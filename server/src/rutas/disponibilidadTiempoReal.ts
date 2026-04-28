import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { suscribirEventosDisponibilidadTiempoReal } from '../lib/canalDisponibilidadTiempoReal.js';
import { env } from '../lib/env.js';
import {
  obtenerPatronesOrigenFrontend,
  tieneOrigenFrontendPermitido,
} from '../lib/origenesFrontend.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import { prisma } from '../prismaCliente.js';

const esquemaParamsStreamDisponibilidad = z.object({
  estudioId: z.string().min(1, 'El estudio es obligatorio'),
});

function esOrigenLocal(origen: string): boolean {
  return (
    origen === 'http://localhost:4173' ||
    /^http:\/\/localhost:517\d$/.test(origen) ||
    /^http:\/\/127\.0\.0\.1:517\d$/.test(origen)
  );
}

function esOrigenPermitido(origen: string | undefined): boolean {
  if (!origen) {
    return true;
  }

  const esProduccion = env.ENTORNO === 'production';

  return (
    tieneOrigenFrontendPermitido(
      origen,
      obtenerPatronesOrigenFrontend(env.FRONTEND_URL, env.FRONTEND_ORIGENES_PERMITIDOS),
    ) || (!esProduccion && esOrigenLocal(origen))
  );
}

export async function rutasDisponibilidadTiempoReal(servidor: FastifyInstance) {
  servidor.get<{ Params: { estudioId: string } }>(
    '/disponibilidad/stream/:estudioId',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const validacion = esquemaParamsStreamDisponibilidad.safeParse(solicitud.params);
      if (!validacion.success) {
        return respuesta.code(400).send({ error: 'Parámetros inválidos para el stream' });
      }

      const { estudioId } = validacion.data;
      const payload = solicitud.user as {
        sub: string;
        rol: string;
        estudioId: string | null;
      };

      if (payload.rol === 'dueno' && payload.estudioId !== estudioId) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      if (payload.rol === 'empleado') {
        const acceso = await prisma.empleadoAcceso.findUnique({
          where: { id: payload.sub },
          select: { personal: { select: { estudioId: true } } },
        });

        if (!acceso?.personal || acceso.personal.estudioId !== estudioId) {
          return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
        }
      }

      if (!['maestro', 'dueno', 'empleado'].includes(payload.rol)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      respuesta.hijack();
      const salida = respuesta.raw;
      const origen = solicitud.headers.origin;
      const encabezadosSse: Record<string, string> = {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      };

      if (origen && esOrigenPermitido(origen)) {
        encabezadosSse['Access-Control-Allow-Origin'] = origen;
        encabezadosSse['Access-Control-Allow-Credentials'] = 'true';
        encabezadosSse['Vary'] = 'Origin';
      }

      salida.writeHead(200, {
        ...encabezadosSse,
      });

      salida.write(
        `event: conectado\ndata: ${JSON.stringify({
          estudioId,
          timestamp: new Date().toISOString(),
        })}\n\n`,
      );

      const cancelarSuscripcion = suscribirEventosDisponibilidadTiempoReal(estudioId, (evento) => {
        salida.write(`event: disponibilidad\ndata: ${JSON.stringify(evento)}\n\n`);
      });

      const intervaloHeartbeat = setInterval(() => {
        salida.write(`event: heartbeat\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
      }, 25_000);

      const cerrarConexion = () => {
        clearInterval(intervaloHeartbeat);
        cancelarSuscripcion();
        salida.end();
      };

      solicitud.raw.on('close', cerrarConexion);
      solicitud.raw.on('error', cerrarConexion);
    },
  );
}
