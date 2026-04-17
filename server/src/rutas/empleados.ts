import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  incluirServiciosDetalleReserva,
  serializarReservaApi,
} from '../lib/serializacionReservas.js';
import { revocarSesionesPorSujeto } from '../lib/sesionesAuth.js';
import { prisma } from '../prismaCliente.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import type { PayloadJWT } from '../middleware/autenticacion.js';
import { tieneAccesoPropietarioDemo } from '../lib/accesoEstudio.js';
import { emailSchema, textoSchema } from '../lib/validacion.js';
import { enviarEmailBienvenidaEmpleado } from '../servicios/servicioEmail.js';
import { env } from '../lib/env.js';
import { compararHashContrasena, generarHashContrasena } from '../utils/contrasenas.js';
import { obtenerFechaISOEnZona, normalizarZonaHorariaEstudio } from '../utils/zonasHorarias.js';
import {
  actualizarEstadoProgramadoPersonal,
  obtenerDesactivadoHastaPersonal,
} from '../lib/reactivacionPersonalProgramada.js';

const REGEX_CONTRASENA_SEGURA = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/;

function obtenerFechaAltaPersonal(creadoEn: Date): string {
  return creadoEn.toISOString().slice(0, 10);
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

      const acceso = await prisma.empleadoAcceso.findUnique({
        where: { id: payload.sub },
        select: {
          personal: {
            select: {
              creadoEn: true,
              estudio: {
                select: {
                  zonaHoraria: true,
                  pais: true,
                },
              },
            },
          },
        },
      });

      const fecha = solicitud.query.fecha ?? obtenerFechaISOEnZona(
        new Date(),
        normalizarZonaHorariaEstudio(
          acceso?.personal?.estudio.zonaHoraria,
          acceso?.personal?.estudio.pais,
        ),
        acceso?.personal?.estudio.pais,
      );
      if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
        return respuesta.code(400).send({ error: 'Formato de fecha inválido. Use YYYY-MM-DD' });
      }

      const fechaAlta = acceso?.personal?.creadoEn
        ? obtenerFechaAltaPersonal(acceso.personal.creadoEn)
        : null;

      if (fechaAlta && fecha < fechaAlta) {
        return respuesta.send({ datos: [] });
      }

      const reservas = await prisma.reserva.findMany({
        where: {
          personalId: payload.personalId,
          fecha,
        },
        orderBy: { horaInicio: 'asc' },
        include: incluirServiciosDetalleReserva,
      });

      return respuesta.send({ datos: reservas.map(serializarReservaApi) });
    },
  );

  servidor.get<{ Querystring: { mes: string } }>(
    '/empleados/mi-agenda-mes',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as PayloadJWT;
      if (payload.rol !== 'empleado') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      if (!payload.personalId) {
        return respuesta.code(400).send({ error: 'Token inválido: falta personalId' });
      }

      const acceso = await prisma.empleadoAcceso.findUnique({
        where: { id: payload.sub },
        select: {
          personal: {
            select: {
              creadoEn: true,
            },
          },
        },
      });

      const mes = solicitud.query.mes;
      if (!/^\d{4}-\d{2}$/.test(mes)) {
        return respuesta.code(400).send({ error: 'Formato de mes inválido. Use YYYY-MM' });
      }

      const [anioTexto, mesTexto] = mes.split('-');
      const anio = Number(anioTexto);
      const mesNumero = Number(mesTexto);
      const inicioMes = `${anio}-${String(mesNumero).padStart(2, '0')}-01`;
      const finMes = new Date(anio, mesNumero, 0).toISOString().split('T')[0]!;
      const fechaAlta = acceso?.personal?.creadoEn
        ? obtenerFechaAltaPersonal(acceso.personal.creadoEn)
        : null;

      if (fechaAlta && finMes < fechaAlta) {
        return respuesta.send({ datos: [] });
      }

      const inicioConsulta = fechaAlta && fechaAlta > inicioMes ? fechaAlta : inicioMes;

      const reservas = await prisma.reserva.findMany({
        where: {
          personalId: payload.personalId,
          fecha: { gte: inicioConsulta, lte: finMes },
        },
        orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
        include: incluirServiciosDetalleReserva,
      });

      return respuesta.send({ datos: reservas.map(serializarReservaApi) });
    },
  );

  // ─── GET /empleados/mis-metricas (rol empleado) ──────────────────────────
  servidor.get(
    '/empleados/mis-metricas',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as PayloadJWT;
      if (payload.rol !== 'empleado') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      if (!payload.personalId) {
        return respuesta.code(400).send({ error: 'Token inválido: falta personalId' });
      }

      const acceso = await prisma.empleadoAcceso.findUnique({
        where: { id: payload.sub },
        select: {
          personal: {
            select: {
              creadoEn: true,
              estudio: {
                select: { zonaHoraria: true, pais: true },
              },
            },
          },
        },
      });

      const zona = normalizarZonaHorariaEstudio(
        acceso?.personal?.estudio.zonaHoraria,
        acceso?.personal?.estudio.pais,
      );
      const hoyISO = obtenerFechaISOEnZona(new Date(), zona, acceso?.personal?.estudio.pais);
      const partes = hoyISO.split('-').map(Number);
      const anio = partes[0]!;
      const mes = partes[1]!;
      const dia = partes[2]!;
      const fechaHoy = new Date(anio, mes - 1, dia);
      const diaSemana = fechaHoy.getDay();
      const inicioSemana = new Date(fechaHoy);
      inicioSemana.setDate(fechaHoy.getDate() - diaSemana);
      const finSemana = new Date(inicioSemana);
      finSemana.setDate(inicioSemana.getDate() + 6);

      const formatear = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      const inicioSemanaISO = formatear(inicioSemana);
      const finSemanaISO = formatear(finSemana);
      const inicioMesISO = `${anio}-${String(mes).padStart(2, '0')}-01`;
      const finMes = new Date(anio, mes, 0);
      const finMesISO = formatear(finMes);
      const fechaAlta = acceso?.personal?.creadoEn
        ? obtenerFechaAltaPersonal(acceso.personal.creadoEn)
        : null;

      const rangoSemana = fechaAlta && fechaAlta > inicioSemanaISO
        ? { gte: fechaAlta, lte: finSemanaISO }
        : { gte: inicioSemanaISO, lte: finSemanaISO };
      const rangoMes = fechaAlta && fechaAlta > inicioMesISO
        ? { gte: fechaAlta, lte: finMesISO }
        : { gte: inicioMesISO, lte: finMesISO };

      const condicionBase = {
        personalId: payload.personalId,
        estado: { not: 'cancelled' as const },
      };

      const [citasHoy, citasSemana, citasMes] = await Promise.all([
        prisma.reserva.count({
          where: {
            ...condicionBase,
            fecha: hoyISO,
            ...(fechaAlta && hoyISO < fechaAlta ? { id: '__sin_resultados__' } : {}),
          },
        }),
        prisma.reserva.count({ where: { ...condicionBase, fecha: rangoSemana } }),
        prisma.reserva.count({ where: { ...condicionBase, fecha: rangoMes } }),
      ]);

      return respuesta.send({ datos: { citasHoy, citasSemana, citasMes } });
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

      const estadosPermitidos = ['completed', 'confirmed', 'working', 'no_show'];
      if (!estadosPermitidos.includes(solicitud.body.estado)) {
        return respuesta.code(400).send({
          error: 'Estado no permitido para empleado',
          campos: { estado: 'confirmed | working | completed | no_show' },
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

      await prisma.reserva.update({
        where: { id: solicitud.params.id },
        data: { estado: solicitud.body.estado },
      });

      if (solicitud.body.estado === 'confirmed') {
        await prisma.reservaServicio.updateMany({
          where: {
            reservaId: solicitud.params.id,
            estado: { in: ['pending', 'working'] },
          },
          data: { estado: 'confirmed' },
        });
      }

      if (solicitud.body.estado === 'working') {
        await prisma.reservaServicio.updateMany({
          where: {
            reservaId: solicitud.params.id,
            estado: { in: ['pending', 'confirmed'] },
          },
          data: { estado: 'working' },
        });
      }

      if (solicitud.body.estado === 'completed') {
        await prisma.reservaServicio.updateMany({
          where: {
            reservaId: solicitud.params.id,
            estado: { in: ['pending', 'confirmed', 'working'] },
          },
          data: { estado: 'completed' },
        });
      }

      if (solicitud.body.estado === 'no_show') {
        await prisma.reservaServicio.updateMany({
          where: {
            reservaId: solicitud.params.id,
            estado: { in: ['pending', 'confirmed', 'working'] },
          },
          data: { estado: 'no_show' },
        });
      }

      const actualizada = await prisma.reserva.findUnique({
        where: { id: solicitud.params.id },
        include: incluirServiciosDetalleReserva,
      });

      if (!actualizada) {
        return respuesta.code(404).send({ error: 'Reserva no encontrada' });
      }

      console.log(`[Empleado] cambió reserva ${solicitud.params.id} a ${solicitud.body.estado}`);

      return respuesta.send({ datos: serializarReservaApi(actualizada) });
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
          creadoEn: true,
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
              plan: true,
              colorPrimario: true,
              logoUrl: true,
              direccion: true,
              telefono: true,
              emailContacto: true,
              horarioApertura: true,
              horarioCierre: true,
              diasAtencion: true,
              horario: true,
              festivos: true,
              estado: true,
              pais: true,
              claveCliente: true,
              slug: true,
              servicios: true,
            },
          },
        },
      });

      const acceso = await prisma.empleadoAcceso.findUnique({
        where: { id: payload.sub },
        select: { email: true },
      });

      if (!personal) return respuesta.code(404).send({ error: 'Perfil no encontrado' });

      return respuesta.send({ datos: { ...personal, email: acceso?.email ?? payload.email ?? '' } });
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

      if (!(await compararHashContrasena(contrasenaActual, acceso.hashContrasena))) {
        return respuesta.code(401).send({ error: 'Contraseña actual incorrecta' });
      }

      const nuevoHash = await generarHashContrasena(contrasenaNueva);
      await prisma.empleadoAcceso.update({ where: { id: acceso.id }, data: { hashContrasena: nuevoHash, forzarCambioContrasena: false } });

      await revocarSesionesPorSujeto('empleado_acceso', acceso.id, 'contrasena_actualizada');

      return respuesta.send({ datos: { mensaje: 'Contraseña actualizada correctamente' } });
    },
  );

  // ─── GET /estudio/:id/personal/:personalId/acceso (rol dueno) ────────────
  servidor.get<{ Params: { id: string; personalId: string } }>(
    '/estudio/:id/personal/:personalId/acceso',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as PayloadJWT;
      if (payload.rol !== 'dueno' && payload.rol !== 'maestro' && payload.rol !== 'vendedor') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      if (payload.rol !== 'maestro' && !tieneAccesoPropietarioDemo(payload, solicitud.params.id)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const acceso = await prisma.empleadoAcceso.findUnique({
        where: { personalId: solicitud.params.personalId },
        select: {
          id: true,
          personalId: true,
          email: true,
          activo: true,
          ultimoAcceso: true,
          creadoEn: true,
          forzarCambioContrasena: true,
          personal: {
            select: {
              activo: true,
            },
          },
        },
      });

      if (!acceso) {
        return respuesta.send({ datos: null });
      }

      const desactivadoHasta = await obtenerDesactivadoHastaPersonal(solicitud.params.personalId);

      return respuesta.send({
        datos: {
          id: acceso.id,
          personalId: acceso.personalId,
          email: acceso.email,
          activo: acceso.activo,
          ultimoAcceso: acceso.ultimoAcceso,
          creadoEn: acceso.creadoEn,
          forzarCambioContrasena: acceso.forzarCambioContrasena,
          personalActivo: acceso.personal?.activo ?? true,
          desactivadoHasta,
        },
      });
    },
  );

  // ─── POST /estudio/:id/personal/:personalId/crear-acceso (rol dueno) ─────
  servidor.post<{
    Params: { id: string; personalId: string };
    Body: { email: string; contrasena?: string; forzarCambioContrasena?: boolean };
  }>(
    '/estudio/:id/personal/:personalId/crear-acceso',
    {
      preHandler: verificarJWT,
      config: {
        rateLimit: {
          max: 3,
          timeWindow: '1 hour',
          errorResponseBuilder: () => ({
            error: 'Demasiados intentos de alta o restablecimiento de acceso. Espera 1 hora.',
          }),
        },
      },
    },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as PayloadJWT;
      if (!tieneAccesoPropietarioDemo(payload, solicitud.params.id)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const esquema = z.object({
        email: emailSchema,
        contrasena: z.string().trim().optional(),
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

      const accesoExistente = await prisma.empleadoAcceso.findUnique({
        where: { personalId: solicitud.params.personalId },
        select: { id: true },
      });

      const contrasenaLimpia = contrasena?.trim() ?? '';
      if (!accesoExistente && !contrasenaLimpia) {
        return respuesta.code(400).send({ error: 'La contraseña temporal es obligatoria para crear el acceso' });
      }

      if (contrasenaLimpia && !REGEX_CONTRASENA_SEGURA.test(contrasenaLimpia)) {
        return respuesta.code(400).send({
          error: 'La contraseña debe tener al menos 8 caracteres, una mayúscula, un número y un símbolo',
        });
      }

      const hashContrasena = contrasenaLimpia ? await generarHashContrasena(contrasenaLimpia) : null;

      const acceso = await prisma.empleadoAcceso.upsert({
        where: { personalId: solicitud.params.personalId },
        create: {
          personalId: solicitud.params.personalId,
          email,
          hashContrasena: hashContrasena!,
          activo: true,
          forzarCambioContrasena: forzarCambioContrasena ?? false,
        },
        update: {
          email,
          activo: true,
          forzarCambioContrasena: forzarCambioContrasena ?? false,
          ...(hashContrasena ? { hashContrasena } : {}),
        },
        select: {
          id: true,
          personalId: true,
          email: true,
          activo: true,
          creadoEn: true,
          actualizadoEn: true,
          forzarCambioContrasena: true,
          personal: {
            select: {
              activo: true,
            },
          },
        },
      });

      await actualizarEstadoProgramadoPersonal({
        personalId: solicitud.params.personalId,
        activo: true,
        desactivarHasta: null,
      });

      if (accesoExistente) {
        await revocarSesionesPorSujeto('empleado_acceso', acceso.id, 'credenciales_actualizadas_por_dueno');
      }

      if (contrasenaLimpia) {
        void enviarEmailBienvenidaEmpleado({
          email,
          nombreEmpleado: personal.nombre,
          nombreSalon: personal.estudio.nombre,
          contrasenaTemp: contrasenaLimpia,
          urlLogin: `${env.FRONTEND_URL}/iniciar-sesion`,
          forzarCambioContrasena: forzarCambioContrasena ?? false,
        });
      }

      return respuesta.code(201).send({
        datos: {
          id: acceso.id,
          personalId: acceso.personalId,
          email: acceso.email,
          activo: acceso.activo,
          creadoEn: acceso.creadoEn,
          actualizadoEn: acceso.actualizadoEn,
          forzarCambioContrasena: acceso.forzarCambioContrasena,
          personalActivo: acceso.personal?.activo ?? true,
          desactivadoHasta: null,
        },
      });
    },
  );

  // ─── PUT /estudio/:id/personal/:personalId/acceso (rol dueno) ────────────
  servidor.put<{
    Params: { id: string; personalId: string };
    Body: { activo: boolean; desactivarHasta?: string | null };
  }>(
    '/estudio/:id/personal/:personalId/acceso',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as PayloadJWT;
      if (!tieneAccesoPropietarioDemo(payload, solicitud.params.id)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const esquema = z.object({
        activo: z.boolean(),
        desactivarHasta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
      });
      const resultado = esquema.safeParse(solicitud.body);
      if (!resultado.success) {
        return respuesta.code(400).send({ error: 'Datos inválidos para actualizar el acceso del especialista' });
      }

      const personal = await prisma.personal.findFirst({
        where: { id: solicitud.params.personalId, estudioId: solicitud.params.id },
        select: { id: true },
      });
      if (!personal) {
        return respuesta.code(404).send({ error: 'Especialista no encontrado en este salón' });
      }

      const acceso = await prisma.empleadoAcceso.findUnique({ where: { personalId: solicitud.params.personalId } });

      if (!resultado.data.activo && resultado.data.desactivarHasta) {
        const hoy = new Date();
        const fechaHasta = new Date(`${resultado.data.desactivarHasta}T00:00:00`);
        if (Number.isNaN(fechaHasta.getTime()) || fechaHasta < new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate())) {
          return respuesta.code(400).send({ error: 'La fecha de reactivación debe ser hoy o una fecha futura' });
        }
      }

      await actualizarEstadoProgramadoPersonal({
        personalId: solicitud.params.personalId,
        activo: resultado.data.activo,
        desactivarHasta: resultado.data.activo ? null : (resultado.data.desactivarHasta ?? null),
      });

      if (acceso && !resultado.data.activo) {
        await revocarSesionesPorSujeto('empleado_acceso', acceso.id, 'acceso_desactivado_por_dueno');
      }

      if (!acceso) {
        return respuesta.send({ datos: null });
      }

      const actualizado = await prisma.empleadoAcceso.findUnique({
        where: { id: acceso.id },
        select: {
          id: true,
          personalId: true,
          email: true,
          activo: true,
          ultimoAcceso: true,
          creadoEn: true,
          forzarCambioContrasena: true,
          personal: {
            select: {
              activo: true,
            },
          },
        },
      });

      const desactivadoHasta = await obtenerDesactivadoHastaPersonal(solicitud.params.personalId);

      if (!actualizado) {
        return respuesta.send({ datos: null });
      }

      return respuesta.send({
        datos: {
          id: actualizado.id,
          personalId: actualizado.personalId,
          email: actualizado.email,
          activo: actualizado.activo,
          ultimoAcceso: actualizado.ultimoAcceso,
          creadoEn: actualizado.creadoEn,
          forzarCambioContrasena: actualizado.forzarCambioContrasena,
          personalActivo: actualizado.personal?.activo ?? true,
          desactivadoHasta,
        },
      });
    },
  );

  // ─── DELETE /estudio/:id/personal/:personalId/acceso (rol dueno) ─────────
  servidor.delete<{ Params: { id: string; personalId: string } }>(
    '/estudio/:id/personal/:personalId/acceso',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as PayloadJWT;
      if (!tieneAccesoPropietarioDemo(payload, solicitud.params.id)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const acceso = await prisma.empleadoAcceso.findUnique({
        where: { personalId: solicitud.params.personalId },
      });
      if (!acceso) return respuesta.code(404).send({ error: 'Este especialista no tiene acceso configurado' });

      await prisma.empleadoAcceso.update({
        where: { id: acceso.id },
        data: { activo: false },
      });

      await revocarSesionesPorSujeto('empleado_acceso', acceso.id, 'acceso_desactivado_por_dueno');

      return respuesta.send({ datos: { mensaje: 'Acceso desactivado correctamente' } });
    },
  );
}
