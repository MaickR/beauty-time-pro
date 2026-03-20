import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { env } from '../lib/env.js';
import { prisma } from '../prismaCliente.js';
import { verificarJWT, type PayloadJWT } from '../middleware/autenticacion.js';

const esquemaSuscripcionPush = z.object({
  endpoint: z.string().url('Endpoint inválido'),
  keys: z.object({
    p256dh: z.string().min(1, 'Clave p256dh requerida'),
    auth: z.string().min(1, 'Clave auth requerida'),
  }),
});

const esquemaCancelarPush = z.object({
  endpoint: z.string().url('Endpoint inválido'),
});

function obtenerContextoSuscripcion(payload: PayloadJWT) {
  if (payload.rol === 'dueno') {
    return { tipo: 'dueno' as const, usuarioId: payload.sub, clienteId: null };
  }

  if (payload.rol === 'cliente' && payload.estudioId === null) {
    return { tipo: 'cliente' as const, usuarioId: null, clienteId: payload.sub };
  }

  return null;
}

export async function rutasPush(servidor: FastifyInstance): Promise<void> {
  servidor.get('/push/clave-publica', async (_solicitud, respuesta) => {
    return respuesta.send({ clavePublica: env.VAPID_PUBLIC_KEY });
  });

  servidor.post<{ Body: { endpoint: string; keys: { p256dh: string; auth: string } } }>(
    '/push/suscribir',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as PayloadJWT;
      const contexto = obtenerContextoSuscripcion(payload);
      if (!contexto) {
        return respuesta
          .code(403)
          .send({ error: 'Esta sesión no puede suscribirse a notificaciones push' });
      }

      const resultado = esquemaSuscripcionPush.safeParse(solicitud.body);
      if (!resultado.success) {
        return respuesta
          .code(400)
          .send({ error: resultado.error.issues[0]?.message ?? 'Suscripción inválida' });
      }

      const { endpoint, keys } = resultado.data;

      const suscripcion = await prisma.suscripcionPush.upsert({
        where: { endpoint },
        create: {
          endpoint,
          p256dh: keys.p256dh,
          auth: keys.auth,
          tipo: contexto.tipo,
          usuarioId: contexto.usuarioId,
          clienteId: contexto.clienteId,
          activa: true,
        },
        update: {
          p256dh: keys.p256dh,
          auth: keys.auth,
          tipo: contexto.tipo,
          usuarioId: contexto.usuarioId,
          clienteId: contexto.clienteId,
          activa: true,
        },
      });

      return respuesta.code(201).send({ datos: { id: suscripcion.id, activa: suscripcion.activa } });
    },
  );

  servidor.delete<{ Body: { endpoint: string } }>(
    '/push/cancelar',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as PayloadJWT;
      const contexto = obtenerContextoSuscripcion(payload);
      if (!contexto) {
        return respuesta
          .code(403)
          .send({ error: 'Esta sesión no puede cancelar notificaciones push' });
      }

      const resultado = esquemaCancelarPush.safeParse(solicitud.body);
      if (!resultado.success) {
        return respuesta
          .code(400)
          .send({ error: resultado.error.issues[0]?.message ?? 'Solicitud inválida' });
      }

      const where = contexto.tipo === 'dueno'
        ? { endpoint: resultado.data.endpoint, usuarioId: contexto.usuarioId }
        : { endpoint: resultado.data.endpoint, clienteId: contexto.clienteId };

      await prisma.suscripcionPush.deleteMany({ where });

      return respuesta.send({ datos: { cancelada: true } });
    },
  );
}
