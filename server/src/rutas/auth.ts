import type { FastifyInstance, FastifyRequest } from 'fastify';
import crypto from 'crypto';
import { z } from 'zod';
import { prisma } from '../prismaCliente.js';
import { env } from '../lib/env.js';
import { enviarEmailResetContrasena, enviarEmailVerificacionCliente } from '../servicios/servicioEmail.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import { obtenerErrorAccesoSalon, salonEstaDisponible } from '../lib/estadoSalon.js';
import {
  crearSesionAutenticacion,
  registrarUsoSesion,
  revocarSesionAutenticacion,
  revocarSesionesPorSujeto,
  rotarSesionAutenticacion,
  validarRefreshSesion,
  type TipoSujetoSesion,
} from '../lib/sesionesAuth.js';
import { registrarAuditoria } from '../utils/auditoria.js';
import { compararHashContrasena, generarHashContrasena } from '../utils/contrasenas.js';

const REFRESH_EXPIRA = env.JWT_REFRESH_EXPIRA_EN;
const COOKIE_REFRESH = 'refresh_token';
const CABECERA_CSRF = 'x-csrf-token';

function obtenerMaxAgeRefreshSegundos() {
  const coincidencia = REFRESH_EXPIRA.trim().match(/^(\d+)([smhd])$/i);
  if (!coincidencia) {
    return 60 * 60 * 24 * 7;
  }

  const cantidad = Number(coincidencia[1]);
  const unidad = (coincidencia[2] ?? 'd').toLowerCase();

  switch (unidad) {
    case 's':
      return cantidad;
    case 'm':
      return cantidad * 60;
    case 'h':
      return cantidad * 60 * 60;
    case 'd':
      return cantidad * 60 * 60 * 24;
    default:
      return 60 * 60 * 24 * 7;
  }
}

function obtenerOpcionesCookieRefresh() {
  return {
    httpOnly: true,
    secure: env.ENTORNO === 'production',
    sameSite: env.ENTORNO === 'production' ? 'strict' : 'lax',
    path: '/auth',
  } as const;
}

function tieneOrigenPermitidoParaCookie(origen?: string, referer?: string): boolean {
  if (env.ENTORNO !== 'production') {
    return true;
  }

  const origenFrontend = new URL(env.FRONTEND_URL).origin;

  if (origen) {
    return origen === origenFrontend;
  }

  if (!referer) {
    return false;
  }

  try {
    return new URL(referer).origin === origenFrontend;
  } catch {
    return false;
  }
}

const REGEX_CONTRASENA = /^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/;
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

interface PermisosSupervisorJWT {
  verTotalSalones: boolean;
  verControlSalones: boolean;
  verReservas: boolean;
  verVentas: boolean;
  verDirectorio: boolean;
  editarDirectorio: boolean;
  verControlCobros: boolean;
  accionRecordatorio: boolean;
  accionRegistroPago: boolean;
  accionSuspension: boolean;
  activarSalones: boolean;
  verPreregistros: boolean;
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

function crearPermisosSupervisorVacios(): PermisosSupervisorJWT {
  return {
    verTotalSalones: false,
    verControlSalones: false,
    verReservas: false,
    verVentas: false,
    verDirectorio: false,
    editarDirectorio: false,
    verControlCobros: false,
    accionRecordatorio: false,
    accionRegistroPago: false,
    accionSuspension: false,
    activarSalones: false,
    verPreregistros: false,
  };
}

function obtenerTokenCsrfCabecera(solicitud: FastifyRequest): string | null {
  const valor = solicitud.headers[CABECERA_CSRF];
  if (Array.isArray(valor)) {
    return valor[0] ?? null;
  }
  return typeof valor === 'string' && valor.trim() ? valor.trim() : null;
}

function obtenerTipoSujetoSesion(rol: string): TipoSujetoSesion {
  if (rol === 'empleado') {
    return 'empleado_acceso';
  }

  if (rol === 'cliente') {
    return 'cliente_app';
  }

  return 'usuario';
}

async function resolverUsuarioAuditoriaAcceso(payload: {
  rol: string;
  sub: string;
}): Promise<string | null> {
  if (payload.rol !== 'cliente' && payload.rol !== 'empleado') {
    return payload.sub;
  }

  return null;
}

async function registrarAuditoriaAcceso(
  accion: string,
  solicitud: FastifyRequest,
  payload: {
    rol: string;
    sub: string;
    sesionId?: string;
    email?: string;
    estudioId?: string | null;
  },
  detalles?: Record<string, unknown>,
): Promise<void> {
  const usuarioId = await resolverUsuarioAuditoriaAcceso(payload);

  await registrarAuditoria({
    usuarioId,
    accion,
    entidadTipo: 'sesion',
    entidadId: payload.sesionId ?? payload.sub,
    detalles: {
      actor: {
        rol: payload.rol,
        sujetoId: payload.sub,
        estudioId: payload.estudioId ?? null,
        email: payload.email ?? null,
      },
      ...detalles,
    },
    ip: solicitud.ip,
  });
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
            slug: true,
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

          if (!salonEstaDisponible(estudioDueno)) {
            const errorSalon = obtenerErrorAccesoSalon(estudioDueno);
            return respuesta.code(403).send({
              error:
                errorSalon.codigo === 'SALON_SUSPENDIDO'
                  ? 'Tu salón está suspendido. Contacta a Beauty Time Pro.'
                  : errorSalon.error,
              codigo: errorSalon.codigo,
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
            slugEstudio: estudioDueno.slug,
            nombre: usuarioDueno.nombre,
            email: usuarioDueno.email,
          }, {
            sujetoTipo: 'usuario',
            ip: solicitud.ip,
            userAgent: solicitud.headers['user-agent'],
            solicitud,
            accionAuditoria: 'login_exitoso',
            detallesAuditoria: { metodo: 'clave_dueno' },
          });
        }
        const estudioCliente = await prisma.estudio.findFirst({
          where: { claveCliente: claveNorm },
          select: { id: true, activo: true, estado: true },
        });
        if (estudioCliente) {
          if (!salonEstaDisponible(estudioCliente)) {
            const errorSalon = obtenerErrorAccesoSalon(estudioCliente);
            return respuesta.code(403).send(errorSalon);
          }

          return emitirTokens(servidor, respuesta, {
            sub: estudioCliente.id,
            rol: 'cliente',
            estudioId: estudioCliente.id,
            nombre: '',
            email: '',
          }, {
            sujetoTipo: 'cliente_app',
            ip: solicitud.ip,
            userAgent: solicitud.headers['user-agent'],
            solicitud,
            accionAuditoria: 'login_exitoso',
            detallesAuditoria: { metodo: 'clave_cliente_publica' },
          });
        }

        return respuesta.code(401).send({ error: 'Credenciales incorrectas' });
      }

      // ─── Modo email/teléfono + contraseña ────────────────────────────────
      if (!email || !contrasena) {
        return respuesta.code(400).send({ error: 'Email/teléfono y contraseña son requeridos' });
      }

      const credencial = email.trim().toLowerCase();
      const esBusquedaPorEmail = credencial.includes('@');

      // ─── Verificar si es un ClienteApp (cliente final con cuenta) ──────────
      const clienteApp = esBusquedaPorEmail
        ? await prisma.clienteApp.findUnique({
            where: { email: credencial },
            select: { id: true, email: true, hashContrasena: true, emailVerificado: true, activo: true, nombre: true, apellido: true },
          })
        : await prisma.clienteApp.findUnique({
            where: { telefono: credencial },
            select: { id: true, email: true, hashContrasena: true, emailVerificado: true, activo: true, nombre: true, apellido: true },
          });

      if (clienteApp) {
        if (!(await compararHashContrasena(contrasena, clienteApp.hashContrasena))) {
          return respuesta.code(401).send({ error: 'Credenciales incorrectas', codigo: 'CREDENCIALES_INVALIDAS' });
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
          email: clienteApp.email,
        }, {
          sujetoTipo: 'cliente_app',
          ip: solicitud.ip,
          userAgent: solicitud.headers['user-agent'],
          solicitud,
          accionAuditoria: 'login_exitoso',
          detallesAuditoria: { metodo: esBusquedaPorEmail ? 'correo' : 'telefono' },
        });
      }

      // Si la credencial no contiene @, no buscar como empleado o usuario
      if (!esBusquedaPorEmail) {
        return respuesta.code(401).send({ error: 'Credenciales incorrectas' });
      }

      // ─── Verificar EmpleadoAcceso ─────────────────────────────────────────
      const empleadoAcceso = await prisma.empleadoAcceso.findUnique({
        where: { email: credencial },
        include: {
          personal: {
            select: {
              id: true,
              nombre: true,
              estudioId: true,
              activo: true,
              estudio: {
                select: {
                  activo: true,
                  estado: true,
                },
              },
            },
          },
        },
      });

      if (empleadoAcceso) {
        if (!empleadoAcceso.activo) {
          return respuesta.code(403).send({ error: 'Tu acceso ha sido desactivado. Contacta al dueño del salón.' });
        }
        if (!empleadoAcceso.personal.activo) {
          return respuesta.code(403).send({ error: 'Tu perfil de especialista fue dado de baja. Contacta al dueño del salón.' });
        }
        if (!salonEstaDisponible(empleadoAcceso.personal.estudio)) {
          const errorSalon = obtenerErrorAccesoSalon(empleadoAcceso.personal.estudio);
          return respuesta.code(403).send({
            error: `${errorSalon.error}. Contacta al dueño del salón.`,
            codigo: errorSalon.codigo,
          });
        }
        if (!(await compararHashContrasena(contrasena, empleadoAcceso.hashContrasena))) {
          return respuesta.code(401).send({ error: 'Credenciales incorrectas', codigo: 'CREDENCIALES_INVALIDAS' });
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
        }, {
          sujetoTipo: 'empleado_acceso',
          ip: solicitud.ip,
          userAgent: solicitud.headers['user-agent'],
          solicitud,
          accionAuditoria: 'login_exitoso',
          detallesAuditoria: { metodo: 'correo' },
        });
      }

      // ─── Verificar Usuario (dueño / maestro) ─────────────────────────────
      const usuario = await prisma.usuario.findUnique({
        where: { email: credencial },
        include: { estudio: { select: { id: true, slug: true, activo: true, estado: true, motivoRechazo: true } } },
      });

      if (!usuario) {
        return respuesta.code(401).send({
          error: 'Credenciales incorrectas',
          codigo: 'CREDENCIALES_INVALIDAS',
        });
      }

      if (!(await compararHashContrasena(contrasena, usuario.hashContrasena))) {
        return respuesta.code(401).send({ error: 'Credenciales incorrectas', codigo: 'CREDENCIALES_INVALIDAS' });
      }

      if (!usuario.activo) {
        if (usuario.rol === 'dueno' && !usuario.estudioId && !usuario.estudio) {
          return respuesta.code(410).send({
            error: 'Esta cuenta fue eliminada definitivamente del sistema. Puedes registrarla de nuevo con este correo.',
            codigo: 'CUENTA_ELIMINADA',
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

      if (usuario.rol === 'dueno' && usuario.estudio && !salonEstaDisponible(usuario.estudio)) {
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

        return respuesta.code(403).send(obtenerErrorAccesoSalon(usuario.estudio));
      }

      void prisma.usuario.update({
        where: { id: usuario.id },
        data: { ultimoAcceso: new Date() },
      });

      let esMaestroTotal = false;
      let permisosJWT = crearPermisosVacios();
      let permisosSupervisorJWT = crearPermisosSupervisorVacios();

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
      } else if (usuario.rol === 'supervisor') {
        const permisosSup = await prisma.permisosSupervisor.findUnique({
          where: { usuarioId: usuario.id },
        });
        if (permisosSup) {
          permisosSupervisorJWT = {
            verTotalSalones: permisosSup.verTotalSalones,
            verControlSalones: permisosSup.verControlSalones,
            verReservas: permisosSup.verReservas,
            verVentas: permisosSup.verVentas,
            verDirectorio: permisosSup.verDirectorio,
            editarDirectorio: permisosSup.editarDirectorio,
            verControlCobros: permisosSup.verControlCobros,
            accionRecordatorio: permisosSup.accionRecordatorio,
            accionRegistroPago: permisosSup.accionRegistroPago,
            accionSuspension: permisosSup.accionSuspension,
            activarSalones: permisosSup.activarSalones,
            verPreregistros: permisosSup.verPreregistros,
          };
        }
      }
      // vendedor no requiere permisos especiales

      return emitirTokens(servidor, respuesta, {
        sub: usuario.id,
        rol: usuario.rol,
        estudioId: usuario.estudioId,
        slugEstudio: usuario.estudio?.slug ?? null,
        nombre: usuario.nombre,
        email: usuario.email,
        esMaestroTotal,
        permisos: permisosJWT,
        permisosSupervisor: permisosSupervisorJWT,
      }, {
        sujetoTipo: 'usuario',
        ip: solicitud.ip,
        userAgent: solicitud.headers['user-agent'],
        solicitud,
        accionAuditoria: 'login_exitoso',
        detallesAuditoria: { metodo: 'correo' },
      });
    },
  );

  /**
   * POST /auth/cambiar-contrasena — requiere JWT
   */
  servidor.post<{ Body: { contrasenaActual: string; contrasenaNueva: string } }>(
    '/auth/cambiar-contrasena',
    {
      preHandler: verificarJWT,
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '1 hour',
          errorResponseBuilder: () => ({
            error: 'Demasiados intentos. Espera 1 hora.',
          }),
        },
      },
    },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as {
        sub: string;
        rol: string;
        estudioId: string | null;
        nombre?: string;
        email?: string;
        esMaestroTotal?: boolean;
        permisos?: PermisosJWT;
        permisosSupervisor?: PermisosSupervisorJWT;
      };
      const { contrasenaActual, contrasenaNueva } = solicitud.body;

      if (!REGEX_CONTRASENA.test(contrasenaNueva)) {
        return respuesta.code(400).send({
          error: 'The password must have at least 8 characters, one uppercase, one lowercase, one number, and one special character',
        });
      }

      const usuario = await prisma.usuario.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          nombre: true,
          email: true,
          estudioId: true,
          hashContrasena: true,
          estudio: { select: { slug: true } },
        },
      });
      if (!usuario) return respuesta.code(404).send({ error: 'Usuario no encontrado' });

      if (!(await compararHashContrasena(contrasenaActual, usuario.hashContrasena))) {
        return respuesta.code(401).send({ error: 'Contraseña actual incorrecta' });
      }

      const nuevoHash = await generarHashContrasena(contrasenaNueva);
      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { hashContrasena: nuevoHash },
      });

      await revocarSesionesPorSujeto('usuario', usuario.id, 'contrasena_actualizada');

      return emitirTokens(servidor, respuesta, {
        sub: usuario.id,
        rol: payload.rol,
        estudioId: usuario.estudioId,
        slugEstudio: usuario.estudio?.slug ?? null,
        nombre: usuario.nombre,
        email: usuario.email,
        esMaestroTotal: payload.esMaestroTotal ?? false,
        permisos: payload.permisos ?? crearPermisosVacios(),
        permisosSupervisor: payload.permisosSupervisor ?? crearPermisosSupervisorVacios(),
      }, {
        sujetoTipo: 'usuario',
        ip: solicitud.ip,
        userAgent: solicitud.headers['user-agent'],
        solicitud,
        accionAuditoria: 'cambio_contrasena',
      });
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
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '15 minutes',
          errorResponseBuilder: () => ({
            error: 'Demasiados intentos. Espera unos minutos.',
          }),
        },
      },
    },
    async (solicitud, respuesta) => {
      const { token, contrasenaNueva } = solicitud.body;

      if (!REGEX_CONTRASENA.test(contrasenaNueva)) {
        return respuesta.code(400).send({
          error: 'The password must have at least 8 characters, one uppercase, one lowercase, one number, and one special character',
        });
      }

      const registro = await prisma.tokenReset.findUnique({ where: { token } });

      if (!registro || registro.usado || registro.expiraEn < new Date()) {
        return respuesta.code(400).send({ error: 'El enlace de recuperación es inválido o ha expirado.' });
      }

      const nuevoHash = await generarHashContrasena(contrasenaNueva);
      await prisma.$transaction([
        prisma.usuario.update({ where: { id: registro.usuarioId }, data: { hashContrasena: nuevoHash } }),
        prisma.tokenReset.update({ where: { id: registro.id }, data: { usado: true } }),
      ]);

      await revocarSesionesPorSujeto('usuario', registro.usuarioId, 'reset_contrasena');

      return respuesta.send({ datos: { mensaje: 'Contraseña actualizada. Ya puedes iniciar sesión.' } });
    },
  );

  /**
   * POST /auth/refrescar
   */
  servidor.post('/auth/refrescar', {
    config: {
      rateLimit: {
        max: 60,
        timeWindow: '1 hour',
        errorResponseBuilder: () => ({
          error: 'Demasiados intentos de refresco. Espera unos minutos.',
        }),
      },
    },
  }, async (solicitud, respuesta) => {
    if (!tieneOrigenPermitidoParaCookie(solicitud.headers.origin, solicitud.headers.referer)) {
      return respuesta.code(403).send({ error: 'Origen no permitido' });
    }

    const refreshToken = solicitud.cookies[COOKIE_REFRESH];
    const csrfToken = obtenerTokenCsrfCabecera(solicitud);
    if (!refreshToken) return respuesta.code(401).send({ error: 'No autenticado' });
    if (!csrfToken) {
      return respuesta.code(403).send({ error: 'Token CSRF requerido' });
    }

    try {
      const payload = servidor.jwt.verify<{
        sub: string;
        rol: string;
        estudioId: string | null;
        nombre: string;
        email: string;
        personalId?: string;
        forzarCambioContrasena?: boolean;
        sesionId?: string;
        refreshTokenId?: string;
        tipoToken?: string;
      }>(refreshToken);

      if (!payload.sesionId || !payload.refreshTokenId || payload.tipoToken !== 'refresh') {
        respuesta.clearCookie(COOKIE_REFRESH, obtenerOpcionesCookieRefresh());
        return respuesta.code(401).send({ error: 'Sesión expirada. Inicia sesión nuevamente.' });
      }

      const sesionRotada = await rotarSesionAutenticacion(
        payload.sesionId,
        payload.refreshTokenId,
        csrfToken,
        {
          ip: solicitud.ip,
          userAgent: solicitud.headers['user-agent'],
        },
      );

      if (!sesionRotada) {
        respuesta.clearCookie(COOKIE_REFRESH, obtenerOpcionesCookieRefresh());
        return respuesta.code(401).send({ error: 'Sesión expirada. Inicia sesión nuevamente.' });
      }

      let esMaestroTotal = false;
      let permisos = crearPermisosVacios();
      let permisosSupervisor = crearPermisosSupervisorVacios();
      const payloadActualizado: {
        sub: string;
        rol: string;
        estudioId: string | null;
        slugEstudio?: string | null;
        nombre: string;
        email: string;
        personalId?: string;
        forzarCambioContrasena?: boolean;
        esMaestroTotal?: boolean;
        permisos?: PermisosJWT;
        permisosSupervisor?: PermisosSupervisorJWT;
      } = {
        sub: payload.sub,
        rol: payload.rol,
        estudioId: payload.estudioId,
        nombre: payload.nombre ?? '',
        email: payload.email ?? '',
        ...(payload.personalId !== undefined && { personalId: payload.personalId }),
        ...(payload.forzarCambioContrasena !== undefined && {
          forzarCambioContrasena: payload.forzarCambioContrasena,
        }),
      };

      if (payload.rol === 'empleado') {
        const acceso = await prisma.empleadoAcceso.findUnique({
          where: { id: payload.sub },
          select: {
            activo: true,
            email: true,
            personalId: true,
            forzarCambioContrasena: true,
            personal: {
              select: {
                activo: true,
                estudioId: true,
                nombre: true,
                estudio: {
                  select: {
                    activo: true,
                    estado: true,
                  },
                },
              },
            },
          },
        });
        if (!acceso) return respuesta.code(401).send({ error: 'No autenticado' });
        if (!acceso.activo) return respuesta.code(403).send({ error: 'Tu acceso ha sido desactivado. Contacta al dueño del salón.' });
        if (!acceso.personal) return respuesta.code(401).send({ error: 'No autenticado' });
        if (!acceso.personal.activo) {
          return respuesta.code(403).send({ error: 'Tu perfil de especialista fue dado de baja. Contacta al dueño del salón.' });
        }
        if (!salonEstaDisponible(acceso.personal.estudio)) {
          const errorSalon = obtenerErrorAccesoSalon(acceso.personal.estudio);
          return respuesta.code(403).send({ error: `${errorSalon.error}. Contacta al dueño del salón.`, codigo: errorSalon.codigo });
        }

        payloadActualizado.estudioId = acceso.personal.estudioId;
        payloadActualizado.nombre = acceso.personal.nombre;
        payloadActualizado.email = acceso.email;
        payloadActualizado.personalId = acceso.personalId;
        payloadActualizado.forzarCambioContrasena = acceso.forzarCambioContrasena ?? false;
      }

      if (payload.rol === 'dueno') {
        const usuario = await prisma.usuario.findUnique({
          where: { id: payload.sub },
          select: {
            activo: true,
            nombre: true,
            email: true,
            estudioId: true,
            estudio: {
              select: {
                activo: true,
                estado: true,
                slug: true,
              },
            },
          },
        });

        if (!usuario) {
          return respuesta.code(401).send({ error: 'No autenticado' });
        }

        if (!usuario.activo || !usuario.estudio || !salonEstaDisponible(usuario.estudio)) {
          const errorSalon = obtenerErrorAccesoSalon(usuario.estudio ?? {});
          return respuesta.code(403).send({ error: !usuario.activo ? 'Tu sesión ya no está habilitada' : errorSalon.error, codigo: !usuario.activo ? 'CUENTA_DESACTIVADA' : errorSalon.codigo });
        }

        payloadActualizado.estudioId = usuario.estudioId ?? null;
        payloadActualizado.slugEstudio = usuario.estudio?.slug ?? null;
        payloadActualizado.nombre = usuario.nombre;
        payloadActualizado.email = usuario.email;
      }

      if (payload.rol === 'cliente') {
        if (payload.estudioId === null) {
          const clienteApp = await prisma.clienteApp.findUnique({
            where: { id: payload.sub },
            select: {
              activo: true,
              nombre: true,
              apellido: true,
              email: true,
            },
          });

          if (!clienteApp) {
            return respuesta.code(401).send({ error: 'No autenticado' });
          }

          if (!clienteApp.activo) {
            return respuesta.code(403).send({ error: 'Tu cuenta ha sido desactivada' });
          }

          payloadActualizado.nombre = `${clienteApp.nombre} ${clienteApp.apellido}`.trim();
          payloadActualizado.email = clienteApp.email ?? payloadActualizado.email;
        } else {
          const estudioCliente = await prisma.estudio.findUnique({
            where: { id: payload.estudioId },
            select: {
              activo: true,
              estado: true,
            },
          });

          if (!estudioCliente) {
            return respuesta.code(401).send({ error: 'No autenticado' });
          }

          if (!salonEstaDisponible(estudioCliente)) {
            return respuesta.code(403).send(obtenerErrorAccesoSalon(estudioCliente));
          }
        }
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

        payloadActualizado.esMaestroTotal = esMaestroTotal;
        payloadActualizado.permisos = permisos;
      }

      if (payload.rol === 'supervisor' || payload.rol === 'vendedor') {
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

        if (payload.rol === 'supervisor') {
          const permisosSup = await prisma.permisosSupervisor.findUnique({
            where: { usuarioId: payload.sub },
          });
          if (permisosSup) {
            permisosSupervisor = {
              verTotalSalones: permisosSup.verTotalSalones,
              verControlSalones: permisosSup.verControlSalones,
              verReservas: permisosSup.verReservas,
              verVentas: permisosSup.verVentas,
              verDirectorio: permisosSup.verDirectorio,
              editarDirectorio: permisosSup.editarDirectorio,
              verControlCobros: permisosSup.verControlCobros,
              accionRecordatorio: permisosSup.accionRecordatorio,
              accionRegistroPago: permisosSup.accionRegistroPago,
              accionSuspension: permisosSup.accionSuspension,
              activarSalones: permisosSup.activarSalones,
              verPreregistros: permisosSup.verPreregistros,
            };
          }
          payloadActualizado.permisosSupervisor = permisosSupervisor;
        }
      }

      payloadActualizado.esMaestroTotal = esMaestroTotal;
      payloadActualizado.permisos = permisos;
      payloadActualizado.permisosSupervisor = permisosSupervisor;

      await registrarUsoSesion(payload.sesionId);

      return emitirTokens(servidor, respuesta, payloadActualizado, {
        sujetoTipo: obtenerTipoSujetoSesion(payload.rol),
        ip: solicitud.ip,
        userAgent: solicitud.headers['user-agent'],
        solicitud,
        accionAuditoria: 'refresh_sesion',
        sesionRotada,
      });
    } catch {
      respuesta.clearCookie(COOKIE_REFRESH, obtenerOpcionesCookieRefresh());
      return respuesta.code(401).send({ error: 'Sesión expirada. Inicia sesión nuevamente.' });
    }
  });

  /**
   * POST /auth/cerrar-sesion
   */
  servidor.post('/auth/cerrar-sesion', async (solicitud, respuesta) => {
    if (!tieneOrigenPermitidoParaCookie(solicitud.headers.origin, solicitud.headers.referer)) {
      return respuesta.code(403).send({ error: 'Origen no permitido' });
    }

    const csrfToken = obtenerTokenCsrfCabecera(solicitud);
    if (!csrfToken) {
      return respuesta.code(403).send({ error: 'Token CSRF requerido' });
    }

    let datosAuditoria: {
      rol: string;
      sub: string;
      sesionId?: string;
      email?: string;
      estudioId?: string | null;
    } | null = null;

    try {
      await solicitud.jwtVerify();
      const payload = solicitud.user as {
        rol: string;
        sub: string;
        sesionId?: string;
        email?: string;
        estudioId?: string | null;
      };

      if (payload.sesionId) {
        await revocarSesionAutenticacion(payload.sesionId, 'logout_manual');
        datosAuditoria = payload;
      }
    } catch {
      try {
        const refreshToken = solicitud.cookies[COOKIE_REFRESH];
        if (refreshToken) {
          const payloadRefresh = servidor.jwt.verify<{
            rol: string;
            sub: string;
            sesionId?: string;
            refreshTokenId?: string;
            email?: string;
            estudioId?: string | null;
            tipoToken?: string;
          }>(refreshToken);

          if (
            payloadRefresh.sesionId &&
            payloadRefresh.refreshTokenId &&
            payloadRefresh.tipoToken === 'refresh' &&
            await validarRefreshSesion({
              sesionId: payloadRefresh.sesionId,
              refreshTokenId: payloadRefresh.refreshTokenId,
              csrfToken,
            })
          ) {
            await revocarSesionAutenticacion(payloadRefresh.sesionId, 'logout_manual');
            datosAuditoria = payloadRefresh;
          }
        }
      } catch {
        // Si la cookie ya expiró, solo limpiamos estado del navegador.
      }
    }

    respuesta.clearCookie(COOKIE_REFRESH, obtenerOpcionesCookieRefresh());

    if (datosAuditoria) {
      await registrarAuditoriaAcceso('logout_sesion', solicitud, datosAuditoria);
    }

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
    slugEstudio?: string | null;
    nombre: string;
    email: string;
    esMaestroTotal?: boolean;
    permisos?: PermisosJWT;
    permisosSupervisor?: PermisosSupervisorJWT;
    personalId?: string;
    forzarCambioContrasena?: boolean;
  },
  metadatosSesion: {
    sujetoTipo: TipoSujetoSesion;
    ip?: string;
    userAgent?: string;
    solicitud?: FastifyRequest;
    accionAuditoria?: string;
    detallesAuditoria?: Record<string, unknown>;
    sesionRotada?: {
      sesionId: string;
      refreshTokenId: string;
      csrfToken: string;
    };
  },
): Promise<import('fastify').FastifyReply> {
  const sesion =
    metadatosSesion.sesionRotada ??
    (await crearSesionAutenticacion(metadatosSesion.sujetoTipo, payload.sub, {
      ip: metadatosSesion.ip,
      userAgent: metadatosSesion.userAgent,
    }));

  const payloadJWT = {
    sub: payload.sub,
    rol: payload.rol,
    estudioId: payload.estudioId,
    nombre: payload.nombre,
    email: payload.email,
    esMaestroTotal: payload.esMaestroTotal ?? false,
    permisos: payload.permisos ?? crearPermisosVacios(),
    permisosSupervisor: payload.permisosSupervisor ?? crearPermisosSupervisorVacios(),
    personalId: payload.personalId,
    forzarCambioContrasena: payload.forzarCambioContrasena ?? false,
    sesionId: sesion.sesionId,
  };

  const accessToken = servidor.jwt.sign(payloadJWT);
  const refreshToken = servidor.jwt.sign(
    {
      ...payloadJWT,
      refreshTokenId: sesion.refreshTokenId,
      tipoToken: 'refresh',
    },
    { expiresIn: REFRESH_EXPIRA },
  );

  respuesta.setCookie(COOKIE_REFRESH, refreshToken, {
    ...obtenerOpcionesCookieRefresh(),
    maxAge: obtenerMaxAgeRefreshSegundos(),
  });

  if (metadatosSesion.solicitud && metadatosSesion.accionAuditoria) {
    await registrarAuditoriaAcceso(metadatosSesion.accionAuditoria, metadatosSesion.solicitud, {
      rol: payload.rol,
      sub: payload.sub,
      sesionId: sesion.sesionId,
      email: payload.email,
      estudioId: payload.estudioId,
    }, metadatosSesion.detallesAuditoria);
  }

  return respuesta.code(200).send({
    datos: {
      token: accessToken,
      csrfToken: sesion.csrfToken,
      rol: payload.rol,
      estudioId: payload.estudioId,
      slugEstudio: payload.slugEstudio ?? null,
      nombre: payload.nombre,
      email: payload.email,
      esMaestroTotal: payload.esMaestroTotal ?? false,
      permisos: payload.permisos ?? crearPermisosVacios(),
      permisosSupervisor: payload.permisosSupervisor ?? crearPermisosSupervisorVacios(),
      personalId: payload.personalId ?? null,
      forzarCambioContrasena: payload.forzarCambioContrasena ?? false,
    },
  });
}
