import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../prismaCliente.js';
import { env } from '../lib/env.js';
import { tieneCookieRefresh } from '../lib/cookiesRefresh.js';
import { obtenerErrorAccesoSalon, salonEstaDisponible } from '../lib/estadoSalon.js';
import { obtenerSesionActiva } from '../lib/sesionesAuth.js';

export interface PayloadJWT {
  sub: string;
  rol: string;
  estudioId: string | null;
  sesionId?: string;
  nombre?: string;
  email?: string;
  personalId?: string;
  forzarCambioContrasena?: boolean;
  esMaestroTotal?: boolean;
  permisos?: {
    aprobarSalones: boolean;
    gestionarPagos: boolean;
    crearAdmins: boolean;
    verAuditLog: boolean;
    verMetricas: boolean;
    suspenderSalones: boolean;
  };
}

// Cuentas fundadoras siempre protegidas (independientemente del env var)
const ADMINS_PROTEGIDOS_POR_DEFECTO = [
  'miguel@salonpromaster.com',
  'mike@salonpromaster.com',
  'msrl.dev420@gmail.com',
];

export function obtenerAdminsProtegidos(): string[] {
  const deEnv = (env.ADMINS_PROTEGIDOS ?? '').split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  const todos = new Set([...ADMINS_PROTEGIDOS_POR_DEFECTO, ...deEnv]);
  return Array.from(todos);
}

export function esEmailAdminProtegido(email: string): boolean {
  return obtenerAdminsProtegidos().includes(email.trim().toLowerCase());
}

export async function verificarJWT(
  solicitud: FastifyRequest,
  respuesta: FastifyReply,
): Promise<void> {
  try {
    await solicitud.jwtVerify();

    const payload = solicitud.user as PayloadJWT;

    if (payload.sesionId) {
      const sesion = await obtenerSesionActiva(payload.sesionId);
      if (!sesion) {
        await respuesta.code(401).send({ error: 'Sesión expirada. Inicia sesión nuevamente.' });
        return;
      }
    }

    if (payload.rol === 'empleado') {
      const acceso = await prisma.empleadoAcceso.findUnique({
        where: { id: payload.sub },
        select: {
          activo: true,
          personal: {
            select: {
              activo: true,
              estudio: {
                select: {
                  activo: true,
                  estado: true,
                },
              },
            },
          },
        },
      });
      if (!acceso) {
        await respuesta.code(401).send({ error: 'No autenticado' });
        return;
      }
      if (!acceso.activo) {
        await respuesta.code(403).send({
          error: 'Tu acceso ha sido revocado',
          codigo: 'ACCESO_REVOCADO',
        });
        return;
      }
      if (!acceso.personal?.activo) {
        await respuesta.code(403).send({
          error: 'Tu perfil de especialista fue dado de baja',
          codigo: 'PERSONAL_INACTIVO',
        });
        return;
      }
      if (!salonEstaDisponible(acceso.personal.estudio ?? {})) {
        const errorSalon = obtenerErrorAccesoSalon(acceso.personal.estudio ?? {});
        await respuesta.code(403).send({
          error: errorSalon.error,
          codigo: errorSalon.codigo,
        });
        return;
      }
      return;
    }

    if (payload.rol === 'cliente') {
      if (payload.estudioId === null) {
        const cliente = await prisma.clienteApp.findUnique({
          where: { id: payload.sub },
          select: { activo: true },
        });

        if (!cliente) {
          await respuesta.code(401).send({ error: 'No autenticado' });
          return;
        }

        if (!cliente.activo) {
          await respuesta.code(403).send({
            error: 'Tu cuenta ha sido desactivada',
            codigo: 'CUENTA_DESACTIVADA',
          });
          return;
        }

        return;
      }

      const estudio = await prisma.estudio.findUnique({
        where: { id: payload.estudioId },
        select: { activo: true, estado: true },
      });

      if (!estudio) {
        await respuesta.code(401).send({ error: 'No autenticado' });
        return;
      }

      if (!salonEstaDisponible(estudio)) {
        const errorSalon = obtenerErrorAccesoSalon(estudio);
        await respuesta.code(403).send({
          error: errorSalon.error,
          codigo: errorSalon.codigo,
        });
        return;
      }

      return;
    }

    if (payload.rol === 'dueno') {
      const usuario = await prisma.usuario.findUnique({
        where: { id: payload.sub },
        select: {
          activo: true,
          estudio: {
            select: {
              activo: true,
              estado: true,
              fechaVencimiento: true,
            },
          },
        },
      });

      if (!usuario) {
        await respuesta.code(401).send({ error: 'No autenticado' });
        return;
      }

      if (!usuario.estudio || !salonEstaDisponible(usuario.estudio)) {
        const errorSalon = obtenerErrorAccesoSalon(usuario.estudio ?? {});
        await respuesta.code(403).send({
          error: errorSalon.error,
          codigo: errorSalon.codigo,
        });
        return;
      }

      if (!usuario.activo) {
        await respuesta.code(403).send({
          error: 'Tu cuenta ha sido suspendida',
          codigo: 'CUENTA_SUSPENDIDA',
        });
        return;
      }

      return;
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: { activo: true },
    });

    if (!usuario) {
      await respuesta.code(401).send({ error: 'No autenticado' });
      return;
    }

    if (!usuario.activo) {
      await respuesta.code(403).send({
        error: 'Tu cuenta ha sido desactivada',
        codigo: 'CUENTA_DESACTIVADA',
      });
      return;
    }
  } catch {
    await respuesta.code(401).send({ error: 'No autenticado' });
  }
}

export async function verificarJWTOpcional(
  solicitud: FastifyRequest,
  respuesta: FastifyReply,
): Promise<void> {
  const cabeceraAuth = solicitud.headers.authorization;
  const tieneRefreshCookie = tieneCookieRefresh(solicitud.cookies);

  if (!cabeceraAuth && !tieneRefreshCookie) {
    return;
  }

  await verificarJWT(solicitud, respuesta);
}
