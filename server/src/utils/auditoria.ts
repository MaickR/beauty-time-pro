import { prisma } from '../prismaCliente.js';
import type { Prisma } from '../generated/prisma/client.js';

interface RegistrarAuditoriaParams {
  usuarioId: string;
  accion: string;
  entidadTipo: string;
  entidadId: string;
  detalles?: Record<string, unknown>;
  ip?: string;
}

export async function registrarAuditoria(params: RegistrarAuditoriaParams): Promise<void> {
  await prisma.auditLog.create({
    data: {
      usuarioId: params.usuarioId,
      accion: params.accion,
      entidadTipo: params.entidadTipo,
      entidadId: params.entidadId,
      detalles: params.detalles as Prisma.InputJsonValue | undefined,
      ip: params.ip ?? null,
    },
  });
}
