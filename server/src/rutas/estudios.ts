import type { FastifyInstance } from 'fastify';
import type { Prisma } from '../generated/prisma/client.js';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { resolverCategoriasSalon } from '../lib/categoriasSalon.js';
import { construirSelectDesdeColumnas, obtenerColumnasTabla, obtenerTablasDisponibles } from '../lib/compatibilidadEsquema.js';
import { env } from '../lib/env.js';
import { obtenerSlotsDisponiblesBackend } from '../lib/programacion.js';
import { prisma } from '../prismaCliente.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import { registrarAuditoria } from '../utils/auditoria.js';
import { sanitizarTexto } from '../utils/sanitizar.js';
import { enviarEmailSolicitudCancelacion } from '../servicios/servicioEmail.js';
import { colorHexSchema, emailOpcionalONuloSchema, fechaIsoSchema, horaOpcionalONulaSchema, horaSchema, obtenerMensajeValidacion, telefonoSchema, textoOpcionalONuloSchema, textoSchema, urlOpcionalSchema } from '../lib/validacion.js';
import { sanitizarClaveSalon } from '../lib/clavesSalon.js';
import { normalizarPlanEstudio, validarCantidadServiciosPlan } from '../lib/planes.js';

const esquemaHorario = z.record(
  z.string(),
  z.object({
    isOpen: z.boolean(),
    openTime: horaSchema,
    closeTime: horaSchema,
  }),
);

const CLAVE_SALON_REGEX = /^[A-Z0-9]+$/;

const esquemaServicio = z.object({
  name: textoSchema('servicio', 80),
  duration: z.number().int().min(5, 'La duración mínima es 5 minutos').max(720, 'La duración máxima es 720 minutos'),
  price: z.number().min(1, 'El precio debe ser mayor a 0').max(10000000, 'El precio excede el máximo permitido'),
  category: textoOpcionalONuloSchema('categoria', 80).transform((valor) => valor ?? undefined),
});

const esquemaServicioPersonalizado = z.object({
  name: textoSchema('servicioPersonalizado', 80),
  category: textoSchema('categoria', 80),
});

const claveSalonSchema = (campo: 'claveDueno' | 'claveCliente') =>
  textoSchema(campo, 32).transform((valor) => sanitizarClaveSalon(valor)).refine(
    (valor) => CLAVE_SALON_REGEX.test(valor),
    'La clave solo puede contener letras y números',
  );

const esquemaEmailContactoOpcional = emailOpcionalONuloSchema('emailContacto');

const esquemaCamposEstudio = {
  nombre: textoSchema('nombre', 120).optional(),
  propietario: textoSchema('propietario', 120).optional(),
  telefono: telefonoSchema.optional(),
  sitioWeb: urlOpcionalSchema,
  pais: textoSchema('pais', 50).optional(),
  plan: z.enum(['STANDARD', 'PRO']).optional(),
  sucursales: z.array(textoSchema('sucursal', 80)).max(20, 'No puedes registrar más de 20 sucursales').optional(),
  horario: esquemaHorario.optional(),
  servicios: z.array(esquemaServicio).max(100, 'No puedes registrar más de 100 servicios').optional(),
  serviciosCustom: z.array(esquemaServicioPersonalizado).max(100, 'No puedes registrar más de 100 servicios personalizados').optional(),
  festivos: z.array(fechaIsoSchema).max(366, 'No puedes registrar más de 366 festivos').optional(),
  colorPrimario: colorHexSchema.optional(),
  descripcion: textoOpcionalONuloSchema('descripcion', 500),
  direccion: textoOpcionalONuloSchema('direccion', 180),
  emailContacto: esquemaEmailContactoOpcional,
  horarioApertura: horaOpcionalONulaSchema,
  horarioCierre: horaOpcionalONulaSchema,
  diasAtencion: textoOpcionalONuloSchema('diasAtencion', 120),
  categorias: textoOpcionalONuloSchema('categorias', 160),
  primeraVez: z.boolean().optional(),
};

const esquemaCrearEstudio = z.object({
  nombre: textoSchema('nombre', 120),
  propietario: textoSchema('propietario', 120).optional(),
  telefono: telefonoSchema,
  sitioWeb: urlOpcionalSchema,
  pais: textoSchema('pais', 50).optional(),
  plan: z.enum(['STANDARD', 'PRO']).optional(),
  sucursales: z.array(textoSchema('sucursal', 80)).max(20).optional(),
  claveDueno: claveSalonSchema('claveDueno'),
  claveCliente: claveSalonSchema('claveCliente'),
  suscripcion: textoSchema('suscripcion', 30).optional(),
  inicioSuscripcion: fechaIsoSchema.optional(),
  fechaVencimiento: fechaIsoSchema.optional(),
  horario: esquemaHorario.optional(),
  servicios: z.array(esquemaServicio).max(100).optional(),
  serviciosCustom: z.array(esquemaServicioPersonalizado).max(100).optional(),
  festivos: z.array(fechaIsoSchema).max(366).optional(),
  colorPrimario: colorHexSchema.optional(),
  descripcion: textoOpcionalONuloSchema('descripcion', 500),
  direccion: textoOpcionalONuloSchema('direccion', 180),
  emailContacto: esquemaEmailContactoOpcional,
  horarioApertura: horaOpcionalONulaSchema,
  horarioCierre: horaOpcionalONulaSchema,
  diasAtencion: textoOpcionalONuloSchema('diasAtencion', 120),
  categorias: textoOpcionalONuloSchema('categorias', 160),
  primeraVez: z.boolean().optional(),
}).strict();

const esquemaActualizarEstudio = z.object(esquemaCamposEstudio).strict().refine((datos) => Object.keys(datos).length > 0, {
  message: 'Debes enviar al menos un campo para actualizar',
});

function obtenerFiltroDemo() {
  return env.ENTORNO === 'development' || !env.DEMO_CLAVE_DUENO
    ? {}
    : { claveDueno: { not: env.DEMO_CLAVE_DUENO } };
}

async function verificarAccesoDuenoAEstudio(usuarioId: string, estudioId: string): Promise<boolean> {
  const estudio = await prisma.estudio.findFirst({
    where: {
      id: estudioId,
      usuarios: {
        some: {
          id: usuarioId,
          rol: 'dueno',
        },
      },
    },
    select: { id: true },
  });

  return Boolean(estudio);
}

function esErrorCompatibilidadEstudio(error: unknown): boolean {
  const codigo =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  const mensaje = error instanceof Error ? error.message : '';

  return (
    codigo === 'P2022' ||
    /Unknown column/i.test(mensaje) ||
    /(pinCancelacionHash|plan|primeraVez|cancelacionSolicitada|fechaSolicitudCancelacion|motivoCancelacion)/i.test(
      mensaje,
    )
  );
}

const seleccionarPersonalEstudio = {
  id: true,
  estudioId: true,
  nombre: true,
  avatarUrl: true,
  especialidades: true,
  activo: true,
  horaInicio: true,
  horaFin: true,
  descansoInicio: true,
  descansoFin: true,
  diasTrabajo: true,
  creadoEn: true,
} satisfies Prisma.PersonalSelect;

const seleccionarEstudioPanelModerno = {
  id: true,
  nombre: true,
  propietario: true,
  telefono: true,
  sitioWeb: true,
  pais: true,
  sucursales: true,
  claveDueno: true,
  claveCliente: true,
  activo: true,
  plan: true,
  pinCancelacionHash: true,
  estado: true,
  suscripcion: true,
  inicioSuscripcion: true,
  fechaVencimiento: true,
  horario: true,
  servicios: true,
  serviciosCustom: true,
  festivos: true,
  colorPrimario: true,
  logoUrl: true,
  descripcion: true,
  direccion: true,
  emailContacto: true,
  horarioApertura: true,
  horarioCierre: true,
  diasAtencion: true,
  categorias: true,
  primeraVez: true,
  cancelacionSolicitada: true,
  fechaSolicitudCancelacion: true,
  motivoCancelacion: true,
  creadoEn: true,
  actualizadoEn: true,
  personal: {
    orderBy: { creadoEn: 'asc' },
    select: seleccionarPersonalEstudio,
  },
} satisfies Prisma.EstudioSelect;

const seleccionarEstudioPanelCompat = {
  id: true,
  nombre: true,
  propietario: true,
  telefono: true,
  sitioWeb: true,
  pais: true,
  sucursales: true,
  claveDueno: true,
  claveCliente: true,
  activo: true,
  estado: true,
  suscripcion: true,
  inicioSuscripcion: true,
  fechaVencimiento: true,
  horario: true,
  servicios: true,
  serviciosCustom: true,
  festivos: true,
  colorPrimario: true,
  logoUrl: true,
  descripcion: true,
  direccion: true,
  emailContacto: true,
  horarioApertura: true,
  horarioCierre: true,
  diasAtencion: true,
  categorias: true,
  creadoEn: true,
  actualizadoEn: true,
  personal: {
    orderBy: { creadoEn: 'asc' },
    select: seleccionarPersonalEstudio,
  },
} satisfies Prisma.EstudioSelect;

function serializarEstudioPanel(estudio: Record<string, unknown>) {
  const { pinCancelacionHash, ...resto } = estudio;

  return {
    ...resto,
    plan: (estudio['plan'] as string | undefined) ?? 'STANDARD',
    primeraVez: (estudio['primeraVez'] as boolean | undefined) ?? true,
    cancelacionSolicitada: (estudio['cancelacionSolicitada'] as boolean | undefined) ?? false,
    fechaSolicitudCancelacion:
      (estudio['fechaSolicitudCancelacion'] as Date | string | null | undefined) ?? null,
    motivoCancelacion: (estudio['motivoCancelacion'] as string | null | undefined) ?? null,
    pinCancelacionConfigurado:
      typeof pinCancelacionHash === 'string' && pinCancelacionHash.trim().length > 0,
  };
}

async function listarEstudiosPanel(where: Prisma.EstudioWhereInput = {}) {
  try {
    return await prisma.estudio.findMany({
      where,
      orderBy: { creadoEn: 'desc' },
      select: seleccionarEstudioPanelModerno,
    });
  } catch (error) {
    if (!esErrorCompatibilidadEstudio(error)) {
      throw error;
    }

    return prisma.estudio.findMany({
      where,
      orderBy: { creadoEn: 'desc' },
      select: seleccionarEstudioPanelCompat,
    });
  }
}

async function obtenerEstudioPanel(where: Prisma.EstudioWhereInput) {
  try {
    return await prisma.estudio.findFirst({
      where,
      select: seleccionarEstudioPanelModerno,
    });
  } catch (error) {
    if (!esErrorCompatibilidadEstudio(error)) {
      throw error;
    }

    return prisma.estudio.findFirst({
      where,
      select: seleccionarEstudioPanelCompat,
    });
  }
}

export async function rutasEstudios(servidor: FastifyInstance): Promise<void> {
  // GET /estudios — solo rol maestro
  servidor.get('/estudios', { preHandler: verificarJWT }, async (solicitud, respuesta) => {
    const payload = solicitud.user as { rol: string };
    if (payload.rol !== 'maestro') {
      return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
    }
    const filtroDemo = obtenerFiltroDemo();
    const estudios = await listarEstudiosPanel(filtroDemo);
    return respuesta.send({
      datos: estudios.map((estudio) =>
        serializarEstudioPanel(estudio as unknown as Record<string, unknown>),
      ),
    });
  });

  // GET /estudios/:id — dueno o maestro
  servidor.get<{ Params: { id: string } }>(
    '/estudios/:id',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const { id } = solicitud.params;
      if (payload.rol !== 'maestro' && payload.estudioId !== id) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      const filtroDemo = obtenerFiltroDemo();
      const estudio = await obtenerEstudioPanel({ id, ...filtroDemo });
      if (!estudio) return respuesta.code(404).send({ error: 'Estudio no encontrado' });
      return respuesta.send({
        datos: serializarEstudioPanel(estudio as unknown as Record<string, unknown>),
      });
    },
  );

  // POST /estudios — solo maestro
  servidor.post<{ Body: Record<string, unknown> }>(
    '/estudios',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      const resultado = esquemaCrearEstudio.safeParse(solicitud.body);
      if (!resultado.success) {
        return respuesta.code(400).send({ error: obtenerMensajeValidacion(resultado.error) });
      }

      const datos = resultado.data;
      const categorias = resolverCategoriasSalon({
        categorias: datos.categorias,
        servicios: datos.servicios,
        serviciosCustom: datos.serviciosCustom,
      });

      const estudio = await prisma.estudio.create({
        data: {
          nombre: datos.nombre,
          propietario: datos.propietario ?? '',
          telefono: datos.telefono,
          sitioWeb: datos.sitioWeb,
          pais: datos.pais ?? 'Mexico',
          plan: normalizarPlanEstudio(datos.plan),
          sucursales: datos.sucursales ?? [],
          claveDueno: datos.claveDueno.toUpperCase(),
          claveCliente: datos.claveCliente.toUpperCase(),
          suscripcion: datos.suscripcion ?? 'mensual',
          inicioSuscripcion: datos.inicioSuscripcion ?? new Date().toISOString().split('T')[0]!,
          fechaVencimiento: datos.fechaVencimiento ?? '',
          horario: datos.horario ?? {},
          servicios: (datos.servicios ?? []) as Prisma.InputJsonValue,
          serviciosCustom: (datos.serviciosCustom ?? []) as Prisma.InputJsonValue,
          festivos: datos.festivos ?? [],
          ...(datos.colorPrimario !== undefined && { colorPrimario: datos.colorPrimario }),
          ...(datos.descripcion !== undefined && { descripcion: sanitizarTexto(datos.descripcion ?? '') }),
          ...(datos.direccion !== undefined && { direccion: sanitizarTexto(datos.direccion ?? '') }),
          ...(datos.emailContacto !== undefined && { emailContacto: datos.emailContacto }),
          ...(datos.horarioApertura !== undefined && { horarioApertura: datos.horarioApertura }),
          ...(datos.horarioCierre !== undefined && { horarioCierre: datos.horarioCierre }),
          ...(datos.diasAtencion !== undefined && { diasAtencion: datos.diasAtencion }),
          ...(datos.primeraVez !== undefined && { primeraVez: datos.primeraVez }),
          categorias,
        },
      });
      return respuesta.code(201).send({ datos: estudio });
    },
  );

  // PUT /estudios/:id — maestro o dueno del propio estudio
  servidor.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/estudios/:id',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      try {
        const payload = solicitud.user as { sub: string; rol: string; estudioId: string | null };
        const { id } = solicitud.params;
        if (payload.rol !== 'maestro' && payload.estudioId !== id) {
          return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
        }
        if (payload.rol === 'dueno') {
          const tieneAcceso = await verificarAccesoDuenoAEstudio(payload.sub, id);
          if (!tieneAcceso) {
            return respuesta.code(403).send({ error: 'Sin acceso a este recurso' });
          }
        }
        const resultado = esquemaActualizarEstudio.safeParse(solicitud.body);
        if (!resultado.success) {
          return respuesta.code(400).send({ error: obtenerMensajeValidacion(resultado.error) });
        }

        const datos = resultado.data;
        const [columnasEstudios, tablasDisponibles] = await Promise.all([
          obtenerColumnasTabla('estudios'),
          obtenerTablasDisponibles(),
        ]);
        let estudioExistente: { categorias: unknown; servicios: unknown; serviciosCustom: unknown; plan?: string } | null;
        try {
          estudioExistente = await prisma.estudio.findUnique({
            where: { id },
            select: { categorias: true, servicios: true, serviciosCustom: true, plan: true },
          });
        } catch (error) {
          if (!esErrorCompatibilidadEstudio(error)) {
            throw error;
          }
          estudioExistente = await prisma.estudio.findUnique({
            where: { id },
            select: { categorias: true, servicios: true, serviciosCustom: true },
          });
        }

        if (!estudioExistente) {
          return respuesta.code(404).send({ error: 'Estudio no encontrado' });
        }

        if (payload.rol !== 'maestro' && datos.plan !== undefined) {
          return respuesta.code(403).send({ error: 'Solo el panel maestro puede cambiar el plan del salón' });
        }

        const planSiguiente = normalizarPlanEstudio(datos.plan ?? estudioExistente.plan);
        const serviciosActuales = Array.isArray(estudioExistente.servicios)
          ? estudioExistente.servicios.length
          : 0;
        const serviciosNuevos = Array.isArray(datos.servicios)
          ? datos.servicios.length
          : serviciosActuales;
        const errorServicios = validarCantidadServiciosPlan({
          plan: planSiguiente,
          cantidadNueva: serviciosNuevos,
          cantidadActual: serviciosActuales,
        });
        if (errorServicios) {
          return respuesta.code(400).send({ error: errorServicios });
        }

        if (
          datos.plan !== undefined &&
          normalizarPlanEstudio(datos.plan) === 'STANDARD' &&
          serviciosNuevos > 4
        ) {
          return respuesta.code(400).send({
            error:
              'Antes de cambiar a Standard debes dejar el catálogo con un máximo de 4 servicios activos.',
          });
        }
        const categorias = resolverCategoriasSalon({
          categorias:
            datos.categorias ??
            (typeof estudioExistente?.categorias === 'string' ? estudioExistente.categorias : null),
          servicios: datos.servicios ?? estudioExistente?.servicios,
          serviciosCustom: datos.serviciosCustom ?? estudioExistente?.serviciosCustom,
        });

        const dataActualizacion: Record<string, unknown> = {
          ...(datos.nombre !== undefined && columnasEstudios.has('nombre') && { nombre: datos.nombre }),
          ...(datos.propietario !== undefined && columnasEstudios.has('propietario') && { propietario: datos.propietario }),
          ...(datos.telefono !== undefined && columnasEstudios.has('telefono') && { telefono: datos.telefono }),
          ...(datos.sitioWeb !== undefined && columnasEstudios.has('sitioWeb') && { sitioWeb: datos.sitioWeb }),
          ...(datos.pais !== undefined && columnasEstudios.has('pais') && { pais: datos.pais }),
          ...(datos.plan !== undefined && columnasEstudios.has('plan') && { plan: normalizarPlanEstudio(datos.plan) }),
          ...(datos.sucursales !== undefined && columnasEstudios.has('sucursales') && { sucursales: datos.sucursales }),
          ...(datos.horario !== undefined && columnasEstudios.has('horario') && { horario: datos.horario }),
          ...(datos.servicios !== undefined && columnasEstudios.has('servicios') && { servicios: datos.servicios as Prisma.InputJsonValue }),
          ...(datos.serviciosCustom !== undefined && columnasEstudios.has('serviciosCustom') && { serviciosCustom: datos.serviciosCustom as Prisma.InputJsonValue }),
          ...(datos.festivos !== undefined && columnasEstudios.has('festivos') && { festivos: datos.festivos }),
          ...(datos.colorPrimario !== undefined && columnasEstudios.has('colorPrimario') && { colorPrimario: datos.colorPrimario }),
          ...(datos.descripcion !== undefined && columnasEstudios.has('descripcion') && { descripcion: sanitizarTexto(datos.descripcion ?? '') }),
          ...(datos.direccion !== undefined && columnasEstudios.has('direccion') && { direccion: sanitizarTexto(datos.direccion ?? '') }),
          ...(datos.emailContacto !== undefined && columnasEstudios.has('emailContacto') && { emailContacto: datos.emailContacto }),
          ...(datos.horarioApertura !== undefined && columnasEstudios.has('horarioApertura') && { horarioApertura: datos.horarioApertura }),
          ...(datos.horarioCierre !== undefined && columnasEstudios.has('horarioCierre') && { horarioCierre: datos.horarioCierre }),
          ...(datos.diasAtencion !== undefined && columnasEstudios.has('diasAtencion') && { diasAtencion: datos.diasAtencion }),
          ...(columnasEstudios.has('categorias') && { categorias }),
        };

        const selectActualizacion = construirSelectDesdeColumnas(columnasEstudios, ['id']);

        await prisma.estudio.update({
          where: { id },
          data: dataActualizacion as Prisma.EstudioUncheckedUpdateInput,
          select: selectActualizacion as Prisma.EstudioSelect,
        });

        if (
          datos.plan !== undefined &&
          normalizarPlanEstudio(datos.plan) === 'STANDARD' &&
          tablasDisponibles.has('config_fidelidad')
        ) {
          await prisma.configFidelidad.updateMany({
            where: { estudioId: id },
            data: { activo: false },
          });
        }

        return respuesta.send({ datos: { id, actualizado: true } });
      } catch (error) {
        solicitud.log.error({ err: error }, 'Fallo al actualizar estudio');
        return respuesta.code(500).send({
          error: 'No se pudo actualizar el estudio',
          detalle: error instanceof Error ? error.message : 'Error desconocido',
        });
      }
    },
  );

  servidor.get<{
    Params: { id: string };
    Querystring: { personalId: string; fecha: string; duracion: string };
  }>(
    '/estudios/:id/disponibilidad',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const { id } = solicitud.params;
      const { personalId, fecha, duracion } = solicitud.query;

      if (payload.rol !== 'maestro' && payload.estudioId !== id) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      if (!personalId || !fecha || !duracion) {
        return respuesta.code(400).send({ error: 'personalId, fecha y duracion son requeridos' });
      }

      const duracionMin = Number(duracion);
      if (isNaN(duracionMin) || duracionMin <= 0) {
        return respuesta.code(400).send({ error: 'duracion debe ser un número positivo' });
      }

      const [salon, miembro, reservasExistentes] = await Promise.all([
        prisma.estudio.findUnique({
          where: { id },
          select: { horario: true, festivos: true },
        }),
        prisma.personal.findFirst({
          where: { id: personalId, estudioId: id, activo: true },
          select: {
            id: true,
            horaInicio: true,
            horaFin: true,
            descansoInicio: true,
            descansoFin: true,
            diasTrabajo: true,
          },
        }),
        prisma.reserva.findMany({
          where: {
            estudioId: id,
            personalId,
            fecha,
            estado: { not: 'cancelled' },
          },
          select: { horaInicio: true, duracion: true },
        }),
      ]);

      if (!salon || !miembro) {
        return respuesta.code(404).send({ error: 'Salón o especialista no encontrado' });
      }

      const festivos = salon.festivos as string[];
      if (festivos.includes(fecha)) {
        return respuesta.send({ datos: [] });
      }

      const slots = obtenerSlotsDisponiblesBackend({
        horario: salon.horario as Record<string, { isOpen: boolean; openTime: string; closeTime: string }>,
        miembro,
        fecha,
        duracionMin,
        reservas: reservasExistentes,
      });

      return respuesta.send({ datos: slots });
    },
  );

  // DELETE /estudios/:id — solo maestro
  servidor.delete<{ Params: { id: string } }>(
    '/estudios/:id',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      try {
        const payload = solicitud.user as { rol: string };
        if (payload.rol !== 'maestro') {
          return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
        }

        const { id } = solicitud.params;
        const tablasDisponibles = await obtenerTablasDisponibles();

        const estudio = await prisma.estudio.findUnique({
          where: { id },
          select: { id: true },
        });

        if (!estudio) {
          return respuesta.code(404).send({ error: 'Estudio no encontrado' });
        }

        const [usuarios, personal, reservas, pagos] = await Promise.all([
          prisma.usuario.findMany({ where: { estudioId: id }, select: { id: true } }),
          prisma.personal.findMany({ where: { estudioId: id }, select: { id: true } }),
          prisma.reserva.findMany({ where: { estudioId: id }, select: { id: true } }),
          prisma.pago.findMany({ where: { estudioId: id }, select: { id: true } }),
        ]);

        const usuarioIds = usuarios.map((usuario) => usuario.id);
        const personalIds = personal.map((persona) => persona.id);
        const reservaIds = reservas.map((reserva) => reserva.id);
        const pagoIds = pagos.map((pago) => pago.id);

        if (usuarioIds.length > 0 && tablasDisponibles.has('suscripciones_push')) {
          await prisma.suscripcionPush.deleteMany({ where: { usuarioId: { in: usuarioIds } } });
        }
        if (usuarioIds.length > 0 && tablasDisponibles.has('tokens_reset')) {
          await prisma.tokenReset.deleteMany({ where: { usuarioId: { in: usuarioIds } } });
        }
        if (usuarioIds.length > 0 && tablasDisponibles.has('permisos_maestro')) {
          await prisma.permisosMaestro.deleteMany({ where: { usuarioId: { in: usuarioIds } } });
        }
        if (usuarioIds.length > 0 && tablasDisponibles.has('audit_log')) {
          await prisma.auditLog.deleteMany({ where: { usuarioId: { in: usuarioIds } } });
        }

        if (tablasDisponibles.has('audit_log')) {
          await prisma.auditLog.deleteMany({
          where: {
            OR: [
              { entidadTipo: 'estudio', entidadId: id },
              ...(pagoIds.length > 0 ? [{ entidadTipo: 'pago', entidadId: { in: pagoIds } }] : []),
            ],
          },
        });
        }

        if (reservaIds.length > 0 && tablasDisponibles.has('reserva_servicios')) {
          await prisma.reservaServicio.deleteMany({ where: { reservaId: { in: reservaIds } } });
        }

        if (personalIds.length > 0 && tablasDisponibles.has('empleados_acceso')) {
          await prisma.empleadoAcceso.deleteMany({ where: { personalId: { in: personalIds } } });
        }

        await prisma.personal.deleteMany({ where: { estudioId: id } });
        await prisma.reserva.deleteMany({ where: { estudioId: id } });
        await prisma.pago.deleteMany({ where: { estudioId: id } });
        if (tablasDisponibles.has('clientes')) {
          await prisma.cliente.deleteMany({ where: { estudioId: id } });
        }
        if (tablasDisponibles.has('puntos_fidelidad')) {
          await prisma.puntosFidelidad.deleteMany({ where: { estudioId: id } });
        }
        if (tablasDisponibles.has('config_fidelidad')) {
          await prisma.configFidelidad.deleteMany({ where: { estudioId: id } });
        }
        await prisma.diaFestivo.deleteMany({ where: { estudioId: id } });
        await prisma.usuario.deleteMany({ where: { estudioId: id } });
        await prisma.estudio.deleteMany({ where: { id } });

        return respuesta.code(200).send({ datos: { eliminado: true } });
      } catch (error) {
        solicitud.log.error({ err: error }, 'Fallo al eliminar estudio');
        return respuesta.code(500).send({
          error: 'No se pudo eliminar el estudio',
          detalle: error instanceof Error ? error.message : 'Error desconocido',
        });
      }
    },
  );

  // PUT /estudios/:id/pin-cancelacion — set PIN de cancelación (dueno o maestro)
  servidor.put<{ Params: { id: string }; Body: { pin: string; confirmacion: string } }>(
    '/estudios/:id/pin-cancelacion',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string; estudioId: string | null };
      const { id } = solicitud.params;

      if (payload.rol !== 'maestro' && payload.estudioId !== id) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      if (payload.rol === 'dueno') {
        const tieneAcceso = await verificarAccesoDuenoAEstudio(payload.sub, id);
        if (!tieneAcceso) return respuesta.code(403).send({ error: 'Sin acceso a este recurso' });
      }

      const { pin, confirmacion } = solicitud.body;
      if (!pin || !confirmacion) {
        return respuesta.code(400).send({ error: 'PIN y confirmación son obligatorios' });
      }
      if (!/^\d{4,6}$/.test(pin)) {
        return respuesta.code(400).send({ error: 'El PIN debe tener entre 4 y 6 dígitos numéricos' });
      }
      if (pin !== confirmacion) {
        return respuesta.code(400).send({ error: 'El PIN y la confirmación no coinciden' });
      }

      const pinCancelacionHash = await bcrypt.hash(pin, 12);
      await prisma.estudio.update({ where: { id }, data: { pinCancelacionHash } });

      return respuesta.send({ datos: { pinCancelacionConfigurado: true } });
    },
  );

  // POST /estudios/:id/solicitar-cancelacion — dueno de su propio estudio
  servidor.post<{ Params: { id: string }; Body: { motivo?: string } }>(
    '/estudios/:id/solicitar-cancelacion',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null; sub: string };
      const { id } = solicitud.params;

      if (payload.rol !== 'dueno' || payload.estudioId !== id) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const tieneAcceso = await verificarAccesoDuenoAEstudio(payload.sub, id);
      if (!tieneAcceso) {
        return respuesta.code(403).send({ error: 'Sin acceso a este recurso' });
      }

      const estudio = await prisma.estudio.findUnique({ where: { id } });
      if (!estudio) {
        return respuesta.code(404).send({ error: 'Estudio no encontrado' });
      }

      if (estudio.cancelacionSolicitada) {
        return respuesta.code(400).send({ error: 'Ya tienes una solicitud de cancelación pendiente' });
      }

      const motivoRaw = (solicitud.body as { motivo?: string }).motivo;
      const motivo = typeof motivoRaw === 'string' ? motivoRaw.trim().slice(0, 300) : undefined;
      const ahora = new Date();

      await prisma.estudio.update({
        where: { id },
        data: {
          cancelacionSolicitada: true,
          fechaSolicitudCancelacion: ahora,
          motivoCancelacion: motivo ?? null,
        },
      });

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'solicitar_cancelacion',
        entidadTipo: 'estudio',
        entidadId: id,
        detalles: { nombre: estudio.nombre, motivo: motivo ?? null },
        ip: solicitud.ip,
      });

      void enviarEmailSolicitudCancelacion({
        nombreSalon: estudio.nombre,
        motivo,
        fechaSolicitud: ahora.toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' }),
      });

      return respuesta.send({
        datos: { mensaje: 'Tu solicitud fue recibida. Te contactaremos en máximo 48 horas.' },
      });
    },
  );

  // DELETE /estudios/:id/cancelar-solicitud — dueno retira su solicitud
  servidor.delete<{ Params: { id: string } }>(
    '/estudios/:id/cancelar-solicitud',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null; sub: string };
      const { id } = solicitud.params;

      if (payload.rol !== 'dueno' || payload.estudioId !== id) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const estudio = await prisma.estudio.findUnique({ where: { id } });
      if (!estudio) {
        return respuesta.code(404).send({ error: 'Estudio no encontrado' });
      }

      await prisma.estudio.update({
        where: { id },
        data: {
          cancelacionSolicitada: false,
          fechaSolicitudCancelacion: null,
          motivoCancelacion: null,
        },
      });

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'retirar_solicitud_cancelacion',
        entidadTipo: 'estudio',
        entidadId: id,
        detalles: { nombre: estudio.nombre },
        ip: solicitud.ip,
      });

      return respuesta.send({ datos: { mensaje: 'Solicitud de cancelación retirada' } });
    },
  );
}
