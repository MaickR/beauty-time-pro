import type { FastifyRequest, FastifyReply } from 'fastify';
import { prisma } from '../prismaCliente.js';
import { env } from '../lib/env.js';

export interface PayloadJWT {
  sub: string;
  rol: string;
  estudioId: string | null;
  nombre?: string;
  email?: string;
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

    if (payload.rol === 'cliente') {
      const cliente = await prisma.clienteApp.findUnique({
        where: { id: payload.sub },
        select: { activo: true },
      });

      if (cliente && !cliente.activo) {
        await respuesta.code(403).send({ error: 'Tu cuenta ha sido desactivada. Contacta al administrador principal.' });
      }

      return;
    }

    const usuario = await prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: { activo: true },
    });

    if (usuario && !usuario.activo) {
      await respuesta.code(403).send({ error: 'Tu cuenta ha sido desactivada. Contacta al administrador principal.' });
    }
  } catch {
    await respuesta.code(401).send({ error: 'No autenticado' });
  }
}
