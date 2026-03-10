import './lib/env.js'; // validar entorno al arrancar
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import cookie from '@fastify/cookie';
import fastifyMultipart from '@fastify/multipart';
import fastifyStatic from '@fastify/static';
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
import { rutasClientes } from './rutas/clientes.js';
import { rutasFidelidad } from './rutas/fidelidad.js';
import { rutasPerfil } from './rutas/perfil.js';

void (async () => {
  const servidor = Fastify({ logger: true });

  await servidor.register(cors, {
    origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:4173'],
    credentials: true,
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
  await servidor.register(rutasClientes);
  await servidor.register(rutasFidelidad);
  await servidor.register(rutasPerfil);

  servidor.get('/salud', async () => ({ estado: 'ok' }));

  try {
    await servidor.listen({ port: env.PUERTO, host: '0.0.0.0' });
    // iniciarJobRecordatorios();
  } catch (err) {
    servidor.log.error(err);
    process.exit(1);
  }
})();
