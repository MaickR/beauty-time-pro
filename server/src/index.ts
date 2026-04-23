import './lib/env.js'; // validar entorno al arrancar
import Fastify from 'fastify';
import type { FastifyError } from 'fastify';
import type { FastifyInstance } from 'fastify';
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
import { obtenerPatronesOrigenFrontend, tieneOrigenFrontendPermitido } from './lib/origenesFrontend.js';
import { sincronizarReactivacionesProgramadasPersonal } from './lib/reactivacionPersonalProgramada.js';
import { iniciarJobColaEmails } from './jobs/colaEmails.js';
import { iniciarJobRecordatorios } from './jobs/recordatorios.js';
import { iniciarJobCumpleanos } from './jobs/cumpleanos.js';
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
import { rutasMensajesMasivos } from './rutas/mensajesMasivos.js';
import { rutasProductos } from './rutas/productos.js';
import { rutasVendedor } from './rutas/vendedor.js';
import { rutasPreciosPlanes } from './rutas/preciosPlanes.js';

const INTERVALO_MINIMO_SINCRONIZACION_MS = 60_000;
let sincronizacionReactivacionEnCurso = false;
let ultimaSincronizacionReactivacionMs = 0;

function intentarSincronizarReactivacionesNoBloqueante(servidor: FastifyInstance): void {
  const ahora = Date.now();
  if (sincronizacionReactivacionEnCurso) {
    return;
  }

  if (ahora - ultimaSincronizacionReactivacionMs < INTERVALO_MINIMO_SINCRONIZACION_MS) {
    return;
  }

  sincronizacionReactivacionEnCurso = true;
  ultimaSincronizacionReactivacionMs = ahora;

  void sincronizarReactivacionesProgramadasPersonal()
    .catch((error) => {
      servidor.log.warn({ err: error }, 'No se pudo sincronizar la reactivación programada de personal');
    })
    .finally(() => {
      sincronizacionReactivacionEnCurso = false;
    });
}

function obtenerContentTypeEstatico(rutaArchivo: string): string {
  const extension = path.extname(rutaArchivo).toLowerCase();

  switch (extension) {
    case '.html':
    case '.htm':
      return 'text/plain';
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.gif':
      return 'image/gif';
    case '.svg':
      return 'image/svg+xml';
    case '.pdf':
      return 'application/pdf';
    default:
      return 'application/octet-stream';
  }
}

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

  return (
    tieneOrigenFrontendPermitido(
      origen,
      obtenerPatronesOrigenFrontend(env.FRONTEND_URL, env.FRONTEND_ORIGENES_PERMITIDOS),
    ) || (!esProduccion && esOrigenLocal(origen))
  );
}

function obtenerMensajePublicoError(codigoEstado: number): string {
  switch (codigoEstado) {
    case 400:
    case 422:
      return 'Solicitud inválida';
    case 401:
      return 'No autenticado';
    case 403:
      return 'Sin permisos para esta acción';
    case 404:
      return 'Recurso no encontrado';
    case 409:
      return 'Conflicto con el estado actual del recurso';
    case 413:
      return 'El contenido supera el límite permitido';
    default:
      return 'Solicitud inválida';
  }
}

void (async () => {
  const servidor = Fastify({
    logger: true,
    bodyLimit: 1_048_576 /* 1 MB */,
    // Mantener desactivada la confianza en proxies evita spoofing por X-Forwarded-*.
    trustProxy: false,
  });

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
    allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token'],
    exposedHeaders: ['X-Request-ID'],
  });

  servidor.addHook('onRequest', async (solicitud, respuesta) => {
    intentarSincronizarReactivacionesNoBloqueante(servidor);

    respuesta.header('X-Request-ID', solicitud.id);
  });

  servidor.addHook('onSend', async (solicitud, respuesta, payload) => {
    respuesta.header('X-Request-ID', solicitud.id);
    const origen = solicitud.headers.origin;
    if (esOrigenPermitido(origen, esProduccion) && origen) {
      respuesta.header('Access-Control-Allow-Origin', origen);
      respuesta.header('Access-Control-Allow-Credentials', 'true');
      respuesta.header('Vary', 'Origin');
    }

    return payload;
  });

  servidor.setErrorHandler((error: FastifyError | unknown, solicitud, respuesta) => {
    const errorConPropiedades =
      typeof error === 'object' && error !== null ? (error as Record<string, unknown>) : null;
    const codigoEstado =
      errorConPropiedades && typeof errorConPropiedades.statusCode === 'number'
        ? errorConPropiedades.statusCode
        : undefined;
    const codigoError =
      errorConPropiedades && typeof errorConPropiedades.code === 'string'
        ? errorConPropiedades.code
        : undefined;
    const mensajeError =
      typeof error === 'string'
        ? error
        : errorConPropiedades && typeof errorConPropiedades.message === 'string'
          ? errorConPropiedades.message
          : errorConPropiedades && typeof errorConPropiedades.error === 'string'
            ? errorConPropiedades.error
            : '';

    if (codigoEstado === 429 || codigoError === 'FST_ERR_RATE_LIMIT') {
      return respuesta.code(429).send({ error: 'Demasiados intentos. Espera 15 minutos.' });
    }

    // Algunos handlers de rate-limit pueden propagar solo texto sin statusCode.
    if (
      !codigoEstado &&
      /demasiados intentos|rate limit|too many requests/i.test(mensajeError)
    ) {
      return respuesta.code(429).send({ error: 'Demasiados intentos. Espera 15 minutos.' });
    }

    if (codigoEstado === 401) {
      return respuesta.code(401).send({ error: 'No autenticado' });
    }

    if (codigoEstado && codigoEstado >= 400 && codigoEstado < 500) {
      servidor.log.warn(
        { err: error, requestId: solicitud.id, codigoEstado, codigoError, mensajeError },
        'Error 4xx controlado por el manejador global',
      );
      return respuesta.code(codigoEstado).send({ error: obtenerMensajePublicoError(codigoEstado) });
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
    setHeaders: (respuesta, rutaArchivo) => {
      respuesta.setHeader('X-Content-Type-Options', 'nosniff');
      respuesta.setHeader('Content-Disposition', 'inline');
      respuesta.setHeader('Content-Type', obtenerContentTypeEstatico(rutaArchivo));
    },
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
  await servidor.register(rutasMensajesMasivos);
  await servidor.register(rutasProductos);
  await servidor.register(rutasVendedor);
  await servidor.register(rutasPreciosPlanes);

  servidor.get(
    '/salud',
    {
      logLevel: 'warn',
    },
    async (_solicitud, respuesta) => {
      respuesta.header('Cache-Control', 'no-store, max-age=0');
      return {
        estado: 'ok',
        timestamp: new Date().toISOString(),
        entorno: env.ENTORNO,
      };
    },
  );

  // /health — Railway usará este endpoint para verificar que el deploy fue exitoso
  servidor.get(
    '/health',
    {
      logLevel: 'warn',
    },
    async (_solicitud, respuesta) => {
      respuesta.header('Cache-Control', 'no-store, max-age=0');
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
      };
    },
  );

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
      iniciarJobColaEmails();
      iniciarJobRecordatorios();
      iniciarJobCumpleanos();
    }
  } catch (err) {
    servidor.log.error(err);
    process.exit(1);
  }
})();
