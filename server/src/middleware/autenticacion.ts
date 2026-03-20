import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../prismaCliente.js';
import { env } from '../lib/env.js';

export interface PayloadJWT {
  sub: string;
  rol: string;
  estudioId: string | null;
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

export function obtenerAdminsProtegidos(): string[] {
  return (env.ADMINS_PROTEGIDOS ?? '').split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
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

    if (payload.rol === 'empleado') {
      const acceso = await prisma.empleadoAcceso.findUnique({
        where: { id: payload.sub },
        select: { activo: true },
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
      return;
    }

    if (payload.rol === 'cliente') {
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

    if (payload.rol === 'dueno') {
      const usuario = await prisma.usuario.findUnique({
        where: { id: payload.sub },
        select: {
          activo: true,
          estudio: {
            select: {
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

      if (usuario.estudio?.estado === 'suspendido') {
        await respuesta.code(403).send({
          error: 'Tu salón está suspendido',
          codigo: 'SALON_SUSPENDIDO',
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
  const tieneRefreshCookie = Boolean(solicitud.cookies?.refresh_token);

  if (!cabeceraAuth && !tieneRefreshCookie) {
    return;
  }

  await verificarJWT(solicitud, respuesta);
}
