process.env.TZ = 'America/Mexico_City'; // normalizar timezone del servidor
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
import compress from '@fastify/compress';
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
import { rutasPush } from './rutas/push.js';
import { rutasEmpleados } from './rutas/empleados.js';

function esOrigenLocal(origen: string): boolean {
  return (
    origen === 'http://localhost:4173' ||
    /^http:\/\/localhost:517\d$/.test(origen) ||
    /^http:\/\/127\.0\.0\.1:517\d$/.test(origen)
  );
}

function esOrigenPermitido(origen: string | undefined, esProduccion: boolean): boolean {
  if (!origen) {
    return true;
  }

  return origen === env.FRONTEND_URL || (!esProduccion && esOrigenLocal(origen));
}

void (async () => {
  const servidor = Fastify({ logger: true, bodyLimit: 1_048_576 /* 1 MB */ });

  await servidor.register(helmet, {
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        connectSrc: ["'self'", env.FRONTEND_URL],
      },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  await servidor.register(compress, { global: true });

  await servidor.register(rateLimit, { global: false });

  const esProduccion = env.ENTORNO === 'production';
  await servidor.register(cors, {
    origin: (origen, callback) => {
      callback(null, esOrigenPermitido(origen, esProduccion));
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  servidor.addHook('onSend', async (solicitud, respuesta, payload) => {
    const origen = solicitud.headers.origin;
    if (esOrigenPermitido(origen, esProduccion) && origen) {
      respuesta.header('Access-Control-Allow-Origin', origen);
      respuesta.header('Access-Control-Allow-Credentials', 'true');
      respuesta.header('Vary', 'Origin');
    }

    return payload;
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

  await servidor.register(fastifyMultipart, { limits: { fileSize: 2 * 1024 * 1024 /* 2 MB */ } });
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
  await servidor.register(rutasPush);
  await servidor.register(rutasEmpleados);

  servidor.get('/salud', async () => ({
    estado: 'ok',
    timestamp: new Date().toISOString(),
    entorno: env.ENTORNO,
  }));

  // /health — Railway usará este endpoint para verificar que el deploy fue exitoso
  servidor.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  }));

  const gracefulShutdown = async (signal: string) => {
    servidor.log.info(`Recibida señal ${signal}, cerrando servidor...`);
    await servidor.close();
    await import('./prismaCliente.js').then((m) => m.prisma.$disconnect());
    process.exit(0);
  };
  process.on('SIGTERM', () => void gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => void gracefulShutdown('SIGINT'));

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
