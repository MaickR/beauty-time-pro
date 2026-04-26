import { prisma } from '../prismaCliente.js';
import type { Prisma } from '../generated/prisma/client.js';

interface RegistrarAuditoriaParams {
  usuarioId?: string | null;
  accion: string;
  entidadTipo: string;
  entidadId: string;
  detalles?: Record<string, unknown>;
  ip?: string;
  requestId?: string;
}

export async function registrarAuditoria(params: RegistrarAuditoriaParams): Promise<void> {
  const detallesAuditoria = params.requestId
    ? { ...(params.detalles ?? {}), requestId: params.requestId }
    : params.detalles;

  await prisma.auditLog.create({
    data: {
      usuarioId: params.usuarioId ?? null,
      accion: params.accion,
      entidadTipo: params.entidadTipo,
      entidadId: params.entidadId,
      detalles: detallesAuditoria as Prisma.InputJsonValue | undefined,
      ip: params.ip ?? null,
    },
  });
}
