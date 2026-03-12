import './lib/env.js'; // validar entorno al arrancar
import Fastify from 'fastify';
import type { FastifyError } from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import path from 'path';
import { env } from './lib/env.js';
import { iniciarJobRecordatorios } from './jobs/recordatorios.js';
import { rutasAuth } from './rutas/auth.js';
import { rutasEstudios } from './rutas/estudios.js';
import { rutasPersonal } from './rutas/personal.js';
import { rutasReservas } from './rutas/reservas.js';
import { rutasPagos } from './rutas/pagos.js';
import { rutasFestivos } from './rutas/festivos.js';
import { rutasAdmin } from './rutas/admin.js';
import { rutasAdmins } from './rutas/admins.js';
import { rutasClientes } from './rutas/clientes.js';
import { rutasFidelidad } from './rutas/fidelidad.js';
import { rutasPerfil } from './rutas/perfil.js';
import { rutasRegistro } from './rutas/registro.js';
import { rutasClientesApp } from './rutas/clientesApp.js';

void (async () => {
  const servidor = Fastify({ logger: true });

  await servidor.register(helmet, {
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  await servidor.register(rateLimit, { global: false });

  await servidor.register(cors, {
    origin: (origen, callback) => {
      if (!origen) {
        callback(null, true);
        return;
      }

      const permitido =
        origen === 'http://localhost:4173' ||
        /^http:\/\/localhost:517\d$/.test(origen) ||
        /^http:\/\/127\.0\.0\.1:517\d$/.test(origen);

      callback(null, permitido);
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  servidor.setErrorHandler((error: FastifyError, _solicitud, respuesta) => {
    if (error.statusCode === 429) {
      return respuesta.code(429).send({ error: 'Demasiados intentos. Espera 15 minutos.' });
    }

    if (error.statusCode === 401) {
      return respuesta.code(401).send({ error: error.message || 'No autenticado' });
    }

    if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
      return respuesta.code(error.statusCode).send({ error: error.message || 'Solicitud inválida' });
    }

    servidor.log.error(error);
    return respuesta.code(500).send({ error: 'Error interno del servidor' });
  });

  await servidor.register(jwt, {
    secret: env.JWT_SECRETO,
    sign: { expiresIn: env.JWT_EXPIRA_EN },
  });

  await servidor.register(cookie, {
    secret: env.JWT_SECRETO,
    parseOptions: {},
  });

  await servidor.register(fastifyMultipart);
  await servidor.register(fastifyStatic, {
    root: path.join(process.cwd(), 'uploads'),
    prefix: '/uploads/',
    decorateReply: false,
  });

  await servidor.register(rutasAuth);
  await servidor.register(rutasEstudios);
  await servidor.register(rutasPersonal);
  await servidor.register(rutasReservas);
  await servidor.register(rutasPagos);
  await servidor.register(rutasFestivos);
  await servidor.register(rutasAdmin);
  await servidor.register(rutasAdmins);
  await servidor.register(rutasClientes);
  await servidor.register(rutasFidelidad);
  await servidor.register(rutasPerfil);
  await servidor.register(rutasRegistro);
  await servidor.register(rutasClientesApp);

  servidor.get('/salud', async () => ({
    estado: 'ok',
    timestamp: new Date().toISOString(),
    entorno: env.ENTORNO,
  }));

  try {
    await servidor.listen({ port: env.PUERTO, host: '0.0.0.0' });
    if (env.ENTORNO !== 'test') {
      iniciarJobRecordatorios();
    }
  } catch (err) {
    servidor.log.error(err);
    process.exit(1);
  }
})();
