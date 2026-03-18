import type { FastifyInstance } from 'fastify';
import type { Prisma } from '../generated/prisma/client.js';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { resolverCategoriasSalon } from '../lib/categoriasSalon.js';
import { env } from '../lib/env.js';
import { obtenerSlotsDisponiblesBackend } from '../lib/programacion.js';
import { prisma } from '../prismaCliente.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import { registrarAuditoria } from '../utils/auditoria.js';
import { sanitizarTexto } from '../utils/sanitizar.js';
import { enviarEmailSolicitudCancelacion } from '../servicios/servicioEmail.js';
import { colorHexSchema, emailOpcionalONuloSchema, fechaIsoSchema, horaOpcionalONulaSchema, horaSchema, obtenerMensajeValidacion, telefonoSchema, textoOpcionalONuloSchema, textoSchema, urlOpcionalSchema } from '../lib/validacion.js';
import { normalizarPlanEstudio, validarCantidadServiciosPlan } from '../lib/planes.js';

const esquemaHorario = z.record(
  z.string(),
  z.object({
    isOpen: z.boolean(),
    openTime: horaSchema,
    closeTime: horaSchema,
  }),
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
  servicios: z.array(z.unknown()).max(100, 'No puedes registrar más de 100 servicios').optional(),
  serviciosCustom: z.array(z.unknown()).max(100, 'No puedes registrar más de 100 servicios personalizados').optional(),
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
  claveDueno: textoSchema('claveDueno', 32),
  claveCliente: textoSchema('claveCliente', 32),
  suscripcion: textoSchema('suscripcion', 30).optional(),
  inicioSuscripcion: fechaIsoSchema.optional(),
  fechaVencimiento: fechaIsoSchema.optional(),
  horario: esquemaHorario.optional(),
  servicios: z.array(z.unknown()).max(100).optional(),
  serviciosCustom: z.array(z.unknown()).max(100).optional(),
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

export async function rutasEstudios(servidor: FastifyInstance): Promise<void> {
  // GET /estudios — solo rol maestro
  servidor.get('/estudios', { preHandler: verificarJWT }, async (solicitud, respuesta) => {
    const payload = solicitud.user as { rol: string };
    if (payload.rol !== 'maestro') {
      return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
    }
    const filtroDemo = obtenerFiltroDemo();
    const estudios = await prisma.estudio.findMany({
      where: filtroDemo,
      orderBy: { creadoEn: 'desc' },
      include: { personal: { orderBy: { creadoEn: 'asc' } } },
    });
    return respuesta.send({
      datos: estudios.map(({ pinCancelacionHash, ...resto }) => ({
        ...resto,
        pinCancelacionConfigurado: Boolean(pinCancelacionHash),
      })),
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
      const estudio = await prisma.estudio.findFirst({
        where: { id, ...filtroDemo },
        include: { personal: { orderBy: { creadoEn: 'asc' } } },
      });
      if (!estudio) return respuesta.code(404).send({ error: 'Estudio no encontrado' });
      const { pinCancelacionHash, ...restoEstudio } = estudio;
      return respuesta.send({
        datos: { ...restoEstudio, pinCancelacionConfigurado: Boolean(pinCancelacionHash) },
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
      const estudioExistente = await prisma.estudio.findUnique({
        where: { id },
        select: { categorias: true, servicios: true, serviciosCustom: true, plan: true },
      });
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
        categorias: datos.categorias ?? estudioExistente?.categorias,
        servicios: datos.servicios ?? estudioExistente?.servicios,
        serviciosCustom: datos.serviciosCustom ?? estudioExistente?.serviciosCustom,
      });

      const estudio = await prisma.$transaction(async (tx) => {
        const estudioActualizado = await tx.estudio.update({
          where: { id },
          data: {
            ...(datos.nombre !== undefined && { nombre: datos.nombre }),
            ...(datos.propietario !== undefined && { propietario: datos.propietario }),
            ...(datos.telefono !== undefined && { telefono: datos.telefono }),
            ...(datos.sitioWeb !== undefined && { sitioWeb: datos.sitioWeb }),
            ...(datos.pais !== undefined && { pais: datos.pais }),
            ...(datos.plan !== undefined && { plan: normalizarPlanEstudio(datos.plan) }),
            ...(datos.sucursales !== undefined && { sucursales: datos.sucursales }),
            ...(datos.horario !== undefined && { horario: datos.horario }),
            ...(datos.servicios !== undefined && { servicios: datos.servicios as Prisma.InputJsonValue }),
            ...(datos.serviciosCustom !== undefined && { serviciosCustom: datos.serviciosCustom as Prisma.InputJsonValue }),
            ...(datos.festivos !== undefined && { festivos: datos.festivos }),
            ...(datos.colorPrimario !== undefined && { colorPrimario: datos.colorPrimario }),
            ...(datos.descripcion !== undefined && { descripcion: sanitizarTexto(datos.descripcion ?? '') }),
            ...(datos.direccion !== undefined && { direccion: sanitizarTexto(datos.direccion ?? '') }),
            ...(datos.emailContacto !== undefined && { emailContacto: datos.emailContacto }),
            ...(datos.horarioApertura !== undefined && { horarioApertura: datos.horarioApertura }),
            ...(datos.horarioCierre !== undefined && { horarioCierre: datos.horarioCierre }),
            ...(datos.diasAtencion !== undefined && { diasAtencion: datos.diasAtencion }),
            categorias,
          },
        });

        if (datos.plan !== undefined && normalizarPlanEstudio(datos.plan) === 'STANDARD') {
          await tx.configFidelidad.updateMany({
            where: { estudioId: id },
            data: { activo: false },
          });
        }

        return estudioActualizado;
      });
      return respuesta.send({ datos: estudio });
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
      const payload = solicitud.user as { rol: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const estudio = await prisma.estudio.findUnique({
        where: { id: solicitud.params.id },
        include: {
          usuarios: {
            where: { rol: 'dueno' },
            select: { id: true, email: true, estudioId: true },
          },
        },
      });

      if (!estudio) {
        return respuesta.code(404).send({ error: 'Estudio no encontrado' });
      }

      await prisma.$transaction(async (tx) => {
        const duenosAsociados = estudio.usuarios;
        const duenoPorCorreo = estudio.emailContacto
          ? await tx.usuario.findMany({
              where: { rol: 'dueno', email: estudio.emailContacto },
              select: { id: true, email: true, estudioId: true },
            })
          : [];

        const duenosAEliminar = Array.from(
          new Map(
            [...duenosAsociados, ...duenoPorCorreo]
              .filter((usuario) => !usuario.estudioId || usuario.estudioId === estudio.id)
              .map((usuario) => [usuario.id, usuario]),
          ).values(),
        );

        for (const dueno of duenosAEliminar) {
          await tx.usuario.delete({ where: { id: dueno.id } });
        }

        await tx.estudio.delete({ where: { id: estudio.id } });
      });

      return respuesta.code(200).send({ datos: { eliminado: true } });
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
