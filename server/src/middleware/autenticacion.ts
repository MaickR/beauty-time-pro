import type { FastifyRequest, FastifyReply } from 'fastify';

export interface PayloadJWT {
  sub: string;
  rol: string;
  estudioId: string | null;
}

export async function verificarJWT(
  solicitud: FastifyRequest,
  respuesta: FastifyReply,
): Promise<void> {
  try {
    await solicitud.jwtVerify();
  } catch {
    await respuesta.code(401).send({ error: 'No autenticado' });
  }
}
