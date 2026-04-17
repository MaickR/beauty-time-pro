import type { FastifyInstance } from 'fastify';
import { prisma } from '../prismaCliente.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import { tieneAccesoAdministrativoEstudio } from '../lib/accesoEstudio.js';
import {
  calcularRecompensasDisponibles,
  canjearRecompensaFidelidad,
  obtenerConfigFidelidad,
} from '../lib/fidelidad.js';
import { MENSAJE_FUNCION_PRO, normalizarPlanEstudio } from '../lib/planes.js';

export async function rutasFidelidad(servidor: FastifyInstance): Promise<void> {
  servidor.get<{ Params: { id: string } }>(
    '/estudio/:id/fidelidad/config',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const { id } = solicitud.params;
      if (!tieneAccesoAdministrativoEstudio(payload, id)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const estudio = await prisma.estudio.findUnique({ where: { id }, select: { plan: true } });
      if (!estudio) {
        return respuesta.code(404).send({ error: 'Estudio no encontrado' });
      }
      if (normalizarPlanEstudio(estudio.plan) !== 'PRO') {
        return respuesta.code(403).send({ error: MENSAJE_FUNCION_PRO });
      }

      const config = await obtenerConfigFidelidad(id);
      return respuesta.send({ datos: config });
    },
  );

  servidor.put<{
    Params: { id: string };
    Body: {
      activo?: boolean;
      visitasRequeridas?: number;
      tipoRecompensa?: string;
      porcentajeDescuento?: number | null;
      descripcionRecompensa?: string;
    };
  }>(
    '/estudio/:id/fidelidad/config',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const { id } = solicitud.params;
      if (!tieneAccesoAdministrativoEstudio(payload, id)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const estudio = await prisma.estudio.findUnique({ where: { id }, select: { plan: true } });
      if (!estudio) {
        return respuesta.code(404).send({ error: 'Estudio no encontrado' });
      }
      if (normalizarPlanEstudio(estudio.plan) !== 'PRO') {
        return respuesta.code(403).send({ error: MENSAJE_FUNCION_PRO });
      }

      const datos = solicitud.body;

      // Validar porcentaje de descuento: 5-50 en pasos de 5
      if (datos.porcentajeDescuento !== undefined && datos.porcentajeDescuento !== null) {
        const pct = datos.porcentajeDescuento;
        if (pct < 5 || pct > 50 || pct % 5 !== 0) {
          return respuesta.code(400).send({
            error: 'El porcentaje de descuento debe estar entre 5% y 50% en incrementos de 5%.',
            campos: { porcentajeDescuento: 'Valor inválido' },
          });
        }
      }

      const config = await prisma.configFidelidad.upsert({
        where: { estudioId: id },
        create: {
          estudioId: id,
          activo: datos.activo ?? false,
          visitasRequeridas: datos.visitasRequeridas ?? 5,
          tipoRecompensa: datos.tipoRecompensa ?? 'descuento',
          porcentajeDescuento: datos.porcentajeDescuento ?? 10,
          descripcionRecompensa: datos.descripcionRecompensa ?? 'Servicio gratis en tu próxima visita',
        },
        update: {
          ...(datos.activo !== undefined && { activo: datos.activo }),
          ...(datos.visitasRequeridas !== undefined && { visitasRequeridas: datos.visitasRequeridas }),
          ...(datos.tipoRecompensa !== undefined && { tipoRecompensa: datos.tipoRecompensa }),
          ...(datos.porcentajeDescuento !== undefined && { porcentajeDescuento: datos.porcentajeDescuento }),
          ...(datos.descripcionRecompensa !== undefined && { descripcionRecompensa: datos.descripcionRecompensa }),
        },
      });
      return respuesta.send({ datos: config });
    },
  );

  servidor.get<{ Params: { id: string }; Querystring: { limite?: string } }>(
    '/estudio/:id/fidelidad/ranking',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const { id } = solicitud.params;
      if (!tieneAccesoAdministrativoEstudio(payload, id)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const estudio = await prisma.estudio.findUnique({ where: { id }, select: { plan: true } });
      if (!estudio) {
        return respuesta.code(404).send({ error: 'Estudio no encontrado' });
      }
      if (normalizarPlanEstudio(estudio.plan) !== 'PRO') {
        return respuesta.code(403).send({ error: MENSAJE_FUNCION_PRO });
      }

      const limite = Math.min(50, Math.max(1, parseInt(solicitud.query.limite ?? '20', 10)));
      const config = await obtenerConfigFidelidad(id);
      const ranking = await prisma.puntosFidelidad.findMany({
        where: { estudioId: id },
        take: limite,
        orderBy: [{ visitasAcumuladas: 'desc' }, { ultimaVisita: 'desc' }],
        include: {
          cliente: {
            select: { id: true, nombre: true, telefono: true, email: true },
          },
        },
      });

      return respuesta.send({
        datos: ranking.map((fila) => ({
          id: fila.id,
          clienteId: fila.clienteId,
          nombre: fila.cliente.nombre,
          telefono: fila.cliente.telefono,
          email: fila.cliente.email,
          visitasAcumuladas: fila.visitasAcumuladas,
          visitasRequeridas: config.visitasRequeridas,
          recompensasDisponibles: calcularRecompensasDisponibles(fila),
          recompensaDisponible: calcularRecompensasDisponibles(fila) > 0,
          ultimaVisita: fila.ultimaVisita,
        })),
      });
    },
  );

  servidor.get<{ Params: { id: string; estudioId: string } }>(
    '/clientes/:id/fidelidad/:estudioId',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const { id, estudioId } = solicitud.params;
      if (!tieneAccesoAdministrativoEstudio(payload, estudioId)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const [config, cliente, puntos] = await Promise.all([
        obtenerConfigFidelidad(estudioId),
        prisma.cliente.findUnique({ where: { id }, select: { id: true, estudioId: true, nombre: true, telefono: true } }),
        prisma.puntosFidelidad.findUnique({ where: { clienteId_estudioId: { clienteId: id, estudioId } } }),
      ]);

      if (!cliente || cliente.estudioId !== estudioId) {
        return respuesta.code(404).send({ error: 'Cliente no encontrado' });
      }

      const puntosSeguros = puntos ?? {
        visitasAcumuladas: 0,
        visitasUsadas: 0,
        recompensasGanadas: 0,
        recompensasUsadas: 0,
        ultimaVisita: null,
      };

      return respuesta.send({
        datos: {
          clienteId: cliente.id,
          nombre: cliente.nombre,
          telefono: cliente.telefono,
          activo: config.activo,
          descripcionRecompensa: config.descripcionRecompensa,
          visitasRequeridas: config.visitasRequeridas,
          visitasAcumuladas: puntosSeguros.visitasAcumuladas,
          visitasRestantes: Math.max(0, config.visitasRequeridas - (puntosSeguros.visitasAcumuladas - puntosSeguros.visitasUsadas)),
          recompensasGanadas: puntosSeguros.recompensasGanadas,
          recompensasUsadas: puntosSeguros.recompensasUsadas,
          recompensasDisponibles: calcularRecompensasDisponibles(puntosSeguros),
          recompensaDisponible: calcularRecompensasDisponibles(puntosSeguros) > 0,
          ultimaVisita: puntosSeguros.ultimaVisita,
        },
      });
    },
  );

  servidor.get<{ Params: { id: string }; Querystring: { telefono: string } }>(
    '/estudio/:id/fidelidad/cliente',
    async (solicitud, respuesta) => {
      const { id } = solicitud.params;

      const telefono = solicitud.query.telefono?.trim();
      if (!telefono) {
        return respuesta.code(400).send({ error: 'telefono es requerido' });
      }

      const cliente = await prisma.cliente.findUnique({
        where: { estudioId_telefono: { estudioId: id, telefono } },
        select: { id: true, nombre: true, telefono: true },
      });
      if (!cliente) {
        return respuesta.send({ datos: null });
      }

      const config = await obtenerConfigFidelidad(id);
      const puntos = await prisma.puntosFidelidad.findUnique({
        where: { clienteId_estudioId: { clienteId: cliente.id, estudioId: id } },
      });
      const puntosSeguros = puntos ?? {
        visitasAcumuladas: 0,
        visitasUsadas: 0,
        recompensasGanadas: 0,
        recompensasUsadas: 0,
        ultimaVisita: null,
      };

      return respuesta.send({
        datos: {
          clienteId: cliente.id,
          nombre: cliente.nombre,
          telefono: cliente.telefono,
          activo: config.activo,
          descripcionRecompensa: config.descripcionRecompensa,
          visitasRequeridas: config.visitasRequeridas,
          visitasAcumuladas: puntosSeguros.visitasAcumuladas,
          visitasRestantes: Math.max(
            0,
            config.visitasRequeridas -
              (puntosSeguros.visitasAcumuladas - puntosSeguros.visitasUsadas),
          ),
          recompensasGanadas: puntosSeguros.recompensasGanadas,
          recompensasUsadas: puntosSeguros.recompensasUsadas,
          recompensasDisponibles: calcularRecompensasDisponibles(puntosSeguros),
          recompensaDisponible: calcularRecompensasDisponibles(puntosSeguros) > 0,
          ultimaVisita: puntosSeguros.ultimaVisita,
        },
      });
    },
  );

  servidor.post<{
    Body: { clienteId: string; estudioId: string };
  }>(
    '/fidelidad/canjear',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const { clienteId, estudioId } = solicitud.body;
      if (!tieneAccesoAdministrativoEstudio(payload, estudioId)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const estudio = await prisma.estudio.findUnique({
        where: { id: estudioId },
        select: { plan: true },
      });
      if (!estudio) {
        return respuesta.code(404).send({ error: 'Estudio no encontrado' });
      }
      if (normalizarPlanEstudio(estudio.plan) !== 'PRO') {
        return respuesta.code(403).send({ error: MENSAJE_FUNCION_PRO });
      }

      try {
        const resultado = await canjearRecompensaFidelidad(clienteId, estudioId);
        return respuesta.send({ datos: { canjeado: true, descripcion: resultado.descripcion } });
      } catch (error) {
        solicitud.log.warn({ err: error }, 'Fallo controlado al canjear recompensa');
        return respuesta.code(400).send({ error: 'No fue posible canjear la recompensa' });
      }
    },
  );
}
