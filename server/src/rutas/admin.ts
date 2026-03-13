import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../prismaCliente.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import { requierePermiso } from '../middleware/verificarPermiso.js';
import { resolverCategoriasSalon } from '../lib/categoriasSalon.js';
import { cacheSalonesPublicos } from '../lib/cache.js';
import { enviarEmailBienvenidaSalon, enviarEmailRechazoSalon, enviarEmailCancelacionProcesada, enviarEmailRecordatorioPagoSalon } from '../servicios/servicioEmail.js';
import { registrarAuditoria } from '../utils/auditoria.js';
import { emailSchema, obtenerMensajeValidacion, telefonoSchema, textoSchema } from '../lib/validacion.js';

const esquemaRechazoSolicitud = z.object({
  motivo: textoSchema('motivo', 500, 10),
});

const esquemaCrearSalonAdmin = z.object({
  nombreSalon: textoSchema('nombreSalon', 120, 2),
  nombreAdmin: textoSchema('nombreAdmin', 120, 2),
  email: emailSchema,
  contrasena: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  telefono: telefonoSchema,
  pais: z.enum(['Mexico', 'Colombia']).optional().default('Mexico'),
  personal: z.array(z.object({
    nombre: textoSchema('nombre', 120, 2),
    especialidades: z.array(z.string().trim()).default([]),
    horaInicio: z.string().optional(),
    horaFin: z.string().optional(),
    descansoInicio: z.string().optional(),
    descansoFin: z.string().optional(),
  })).optional().default([]),
});

function generarContrasenaAleatoria(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  result += 'ABCDEFGH'[Math.floor(Math.random() * 8)];
  result += '23456789'[Math.floor(Math.random() * 8)];
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

function diasDesde(fecha: Date): number {
  return Math.floor((Date.now() - fecha.getTime()) / (1000 * 60 * 60 * 24));
}

function obtenerFechaISOActual(): string {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return hoy.toISOString().split('T')[0]!;
}

function crearFechaDesdeISO(fechaISO: string): Date {
  const [anio, mes, dia] = fechaISO.split('-').map(Number);
  return new Date(anio!, (mes! - 1), dia!);
}

function formatearFechaISO(fecha: Date): string {
  return fecha.toISOString().split('T')[0]!;
}

function calcularNuevaFechaVencimiento(params: {
  fechaVencimiento?: string | null;
  inicioSuscripcion?: string | null;
  meses: number;
}): {
  fechaBase: string;
  nuevaFechaVencimiento: string;
  estrategia: 'desde_vencimiento_actual' | 'desde_hoy';
} {
  const hoy = obtenerFechaISOActual();
  const fechaReferencia = params.fechaVencimiento || params.inicioSuscripcion || hoy;
  const fechaBase = fechaReferencia >= hoy ? fechaReferencia : hoy;
  const fechaCalculada = crearFechaDesdeISO(fechaBase);
  fechaCalculada.setMonth(fechaCalculada.getMonth() + params.meses);

  return {
    fechaBase,
    nuevaFechaVencimiento: formatearFechaISO(fechaCalculada),
    estrategia: fechaReferencia >= hoy ? 'desde_vencimiento_actual' : 'desde_hoy',
  };
}

function clasificarEstadoSalon(params: {
  estado: 'pendiente' | 'aprobado' | 'rechazado' | 'suspendido';
  activo: boolean;
  duenoActivo?: boolean;
}): 'pendiente' | 'aprobado' | 'rechazado' | 'suspendido' {
  if (params.estado === 'rechazado' || params.estado === 'pendiente') {
    return params.estado;
  }

  if (params.estado === 'suspendido' || !params.activo || params.duenoActivo === false) {
    return 'suspendido';
  }

  return 'aprobado';
}

export async function rutasAdmin(servidor: FastifyInstance): Promise<void> {
  /**
   * GET /admin/salones — lista todos los estudios con su usuario y último acceso
   * Soporta ?estado=pendiente|aprobado|rechazado|suspendido&pagina=1&limite=20
   */
  servidor.get<{ Querystring: { estado?: string; pagina?: string; limite?: string } }>(
    '/admin/salones',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { estado, pagina: paginaStr, limite: limiteStr } = solicitud.query;
      const pagina = Math.max(1, parseInt(paginaStr ?? '1', 10));
      const limite = Math.min(100, Math.max(1, parseInt(limiteStr ?? '50', 10)));
      const saltar = (pagina - 1) * limite;

      const estadosValidos = ['pendiente', 'aprobado', 'rechazado', 'suspendido'];
      const estadoSolicitado =
        estado && estadosValidos.includes(estado)
          ? (estado as 'pendiente' | 'aprobado' | 'rechazado' | 'suspendido')
          : null;

      const estudios = await prisma.estudio.findMany({
        include: {
          usuarios: {
            where: { rol: 'dueno' },
            select: { id: true, email: true, nombre: true, ultimoAcceso: true, activo: true },
            take: 1,
          },
        },
        orderBy: { creadoEn: 'asc' },
      });

      const auditorias = await prisma.auditLog.findMany({
        where: {
          entidadTipo: 'estudio',
          entidadId: { in: estudios.map((estudio) => estudio.id) },
          accion: { in: ['aprobar_salon', 'renovar_suscripcion'] },
        },
        include: {
          usuario: { select: { nombre: true, email: true } },
        },
        orderBy: { creadoEn: 'desc' },
      });

      const aprobacionesPorEstudio = new Map<string, (typeof auditorias)[number]>();
      const renovacionesPorEstudio = new Map<string, (typeof auditorias)[number]>();

      auditorias.forEach((auditoria) => {
        if (auditoria.accion === 'aprobar_salon' && !aprobacionesPorEstudio.has(auditoria.entidadId)) {
          aprobacionesPorEstudio.set(auditoria.entidadId, auditoria);
        }

        if (auditoria.accion === 'renovar_suscripcion' && !renovacionesPorEstudio.has(auditoria.entidadId)) {
          renovacionesPorEstudio.set(auditoria.entidadId, auditoria);
        }
      });

      const estudiosNormalizados = estudios
        .map((estudio) => {
          const dueno = estudio.usuarios[0];
          const estadoNormalizado = clasificarEstadoSalon({
            estado: estudio.estado,
            activo: estudio.activo,
            duenoActivo: dueno?.activo,
          });
          const aprobacion = aprobacionesPorEstudio.get(estudio.id);
          const renovacion = renovacionesPorEstudio.get(estudio.id);

          return {
            ...estudio,
            estado: estadoNormalizado,
            aprobadoPorNombre: aprobacion?.usuario.nombre ?? null,
            aprobadoPorEmail: aprobacion?.usuario.email ?? null,
            renovadoPorNombre: renovacion?.usuario.nombre ?? null,
            renovadoPorEmail: renovacion?.usuario.email ?? null,
          };
        })
        .filter((estudio) => (estadoSolicitado ? estudio.estado === estadoSolicitado : true));

      const total = estudiosNormalizados.length;
      const items = estudiosNormalizados.slice(saltar, saltar + limite);
      return respuesta.send({ datos: items, total, pagina, totalPaginas: Math.ceil(total / limite) });
    },
  );

  /**
   * GET /admin/solicitudes — estudios con estado pendiente ordenados por fechaSolicitud
   * Soporta ?pagina=1&limite=20
   */
  servidor.get<{ Querystring: { pagina?: string; limite?: string } }>(
    '/admin/solicitudes',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const pagina = Math.max(1, parseInt(solicitud.query.pagina ?? '1', 10));
      const limite = Math.min(100, Math.max(1, parseInt(solicitud.query.limite ?? '50', 10)));
      const saltar = (pagina - 1) * limite;

      const [total, solicitudes] = await Promise.all([
        prisma.estudio.count({ where: { estado: 'pendiente' } }),
        prisma.estudio.findMany({
          where: { estado: 'pendiente' },
          include: {
            usuarios: {
              where: { rol: 'dueno' },
              select: { id: true, email: true, nombre: true },
              take: 1,
            },
          },
          orderBy: { fechaSolicitud: 'asc' },
          skip: saltar,
          take: limite,
        }),
      ]);

      const datos = solicitudes.map((s) => ({
        ...s,
        diasDesdeRegistro: diasDesde(s.fechaSolicitud),
        dueno: s.usuarios[0] ?? null,
      }));

      return respuesta.send({ datos, total, pagina, totalPaginas: Math.ceil(total / limite) });
    },
  );

  /**
   * GET /admin/solicitudes/:id — detalle completo de una solicitud
   */
  servidor.get<{ Params: { id: string } }>(
    '/admin/solicitudes/:id',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { id } = solicitud.params;
      const estudio = await prisma.estudio.findUnique({
        where: { id },
        include: {
          usuarios: {
            where: { rol: 'dueno' },
            select: { id: true, email: true, nombre: true, activo: true },
            take: 1,
          },
        },
      });

      if (!estudio) {
        return respuesta.code(404).send({ error: 'Solicitud no encontrada' });
      }

      const categoriasFormateadas = estudio.categorias
        ? estudio.categorias.split(',').map((c) => c.trim()).filter(Boolean)
        : [];

      return respuesta.send({
        datos: {
          ...estudio,
          categoriasFormateadas,
          dueno: estudio.usuarios[0] ?? null,
          diasDesdeRegistro: diasDesde(estudio.fechaSolicitud),
        },
      });
    },
  );

  /**
   * POST /admin/solicitudes/:id/aprobar — aprueba un salón
   */
  servidor.post<{ Params: { id: string }; Body?: { fechaVencimiento?: string } }>(
    '/admin/solicitudes/:id/aprobar',
    { preHandler: [verificarJWT, requierePermiso('aprobarSalones')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; sub: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { id } = solicitud.params;
      const fechaVencimiento = solicitud.body?.fechaVencimiento ?? (() => {
        const porDefecto = new Date();
        porDefecto.setDate(porDefecto.getDate() + 30);
        return porDefecto.toISOString().split('T')[0]!;
      })();

      const estudio = await prisma.estudio.findUnique({
        where: { id },
        include: { usuarios: { where: { rol: 'dueno' }, take: 1 } },
      });

      if (!estudio) {
        return respuesta.code(404).send({ error: 'Salón no encontrado' });
      }

      let usuario = estudio.usuarios[0] ?? null;
      if (!usuario && estudio.emailContacto) {
        usuario = await prisma.usuario.findFirst({
          where: { rol: 'dueno', email: estudio.emailContacto },
        });
      }

      if (!usuario) {
        return respuesta.code(400).send({ error: 'El salón no tiene usuario dueño' });
      }

      const [estudioActualizado] = await prisma.$transaction([
        prisma.estudio.update({
          where: { id },
          data: {
            estado: 'aprobado',
            activo: true,
            fechaAprobacion: new Date(),
            fechaVencimiento,
            categorias: resolverCategoriasSalon({
              categorias: estudio.categorias,
              servicios: estudio.servicios,
              serviciosCustom: estudio.serviciosCustom,
            }),
          },
        }),
        prisma.usuario.update({
          where: { id: usuario.id },
          data: { activo: true, estudioId: id },
        }),
      ]);

      console.log('[Admin] Salón aprobado:', estudio.nombre);
      cacheSalonesPublicos.flushAll(); // invalidar caché de salones públicos

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'aprobar_salon',
        entidadTipo: 'estudio',
        entidadId: id,
        detalles: { nombre: estudio.nombre, fechaVencimiento },
        ip: solicitud.ip,
      });

      void enviarEmailBienvenidaSalon({
        emailDestino: usuario.email,
        nombreDueno: usuario.nombre || estudio.propietario,
        nombreSalon: estudio.nombre,
        fechaVencimiento,
      });

      return respuesta.send({
        datos: {
          ...estudioActualizado,
          mensaje: 'Salón aprobado correctamente',
        },
      });
    },
  );

  /**
   * POST /admin/solicitudes/:id/rechazar — rechaza un salón con motivo
   */
  servidor.post<{ Params: { id: string }; Body: { motivo: string } }>(
    '/admin/solicitudes/:id/rechazar',
    { preHandler: [verificarJWT, requierePermiso('aprobarSalones')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; sub: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { id } = solicitud.params;
      const resultado = esquemaRechazoSolicitud.safeParse(solicitud.body);
      if (!resultado.success) {
        return respuesta.code(400).send({ error: obtenerMensajeValidacion(resultado.error) });
      }

      const { motivo } = resultado.data;

      const estudio = await prisma.estudio.findUnique({
        where: { id },
        include: { usuarios: { where: { rol: 'dueno' }, take: 1 } },
      });

      if (!estudio) {
        return respuesta.code(404).send({ error: 'Salón no encontrado' });
      }

      await prisma.estudio.update({
        where: { id },
        data: { estado: 'rechazado', motivoRechazo: motivo.trim() },
      });

      console.log('[Admin] Salón rechazado:', estudio.nombre);
      cacheSalonesPublicos.flushAll(); // invalidar caché de salones públicos

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'rechazar_salon',
        entidadTipo: 'estudio',
        entidadId: id,
        detalles: { nombre: estudio.nombre, motivo: motivo.trim() },
        ip: solicitud.ip,
      });

      const dueno = estudio.usuarios[0] ?? null;
      if (dueno?.email) {
        void enviarEmailRechazoSalon({
          emailDestino: dueno.email,
          nombreDueno: dueno.nombre || estudio.propietario,
          nombreSalon: estudio.nombre,
          motivo: motivo.trim(),
        });
      }

      return respuesta.send({ datos: { mensaje: 'Solicitud rechazada' } });
    },
  );

  /**
   * POST /admin/solicitudes/:id/reactivar — vuelve un salón rechazado a pendiente
   */
  servidor.post<{ Params: { id: string } }>(
    '/admin/solicitudes/:id/reactivar',
    { preHandler: [verificarJWT, requierePermiso('aprobarSalones')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { id } = solicitud.params;
      const estudio = await prisma.estudio.findUnique({ where: { id } });
      if (!estudio) {
        return respuesta.code(404).send({ error: 'Salón no encontrado' });
      }

      await prisma.estudio.update({
        where: { id },
        data: { estado: 'pendiente', motivoRechazo: null, fechaSolicitud: new Date() },
      });

      return respuesta.send({ datos: { mensaje: 'Solicitud reactivada' } });
    },
  );

  /**
   * POST /admin/salones — crea estudio + usuario dueño + personal inicial en transacción
   */
  servidor.post<{
    Body: {
      nombreSalon: string;
      nombreAdmin: string;
      email: string;
      contrasena: string;
      telefono?: string;
      pais?: string;
      personal?: Array<{
        nombre: string;
        especialidades: string[];
        horaInicio?: string;
        horaFin?: string;
        descansoInicio?: string;
        descansoFin?: string;
      }>;
    };
  }>(
    '/admin/salones',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const resultado = esquemaCrearSalonAdmin.safeParse(solicitud.body);
      if (!resultado.success) {
        return respuesta.code(400).send({ error: obtenerMensajeValidacion(resultado.error) });
      }

      const {
        nombreSalon,
        nombreAdmin,
        email,
        contrasena,
        telefono,
        pais,
        personal,
      } = resultado.data;

      const emailNorm = email.trim().toLowerCase();
      const existente = await prisma.usuario.findUnique({ where: { email: emailNorm } });
      if (existente) {
        return respuesta.code(409).send({ error: 'Ya existe un usuario con ese email' });
      }

      const hashContrasena = await bcrypt.hash(contrasena, 12);

      // Generar claves únicas automáticamente
      const BASE = nombreSalon.toUpperCase().replace(/\s+/g, '').slice(0, 8);
      const sufijo = crypto.randomBytes(3).toString('hex').toUpperCase();
      const claveDueno = `${BASE}${sufijo}`;
      const claveCliente = `${BASE}CLI${sufijo}`;

      const ahora = new Date();
      const vencimiento = new Date(ahora);
      vencimiento.setMonth(vencimiento.getMonth() + 1);

      const formatearFecha = (d: Date) => d.toISOString().split('T')[0]!;

      const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
      const horario = Object.fromEntries(
        diasSemana.map((dia) => [dia, { isOpen: dia !== 'Domingo', openTime: '09:00', closeTime: '19:00' }]),
      );

      const [estudio] = await prisma.$transaction(async (tx) => {
        const nuevoEstudio = await tx.estudio.create({
          data: {
            nombre: nombreSalon,
            propietario: nombreAdmin,
            telefono,
            pais,
            sucursales: [nombreSalon],
            claveDueno,
            claveCliente,
            inicioSuscripcion: formatearFecha(ahora),
            fechaVencimiento: formatearFecha(vencimiento),
            horario,
            servicios: [],
            serviciosCustom: [],
            festivos: [],
          },
        });

        const nuevoUsuario = await tx.usuario.create({
          data: {
            email: emailNorm,
            hashContrasena,
            nombre: nombreAdmin,
            rol: 'dueno',
            estudioId: nuevoEstudio.id,
          },
        });

        if (personal.length > 0) {
          await tx.personal.createMany({
            data: personal.map((p) => ({
              estudioId: nuevoEstudio.id,
              nombre: p.nombre,
              especialidades: p.especialidades,
              horaInicio: p.horaInicio ?? null,
              horaFin: p.horaFin ?? null,
              descansoInicio: p.descansoInicio ?? null,
              descansoFin: p.descansoFin ?? null,
            })),
          });
        }

        return [nuevoEstudio, nuevoUsuario];
      });

      return respuesta.code(201).send({ datos: estudio });
    },
  );

  /**
   * PUT /admin/salones/:id/suspender — activa o desactiva el acceso
   */
  servidor.put<{ Params: { id: string } }>(
    '/admin/salones/:id/suspender',
    { preHandler: [verificarJWT, requierePermiso('suspenderSalones')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; sub: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { id } = solicitud.params;

      const estudio = await prisma.estudio.findUnique({
        where: { id },
        include: { usuarios: { where: { rol: 'dueno' }, take: 1 } },
      });

      if (!estudio) {
        return respuesta.code(404).send({ error: 'Salón no encontrado' });
      }

      let usuario = estudio.usuarios[0] ?? null;
      if (!usuario && estudio.emailContacto) {
        usuario = await prisma.usuario.findFirst({
          where: { rol: 'dueno', email: estudio.emailContacto },
        });
      }

      const estaActivo = usuario?.activo ?? estudio.activo;
      const nuevoActivo = !estaActivo;
      const nuevoEstado = nuevoActivo ? 'aprobado' : 'suspendido';

      await prisma.$transaction(async (tx) => {
        await tx.estudio.update({
          where: { id },
          data: { activo: nuevoActivo, estado: nuevoEstado },
        });

        if (usuario) {
          await tx.usuario.update({
            where: { id: usuario.id },
            data: { activo: nuevoActivo, estudioId: id },
          });
        }
      });

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: nuevoActivo ? 'activar_salon' : 'suspender_salon',
        entidadTipo: 'estudio',
        entidadId: id,
        ip: solicitud.ip,
      });

      return respuesta.send({
        datos: { activo: nuevoActivo, mensaje: nuevoActivo ? 'Cuenta activada' : 'Cuenta suspendida' },
      });
    },
  );

  /**
   * PUT /admin/salones/:id/reset-contrasena — genera contraseña temporal y la devuelve
   */
  servidor.put<{ Params: { id: string } }>(
    '/admin/salones/:id/reset-contrasena',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { id } = solicitud.params;

      const usuario = await prisma.usuario.findFirst({
        where: { estudioId: id, rol: 'dueno' },
      });

      if (!usuario) {
        return respuesta.code(404).send({ error: 'Usuario dueño no encontrado para este salón' });
      }

      const contrasenaTemporal = generarContrasenaAleatoria();
      const nuevoHash = await bcrypt.hash(contrasenaTemporal, 12);

      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { hashContrasena: nuevoHash },
      });

      // Se devuelve la contraseña en texto plano UNA sola vez — el frontend la muestra y no la almacena
      return respuesta.send({
        datos: { contrasenaTemporal, email: usuario.email },
      });
    },
  );

  servidor.put<{
    Params: { id: string };
    Body: { fechaVencimiento?: string; meses?: number };
  }>(
    '/admin/salones/:id',
    { preHandler: [verificarJWT, requierePermiso('gestionarPagos')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; sub: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { id } = solicitud.params;
      const { fechaVencimiento, meses } = solicitud.body;

      if (!fechaVencimiento && !meses) {
        return respuesta.code(400).send({ error: 'fechaVencimiento o meses es requerido' });
      }

      const estudio = await prisma.estudio.findUnique({ where: { id } });
      if (!estudio) {
        return respuesta.code(404).send({ error: 'Salón no encontrado' });
      }

      const renovacion = meses && meses > 0
        ? calcularNuevaFechaVencimiento({
            fechaVencimiento: estudio.fechaVencimiento,
            inicioSuscripcion: estudio.inicioSuscripcion,
            meses,
          })
        : null;

      const fechaFinal = renovacion?.nuevaFechaVencimiento ?? fechaVencimiento!;

      const actualizado = await prisma.estudio.update({
        where: { id },
        data: { fechaVencimiento: fechaFinal },
      });

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'renovar_suscripcion',
        entidadTipo: 'estudio',
        entidadId: id,
        detalles: {
          nombre: estudio.nombre,
          fechaBase: renovacion?.fechaBase ?? estudio.fechaVencimiento,
          fechaVencimientoAnterior: estudio.fechaVencimiento,
          fechaVencimientoNueva: fechaFinal,
          estrategia: renovacion?.estrategia ?? 'manual',
          meses: meses ?? null,
        },
        ip: solicitud.ip,
      });

      return respuesta.send({
        datos: {
          fechaVencimiento: actualizado.fechaVencimiento,
          fechaBaseRenovacion: renovacion?.fechaBase ?? estudio.fechaVencimiento,
          estrategiaRenovacion: renovacion?.estrategia ?? 'manual',
          mensaje: renovacion
            ? 'Suscripción extendida correctamente'
            : 'Suscripción renovada correctamente',
        },
      });
    },
  );

  servidor.post<{ Params: { id: string } }>(
    '/admin/salones/:id/recordatorio-pago',
    { preHandler: [verificarJWT, requierePermiso('gestionarPagos')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; sub: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const estudio = await prisma.estudio.findUnique({
        where: { id: solicitud.params.id },
        include: {
          usuarios: {
            where: { rol: 'dueno' },
            take: 1,
            select: { email: true, nombre: true },
          },
        },
      });

      if (!estudio) {
        return respuesta.code(404).send({ error: 'Salón no encontrado' });
      }

      const dueno = estudio.usuarios[0];
      if (!dueno?.email) {
        return respuesta.code(400).send({ error: 'El salón no tiene correo de contacto del dueño' });
      }

      await enviarEmailRecordatorioPagoSalon({
        email: dueno.email,
        nombreDueno: dueno.nombre || 'equipo del salón',
        nombreSalon: estudio.nombre,
        fechaVencimiento: estudio.fechaVencimiento,
      });

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'recordatorio_pago_salon',
        entidadTipo: 'estudio',
        entidadId: estudio.id,
        detalles: {
          nombre: estudio.nombre,
          fechaVencimiento: estudio.fechaVencimiento,
          emailDestino: dueno.email,
        },
        ip: solicitud.ip,
      });

      return respuesta.send({ datos: { mensaje: 'Recordatorio enviado correctamente' } });
    },
  );

  /**
   * GET /admin/metricas — estadísticas globales de la plataforma
   */
  servidor.get(
    '/admin/metricas',
    { preHandler: [verificarJWT, requierePermiso('verMetricas')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const hace30Dias = new Date();
      hace30Dias.setDate(hace30Dias.getDate() - 30);
      const hace30DiasStr = hace30Dias.toISOString().split('T')[0]!;

      const hoy = new Date().toISOString().split('T')[0]!;

      const [
        totalSalones,
        salonesActivos,
        salonesPendientes,
        salonesVencidos,
        totalAdmins,
        totalAuditLogs,
        reservasUltimos30Dias,
        salonesNuevosUltimos30Dias,
        cancelacionesPendientes,
      ] = await Promise.all([
        prisma.estudio.count(),
        prisma.estudio.count({ where: { estado: 'aprobado' } }),
        prisma.estudio.count({ where: { estado: 'pendiente' } }),
        prisma.estudio.count({
          where: { estado: 'aprobado', fechaVencimiento: { lt: hoy } },
        }),
        prisma.usuario.count({ where: { rol: 'maestro', activo: true } }),
        prisma.auditLog.count(),
        prisma.reserva.count({
          where: { fecha: { gte: hace30DiasStr } },
        }),
        prisma.estudio.count({
          where: { creadoEn: { gte: hace30Dias } },
        }),
        prisma.estudio.count({ where: { cancelacionSolicitada: true } }),
      ]);

      return respuesta.send({
        datos: {
          totalSalones,
          salonesActivos,
          salonesPendientes,
          salonesVencidos,
          totalAdmins,
          totalAuditLogs,
          reservasUltimos30Dias,
          salonesNuevosUltimos30Dias,
          cancelacionesPendientes,
        },
      });
    },
  );

  /**
   * GET /admin/cancelaciones — salones con solicitud de cancelación pendiente
   */
  servidor.get(
    '/admin/cancelaciones',
    { preHandler: [verificarJWT, requierePermiso('gestionarPagos')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const salones = await prisma.estudio.findMany({
        where: { cancelacionSolicitada: true },
        select: {
          id: true,
          nombre: true,
          fechaVencimiento: true,
          cancelacionSolicitada: true,
          fechaSolicitudCancelacion: true,
          motivoCancelacion: true,
          usuarios: {
            where: { rol: 'dueno' },
            take: 1,
            select: { id: true, email: true, nombre: true },
          },
        },
        orderBy: { fechaSolicitudCancelacion: 'asc' },
      });

      const datos = salones.map((s) => ({
        id: s.id,
        nombre: s.nombre,
        fechaVencimiento: s.fechaVencimiento,
        cancelacionSolicitada: s.cancelacionSolicitada,
        fechaSolicitudCancelacion: s.fechaSolicitudCancelacion?.toISOString() ?? null,
        motivoCancelacion: s.motivoCancelacion,
        dueno: s.usuarios[0] ?? null,
      }));

      return respuesta.send({ datos });
    },
  );

  /**
   * POST /admin/salones/:id/procesar-cancelacion — aprueba o rechaza la solicitud
   */
  servidor.post<{ Params: { id: string }; Body: { accion: 'aprobar' | 'rechazar'; respuesta?: string } }>(
    '/admin/salones/:id/procesar-cancelacion',
    { preHandler: [verificarJWT, requierePermiso('gestionarPagos')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; sub: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { id } = solicitud.params;
      const { accion, respuesta: respuestaMaestro } = solicitud.body;

      if (accion !== 'aprobar' && accion !== 'rechazar') {
        return respuesta.code(400).send({ error: 'accion debe ser "aprobar" o "rechazar"' });
      }

      const estudio = await prisma.estudio.findUnique({
        where: { id },
        include: { usuarios: { where: { rol: 'dueno' }, take: 1 } },
      });

      if (!estudio) {
        return respuesta.code(404).send({ error: 'Salón no encontrado' });
      }

      if (!estudio.cancelacionSolicitada) {
        return respuesta.code(400).send({ error: 'Este salón no tiene una solicitud de cancelación pendiente' });
      }

      if (accion === 'aprobar') {
        await prisma.$transaction(async (tx) => {
          await tx.estudio.update({
            where: { id },
            data: {
              activo: false,
              estado: 'suspendido',
              cancelacionSolicitada: false,
              fechaSolicitudCancelacion: null,
              motivoCancelacion: null,
            },
          });

          const dueno = estudio.usuarios[0];
          if (dueno) {
            await tx.usuario.update({
              where: { id: dueno.id },
              data: { activo: false },
            });
          }
        });
      } else {
        await prisma.estudio.update({
          where: { id },
          data: {
            cancelacionSolicitada: false,
            fechaSolicitudCancelacion: null,
            motivoCancelacion: null,
          },
        });
      }

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: accion === 'aprobar' ? 'aprobar_cancelacion' : 'rechazar_cancelacion',
        entidadTipo: 'estudio',
        entidadId: id,
        detalles: { nombre: estudio.nombre, accion, respuesta: respuestaMaestro ?? null },
        ip: solicitud.ip,
      });

      const dueno = estudio.usuarios[0];
      if (dueno?.email) {
        void enviarEmailCancelacionProcesada({
          email: dueno.email,
          nombreSalon: estudio.nombre,
          aprobada: accion === 'aprobar',
          respuesta: respuestaMaestro,
        });
      }

      return respuesta.send({
        datos: {
          mensaje: accion === 'aprobar' ? 'Cancelación aprobada. El salón ha sido suspendido.' : 'Solicitud rechazada.',
        },
      });
    },
  );
}
