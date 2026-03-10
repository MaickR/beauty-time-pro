import type { FastifyInstance } from 'fastify';
import { prisma } from '../prismaCliente.js';
import { verificarJWT } from '../middleware/autenticacion.js';

export async function rutasPagos(servidor: FastifyInstance): Promise<void> {
  // GET /pagos/todos — solo maestro
  servidor.get(
    '/pagos/todos',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      const pagos = await prisma.pago.findMany({
        orderBy: { creadoEn: 'desc' },
      });
      return respuesta.send({ datos: pagos });
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
        orderBy: { creadoEn: 'desc' },
      });
      return respuesta.send({ datos: pagos });
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
    };
  }>('/pagos', { preHandler: verificarJWT }, async (solicitud, respuesta) => {
    const payload = solicitud.user as { rol: string };
    if (payload.rol !== 'maestro') {
      return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
    }
    const { estudioId, monto, moneda, concepto, fecha, tipo, referencia, extenderSuscripcion } =
      solicitud.body;

    if (!estudioId || !monto || !fecha) {
      return respuesta.code(400).send({ error: 'Campos requeridos: estudioId, monto, fecha' });
    }

    const pago = await prisma.pago.create({
      data: {
        estudioId,
        monto,
        moneda: moneda ?? 'MXN',
        concepto: concepto ?? 'Suscripción mensual',
        fecha,
        tipo: tipo ?? 'suscripcion',
        referencia: referencia ?? null,
      },
    });

    // Si se indica extenderSuscripcion, actualiza la fecha de vencimiento del estudio
    if (extenderSuscripcion) {
      const estudio = await prisma.estudio.findUnique({
        where: { id: estudioId },
        select: { fechaVencimiento: true, inicioSuscripcion: true },
      });
      if (estudio) {
        const baseStr = estudio.fechaVencimiento || estudio.inicioSuscripcion;
        const partes = baseStr.split('-').map(Number);
        const fechaBase = new Date(partes[0]!, (partes[1]! - 1), partes[2]!);
        fechaBase.setMonth(fechaBase.getMonth() + 1);
        const nuevaFecha = fechaBase.toISOString().split('T')[0]!;
        await prisma.estudio.update({
          where: { id: estudioId },
          data: { fechaVencimiento: nuevaFecha },
        });
      }
    }

    return respuesta.code(201).send({ datos: pago });
  });
}
