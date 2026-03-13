import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { prisma } from '../prismaCliente.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import type { PayloadJWT } from '../middleware/autenticacion.js';
import { emailSchema, textoSchema } from '../lib/validacion.js';
import { enviarEmailBienvenidaEmpleado } from '../servicios/servicioEmail.js';
import { env } from '../lib/env.js';

const REGEX_CONTRASENA_SEGURA = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/;

function obtenerFechaHoy(): string {
  const hoy = new Date();
  const compensacion = hoy.getTimezoneOffset();
  return new Date(hoy.getTime() - compensacion * 60 * 1000).toISOString().split('T')[0]!;
}

export async function rutasEmpleados(servidor: FastifyInstance): Promise<void> {
  // ─── GET /empleados/mi-agenda (rol empleado) ─────────────────────────────
  servidor.get<{ Querystring: { fecha?: string } }>(
    '/empleados/mi-agenda',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as PayloadJWT;
      if (payload.rol !== 'empleado') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      if (!payload.personalId) {
        return respuesta.code(400).send({ error: 'Token inválido: falta personalId' });
      }

      const fecha = solicitud.query.fecha ?? obtenerFechaHoy();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return respuesta.code(400).send({ error: 'Formato de fecha inválido. Use YYYY-MM-DD' });
      }

      const reservas = await prisma.reserva.findMany({
        where: { personalId: payload.personalId, fecha, estado: { not: 'cancelled' } },
        orderBy: { horaInicio: 'asc' },
        select: {
          id: true,
          fecha: true,
          horaInicio: true,
          duracion: true,
          estado: true,
          servicios: true,
          precioTotal: true,
          nombreCliente: true,
          telefonoCliente: true,
          clienteAppId: true,
          sucursal: true,
        },
      });

      return respuesta.send({ datos: reservas });
    },
  );

  // ─── PUT /empleados/reservas/:id/estado (rol empleado) ───────────────────
  servidor.put<{ Params: { id: string }; Body: { estado: string } }>(
    '/empleados/reservas/:id/estado',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as PayloadJWT;
      if (payload.rol !== 'empleado') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      if (!payload.personalId) {
        return respuesta.code(400).send({ error: 'Token inválido: falta personalId' });
      }

      const estadosPermitidos = ['completed', 'confirmed'];
      if (!estadosPermitidos.includes(solicitud.body.estado)) {
        return respuesta.code(400).send({
          error: 'Solo puedes cambiar el estado a "confirmed" o "completed"',
          campos: { estado: 'confirmed | completed' },
        });
      }

      const acceso = await prisma.empleadoAcceso.findUnique({
        where: { id: payload.sub },
        select: {
          personal: {
            select: {
              id: true,
              estudioId: true,
            },
          },
        },
      });
      if (!acceso?.personal) {
        return respuesta.code(403).send({ error: 'Sin acceso a este recurso' });
      }

      const reserva = await prisma.reserva.findUnique({
        where: { id: solicitud.params.id },
        select: { personalId: true, estado: true, estudioId: true },
      });
      if (!reserva) return respuesta.code(404).send({ error: 'Reserva no encontrada' });
      if (reserva.personalId !== acceso.personal.id || reserva.estudioId !== acceso.personal.estudioId) {
        return respuesta.code(403).send({ error: 'Esta reserva no te pertenece' });
      }

      const actualizada = await prisma.reserva.update({
        where: { id: solicitud.params.id },
        data: { estado: solicitud.body.estado },
      });

      console.log(`[Empleado] cambió reserva ${solicitud.params.id} a ${solicitud.body.estado}`);

      return respuesta.send({ datos: actualizada });
    },
  );

  // ─── GET /empleados/mi-perfil (rol empleado) ─────────────────────────────
  servidor.get(
    '/empleados/mi-perfil',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as PayloadJWT;
      if (payload.rol !== 'empleado') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      if (!payload.personalId) {
        return respuesta.code(400).send({ error: 'Token inválido: falta personalId' });
      }

      const personal = await prisma.personal.findUnique({
        where: { id: payload.personalId },
        select: {
          id: true,
          nombre: true,
          avatarUrl: true,
          especialidades: true,
          activo: true,
          horaInicio: true,
          horaFin: true,
          descansoInicio: true,
          descansoFin: true,
          diasTrabajo: true,
          estudio: {
            select: {
              id: true,
              nombre: true,
              colorPrimario: true,
              logoUrl: true,
              direccion: true,
              telefono: true,
            },
          },
        },
      });

      if (!personal) return respuesta.code(404).send({ error: 'Perfil no encontrado' });

      return respuesta.send({ datos: personal });
    },
  );

  // ─── POST /estudio/:id/personal/:personalId/cambiar-contrasena (rol empleado) ───
  servidor.post<{ Body: { contrasenaActual: string; contrasenaNueva: string } }>(
    '/empleados/cambiar-contrasena',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as PayloadJWT;
      if (payload.rol !== 'empleado') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { contrasenaActual, contrasenaNueva } = solicitud.body;
      const REGEX_CONTRASENA = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/;
      if (!REGEX_CONTRASENA.test(contrasenaNueva)) {
        return respuesta.code(400).send({ error: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, un número y un símbolo.' });
      }

      const acceso = await prisma.empleadoAcceso.findUnique({ where: { id: payload.sub } });
      if (!acceso) return respuesta.code(404).send({ error: 'Cuenta no encontrada' });

      if (!(await bcrypt.compare(contrasenaActual, acceso.hashContrasena))) {
        return respuesta.code(401).send({ error: 'Contraseña actual incorrecta' });
      }

      const nuevoHash = await bcrypt.hash(contrasenaNueva, 12);
      await prisma.empleadoAcceso.update({ where: { id: acceso.id }, data: { hashContrasena: nuevoHash, forzarCambioContrasena: false } });

      return respuesta.send({ datos: { mensaje: 'Contraseña actualizada correctamente' } });
    },
  );

  // ─── GET /estudio/:id/personal/:personalId/acceso (rol dueno) ────────────
  servidor.get<{ Params: { id: string; personalId: string } }>(
    '/estudio/:id/personal/:personalId/acceso',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as PayloadJWT;
      if (payload.rol !== 'dueno' && payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      if (payload.rol === 'dueno' && payload.estudioId !== solicitud.params.id) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const acceso = await prisma.empleadoAcceso.findUnique({
        where: { personalId: solicitud.params.personalId },
        select: { id: true, personalId: true, email: true, activo: true, ultimoAcceso: true, creadoEn: true, forzarCambioContrasena: true },
      });

      return respuesta.send({ datos: acceso ?? null });
    },
  );

  // ─── POST /estudio/:id/personal/:personalId/crear-acceso (rol dueno) ─────
  servidor.post<{
    Params: { id: string; personalId: string };
    Body: { email: string; contrasena: string; forzarCambioContrasena?: boolean };
  }>(
    '/estudio/:id/personal/:personalId/crear-acceso',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as PayloadJWT;
      if (payload.rol !== 'dueno') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      if (payload.estudioId !== solicitud.params.id) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const esquema = z.object({
        email: emailSchema,
        contrasena: z.string().refine(
          (v) => REGEX_CONTRASENA_SEGURA.test(v),
          'La contraseña debe tener al menos 8 caracteres, una mayúscula, un número y un símbolo',
        ),
        forzarCambioContrasena: z.boolean().optional(),
      });
      const resultado = esquema.safeParse(solicitud.body);
      if (!resultado.success) {
        return respuesta.code(400).send({ error: resultado.error.issues[0]?.message ?? 'Datos inválidos' });
      }

      const { email, contrasena, forzarCambioContrasena } = resultado.data;

      const personal = await prisma.personal.findFirst({
        where: { id: solicitud.params.personalId, estudioId: solicitud.params.id },
        select: { id: true, nombre: true, estudio: { select: { nombre: true } } },
      });
      if (!personal) return respuesta.code(404).send({ error: 'Especialista no encontrado en este salón' });

      const hashContrasena = await bcrypt.hash(contrasena, 12);

      const acceso = await prisma.empleadoAcceso.upsert({
        where: { personalId: solicitud.params.personalId },
        create: { personalId: solicitud.params.personalId, email, hashContrasena, activo: true, forzarCambioContrasena: forzarCambioContrasena ?? true },
        update: { email, hashContrasena, activo: true, forzarCambioContrasena: forzarCambioContrasena ?? true },
        select: { id: true, personalId: true, email: true, activo: true, creadoEn: true, actualizadoEn: true, forzarCambioContrasena: true },
      });

      void enviarEmailBienvenidaEmpleado({
        email,
        nombreEmpleado: personal.nombre,
        nombreSalon: personal.estudio.nombre,
        contrasenaTemp: contrasena,
        urlLogin: `${env.FRONTEND_URL}/iniciar-sesion`,
        forzarCambioContrasena: forzarCambioContrasena ?? true,
      });

      return respuesta.code(201).send({ datos: acceso });
    },
  );

  // ─── PUT /estudio/:id/personal/:personalId/acceso (rol dueno) ────────────
  servidor.put<{
    Params: { id: string; personalId: string };
    Body: { activo: boolean };
  }>(
    '/estudio/:id/personal/:personalId/acceso',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as PayloadJWT;
      if (payload.rol !== 'dueno') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      if (payload.estudioId !== solicitud.params.id) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const esquema = z.object({ activo: z.boolean() });
      const resultado = esquema.safeParse(solicitud.body);
      if (!resultado.success) {
        return respuesta.code(400).send({ error: 'Se requiere el campo activo (boolean)' });
      }

      const acceso = await prisma.empleadoAcceso.findUnique({
        where: { personalId: solicitud.params.personalId },
      });
      if (!acceso) return respuesta.code(404).send({ error: 'Este especialista no tiene acceso configurado' });

      const actualizado = await prisma.empleadoAcceso.update({
        where: { id: acceso.id },
        data: { activo: resultado.data.activo },
        select: { id: true, personalId: true, email: true, activo: true, ultimoAcceso: true, creadoEn: true },
      });

      return respuesta.send({ datos: actualizado });
    },
  );

  // ─── DELETE /estudio/:id/personal/:personalId/acceso (rol dueno) ─────────
  servidor.delete<{ Params: { id: string; personalId: string } }>(
    '/estudio/:id/personal/:personalId/acceso',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as PayloadJWT;
      if (payload.rol !== 'dueno') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      if (payload.estudioId !== solicitud.params.id) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const acceso = await prisma.empleadoAcceso.findUnique({
        where: { personalId: solicitud.params.personalId },
      });
      if (!acceso) return respuesta.code(404).send({ error: 'Este especialista no tiene acceso configurado' });

      await prisma.empleadoAcceso.delete({ where: { id: acceso.id } });

      return respuesta.send({ datos: { mensaje: 'Acceso eliminado correctamente' } });
    },
  );
}
