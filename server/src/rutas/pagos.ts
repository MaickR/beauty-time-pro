import type { FastifyInstance } from 'fastify';
import type { Prisma } from '../generated/prisma/client.js';
import { z } from 'zod';
import { prisma } from '../prismaCliente.js';
import { construirSelectDesdeColumnas, obtenerColumnasTabla, obtenerTablasDisponibles } from '../lib/compatibilidadEsquema.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import { requierePermiso } from '../middleware/verificarPermiso.js';
import { tieneAccesoAdministrativoEstudio } from '../lib/accesoEstudio.js';
import { revocarSesionesPorSujeto } from '../lib/sesionesAuth.js';
import { registrarAuditoria } from '../utils/auditoria.js';
import { normalizarZonaHorariaEstudio, obtenerFechaISOEnZona } from '../utils/zonasHorarias.js';
import { enviarEmailPagoConfirmado } from '../servicios/servicioEmail.js';
import { asegurarPrecioActualSalon, obtenerPrecioPlanActual, resolverPrecioRenovacion } from '../lib/preciosPlanes.js';

type PaisPago = 'Mexico' | 'Colombia';
type MonedaPago = 'MXN' | 'COP';

interface PrecioPlanLigeroPago {
  id: string;
  plan: 'STANDARD' | 'PRO';
  pais: string;
  moneda: string;
  monto: number;
  version: number;
  vigenteDesde: Date;
}

interface EstudioPagoCompat {
  id: string;
  nombre: string;
  pais: string;
  plan: 'STANDARD' | 'PRO';
  zonaHoraria: string | null;
  fechaVencimiento: string | null;
  inicioSuscripcion: string | null;
  estado: string;
  activo: boolean;
  emailContacto: string | null;
  propietario: string | null;
  precioPlanActualId: string | null;
  precioPlanProximoId: string | null;
  fechaAplicacionPrecioProximo: string | null;
  precioPlanActual: PrecioPlanLigeroPago | null;
  precioPlanProximo: PrecioPlanLigeroPago | null;
  columnas: {
    precioPlanActualId: boolean;
    precioPlanProximoId: boolean;
    fechaAplicacionPrecioProximo: boolean;
    fechaSuspension: boolean;
    estado: boolean;
    activo: boolean;
    fechaVencimiento: boolean;
  };
}

interface PagoListadoCompat {
  id: string;
  estudioId: string;
  monto: number;
  moneda: string;
  concepto: string;
  fecha: string;
  referencia: string | null;
  creadoEn: Date;
  estudio: {
    nombre: string;
    pais: string;
  };
}

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

function esErrorCompatibilidadEstudio(error: unknown): boolean {
  const codigo =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  const mensaje = error instanceof Error ? error.message : '';

  return (
    codigo === 'P2022' ||
    /Unknown column/i.test(mensaje) ||
    /(precioPlanActualId|precioPlanProximoId|fechaAplicacionPrecioProximo|fechaSuspension|fechaBloqueo|motivoBloqueo)/i.test(mensaje)
  );
}

async function listarPagosCompat(where?: Prisma.PagoWhereInput): Promise<PagoListadoCompat[]> {
  const [columnasPagos, columnasEstudios] = await Promise.all([
    obtenerColumnasTabla('pagos'),
    obtenerColumnasTabla('estudios'),
  ]);

  const seleccionPago = construirSelectDesdeColumnas(columnasPagos, [
    'id',
    'estudioId',
    'monto',
    'moneda',
    'concepto',
    'fecha',
    'referencia',
    'creadoEn',
  ]);

  const seleccionEstudio = construirSelectDesdeColumnas(columnasEstudios, ['nombre', 'pais']);
  const orden = columnasPagos.has('creadoEn')
    ? ({ creadoEn: 'desc' } as Prisma.PagoOrderByWithRelationInput)
    : ({ fecha: 'desc' } as Prisma.PagoOrderByWithRelationInput);

  const pagosCrudos = (await prisma.pago.findMany({
    ...(where ? { where } : {}),
    orderBy: orden,
    select: {
      ...(seleccionPago as Prisma.PagoSelect),
      estudio: {
        select: seleccionEstudio as Prisma.EstudioSelect,
      },
    },
  })) as Array<Record<string, unknown>>;

  return pagosCrudos
    .map((pago) => {
      const estudio =
        typeof pago['estudio'] === 'object' && pago['estudio'] !== null
          ? (pago['estudio'] as Record<string, unknown>)
          : {};
      const creadoEnRaw = pago['creadoEn'];
      const creadoEn =
        creadoEnRaw instanceof Date
          ? creadoEnRaw
          : typeof creadoEnRaw === 'string'
            ? new Date(creadoEnRaw)
            : new Date();

      return {
        id: typeof pago['id'] === 'string' ? pago['id'] : '',
        estudioId: typeof pago['estudioId'] === 'string' ? pago['estudioId'] : '',
        monto: typeof pago['monto'] === 'number' ? pago['monto'] : 0,
        moneda: typeof pago['moneda'] === 'string' ? pago['moneda'] : 'MXN',
        concepto: typeof pago['concepto'] === 'string' ? pago['concepto'] : 'Suscripción mensual Beauty Time Pro',
        fecha: typeof pago['fecha'] === 'string' ? pago['fecha'] : obtenerFechaISOActual(),
        referencia: typeof pago['referencia'] === 'string' ? pago['referencia'] : null,
        creadoEn,
        estudio: {
          nombre: typeof estudio['nombre'] === 'string' ? estudio['nombre'] : 'Salón',
          pais: typeof estudio['pais'] === 'string' ? estudio['pais'] : 'Mexico',
        },
      };
    })
    .filter((pago) => pago.id.length > 0 && pago.estudioId.length > 0);
}

async function obtenerPrecioPorIdCompat(precioId: string): Promise<PrecioPlanLigeroPago | null> {
  try {
    const precio = await prisma.precioPlan.findUnique({
      where: { id: precioId },
      select: {
        id: true,
        plan: true,
        pais: true,
        moneda: true,
        monto: true,
        version: true,
        vigenteDesde: true,
      },
    });

    if (!precio) {
      return null;
    }

    return {
      id: precio.id,
      plan: precio.plan,
      pais: precio.pais,
      moneda: precio.moneda,
      monto: precio.monto,
      version: precio.version,
      vigenteDesde: precio.vigenteDesde,
    };
  } catch (error) {
    if (!esErrorCompatibilidadEstudio(error)) {
      throw error;
    }
    return null;
  }
}

async function obtenerEstudioCompatParaPago(estudioId: string): Promise<EstudioPagoCompat | null> {
  const [columnasEstudios, tablas] = await Promise.all([
    obtenerColumnasTabla('estudios'),
    obtenerTablasDisponibles(),
  ]);

  const seleccionEstudio = construirSelectDesdeColumnas(columnasEstudios, [
    'id',
    'nombre',
    'pais',
    'plan',
    'zonaHoraria',
    'fechaVencimiento',
    'inicioSuscripcion',
    'estado',
    'activo',
    'emailContacto',
    'propietario',
    'precioPlanActualId',
    'precioPlanProximoId',
    'fechaAplicacionPrecioProximo',
  ]);

  const registro = (await prisma.estudio.findUnique({
    where: { id: estudioId },
    select: seleccionEstudio as Prisma.EstudioSelect,
  })) as Record<string, unknown> | null;

  if (!registro) {
    return null;
  }

  const puedeConsultarPrecios = tablas.has('precios_plan');
  const precioPlanActualId =
    columnasEstudios.has('precioPlanActualId') && typeof registro['precioPlanActualId'] === 'string'
      ? registro['precioPlanActualId']
      : null;
  const precioPlanProximoId =
    columnasEstudios.has('precioPlanProximoId') && typeof registro['precioPlanProximoId'] === 'string'
      ? registro['precioPlanProximoId']
      : null;

  const [precioPlanActual, precioPlanProximo] = puedeConsultarPrecios
    ? await Promise.all([
        precioPlanActualId ? obtenerPrecioPorIdCompat(precioPlanActualId) : Promise.resolve(null),
        precioPlanProximoId ? obtenerPrecioPorIdCompat(precioPlanProximoId) : Promise.resolve(null),
      ])
    : [null, null];

  return {
    id: typeof registro['id'] === 'string' ? registro['id'] : estudioId,
    nombre: typeof registro['nombre'] === 'string' ? registro['nombre'] : 'Salón',
    pais: typeof registro['pais'] === 'string' ? registro['pais'] : 'Mexico',
    plan: registro['plan'] === 'PRO' ? 'PRO' : 'STANDARD',
    zonaHoraria: typeof registro['zonaHoraria'] === 'string' ? registro['zonaHoraria'] : null,
    fechaVencimiento:
      typeof registro['fechaVencimiento'] === 'string' ? registro['fechaVencimiento'] : null,
    inicioSuscripcion:
      typeof registro['inicioSuscripcion'] === 'string' ? registro['inicioSuscripcion'] : null,
    estado: typeof registro['estado'] === 'string' ? registro['estado'] : 'aprobado',
    activo: typeof registro['activo'] === 'boolean' ? registro['activo'] : true,
    emailContacto: typeof registro['emailContacto'] === 'string' ? registro['emailContacto'] : null,
    propietario: typeof registro['propietario'] === 'string' ? registro['propietario'] : null,
    precioPlanActualId,
    precioPlanProximoId,
    fechaAplicacionPrecioProximo:
      typeof registro['fechaAplicacionPrecioProximo'] === 'string'
        ? registro['fechaAplicacionPrecioProximo']
        : null,
    precioPlanActual,
    precioPlanProximo,
    columnas: {
      precioPlanActualId: columnasEstudios.has('precioPlanActualId') && puedeConsultarPrecios,
      precioPlanProximoId: columnasEstudios.has('precioPlanProximoId') && puedeConsultarPrecios,
      fechaAplicacionPrecioProximo:
        columnasEstudios.has('fechaAplicacionPrecioProximo') && puedeConsultarPrecios,
      fechaSuspension: columnasEstudios.has('fechaSuspension'),
      estado: columnasEstudios.has('estado'),
      activo: columnasEstudios.has('activo'),
      fechaVencimiento: columnasEstudios.has('fechaVencimiento'),
    },
  };
}

async function actualizarEstudioCompatParaPago(
  estudioId: string,
  cambios: Prisma.EstudioUncheckedUpdateInput,
): Promise<void> {
  const entradas = Object.entries(cambios).filter(([, valor]) => valor !== undefined);
  if (entradas.length === 0) {
    return;
  }

  const payload = Object.fromEntries(entradas);

  try {
    await prisma.estudio.update({
      where: { id: estudioId },
      data: payload,
      select: { id: true },
    });
    return;
  } catch (error) {
    if (!esErrorCompatibilidadEstudio(error)) {
      throw error;
    }
  }

  const columnasSql = entradas.map(([campo]) => `\`${campo}\` = ?`);
  const valoresSql = entradas.map(([, valor]) =>
    typeof valor === 'boolean' ? (valor ? 1 : 0) : valor,
  );

  await prisma.$executeRawUnsafe(
    `UPDATE estudios SET ${columnasSql.join(', ')} WHERE id = ?`,
    ...valoresSql,
    estudioId,
  );
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
      const pagos = await listarPagosCompat();
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
      if (!tieneAccesoAdministrativoEstudio(payload, id)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      const pagos = await listarPagosCompat({ estudioId: id });
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


    let estudio = await obtenerEstudioCompatParaPago(estudioId);

    if (!estudio) {
      return respuesta.code(404).send({ error: 'Salón no encontrado' });
    }

    if (!estudio.precioPlanActual && estudio.columnas.precioPlanActualId) {
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
    const precioResuelto = resolverPrecioRenovacion(
      {
        fechaVencimiento: estudio.fechaVencimiento ?? fechaBaseCobro,
        fechaAplicacionPrecioProximo: estudio.fechaAplicacionPrecioProximo,
        precioPlanActual: estudio.precioPlanActual,
        precioPlanProximo: estudio.precioPlanProximo,
      },
      fechaBaseCobro,
    );
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

    if (renovacion && estudio.columnas.fechaVencimiento) {
      actualizacionEstudio.fechaVencimiento = renovacion.nuevaFechaVencimiento;
    }

    if (
      estudio.columnas.precioPlanActualId &&
      precioAplicado.id &&
      (precioResuelto.cambiaEnRenovacion || !estudio.precioPlanActualId)
    ) {
      actualizacionEstudio.precioPlanActualId = precioAplicado.id;
    }

    if (precioResuelto.cambiaEnRenovacion) {
      if (estudio.columnas.precioPlanProximoId) {
        actualizacionEstudio.precioPlanProximoId = null;
      }
      if (estudio.columnas.fechaAplicacionPrecioProximo) {
        actualizacionEstudio.fechaAplicacionPrecioProximo = null;
      }
    }

    if (renovacion && estudio.estado === 'suspendido') {
      if (estudio.columnas.estado) {
        actualizacionEstudio.estado = 'aprobado';
      }
      if (estudio.columnas.activo) {
        actualizacionEstudio.activo = true;
      }
      if (estudio.columnas.fechaSuspension) {
        actualizacionEstudio.fechaSuspension = null;
      }
    }

    const reactivarDuenoPorPago = renovacion && estudio.estado === 'suspendido';

    if (Object.keys(actualizacionEstudio).length > 0 || reactivarDuenoPorPago) {
      if (Object.keys(actualizacionEstudio).length > 0) {
        await actualizarEstudioCompatParaPago(estudioId, actualizacionEstudio);
      }

      if (reactivarDuenoPorPago) {
        const columnasUsuarios = await obtenerColumnasTabla('usuarios');
        if (columnasUsuarios.has('activo')) {
          try {
            await prisma.usuario.updateMany({
              where: { estudioId, ...(columnasUsuarios.has('rol') ? { rol: 'dueno' } : {}) },
              data: { activo: true },
            });
          } catch (errorActualizarUsuario) {
            await prisma.$executeRawUnsafe(
              `UPDATE usuarios SET activo = 1 WHERE estudioId = ?${columnasUsuarios.has('rol') ? " AND rol = 'dueno'" : ''}`,
              estudioId,
            );
            solicitud.log.warn(
              { err: errorActualizarUsuario, estudioId },
              'No se pudo reactivar dueño con Prisma; se aplicó SQL directo',
            );
          }
        }
      }
    }

    await registrarAuditoria({
      usuarioId: payload.sub,
      accion: 'registrar_pago',
      entidadTipo: 'pago',
      entidadId: pago.id,
      detalles: {
        requestId: solicitud.id,
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
        antes: {
          estado: estudio.estado,
          activo: estudio.activo,
          fechaVencimiento: estudio.fechaVencimiento,
          precioPlanActualId: estudio.precioPlanActualId,
          precioPlanProximoId: estudio.precioPlanProximoId,
        },
        despues: {
          estado: actualizacionEstudio.estado ?? estudio.estado,
          activo: actualizacionEstudio.activo ?? estudio.activo,
          fechaVencimiento: actualizacionEstudio.fechaVencimiento ?? estudio.fechaVencimiento,
          precioPlanActualId: actualizacionEstudio.precioPlanActualId ?? estudio.precioPlanActualId,
          precioPlanProximoId: actualizacionEstudio.precioPlanProximoId ?? estudio.precioPlanProximoId,
        },
      },
      ip: solicitud.ip,
    });

    // Si el salón estaba suspendido y se extendió la suscripción, reactivar automáticamente
    if (renovacion && estudio.estado === 'suspendido') {
      const duenos = await prisma.usuario.findMany({
        where: { estudioId, rol: 'dueno' },
        select: { id: true },
      });

      await Promise.all(
        duenos.map((dueno) =>
          revocarSesionesPorSujeto('usuario', dueno.id, 'salon_reactivado_por_pago')
        ),
      );

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'reactivar_salon_por_pago',
        entidadTipo: 'estudio',
        entidadId: estudioId,
        detalles: {
          requestId: solicitud.id,
          estudioNombre: estudio.nombre,
          nuevaFechaVencimiento: renovacion.nuevaFechaVencimiento,
          usuariosReactivados: duenos.length,
          antes: {
            estado: estudio.estado,
            activo: estudio.activo,
          },
          despues: {
            estado: 'aprobado',
            activo: true,
          },
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
