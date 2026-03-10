import type { FastifyInstance } from 'fastify';
import { prisma } from '../prismaCliente.js';
import { verificarJWT } from '../middleware/autenticacion.js';

export async function rutasFestivos(servidor: FastifyInstance): Promise<void> {
  // GET /estudios/:id/festivos
  servidor.get<{ Params: { id: string } }>(
    '/estudios/:id/festivos',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const { id } = solicitud.params;
      if (payload.rol !== 'maestro' && payload.estudioId !== id) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      const festivos = await prisma.diaFestivo.findMany({
        where: { estudioId: id },
        orderBy: { fecha: 'asc' },
        select: { fecha: true, descripcion: true },
      });
      return respuesta.send({ datos: festivos.map((f: { fecha: string }) => f.fecha) });
    },
  );

  // PUT /estudios/:id/festivos — reemplaza la lista completa
  servidor.put<{ Params: { id: string }; Body: { festivos: string[] } }>(
    '/estudios/:id/festivos',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const { id } = solicitud.params;
      if (payload.rol !== 'maestro' && payload.estudioId !== id) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      const { festivos } = solicitud.body;
      if (!Array.isArray(festivos)) {
        return respuesta.code(400).send({ error: 'festivos debe ser un arreglo de fechas' });
      }

      // Transacción: borrar todos, reinsertar
      await prisma.$transaction([
        prisma.diaFestivo.deleteMany({ where: { estudioId: id } }),
        prisma.diaFestivo.createMany({
          data: festivos.map((fecha) => ({ estudioId: id, fecha })),
          skipDuplicates: true,
        }),
      ]);

      // También sincroniza el campo JSON del estudio para compatibilidad legacy
      await prisma.estudio.update({
        where: { id },
        data: { festivos: festivos },
      });

      return respuesta.send({ datos: festivos });
    },
  );
}
