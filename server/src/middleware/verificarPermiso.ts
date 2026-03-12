import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../prismaCliente.js';

type CampoPermiso =
  | 'aprobarSalones'
  | 'gestionarPagos'
  | 'crearAdmins'
  | 'verAuditLog'
  | 'verMetricas'
  | 'suspenderSalones';

/**
 * Middleware de permiso granular para rutas de maestro.
 * Si el admin tiene esMaestroTotal=true, se omite la verificación.
 */
export function requierePermiso(campo: CampoPermiso) {
  return async (solicitud: FastifyRequest, respuesta: FastifyReply): Promise<void> => {
    const payload = solicitud.user as { sub?: string; rol?: string } | undefined;

    if (!payload?.sub || payload.rol !== 'maestro') {
      return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
    }

    const permisos = await prisma.permisosMaestro.findUnique({
      where: { usuarioId: payload.sub },
    });

    if (!permisos) {
      const totalMaestros = await prisma.usuario.count({ where: { rol: 'maestro' } });
      if (totalMaestros === 1) return;

      return respuesta.code(403).send({
        error: 'Sin permisos configurados. Contacta al administrador.',
      });
    }

    if (permisos.esMaestroTotal) return;

    if (!permisos[campo]) {
      return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
    }
  };
}
