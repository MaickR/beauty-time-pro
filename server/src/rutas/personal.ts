import type { FastifyInstance } from 'fastify';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { prisma } from '../prismaCliente.js';
import { Prisma } from '../generated/prisma/client.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import { tieneAccesoAdministrativoEstudio } from '../lib/accesoEstudio.js';
import {
  guardarConfiguracionComisionPersonal,
  normalizarComisionServicios,
  normalizarPorcentajeComisionPersonal,
  obtenerConfiguracionesComisionPersonal,
} from '../lib/comisionPersonal.js';
import { validarCantidadEmpleadosActivosPlan } from '../lib/planes.js';
import { horaOpcionalONulaSchema, obtenerMensajeValidacion, textoSchema } from '../lib/validacion.js';
import { detectarTipoImagen } from '../utils/validarImagen.js';
import { obtenerDesactivacionesProgramadasPersonal } from '../lib/reactivacionPersonalProgramada.js';

const esquemaPersonalBase = {
  nombre: textoSchema('nombre', 80),
  especialidades: z.array(textoSchema('especialidad', 60)).max(20, 'No puedes registrar más de 20 especialidades').optional(),
  activo: z.boolean().optional(),
  horaInicio: horaOpcionalONulaSchema,
  horaFin: horaOpcionalONulaSchema,
  descansoInicio: horaOpcionalONulaSchema,
  descansoFin: horaOpcionalONulaSchema,
  diasTrabajo: z.array(z.number().int().min(0).max(6)).max(7, 'diasTrabajo no puede superar 7 elementos').nullable().optional(),
  porcentajeComisionBase: z.number().int().min(0).max(100).optional(),
  comisionServicios: z.record(z.string().trim().min(1).max(80), z.number().int().min(0).max(100)).optional(),
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

function construirConfiguracionComisionPersonal(datos: {
  porcentajeComisionBase?: number;
  comisionServicios?: Record<string, number>;
}) {
  return {
    porcentajeComisionBase: normalizarPorcentajeComisionPersonal(datos.porcentajeComisionBase, 0),
    comisionServicios: normalizarComisionServicios(datos.comisionServicios ?? {}),
  };
}

async function sincronizarNumeroEspecialistas(estudioId: string) {
  const totalPersonal = await prisma.personal.count({
    where: { estudioId, activo: true },
  });

  await prisma.estudio.update({
    where: { id: estudioId },
    data: { numeroEspecialistas: totalPersonal },
  });
}

async function desactivarPersonal(personalId: string) {
  return prisma.$transaction(async (tx) => {
    const personalActualizado = await tx.personal.update({
      where: { id: personalId },
      data: {
        activo: false,
        eliminadoEn: new Date(),
      },
    });

    await tx.empleadoAcceso.updateMany({
      where: { personalId, activo: true },
      data: { activo: false },
    });

    return personalActualizado;
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
      if (!tieneAccesoAdministrativoEstudio(payload, id)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      const personal = await prisma.personal.findMany({
        where: { estudioId: id },
        orderBy: [{ activo: 'desc' }, { creadoEn: 'asc' }],
      });

      const desactivadoHastaPorId = await obtenerDesactivacionesProgramadasPersonal(
        personal.map((miembro) => miembro.id),
      );

      const personalVisible = personal
        .filter((miembro) => miembro.activo || Boolean(desactivadoHastaPorId.get(miembro.id)))
        .map((miembro) => ({
          ...miembro,
          desactivadoHasta: desactivadoHastaPorId.get(miembro.id) ?? null,
        }));

      const configuracionesComision = await obtenerConfiguracionesComisionPersonal(
        personalVisible.map((miembro) => miembro.id),
      );

      return respuesta.send({
        datos: personalVisible.map((miembro) => {
          const configuracionComision = configuracionesComision.get(miembro.id) ?? {
            porcentajeComisionBase: 0,
            comisionServicios: {},
          };

          return {
            ...miembro,
            porcentajeComisionBase: configuracionComision.porcentajeComisionBase,
            comisionServicios: configuracionComision.comisionServicios,
          };
        }),
      });
    },
  );

  // POST /estudios/:id/personal
  servidor.post<{
    Params: { id: string };
    Body: {
      nombre: string;
      especialidades?: string[];
      activo?: boolean;
      horaInicio?: string | null;
      horaFin?: string | null;
      descansoInicio?: string | null;
      descansoFin?: string | null;
      diasTrabajo?: number[] | null;
      porcentajeComisionBase?: number;
      comisionServicios?: Record<string, number>;
    };
  }>(
    '/estudios/:id/personal',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string; estudioId: string | null };
      const { id } = solicitud.params;
      if (!tieneAccesoAdministrativoEstudio(payload, id)) {
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

      const [estudio, totalPersonalActivo] = await Promise.all([
        prisma.estudio.findUnique({
          where: { id },
          select: { plan: true },
        }),
        prisma.personal.count({
          where: { estudioId: id, activo: true },
        }),
      ]);

      if (!estudio) {
        return respuesta.code(404).send({ error: 'Estudio no encontrado' });
      }

      const activoSolicitado = resultado.data.activo ?? true;
      const errorPlanPersonal = validarCantidadEmpleadosActivosPlan({
        plan: estudio.plan,
        cantidadActual: totalPersonalActivo,
        cantidadNueva: totalPersonalActivo + (activoSolicitado ? 1 : 0),
      });
      if (errorPlanPersonal) {
        return respuesta.code(400).send({ error: errorPlanPersonal, codigo: 'LIMITE_PLAN' });
      }

      // Verificar límite operativo global de especialistas activos (50 por estudio)
      if (activoSolicitado && totalPersonalActivo >= 50) {
        return respuesta.code(400).send({
          error: 'Límite de especialistas alcanzado. Contacta a soporte para ampliarlo.',
        });
      }

      const {
        nombre,
        especialidades,
        activo,
        horaInicio,
        horaFin,
        descansoInicio,
        descansoFin,
        diasTrabajo,
      } = resultado.data;

      const configuracionComision = construirConfiguracionComisionPersonal({
        porcentajeComisionBase: resultado.data.porcentajeComisionBase,
        comisionServicios: resultado.data.comisionServicios,
      });

      let empleado: Awaited<ReturnType<typeof prisma.personal.create>>;
      try {
        empleado = await prisma.personal.create({
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
      } catch (errorCreacion) {
        solicitud.log.error({ err: errorCreacion, estudioId: id, nombre }, 'Error al crear especialista en DB');
        return respuesta.code(500).send({ error: 'No se pudo crear el especialista. Intenta nuevamente.' });
      }

      // Guardar configuración de comisiones (sin bloquear la respuesta si falla)
      await guardarConfiguracionComisionPersonal(empleado.id, configuracionComision).catch((errComision) => {
        solicitud.log.warn({ err: errComision, personalId: empleado.id }, 'No se pudo guardar configuración de comisión; se usarán valores por defecto');
      });

      await sincronizarNumeroEspecialistas(id).catch((errSync) => {
        solicitud.log.warn({ err: errSync, estudioId: id }, 'No se pudo sincronizar contador de especialistas');
      });

      return respuesta.code(201).send({
        datos: {
          ...empleado,
          porcentajeComisionBase: configuracionComision.porcentajeComisionBase,
          comisionServicios: configuracionComision.comisionServicios,
        },
      });
    },
  );

  // PUT /personal/:id
  servidor.put<{
    Params: { id: string };
    Body: {
      nombre?: string;
      especialidades?: string[];
      activo?: boolean;
      horaInicio?: string | null;
      horaFin?: string | null;
      descansoInicio?: string | null;
      descansoFin?: string | null;
      diasTrabajo?: number[] | null;
      porcentajeComisionBase?: number;
      comisionServicios?: Record<string, number>;
    };
  }>(
    '/personal/:id',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string; estudioId: string | null };
      const empleadoExistente = await prisma.personal.findUnique({
        where: { id: solicitud.params.id },
        select: {
          estudioId: true,
          activo: true,
          estudio: {
            select: { plan: true },
          },
        },
      });
      if (!empleadoExistente) return respuesta.code(404).send({ error: 'Personal no encontrado' });
      if (!tieneAccesoAdministrativoEstudio(payload, empleadoExistente.estudioId)) {
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

      const estaReactivando = datos.activo === true && !empleadoExistente.activo;
      if (estaReactivando) {
        const totalPersonalActivo = await prisma.personal.count({
          where: { estudioId: empleadoExistente.estudioId, activo: true },
        });

        const errorPlanPersonal = validarCantidadEmpleadosActivosPlan({
          plan: empleadoExistente.estudio?.plan,
          cantidadActual: totalPersonalActivo,
          cantidadNueva: totalPersonalActivo + 1,
        });

        if (errorPlanPersonal) {
          return respuesta.code(400).send({ error: errorPlanPersonal, codigo: 'LIMITE_PLAN' });
        }

        if (totalPersonalActivo >= 50) {
          return respuesta.code(400).send({
            error: 'Límite de especialistas alcanzado. Contacta a soporte para ampliarlo.',
          });
        }
      }

      const actualizado = datos.activo === false
        ? await desactivarPersonal(solicitud.params.id)
        : await prisma.personal.update({
            where: { id: solicitud.params.id },
            data: {
              ...(datos.nombre !== undefined && { nombre: datos.nombre }),
              ...(datos.especialidades !== undefined && { especialidades: datos.especialidades }),
              ...(datos.activo !== undefined && { activo: datos.activo }),
              ...(datos.activo !== undefined && {
                eliminadoEn: datos.activo ? null : new Date(),
              }),
              ...(datos.horaInicio !== undefined && { horaInicio: datos.horaInicio }),
              ...(datos.horaFin !== undefined && { horaFin: datos.horaFin }),
              ...(datos.descansoInicio !== undefined && { descansoInicio: datos.descansoInicio }),
              ...(datos.descansoFin !== undefined && { descansoFin: datos.descansoFin }),
              ...(datos.diasTrabajo !== undefined && { diasTrabajo: datos.diasTrabajo ?? Prisma.JsonNull }),
            },
          });

      const actualizaComision =
        datos.porcentajeComisionBase !== undefined || datos.comisionServicios !== undefined;
      if (actualizaComision) {
        const configuracionActual = (
          await obtenerConfiguracionesComisionPersonal([solicitud.params.id])
        ).get(solicitud.params.id) ?? {
          porcentajeComisionBase: 0,
          comisionServicios: {},
        };

        await guardarConfiguracionComisionPersonal(solicitud.params.id, {
          porcentajeComisionBase:
            datos.porcentajeComisionBase ?? configuracionActual.porcentajeComisionBase,
          comisionServicios:
            datos.comisionServicios !== undefined
              ? normalizarComisionServicios(datos.comisionServicios)
              : configuracionActual.comisionServicios,
        });
      }

      const configuracionActualizada = (
        await obtenerConfiguracionesComisionPersonal([actualizado.id])
      ).get(actualizado.id) ?? {
        porcentajeComisionBase: 0,
        comisionServicios: {},
      };

      await sincronizarNumeroEspecialistas(empleadoExistente.estudioId);
      return respuesta.send({
        datos: {
          ...actualizado,
          porcentajeComisionBase: configuracionActualizada.porcentajeComisionBase,
          comisionServicios: configuracionActualizada.comisionServicios,
        },
      });
    },
  );

  // DELETE /personal/:id
  servidor.delete<{ Params: { id: string } }>(
    '/personal/:id',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string; estudioId: string | null };
      const empleadoExistente = await prisma.personal.findUnique({
        where: { id: solicitud.params.id },
        select: { estudioId: true, activo: true },
      });

      if (!empleadoExistente) {
        return respuesta.code(404).send({ error: 'Personal no encontrado' });
      }

      if (!tieneAccesoAdministrativoEstudio(payload, empleadoExistente.estudioId)) {
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

      if (!empleadoExistente.activo) {
        return respuesta.send({ datos: { eliminado: true } });
      }

      await desactivarPersonal(solicitud.params.id);
      await sincronizarNumeroEspecialistas(empleadoExistente.estudioId);

      return respuesta.send({ datos: { eliminado: true } });
    },
  );

  servidor.post<{ Params: { id: string; personalId: string } }>(
    '/estudio/:id/personal/:personalId/avatar',
    {
      preHandler: verificarJWT,
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '1 hour',
          errorResponseBuilder: () => ({
            error: 'Demasiados uploads. Espera 1 hora.',
          }),
        },
      },
    },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string; estudioId: string | null };
      const { id, personalId } = solicitud.params;

      if (!tieneAccesoAdministrativoEstudio(payload, id)) {
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
