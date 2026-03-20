import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../prismaCliente.js';
import { env } from '../lib/env.js';
import { enviarEmailResetContrasena, enviarEmailVerificacionCliente } from '../servicios/servicioEmail.js';
import { verificarJWT } from '../middleware/autenticacion.js';

const REFRESH_EXPIRA = env.JWT_REFRESH_EXPIRA_EN;
const COOKIE_REFRESH = 'refresh_token';

const REGEX_CONTRASENA = /^(?=.*[A-Z])(?=.*[0-9]).{8,}$/;
const esquemaCambioEmail = z.object({
  emailNuevo: z.string().trim().email('Ingresa un correo válido'),
});

interface PermisosJWT {
  aprobarSalones: boolean;
  gestionarPagos: boolean;
  crearAdmins: boolean;
  verAuditLog: boolean;
  verMetricas: boolean;
  suspenderSalones: boolean;
}

function crearPermisosVacios(): PermisosJWT {
  return {
    aprobarSalones: false,
    gestionarPagos: false,
    crearAdmins: false,
    verAuditLog: false,
    verMetricas: false,
    suspenderSalones: false,
  };
}

export async function rutasAuth(servidor: FastifyInstance): Promise<void> {
  /**
   * POST /auth/iniciar-sesion
   * Acepta { email, contrasena } para usuarios en base de datos.
   * También acepta { clave } para compatibilidad con la ruta de clientes.
   */
  servidor.post<{ Body: { email?: string; contrasena?: string; clave?: string } }>(
    '/auth/iniciar-sesion',
    {
      config: {
        rateLimit: {
          max: 10,
          timeWindow: '15 minutes',
          errorResponseBuilder: () => ({
            error: 'Demasiados intentos. Espera 15 minutos.',
          }),
        },
      },
    },
    async (solicitud, respuesta) => {
      const { email, contrasena, clave } = solicitud.body;

      // ─── Modo clave (clientes + dueños legados) ───────────────────────────
      if (clave && !email) {
        const claveNorm = clave.trim().toUpperCase();

        const estudioDueno = await prisma.estudio.findFirst({
          where: { claveDueno: claveNorm },
          select: {
            id: true,
            activo: true,
            estado: true,
            usuarios: {
              where: { rol: 'dueno' },
              select: { id: true, nombre: true, email: true, activo: true },
              take: 1,
            },
          },
        });
        if (estudioDueno) {
          const usuarioDueno = estudioDueno.usuarios[0];

          if (!estudioDueno.activo || estudioDueno.estado === 'suspendido') {
            return respuesta.code(403).send({
              error: 'Tu salón está suspendido. Contacta a Beauty Time Pro.',
              codigo: 'SALON_SUSPENDIDO',
            });
          }

          if (!usuarioDueno?.activo) {
            return respuesta.code(403).send({
              error: 'Tu cuenta ha sido desactivada.',
              codigo: 'CUENTA_DESACTIVADA',
            });
          }

          return emitirTokens(servidor, respuesta, {
            sub: usuarioDueno.id,
            rol: 'dueno',
            estudioId: estudioDueno.id,
            nombre: usuarioDueno.nombre,
            email: usuarioDueno.email,
          });
        }

        const estudioCliente = await prisma.estudio.findFirst({
          where: { claveCliente: claveNorm },
          select: { id: true },
        });
        if (estudioCliente) {
          return emitirTokens(servidor, respuesta, {
            sub: estudioCliente.id,
            rol: 'cliente',
            estudioId: estudioCliente.id,
            nombre: '',
            email: '',
          });
        }

        return respuesta.code(401).send({ error: 'Credenciales incorrectas' });
      }

      // ─── Modo email + contraseña ─────────────────────────────────────────
      if (!email || !contrasena) {
        return respuesta.code(400).send({ error: 'Email y contraseña son requeridos' });
      }

      const emailNorm = email.trim().toLowerCase();

      // ─── Verificar si es un ClienteApp (cliente final con cuenta) ──────────
      const clienteApp = await prisma.clienteApp.findUnique({
        where: { email: emailNorm },
        select: { id: true, hashContrasena: true, emailVerificado: true, activo: true, nombre: true, apellido: true },
      });

      if (clienteApp) {
        if (!(await bcrypt.compare(contrasena, clienteApp.hashContrasena))) {
          return respuesta.code(401).send({ error: 'La contraseña es incorrecta.', codigo: 'CONTRASENA_INCORRECTA' });
        }
        if (!clienteApp.activo) {
          return respuesta.code(403).send({ error: 'Cuenta suspendida. Contacta al administrador.' });
        }
        if (!clienteApp.emailVerificado) {
          return respuesta.code(403).send({ error: 'Debes verificar tu correo antes de iniciar sesión.', codigo: 'EMAIL_NO_VERIFICADO' });
        }
        void prisma.clienteApp.update({ where: { id: clienteApp.id }, data: { ultimoAcceso: new Date() } });
        return emitirTokens(servidor, respuesta, {
          sub: clienteApp.id,
          rol: 'cliente',
          estudioId: null,
          nombre: `${clienteApp.nombre} ${clienteApp.apellido}`,
          email: emailNorm,
        });
      }

      // ─── Verificar EmpleadoAcceso ─────────────────────────────────────────
      const empleadoAcceso = await prisma.empleadoAcceso.findUnique({
        where: { email: emailNorm },
        include: { personal: { select: { id: true, nombre: true, estudioId: true } } },
      });

      if (empleadoAcceso) {
        if (!empleadoAcceso.activo) {
          return respuesta.code(403).send({ error: 'Tu acceso ha sido desactivado. Contacta al dueño del salón.' });
        }
        if (!(await bcrypt.compare(contrasena, empleadoAcceso.hashContrasena))) {
          return respuesta.code(401).send({ error: 'La contraseña es incorrecta.', codigo: 'CONTRASENA_INCORRECTA' });
        }
        void prisma.empleadoAcceso.update({ where: { id: empleadoAcceso.id }, data: { ultimoAcceso: new Date() } });
        return emitirTokens(servidor, respuesta, {
          sub: empleadoAcceso.id,
          rol: 'empleado',
          estudioId: empleadoAcceso.personal.estudioId,
          nombre: empleadoAcceso.personal.nombre,
          email: empleadoAcceso.email,
          personalId: empleadoAcceso.personalId,
          forzarCambioContrasena: empleadoAcceso.forzarCambioContrasena,
        });
      }

      // ─── Verificar Usuario (dueño / maestro) ─────────────────────────────
      const usuario = await prisma.usuario.findUnique({
        where: { email: emailNorm },
        include: { estudio: { select: { id: true, estado: true, motivoRechazo: true } } },
      });

      if (!usuario) {
        return respuesta.code(404).send({
          error: 'No existe ninguna cuenta registrada con ese correo.',
          codigo: 'CUENTA_NO_EXISTE',
        });
      }

      if (!(await bcrypt.compare(contrasena, usuario.hashContrasena))) {
        return respuesta.code(401).send({ error: 'La contraseña es incorrecta.', codigo: 'CONTRASENA_INCORRECTA' });
      }

      if (!usuario.activo) {
        if (usuario.rol === 'dueno' && !usuario.estudioId && !usuario.estudio) {
          return respuesta.code(410).send({
            error: 'Esta cuenta fue eliminada definitivamente del sistema. Puedes registrarla de nuevo con este correo.',
            codigo: 'CUENTA_ELIMINADA',
          });
        }

        if (usuario.rol === 'dueno' && usuario.estudio?.estado === 'suspendido') {
          return respuesta.code(403).send({
            error: 'Tu salón está suspendido',
            codigo: 'SALON_SUSPENDIDO',
          });
        }

        // Dueño pendiente de aprobación — verificar estado del estudio
        if (usuario.rol === 'dueno' && usuario.estudio) {
          if (usuario.estudio.estado === 'pendiente') {
            return respuesta.code(403).send({
              error: 'Tu solicitud está siendo revisada',
              codigo: 'PENDIENTE_APROBACION',
            });
          }
          if (usuario.estudio.estado === 'rechazado') {
            return respuesta.code(403).send({
              error: 'Tu solicitud fue rechazada',
              codigo: 'SOLICITUD_RECHAZADA',
              motivo: usuario.estudio.motivoRechazo ?? '',
            });
          }
        }
        return respuesta.code(403).send({ error: 'Esta cuenta existe pero no tiene acceso activo. Contacta al administrador.' });
      }

      if (usuario.rol === 'dueno' && usuario.estudio?.estado === 'suspendido') {
        return respuesta.code(403).send({
          error: 'Tu salón está suspendido',
          codigo: 'SALON_SUSPENDIDO',
        });
      }

      void prisma.usuario.update({
        where: { id: usuario.id },
        data: { ultimoAcceso: new Date() },
      });

      let esMaestroTotal = false;
      let permisosJWT = crearPermisosVacios();
      if (usuario.rol === 'maestro') {
        const permisos = await prisma.permisosMaestro.findUnique({
          where: { usuarioId: usuario.id },
          select: {
            aprobarSalones: true,
            gestionarPagos: true,
            crearAdmins: true,
            verAuditLog: true,
            verMetricas: true,
            suspenderSalones: true,
            esMaestroTotal: true,
          },
        });
        if (permisos) {
          esMaestroTotal = permisos.esMaestroTotal;
          permisosJWT = {
            aprobarSalones: permisos.aprobarSalones,
            gestionarPagos: permisos.gestionarPagos,
            crearAdmins: permisos.crearAdmins,
            verAuditLog: permisos.verAuditLog,
            verMetricas: permisos.verMetricas,
            suspenderSalones: permisos.suspenderSalones,
          };
        } else {
          const totalMaestros = await prisma.usuario.count({ where: { rol: 'maestro' } });
          esMaestroTotal = totalMaestros === 1;
          if (esMaestroTotal) {
            permisosJWT = {
              aprobarSalones: true,
              gestionarPagos: true,
              crearAdmins: true,
              verAuditLog: true,
              verMetricas: true,
              suspenderSalones: true,
            };
          }
        }
      }

      return emitirTokens(servidor, respuesta, {
        sub: usuario.id,
        rol: usuario.rol,
        estudioId: usuario.estudioId,
        nombre: usuario.nombre,
        email: usuario.email,
        esMaestroTotal,
        permisos: permisosJWT,
      });
    },
  );

  /**
   * POST /auth/cambiar-contrasena — requiere JWT
   */
  servidor.post<{ Body: { contrasenaActual: string; contrasenaNueva: string } }>(
    '/auth/cambiar-contrasena',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string };
      const { contrasenaActual, contrasenaNueva } = solicitud.body;

      if (!REGEX_CONTRASENA.test(contrasenaNueva)) {
        return respuesta.code(400).send({
          error: 'La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.',
        });
      }

      const usuario = await prisma.usuario.findUnique({ where: { id: payload.sub } });
      if (!usuario) return respuesta.code(404).send({ error: 'Usuario no encontrado' });

      if (!(await bcrypt.compare(contrasenaActual, usuario.hashContrasena))) {
        return respuesta.code(401).send({ error: 'Contraseña actual incorrecta' });
      }

      const nuevoHash = await bcrypt.hash(contrasenaNueva, 12);
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { hashContrasena: nuevoHash },
      });

      return respuesta.send({ datos: { mensaje: 'Contraseña actualizada correctamente' } });
    },
  );

  servidor.post<{ Body: { emailNuevo: string } }>(
    '/auth/solicitar-cambio-email',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string };
      if (payload.rol !== 'dueno') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const resultado = esquemaCambioEmail.safeParse(solicitud.body);
      if (!resultado.success) {
        return respuesta.code(400).send({ error: resultado.error.issues[0]?.message ?? 'Email inválido' });
      }

      const emailNuevo = resultado.data.emailNuevo.trim().toLowerCase();
      const usuario = await prisma.usuario.findUnique({
        where: { id: payload.sub },
        select: { id: true, nombre: true, email: true, rol: true },
      });

      if (!usuario || usuario.rol !== 'dueno') {
        return respuesta.code(404).send({ error: 'Usuario no encontrado' });
      }

      if (usuario.email === emailNuevo) {
        return respuesta.code(400).send({ error: 'Ese correo ya es el actual de tu cuenta.' });
      }

      const [duplicadoUsuario, duplicadoCliente] = await Promise.all([
        prisma.usuario.findUnique({ where: { email: emailNuevo }, select: { id: true } }),
        prisma.clienteApp.findFirst({
          where: { OR: [{ email: emailNuevo }, { emailPendiente: emailNuevo }] },
          select: { id: true },
        }),
      ]);

      if (duplicadoUsuario || duplicadoCliente) {
        return respuesta.code(409).send({ error: 'Ese correo ya está registrado en otra cuenta.' });
      }

      const token = servidor.jwt.sign(
        {
          tipo: 'cambio_email_dueno',
          usuarioId: usuario.id,
          emailNuevo,
        },
        { expiresIn: '24h' },
      );

      const enlaceVerificacion = `${env.FRONTEND_URL}/verificar-email?token=${token}`;
      void enviarEmailVerificacionCliente({
        emailDestino: emailNuevo,
        nombreCliente: usuario.nombre || 'Beauty Time Pro',
        enlaceVerificacion,
      });

      return respuesta.send({
        datos: {
          mensaje:
            'Enviamos un enlace de verificación al nuevo correo. El cambio se aplicará cuando confirmes desde ese email.',
        },
      });
    },
  );

  /**
   * POST /auth/solicitar-reset — siempre 200 por seguridad
   */
  servidor.post<{ Body: { email: string } }>(
    '/auth/solicitar-reset',
    {
      config: {
        rateLimit: {
          max: 3,
          timeWindow: '1 hour',
          errorResponseBuilder: () => ({
            error: 'Demasiados intentos. Espera 1 hora.',
          }),
        },
      },
    },
    async (solicitud, respuesta) => {
      const { email } = solicitud.body;
      const usuario = await prisma.usuario.findUnique({
        where: { email: email?.trim().toLowerCase() ?? '' },
      });

      if (usuario) {
        await prisma.tokenReset.deleteMany({ where: { usuarioId: usuario.id } });

        const token = crypto.randomBytes(32).toString('hex');
        const expiraEn = new Date(Date.now() + 60 * 60 * 1000);

        await prisma.tokenReset.create({ data: { usuarioId: usuario.id, token, expiraEn } });
        console.log('[Auth] Token de reset enviado para:', usuario.email.split('@')[0] + '@***');
        await enviarEmailResetContrasena(usuario.email, token);
      }

      return respuesta.send({ datos: { mensaje: 'Si el correo existe, recibirás instrucciones en breve.' } });
    },
  );

  /**
   * POST /auth/confirmar-reset
   */
  servidor.post<{ Body: { token: string; contrasenaNueva: string } }>(
    '/auth/confirmar-reset',
    async (solicitud, respuesta) => {
      const { token, contrasenaNueva } = solicitud.body;

      if (!REGEX_CONTRASENA.test(contrasenaNueva)) {
        return respuesta.code(400).send({
          error: 'La contraseña debe tener al menos 8 caracteres, una mayúscula y un número.',
        });
      }

      const registro = await prisma.tokenReset.findUnique({ where: { token } });

      if (!registro || registro.usado || registro.expiraEn < new Date()) {
        return respuesta.code(400).send({ error: 'El enlace de recuperación es inválido o ha expirado.' });
      }

      const nuevoHash = await bcrypt.hash(contrasenaNueva, 12);
      await prisma.$transaction([
        prisma.usuario.update({ where: { id: registro.usuarioId }, data: { hashContrasena: nuevoHash } }),
        prisma.tokenReset.update({ where: { id: registro.id }, data: { usado: true } }),
      ]);

      return respuesta.send({ datos: { mensaje: 'Contraseña actualizada. Ya puedes iniciar sesión.' } });
    },
  );

  /**
   * POST /auth/refrescar
   */
  servidor.post('/auth/refrescar', async (solicitud, respuesta) => {
    const refreshToken = solicitud.cookies[COOKIE_REFRESH];
    if (!refreshToken) return respuesta.code(401).send({ error: 'No autenticado' });

    try {
      const payload = servidor.jwt.verify<{
        sub: string; rol: string; estudioId: string | null; nombre: string; email: string; personalId?: string; forzarCambioContrasena?: boolean;
      }>(refreshToken);

      let esMaestroTotal = false;
      let permisos = crearPermisosVacios();

      if (payload.rol === 'empleado') {
        const acceso = await prisma.empleadoAcceso.findUnique({
          where: { id: payload.sub },
          select: { activo: true },
        });
        if (!acceso) return respuesta.code(401).send({ error: 'No autenticado' });
        if (!acceso.activo) return respuesta.code(403).send({ error: 'Tu acceso ha sido desactivado. Contacta al dueño del salón.' });
      }

      if (payload.rol === 'maestro') {
        const usuario = await prisma.usuario.findUnique({
          where: { id: payload.sub },
          select: { activo: true },
        });

        if (!usuario) {
          return respuesta.code(401).send({ error: 'No autenticado' });
        }

        if (!usuario.activo) {
          return respuesta.code(403).send({ error: 'Tu cuenta ha sido desactivada. Contacta al administrador principal.' });
        }

        const permisosActuales = await prisma.permisosMaestro.findUnique({
          where: { usuarioId: payload.sub },
          select: {
            aprobarSalones: true,
            gestionarPagos: true,
            crearAdmins: true,
            verAuditLog: true,
            verMetricas: true,
            suspenderSalones: true,
            esMaestroTotal: true,
          },
        });

        esMaestroTotal = permisosActuales?.esMaestroTotal ?? false;
        permisos = permisosActuales
          ? {
              aprobarSalones: permisosActuales.aprobarSalones,
              gestionarPagos: permisosActuales.gestionarPagos,
              crearAdmins: permisosActuales.crearAdmins,
              verAuditLog: permisosActuales.verAuditLog,
              verMetricas: permisosActuales.verMetricas,
              suspenderSalones: permisosActuales.suspenderSalones,
            }
          : permisos;
      }

      const accessToken = servidor.jwt.sign({
        sub: payload.sub,
        rol: payload.rol,
        estudioId: payload.estudioId,
        nombre: payload.nombre ?? '',
        email: payload.email ?? '',
        esMaestroTotal,
        permisos,
        ...(payload.personalId !== undefined && { personalId: payload.personalId }),
        ...(payload.forzarCambioContrasena !== undefined && {
          forzarCambioContrasena: payload.forzarCambioContrasena,
        }),
      });
      return respuesta.send({ datos: { token: accessToken, rol: payload.rol, estudioId: payload.estudioId, nombre: payload.nombre ?? '', email: payload.email ?? '', esMaestroTotal, permisos, personalId: payload.personalId ?? null, forzarCambioContrasena: payload.forzarCambioContrasena ?? false } });
    } catch {
      return respuesta.code(401).send({ error: 'Sesión expirada. Inicia sesión nuevamente.' });
    }
  });

  /**
   * POST /auth/cerrar-sesion
   */
  servidor.post('/auth/cerrar-sesion', async (_solicitud, respuesta) => {
    respuesta.clearCookie(COOKIE_REFRESH, {
      httpOnly: true,
      secure: env.ENTORNO === 'production',
      sameSite: 'strict',
      path: '/auth/refrescar',
    });
    return respuesta.send({ datos: { mensaje: 'Sesión cerrada' } });
  });
}

async function emitirTokens(
  servidor: FastifyInstance,
  respuesta: import('fastify').FastifyReply,
  payload: {
    sub: string;
    rol: string;
    estudioId: string | null;
    nombre: string;
    email: string;
    esMaestroTotal?: boolean;
    permisos?: PermisosJWT;
    personalId?: string;
    forzarCambioContrasena?: boolean;
  },
): Promise<import('fastify').FastifyReply> {
  const accessToken = servidor.jwt.sign(payload);
  const refreshToken = servidor.jwt.sign(payload, { expiresIn: REFRESH_EXPIRA });

  respuesta.setCookie(COOKIE_REFRESH, refreshToken, {
    httpOnly: true,
    secure: env.ENTORNO === 'production',
    sameSite: 'strict',
    path: '/auth/refrescar',
    maxAge: 60 * 60 * 24 * 7,
  });

  return respuesta.code(200).send({
    datos: {
      token: accessToken,
      rol: payload.rol,
      estudioId: payload.estudioId,
      nombre: payload.nombre,
      email: payload.email,
      esMaestroTotal: payload.esMaestroTotal ?? false,
      permisos: payload.permisos ?? crearPermisosVacios(),
      personalId: payload.personalId ?? null,
      forzarCambioContrasena: payload.forzarCambioContrasena ?? false,
    },
  });
}
