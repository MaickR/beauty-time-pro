import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../prismaCliente.js';
import clientePrisma from '../generated/prisma/client.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import { horaOpcionalONulaSchema, obtenerMensajeValidacion, textoSchema } from '../lib/validacion.js';

const { Prisma } = clientePrisma;

const esquemaPersonalBase = {
  nombre: textoSchema('nombre', 80),
  especialidades: z.array(textoSchema('especialidad', 60)).max(20, 'No puedes registrar más de 20 especialidades').optional(),
  activo: z.boolean().optional(),
  horaInicio: horaOpcionalONulaSchema,
  horaFin: horaOpcionalONulaSchema,
  descansoInicio: horaOpcionalONulaSchema,
  descansoFin: horaOpcionalONulaSchema,
  diasTrabajo: z.array(z.number().int().min(0).max(6)).max(7, 'diasTrabajo no puede superar 7 elementos').nullable().optional(),
};

const esquemaCrearPersonal = z.object(esquemaPersonalBase).superRefine((datos, contexto) => {
  if (datos.horaInicio && datos.horaFin && datos.horaInicio >= datos.horaFin) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['horaFin'], message: 'horaFin debe ser posterior a horaInicio' });
  }

  if (datos.descansoInicio && datos.descansoFin && datos.descansoInicio >= datos.descansoFin) {
    contexto.addIssue({ code: z.ZodIssueCode.custom, path: ['descansoFin'], message: 'descansoFin debe ser posterior a descansoInicio' });
  }
});

const esquemaActualizarPersonal = z.object({
  ...esquemaPersonalBase,
  nombre: textoSchema('nombre', 80).optional(),
}).strict().refine((datos) => Object.keys(datos).length > 0, {
  message: 'Debes enviar al menos un campo para actualizar',
});

async function sincronizarNumeroEspecialistas(estudioId: string) {
  const totalPersonal = await prisma.personal.count({
    where: { estudioId },
  });

  await prisma.estudio.update({
    where: { id: estudioId },
    data: { numeroEspecialistas: totalPersonal },
  });
}

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
    Body: { nombre: string; especialidades?: string[]; activo?: boolean; horaInicio?: string | null; horaFin?: string | null; descansoInicio?: string | null; descansoFin?: string | null; diasTrabajo?: number[] | null };
  }>(
    '/estudios/:id/personal',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const { id } = solicitud.params;
      if (payload.rol !== 'maestro' && payload.estudioId !== id) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      const resultado = esquemaCrearPersonal.safeParse(solicitud.body);
      if (!resultado.success) {
        return respuesta.code(400).send({ error: obtenerMensajeValidacion(resultado.error) });
      }

      const { nombre, especialidades, activo, horaInicio, horaFin, descansoInicio, descansoFin, diasTrabajo } = resultado.data;

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
          diasTrabajo: diasTrabajo !== undefined ? (diasTrabajo ?? Prisma.JsonNull) : Prisma.JsonNull,
        },
      });
      await sincronizarNumeroEspecialistas(id);
      return respuesta.code(201).send({ datos: empleado });
    },
  );

  // PUT /personal/:id
  servidor.put<{ Params: { id: string }; Body: { nombre?: string; especialidades?: string[]; activo?: boolean; horaInicio?: string | null; horaFin?: string | null; descansoInicio?: string | null; descansoFin?: string | null; diasTrabajo?: number[] | null } }>(
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

      const resultado = esquemaActualizarPersonal.safeParse(solicitud.body);
      if (!resultado.success) {
        return respuesta.code(400).send({ error: obtenerMensajeValidacion(resultado.error) });
      }

      const datos = resultado.data;

      const actualizado = await prisma.personal.update({
        where: { id: solicitud.params.id },
        data: {
          ...(datos.nombre !== undefined && { nombre: datos.nombre }),
          ...(datos.especialidades !== undefined && { especialidades: datos.especialidades }),
          ...(datos.activo !== undefined && { activo: datos.activo }),
          ...(datos.horaInicio !== undefined && { horaInicio: datos.horaInicio }),
          ...(datos.horaFin !== undefined && { horaFin: datos.horaFin }),
          ...(datos.descansoInicio !== undefined && { descansoInicio: datos.descansoInicio }),
          ...(datos.descansoFin !== undefined && { descansoFin: datos.descansoFin }),
          ...(datos.diasTrabajo !== undefined && { diasTrabajo: datos.diasTrabajo ?? Prisma.JsonNull }),
        },
      });
      await sincronizarNumeroEspecialistas(empleadoExistente.estudioId);
      return respuesta.send({ datos: actualizado });
    },
  );
}
