import type { FastifyInstance } from 'fastify';
import { prisma } from '../prismaCliente.js';
import { verificarJWT } from '../middleware/autenticacion.js';

export async function rutasEstudios(servidor: FastifyInstance): Promise<void> {
  // GET /estudios — solo rol maestro
  servidor.get('/estudios', { preHandler: verificarJWT }, async (solicitud, respuesta) => {
    const payload = solicitud.user as { rol: string };
    if (payload.rol !== 'maestro') {
      return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
    }
    const estudios = await prisma.estudio.findMany({
      orderBy: { creadoEn: 'desc' },
      include: { personal: { orderBy: { creadoEn: 'asc' } } },
    });
    return respuesta.send({ datos: estudios });
  });

  // GET /estudios/:id — dueno o maestro
  servidor.get<{ Params: { id: string } }>(
    '/estudios/:id',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const { id } = solicitud.params;
      if (payload.rol !== 'maestro' && payload.estudioId !== id) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      const estudio = await prisma.estudio.findUnique({
        where: { id },
        include: { personal: { orderBy: { creadoEn: 'asc' } } },
      });
      if (!estudio) return respuesta.code(404).send({ error: 'Estudio no encontrado' });
      return respuesta.send({ datos: estudio });
    },
  );

  // POST /estudios — solo maestro
  servidor.post<{ Body: Record<string, unknown> }>(
    '/estudios',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      const {
        nombre, propietario, telefono, sitioWeb, pais,
        sucursales, claveDueno, claveCliente, suscripcion,
        inicioSuscripcion, fechaVencimiento, horario,
        servicios, serviciosCustom, festivos,
      } = solicitud.body;

      if (!nombre || !claveDueno || !claveCliente) {
        return respuesta.code(400).send({ error: 'nombre, claveDueno y claveCliente son requeridos' });
      }

      const estudio = await prisma.estudio.create({
        data: {
          nombre: nombre as string,
          propietario: (propietario as string) ?? '',
          telefono: (telefono as string) ?? '',
          sitioWeb: sitioWeb as string | undefined,
          pais: (pais as string) ?? 'Mexico',
          sucursales: (sucursales as object) ?? [],
          claveDueno: (claveDueno as string).toUpperCase(),
          claveCliente: (claveCliente as string).toUpperCase(),
          suscripcion: (suscripcion as string) ?? 'mensual',
          inicioSuscripcion: (inicioSuscripcion as string) ?? new Date().toISOString().split('T')[0],
          fechaVencimiento: (fechaVencimiento as string) ?? '',
          horario: (horario as object) ?? {},
          servicios: (servicios as object) ?? [],
          serviciosCustom: (serviciosCustom as object) ?? [],
          festivos: (festivos as object) ?? [],
        },
      });
      return respuesta.code(201).send({ datos: estudio });
    },
  );

  // PUT /estudios/:id — maestro o dueno del propio estudio
  servidor.put<{ Params: { id: string }; Body: Record<string, unknown> }>(
    '/estudios/:id',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const { id } = solicitud.params;
      if (payload.rol !== 'maestro' && payload.estudioId !== id) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      const estudio = await prisma.estudio.update({
        where: { id },
        data: solicitud.body as Parameters<typeof prisma.estudio.update>[0]['data'],
      });
      return respuesta.send({ datos: estudio });
    },
  );

  // DELETE /estudios/:id — solo maestro
  servidor.delete<{ Params: { id: string } }>(
    '/estudios/:id',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      await prisma.estudio.delete({ where: { id: solicitud.params.id } });
      return respuesta.code(200).send({ datos: { eliminado: true } });
    },
  );
}
