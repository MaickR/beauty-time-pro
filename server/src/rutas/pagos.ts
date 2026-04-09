import type { FastifyInstance } from 'fastify';
import type { Prisma } from '../generated/prisma/client.js';
import { z } from 'zod';
import { prisma } from '../prismaCliente.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import { requierePermiso } from '../middleware/verificarPermiso.js';
import { registrarAuditoria } from '../utils/auditoria.js';
import { normalizarZonaHorariaEstudio, obtenerFechaISOEnZona } from '../utils/zonasHorarias.js';
import { enviarEmailPagoConfirmado } from '../servicios/servicioEmail.js';
import { asegurarPrecioActualSalon, obtenerPrecioPlanActual, resolverPrecioRenovacion } from '../lib/preciosPlanes.js';

type PaisPago = 'Mexico' | 'Colombia';
type MonedaPago = 'MXN' | 'COP';

const esquemaCrearPago = z.object({
  estudioId: z.string().trim().min(1, 'estudioId es requerido'),
  monto: z.number().int().min(1, 'monto debe ser un entero positivo en centavos').max(1_000_000_000),
  moneda: z.string().trim().optional(),
  concepto: z.string().trim().max(160).optional(),
  fecha: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'fecha debe usar formato YYYY-MM-DD'),
  tipo: z.string().trim().max(60).optional(),
  referencia: z.string().trim().max(120).optional(),
  extenderSuscripcion: z.boolean().optional(),
  meses: z.number().int().min(1).max(24).optional(),
});

function obtenerFechaISOActual(zonaHoraria?: string | null, pais?: string | null): string {
  return obtenerFechaISOEnZona(
    new Date(),
    normalizarZonaHorariaEstudio(zonaHoraria, pais),
    pais,
  );
}

function crearFechaDesdeISO(fechaISO: string): Date {
  const [anio, mes, dia] = fechaISO.split('-').map(Number);
  return new Date(anio!, (mes! - 1), dia!);
}

function formatearFechaISO(fecha: Date): string {
  return fecha.toISOString().split('T')[0]!;
}

function normalizarPais(pais?: string | null): PaisPago {
  return pais === 'Colombia' ? 'Colombia' : 'Mexico';
}

function obtenerMonedaPorPais(pais?: string | null): MonedaPago {
  return normalizarPais(pais) === 'Colombia' ? 'COP' : 'MXN';
}

function esErrorCompatibilidadPago(error: unknown): boolean {
  const codigo =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  const mensaje = error instanceof Error ? error.message : '';

  return codigo === 'P2022' || /Unknown column/i.test(mensaje) || /(tipo|referencia)/i.test(mensaje);
}

async function crearPagoCompat(datos: {
  estudioId: string;
  monto: number;
  moneda: MonedaPago;
  concepto: string;
  fecha: string;
  tipo?: string;
  referencia?: string;
}) {
  try {
    return await prisma.pago.create({
      data: {
        estudioId: datos.estudioId,
        monto: datos.monto,
        moneda: datos.moneda,
        concepto: datos.concepto,
        fecha: datos.fecha,
        tipo: datos.tipo ?? 'suscripcion',
        referencia: datos.referencia ?? null,
      },
    });
  } catch (error) {
    if (!esErrorCompatibilidadPago(error)) {
      throw error;
    }

    return prisma.pago.create({
      data: {
        estudioId: datos.estudioId,
        monto: datos.monto,
        moneda: datos.moneda,
        concepto: datos.concepto,
        fecha: datos.fecha,
      },
    });
  }
}

function calcularNuevaFechaVencimiento(params: {
  fechaVencimiento?: string | null;
  inicioSuscripcion?: string | null;
  meses: number;
  zonaHoraria?: string | null;
  pais?: string | null;
}): {
  fechaBase: string;
  nuevaFechaVencimiento: string;
  estrategia: 'desde_vencimiento_actual' | 'desde_hoy';
} {
  const hoy = obtenerFechaISOActual(params.zonaHoraria, params.pais);
  const fechaReferencia = params.fechaVencimiento || params.inicioSuscripcion || hoy;
  const fechaBase = fechaReferencia >= hoy ? fechaReferencia : hoy;
  const fechaCalculada = crearFechaDesdeISO(fechaBase);
  fechaCalculada.setMonth(fechaCalculada.getMonth() + params.meses);

  return {
    fechaBase,
    nuevaFechaVencimiento: formatearFechaISO(fechaCalculada),
    estrategia: fechaReferencia >= hoy ? 'desde_vencimiento_actual' : 'desde_hoy',
  };
}

async function enriquecerPagos(
  pagos: Array<{
    id: string;
    estudioId: string;
    monto: number;
    moneda: string;
    concepto: string;
    fecha: string;
    referencia: string | null;
    creadoEn: Date;
    estudio: { nombre: string; pais: string };
  }>,
) {
  if (pagos.length === 0) return [];

  const auditorias = await prisma.auditLog.findMany({
    where: {
      entidadTipo: 'pago',
      entidadId: { in: pagos.map((pago) => pago.id) },
    },
    include: {
      usuario: {
        select: { nombre: true, email: true },
      },
    },
    orderBy: { creadoEn: 'desc' },
  });

  const auditoriasPorPago = new Map<string, (typeof auditorias)[number]>();
  auditorias.forEach((auditoria) => {
    if (!auditoriasPorPago.has(auditoria.entidadId)) {
      auditoriasPorPago.set(auditoria.entidadId, auditoria);
    }
  });

  return pagos.map((pago) => {
    const auditoria = auditoriasPorPago.get(pago.id);
    const detalles = (auditoria?.detalles as Record<string, unknown> | null) ?? null;

    return {
      ...pago,
      estudioNombre: pago.estudio.nombre,
      pais: normalizarPais(pago.estudio.pais),
      moneda: obtenerMonedaPorPais(pago.estudio.pais),
      registradoPorNombre: auditoria?.usuario?.nombre ?? (detalles?.['registradoPorNombre'] as string | undefined) ?? null,
      registradoPorEmail: auditoria?.usuario?.email ?? (detalles?.['registradoPorEmail'] as string | undefined) ?? null,
      fechaBaseRenovacion: (detalles?.['fechaBase'] as string | undefined) ?? null,
      nuevaFechaVencimiento: (detalles?.['nuevaFechaVencimiento'] as string | undefined) ?? null,
      estrategiaRenovacion: (detalles?.['estrategia'] as string | undefined) ?? null,
    };
  });
}

export async function rutasPagos(servidor: FastifyInstance): Promise<void> {
  // GET /pagos/todos — solo maestro
  servidor.get(
    '/pagos/todos',
    { preHandler: [verificarJWT, requierePermiso('gestionarPagos')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      const pagos = await prisma.pago.findMany({
        include: { estudio: { select: { nombre: true, pais: true } } },
        orderBy: { creadoEn: 'desc' },
      });
      return respuesta.send({ datos: await enriquecerPagos(pagos) });
    },
  );

  // GET /estudios/:id/pagos — maestro o dueno
  servidor.get<{ Params: { id: string } }>(
    '/estudios/:id/pagos',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const { id } = solicitud.params;
      if (payload.rol !== 'maestro' && payload.estudioId !== id) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      const pagos = await prisma.pago.findMany({
        where: { estudioId: id },
        include: { estudio: { select: { nombre: true, pais: true } } },
        orderBy: { creadoEn: 'desc' },
      });
      return respuesta.send({ datos: await enriquecerPagos(pagos) });
    },
  );

  // POST /pagos — solo maestro puede registrar pagos de suscripción
  servidor.post<{
    Body: {
      estudioId: string;
      monto: number;
      moneda?: string;
      concepto?: string;
      fecha: string;
      tipo?: string;
      referencia?: string;
      extenderSuscripcion?: boolean;
      meses?: number;
    };
  }>('/pagos', { preHandler: [verificarJWT, requierePermiso('gestionarPagos')] }, async (solicitud, respuesta) => {
    const payload = solicitud.user as { rol: string; sub: string; nombre?: string; email?: string };
    if (payload.rol !== 'maestro') {
      return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
    }

    const resultado = esquemaCrearPago.safeParse(solicitud.body);
    if (!resultado.success) {
      return respuesta.code(400).send({ error: resultado.error.issues[0]?.message ?? 'Datos inválidos' });
    }

    const { estudioId, monto, moneda, concepto, fecha, tipo, referencia, extenderSuscripcion, meses } =
      resultado.data;


    let estudio = await prisma.estudio.findUnique({
      where: { id: estudioId },
      select: {
        id: true,
        nombre: true,
        pais: true,
        plan: true,
        zonaHoraria: true,
        fechaVencimiento: true,
        inicioSuscripcion: true,
        estado: true,
        activo: true,
        emailContacto: true,
        propietario: true,
        precioPlanActualId: true,
        precioPlanProximoId: true,
        fechaAplicacionPrecioProximo: true,
        precioPlanActual: {
          select: {
            id: true,
            plan: true,
            pais: true,
            moneda: true,
            monto: true,
            version: true,
            vigenteDesde: true,
          },
        },
        precioPlanProximo: {
          select: {
            id: true,
            plan: true,
            pais: true,
            moneda: true,
            monto: true,
            version: true,
            vigenteDesde: true,
          },
        },
      },
    });

    if (!estudio) {
      return respuesta.code(404).send({ error: 'Salón no encontrado' });
    }

    if (!estudio.precioPlanActual) {
      const precioAsignado = await asegurarPrecioActualSalon({
        estudioId,
        plan: estudio.plan,
        pais: estudio.pais,
      });

      estudio = {
        ...estudio,
        precioPlanActualId: precioAsignado.id,
        precioPlanActual: {
          id: precioAsignado.id,
          plan: precioAsignado.plan,
          pais: precioAsignado.pais,
          moneda: precioAsignado.moneda,
          monto: precioAsignado.monto,
          version: precioAsignado.version,
          vigenteDesde: precioAsignado.vigenteDesde,
        },
      };
    }

    const monedaAplicada = obtenerMonedaPorPais(estudio.pais);
    const mesesAplicados = meses && meses > 0 ? meses : 1;
    const renovacion = extenderSuscripcion
      ? calcularNuevaFechaVencimiento({
          fechaVencimiento: estudio.fechaVencimiento,
          inicioSuscripcion: estudio.inicioSuscripcion,
          meses: mesesAplicados,
          zonaHoraria: estudio.zonaHoraria,
          pais: estudio.pais,
        })
      : null;

    const fechaBaseCobro = renovacion?.fechaBase ?? estudio.fechaVencimiento ?? estudio.inicioSuscripcion ?? fecha;
    const precioFallback = estudio.precioPlanActual ?? await obtenerPrecioPlanActual(estudio.plan, estudio.pais);
    const precioResuelto = resolverPrecioRenovacion(estudio, fechaBaseCobro);
    const precioAplicado = precioResuelto.precioAplicado ?? precioFallback;

    if (!precioAplicado) {
      return respuesta.code(500).send({ error: 'No existe un precio configurado para este salón' });
    }

    const esPagoSuscripcion = extenderSuscripcion || (tipo ?? 'suscripcion') === 'suscripcion';
    const montoAplicado = esPagoSuscripcion ? precioAplicado.monto : monto;

    const pago = await crearPagoCompat({
      estudioId,
      monto: montoAplicado,
      moneda: monedaAplicada,
      concepto: concepto ?? `Suscripción mensual Beauty Time Pro (${monedaAplicada})`,
      fecha,
      tipo,
      referencia,
    });

    const actualizacionEstudio: Prisma.EstudioUncheckedUpdateInput = {};

    if (renovacion) {
      actualizacionEstudio.fechaVencimiento = renovacion.nuevaFechaVencimiento;
    }

    if (precioAplicado.id && (precioResuelto.cambiaEnRenovacion || !estudio.precioPlanActualId)) {
      actualizacionEstudio.precioPlanActualId = precioAplicado.id;
    }

    if (precioResuelto.cambiaEnRenovacion) {
      actualizacionEstudio.precioPlanProximoId = null;
      actualizacionEstudio.fechaAplicacionPrecioProximo = null;
    }

    if (renovacion && estudio.estado === 'suspendido') {
      actualizacionEstudio.estado = 'aprobado';
      actualizacionEstudio.activo = true;
      actualizacionEstudio.fechaSuspension = null;
    }

    if (Object.keys(actualizacionEstudio).length > 0) {
      await prisma.estudio.update({
        where: { id: estudioId },
        data: actualizacionEstudio,
      });
    }

    await registrarAuditoria({
      usuarioId: payload.sub,
      accion: 'registrar_pago',
      entidadTipo: 'pago',
      entidadId: pago.id,
      detalles: {
        estudioId,
        estudioNombre: estudio.nombre,
        montoSolicitado: monto,
        montoAplicado,
        monedaSolicitada: moneda ?? null,
        monedaAplicada,
        precioPlanActualId: estudio.precioPlanActualId,
        precioPlanAplicadoId: precioAplicado.id,
        precioPlanProximoId: estudio.precioPlanProximoId,
        precioCambioEnRenovacion: precioResuelto.cambiaEnRenovacion,
        registradoPorNombre: payload.nombre ?? null,
        registradoPorEmail: payload.email ?? null,
        fechaBase: fechaBaseCobro,
        nuevaFechaVencimiento: renovacion?.nuevaFechaVencimiento ?? null,
        estrategia: renovacion?.estrategia ?? null,
      },
      ip: solicitud.ip,
    });

    // Si el salón estaba suspendido y se extendió la suscripción, reactivar automáticamente
    if (renovacion && estudio.estado === 'suspendido') {
      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'reactivar_salon_por_pago',
        entidadTipo: 'estudio',
        entidadId: estudioId,
        detalles: {
          estudioNombre: estudio.nombre,
          nuevaFechaVencimiento: renovacion.nuevaFechaVencimiento,
        },
        ip: solicitud.ip,
      });
    }

    // Crear notificación in-app de pago confirmado
    if (renovacion) {
      try {
        await prisma.notificacionEstudio.create({
          data: {
            estudioId,
            tipo: 'pago_confirmado',
            titulo: 'Pago confirmado',
            mensaje: `Tu suscripción está activa hasta el ${renovacion.nuevaFechaVencimiento}.`,
          },
        });
      } catch (errNotif) {
        solicitud.log.warn({ err: errNotif, estudioId }, 'No se pudo crear notificación de pago confirmado');
      }
    }

    // Enviar email de confirmación al dueño del salón
    if (renovacion && estudio.emailContacto) {
      try {
        await enviarEmailPagoConfirmado({
          email: estudio.emailContacto,
          nombreDueno: estudio.propietario ?? estudio.nombre,
          nombreSalon: estudio.nombre,
          nuevaFechaVencimiento: renovacion.nuevaFechaVencimiento,
        });
      } catch (errEmail) {
        solicitud.log.warn({ err: errEmail, estudioId }, 'No se pudo enviar email de confirmación de pago');
      }
    }

    return respuesta.code(201).send({
      datos: {
        ...pago,
        pais: normalizarPais(estudio.pais),
        moneda: monedaAplicada,
        monto: montoAplicado,
        estudioNombre: estudio.nombre,
        registradoPorNombre: payload.nombre ?? null,
        registradoPorEmail: payload.email ?? null,
        fechaBaseRenovacion: renovacion?.fechaBase ?? null,
        nuevaFechaVencimiento: renovacion?.nuevaFechaVencimiento ?? null,
        estrategiaRenovacion: renovacion?.estrategia ?? null,
        precioPlanIdAplicado: precioAplicado.id,
      },
    });
  });
}
