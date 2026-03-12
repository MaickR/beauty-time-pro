import type { FastifyInstance } from 'fastify';
import { prisma } from '../prismaCliente.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import { requierePermiso } from '../middleware/verificarPermiso.js';
import { registrarAuditoria } from '../utils/auditoria.js';

type PaisPago = 'Mexico' | 'Colombia';
type MonedaPago = 'MXN' | 'COP';

function obtenerFechaISOActual(): string {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return hoy.toISOString().split('T')[0]!;
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

function calcularNuevaFechaVencimiento(params: {
  fechaVencimiento?: string | null;
  inicioSuscripcion?: string | null;
  meses: number;
}): {
  fechaBase: string;
  nuevaFechaVencimiento: string;
  estrategia: 'desde_vencimiento_actual' | 'desde_hoy';
} {
  const hoy = obtenerFechaISOActual();
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
      registradoPorNombre: auditoria?.usuario.nombre ?? (detalles?.['registradoPorNombre'] as string | undefined) ?? null,
      registradoPorEmail: auditoria?.usuario.email ?? (detalles?.['registradoPorEmail'] as string | undefined) ?? null,
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
    const { estudioId, monto, moneda, concepto, fecha, tipo, referencia, extenderSuscripcion, meses } =
      solicitud.body;

    if (!estudioId || !monto || !fecha) {
      return respuesta.code(400).send({ error: 'Campos requeridos: estudioId, monto, fecha' });
    }

    const estudio = await prisma.estudio.findUnique({
      where: { id: estudioId },
      select: {
        id: true,
        nombre: true,
        pais: true,
        fechaVencimiento: true,
        inicioSuscripcion: true,
      },
    });

    if (!estudio) {
      return respuesta.code(404).send({ error: 'Salón no encontrado' });
    }

    const monedaAplicada = obtenerMonedaPorPais(estudio.pais);
    const mesesAplicados = meses && meses > 0 ? meses : 1;
    const renovacion = extenderSuscripcion
      ? calcularNuevaFechaVencimiento({
          fechaVencimiento: estudio.fechaVencimiento,
          inicioSuscripcion: estudio.inicioSuscripcion,
          meses: mesesAplicados,
        })
      : null;

    const pago = await prisma.pago.create({
      data: {
        estudioId,
        monto,
        moneda: monedaAplicada,
        concepto: concepto ?? `Suscripción mensual Beauty Time Pro (${monedaAplicada})`,
        fecha,
        tipo: tipo ?? 'suscripcion',
        referencia: referencia ?? null,
      },
    });

    if (renovacion) {
      await prisma.estudio.update({
        where: { id: estudioId },
        data: { fechaVencimiento: renovacion.nuevaFechaVencimiento },
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
        monto,
        monedaSolicitada: moneda ?? null,
        monedaAplicada,
        registradoPorNombre: payload.nombre ?? null,
        registradoPorEmail: payload.email ?? null,
        fechaBase: renovacion?.fechaBase ?? null,
        nuevaFechaVencimiento: renovacion?.nuevaFechaVencimiento ?? null,
        estrategia: renovacion?.estrategia ?? null,
      },
      ip: solicitud.ip,
    });

    return respuesta.code(201).send({
      datos: {
        ...pago,
        pais: normalizarPais(estudio.pais),
        moneda: monedaAplicada,
        estudioNombre: estudio.nombre,
        registradoPorNombre: payload.nombre ?? null,
        registradoPorEmail: payload.email ?? null,
        fechaBaseRenovacion: renovacion?.fechaBase ?? null,
        nuevaFechaVencimiento: renovacion?.nuevaFechaVencimiento ?? null,
        estrategiaRenovacion: renovacion?.estrategia ?? null,
      },
    });
  });
}
