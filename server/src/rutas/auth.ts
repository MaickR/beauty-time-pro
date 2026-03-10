import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../prismaCliente.js';
import { env } from '../lib/env.js';
import { enviarEmailResetContrasena } from '../servicios/servicioEmail.js';
import { verificarJWT } from '../middleware/autenticacion.js';

const REFRESH_EXPIRA = env.JWT_REFRESH_EXPIRA_EN;
const COOKIE_REFRESH = 'refresh_token';

const REGEX_CONTRASENA = /^(?=.*[A-Z])(?=.*[0-9]).{8,}$/;

export async function rutasAuth(servidor: FastifyInstance): Promise<void> {
  /**
   * POST /auth/iniciar-sesion
   * Acepta { email, contrasena } para usuarios en base de datos.
   * También acepta { clave } para compatibilidad con la ruta de clientes.
   */
  servidor.post<{ Body: { email?: string; contrasena?: string; clave?: string } }>(
    '/auth/iniciar-sesion',
    async (solicitud, respuesta) => {
      const { email, contrasena, clave } = solicitud.body;

      // ─── Modo clave (clientes + dueños legados) ───────────────────────────
      if (clave && !email) {
        const claveNorm = clave.trim().toUpperCase();

        const estudioDueno = await prisma.estudio.findFirst({
          where: { claveDueno: claveNorm },
          select: { id: true },
        });
        if (estudioDueno) {
          return emitirTokens(servidor, respuesta, {
            sub: estudioDueno.id,
            rol: 'dueno',
            estudioId: estudioDueno.id,
            nombre: '',
            email: '',
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

      const usuario = await prisma.usuario.findUnique({
        where: { email: email.trim().toLowerCase() },
      });

      if (!usuario || !(await bcrypt.compare(contrasena, usuario.hashContrasena))) {
        return respuesta.code(401).send({ error: 'Credenciales incorrectas' });
      }

      if (!usuario.activo) {
        return respuesta.code(403).send({ error: 'Cuenta suspendida. Contacta al administrador.' });
      }

      void prisma.usuario.update({
        where: { id: usuario.id },
        data: { ultimoAcceso: new Date() },
      });

      return emitirTokens(servidor, respuesta, {
        sub: usuario.id,
        rol: usuario.rol,
        estudioId: usuario.estudioId,
        nombre: usuario.nombre,
        email: usuario.email,
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

  /**
   * POST /auth/solicitar-reset — siempre 200 por seguridad
   */
  servidor.post<{ Body: { email: string } }>(
    '/auth/solicitar-reset',
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
        console.log('Token de reset:', token);
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
        sub: string; rol: string; estudioId: string | null; nombre: string; email: string;
      }>(refreshToken);

      const accessToken = servidor.jwt.sign({
        sub: payload.sub,
        rol: payload.rol,
        estudioId: payload.estudioId,
        nombre: payload.nombre ?? '',
        email: payload.email ?? '',
      });
      return respuesta.send({ datos: { token: accessToken } });
    } catch {
      return respuesta.code(401).send({ error: 'Sesión expirada. Inicia sesión nuevamente.' });
    }
  });

  /**
   * POST /auth/cerrar-sesion
   */
  servidor.post('/auth/cerrar-sesion', async (_solicitud, respuesta) => {
    respuesta.clearCookie(COOKIE_REFRESH, { path: '/' });
    return respuesta.send({ datos: { mensaje: 'Sesión cerrada' } });
  });
}

async function emitirTokens(
  servidor: FastifyInstance,
  respuesta: import('fastify').FastifyReply,
  payload: { sub: string; rol: string; estudioId: string | null; nombre: string; email: string },
): Promise<import('fastify').FastifyReply> {
  const accessToken = servidor.jwt.sign(payload);
  const refreshToken = servidor.jwt.sign(payload, { expiresIn: REFRESH_EXPIRA });

  respuesta.setCookie(COOKIE_REFRESH, refreshToken, {
    httpOnly: true,
    secure: env.ENTORNO === 'production',
    sameSite: 'strict',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });

  return respuesta.code(200).send({
    datos: {
      token: accessToken,
      rol: payload.rol,
      estudioId: payload.estudioId,
      nombre: payload.nombre,
      email: payload.email,
    },
  });
}
