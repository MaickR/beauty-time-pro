import type { FastifyRequest, FastifyReply } from 'fastify';
import type { PermisosMaestro, PermisosSupervisor } from '../generated/prisma/client.js';
import { prisma } from '../prismaCliente.js';

type CampoPermiso = keyof Pick<
  PermisosMaestro,
  'aprobarSalones' | 'gestionarPagos' | 'crearAdmins' | 'verAuditLog' | 'verMetricas' | 'suspenderSalones'
>;

type CampoPermisoSupervisor = keyof Pick<
  PermisosSupervisor,
  | 'verTotalSalones'
  | 'verControlSalones'
  | 'verReservas'
  | 'verVentas'
  | 'verDirectorio'
  | 'editarDirectorio'
  | 'verControlCobros'
  | 'accionRecordatorio'
  | 'accionRegistroPago'
  | 'accionSuspension'
  | 'activarSalones'
  | 'verPreregistros'
>;

/**
 * Mapeo de permisos maestro a permisos supervisor equivalentes.
 * Un supervisor puede acceder a una ruta protegida por permiso maestro
 * si tiene alguno de los permisos supervisor equivalentes.
 */
const MAPEO_PERMISOS_SUPERVISOR: Record<CampoPermiso, CampoPermisoSupervisor[]> = {
  verMetricas: ['verTotalSalones', 'verReservas', 'verVentas'],
  aprobarSalones: ['verControlSalones', 'activarSalones', 'verPreregistros'],
  gestionarPagos: ['verControlCobros', 'accionRecordatorio', 'accionRegistroPago'],
  suspenderSalones: ['accionSuspension'],
  crearAdmins: [],
  verAuditLog: [],
};

/**
 * Middleware de permiso granular para rutas de maestro.
 * Si el admin tiene esMaestroTotal=true, se omite la verificación.
 * Los supervisores pueden acceder si tienen permisos equivalentes mapeados.
 */
export function requierePermiso(campo: CampoPermiso) {
  return async (solicitud: FastifyRequest, respuesta: FastifyReply): Promise<void> => {
    const payload = solicitud.user as { sub?: string; rol?: string } | undefined;

    if (!payload?.sub) {
      return respuesta.code(403).send({ error: 'Sin acceso' });
    }

    const rolesPermitidos = ['maestro', 'supervisor', 'vendedor'];
    if (!payload.rol || !rolesPermitidos.includes(payload.rol)) {
      return respuesta.code(403).send({ error: 'Sin acceso' });
    }

    // Vendedor no tiene permisos granulares
    if (payload.rol === 'vendedor') {
      return respuesta.code(403).send({ error: 'No tienes permiso para esta acción' });
    }

    if (payload.rol === 'maestro') {
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

      return;
    }

    // Supervisor: verificar permisos equivalentes
    if (payload.rol === 'supervisor') {
      const camposEquivalentes = MAPEO_PERMISOS_SUPERVISOR[campo];

      // Si no hay mapeo, el supervisor no puede acceder a esta funcionalidad
      if (!camposEquivalentes || camposEquivalentes.length === 0) {
        return respuesta.code(403).send({ error: 'No tienes permiso para esta acción' });
      }

      const permisosSup = await prisma.permisosSupervisor.findUnique({
        where: { usuarioId: payload.sub },
      });

      if (!permisosSup) {
        return respuesta.code(403).send({ error: 'No tienes permiso para esta acción' });
      }

      const tieneAlguno = camposEquivalentes.some((c) => permisosSup[c]);
      if (!tieneAlguno) {
        return respuesta.code(403).send({ error: 'No tienes permiso para esta acción' });
      }

      return;
    }
  };
}

/**
 * Middleware de permiso granular específico para supervisores.
 * Solo permite acceso a supervisores (o maestros con acceso total).
 */
export function requierePermisoSupervisor(campo: CampoPermisoSupervisor) {
  return async (solicitud: FastifyRequest, respuesta: FastifyReply): Promise<void> => {
    const payload = solicitud.user as { sub?: string; rol?: string } | undefined;

    if (!payload?.sub) {
      return respuesta.code(403).send({ error: 'Sin acceso' });
    }

    // Maestro con acceso total puede todo
    if (payload.rol === 'maestro') {
      const permisos = await prisma.permisosMaestro.findUnique({
        where: { usuarioId: payload.sub },
      });

      if (permisos?.esMaestroTotal) return;

      // Maestro sin acceso total no tiene permisos de supervisor
      return respuesta.code(403).send({ error: 'No tienes permiso para esta acción' });
    }

    if (payload.rol !== 'supervisor') {
      return respuesta.code(403).send({ error: 'Sin acceso' });
    }

    const permisosSup = await prisma.permisosSupervisor.findUnique({
      where: { usuarioId: payload.sub },
    });

    if (!permisosSup || !permisosSup[campo]) {
      return respuesta.code(403).send({ error: 'No tienes permiso para esta acción' });
    }
  };
}
