import type { FastifyInstance } from 'fastify';
import { prisma } from '../prismaCliente.js';
import { Prisma } from '../generated/prisma/client.js';
import { verificarJWT } from '../middleware/autenticacion.js';

export async function rutasPersonal(servidor: FastifyInstance): Promise<void> {
  // GET /estudios/:id/personal
  servidor.get<{ Params: { id: string } }>(
    '/estudios/:id/personal',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const { id } = solicitud.params;
      if (payload.rol !== 'maestro' && payload.estudioId !== id) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      const personal = await prisma.personal.findMany({
        where: { estudioId: id },
        orderBy: { creadoEn: 'asc' },
      });
      return respuesta.send({ datos: personal });
    },
  );

  // POST /estudios/:id/personal
  servidor.post<{
    Params: { id: string };
    Body: { nombre: string; especialidades?: string[]; activo?: boolean; horaInicio?: string; horaFin?: string; descansoInicio?: string; descansoFin?: string; diasTrabajo?: number[] };
  }>(
    '/estudios/:id/personal',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const { id } = solicitud.params;
      if (payload.rol !== 'maestro' && payload.estudioId !== id) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      const { nombre, especialidades, activo, horaInicio, horaFin, descansoInicio, descansoFin, diasTrabajo } =
        solicitud.body;
      if (!nombre) {
        return respuesta.code(400).send({ error: 'nombre es requerido' });
      }
      const empleado = await prisma.personal.create({
        data: {
          estudioId: id,
          nombre,
          especialidades: especialidades ?? [],
          activo: activo ?? true,
          horaInicio: horaInicio ?? null,
          horaFin: horaFin ?? null,
          descansoInicio: descansoInicio ?? null,
          descansoFin: descansoFin ?? null,
          diasTrabajo: diasTrabajo !== undefined ? diasTrabajo : Prisma.DbNull,
        },
      });
      return respuesta.code(201).send({ datos: empleado });
    },
  );

  // PUT /personal/:id
  servidor.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/personal/:id',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const empleadoExistente = await prisma.personal.findUnique({
        where: { id: solicitud.params.id },
        select: { estudioId: true },
      });
      if (!empleadoExistente) return respuesta.code(404).send({ error: 'Personal no encontrado' });
      if (payload.rol !== 'maestro' && payload.estudioId !== empleadoExistente.estudioId) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      const actualizado = await prisma.personal.update({
        where: { id: solicitud.params.id },
        data: solicitud.body as Parameters<typeof prisma.personal.update>[0]['data'],
      });
      return respuesta.send({ datos: actualizado });
    },
  );
}
