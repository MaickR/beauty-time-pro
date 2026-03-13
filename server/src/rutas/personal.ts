import type { FastifyInstance } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { prisma } from '../prismaCliente.js';
import { Prisma } from '../generated/prisma/client.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import { horaOpcionalONulaSchema, obtenerMensajeValidacion, textoSchema } from '../lib/validacion.js';
import { detectarTipoImagen } from '../utils/validarImagen.js';

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
      const payload = solicitud.user as { sub: string; rol: string; estudioId: string | null };
      const { id } = solicitud.params;
      if (payload.rol !== 'maestro' && payload.estudioId !== id) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      if (payload.rol === 'dueno') {
        const estudio = await prisma.estudio.findFirst({
          where: {
            id,
            usuarios: { some: { id: payload.sub, rol: 'dueno' } },
          },
          select: { id: true },
        });
        if (!estudio) {
          return respuesta.code(403).send({ error: 'Sin acceso a este recurso' });
        }
      }
      const resultado = esquemaCrearPersonal.safeParse(solicitud.body);
      if (!resultado.success) {
        return respuesta.code(400).send({ error: obtenerMensajeValidacion(resultado.error) });
      }

      // Verificar límite de especialistas activos (50 por estudio)
      const totalPersonalActivo = await prisma.personal.count({
        where: { estudioId: id, activo: true },
      });
      if (totalPersonalActivo >= 50) {
        return respuesta.code(400).send({
          error: 'Límite de especialistas alcanzado. Contacta a soporte para ampliarlo.',
        });
      }

      const { nombre, especialidades, activo, horaInicio, horaFin, descansoInicio, descansoFin, diasTrabajo } = resultado.data;

      const empleado = await prisma.personal.create({
        data: {
          estudioId: id,
          nombre,
          avatarUrl: null,
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
      const payload = solicitud.user as { sub: string; rol: string; estudioId: string | null };
      const empleadoExistente = await prisma.personal.findUnique({
        where: { id: solicitud.params.id },
        select: { estudioId: true },
      });
      if (!empleadoExistente) return respuesta.code(404).send({ error: 'Personal no encontrado' });
      if (payload.rol !== 'maestro' && payload.estudioId !== empleadoExistente.estudioId) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      if (payload.rol === 'dueno') {
        const personal = await prisma.personal.findFirst({
          where: {
            id: solicitud.params.id,
            estudio: {
              usuarios: { some: { id: payload.sub, rol: 'dueno' } },
            },
          },
          select: { id: true },
        });
        if (!personal) {
          return respuesta.code(403).send({ error: 'Sin acceso a este recurso' });
        }
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

  servidor.post<{ Params: { id: string; personalId: string } }>(
    '/estudio/:id/personal/:personalId/avatar',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string; estudioId: string | null };
      const { id, personalId } = solicitud.params;

      if (payload.rol !== 'maestro' && payload.estudioId !== id) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      if (payload.rol === 'dueno') {
        const estudio = await prisma.estudio.findFirst({
          where: {
            id,
            usuarios: { some: { id: payload.sub, rol: 'dueno' } },
          },
          select: { id: true },
        });
        if (!estudio) {
          return respuesta.code(403).send({ error: 'Sin acceso a este recurso' });
        }
      }

      const personal = await prisma.personal.findFirst({
        where: { id: personalId, estudioId: id },
        select: { id: true, avatarUrl: true },
      });
      if (!personal) {
        return respuesta.code(404).send({ error: 'Especialista no encontrado' });
      }

      const archivo = await solicitud.file();
      if (!archivo) {
        return respuesta.code(400).send({ error: 'Debes enviar una imagen' });
      }

      const buffer = await archivo.toBuffer();
      if (buffer.length > 2 * 1024 * 1024) {
        return respuesta.code(400).send({ error: 'La imagen no puede superar 2 MB' });
      }

      const extensionSegura = detectarTipoImagen(buffer);
      if (!extensionSegura) {
        return respuesta.code(400).send({ error: 'El archivo no contiene una imagen válida' });
      }

      const carpetaUploads = path.resolve(process.cwd(), '../uploads/avatares');
      await fs.mkdir(carpetaUploads, { recursive: true });

      if (personal.avatarUrl) {
        const rutaAnterior = path.resolve(
          process.cwd(),
          '../uploads',
          personal.avatarUrl.replace('/uploads/', ''),
        );
        await fs.unlink(rutaAnterior).catch(() => {});
      }

      const nombreArchivo = `personal-${personalId}-${Date.now()}.${extensionSegura}`;
      await fs.writeFile(path.join(carpetaUploads, nombreArchivo), buffer);

      const avatarUrl = `/uploads/avatares/${nombreArchivo}`;
      await prisma.personal.update({ where: { id: personalId }, data: { avatarUrl } });

      return respuesta.send({ datos: { avatarUrl } });
    },
  );
}
