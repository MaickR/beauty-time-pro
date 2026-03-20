import type { FastifyRequest, FastifyReply } from 'fastify';
import type { PermisosMaestro } from '../generated/prisma/client.js';
import { prisma } from '../prismaCliente.js';

type CampoPermiso = keyof Pick<
  PermisosMaestro,
  'aprobarSalones' | 'gestionarPagos' | 'crearAdmins' | 'verAuditLog' | 'verMetricas' | 'suspenderSalones'
>;

/**
 * Middleware de permiso granular para rutas de maestro.
 * Si el admin tiene esMaestroTotal=true, se omite la verificación.
 */
export function requierePermiso(campo: CampoPermiso) {
  return async (solicitud: FastifyRequest, respuesta: FastifyReply): Promise<void> => {
    const payload = solicitud.user as { sub?: string; rol?: string } | undefined;

    if (!payload?.sub || payload.rol !== 'maestro') {
      return respuesta.code(403).send({ error: 'Sin acceso' });
    }

    const permisos = await prisma.permisosMaestro.findUnique({
      where: { usuarioId: payload.sub },
    });

    if (!permisos) {
      const totalMaestros = await prisma.usuario.count({ where: { rol: 'maestro' } });
      if (totalMaestros === 1) return;

      return respuesta.code(403).send({
        error: 'No tienes permiso para esta acción',
      });
    }

    if (permisos.esMaestroTotal) return;

    if (!permisos[campo]) {
      return respuesta.code(403).send({ error: 'No tienes permiso para esta acción' });
    }
  };
}
