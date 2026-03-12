import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../prismaCliente.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import { emailSchema, obtenerMensajeValidacion, textoSchema } from '../lib/validacion.js';

const esquemaBusquedaClientes = z.object({
  buscar: textoSchema('buscar', 80).optional(),
});

const esquemaActualizarCliente = z.object({
  nombre: textoSchema('nombre', 120).optional(),
  email: z.union([z.literal(''), emailSchema]).optional().transform((valor) => (valor === '' ? null : valor)),
  notas: textoSchema('notas', 1000).nullable().optional(),
}).strict().refine((datos) => Object.keys(datos).length > 0, {
  message: 'Debes enviar al menos un campo para actualizar',
});

export async function rutasClientes(servidor: FastifyInstance): Promise<void> {
  // GET /estudios/:id/clientes — lista clientes del estudio
  servidor.get<{
    Params: { id: string };
    Querystring: { buscar?: string };
  }>(
    '/estudios/:id/clientes',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const { id } = solicitud.params;
      if (payload.rol !== 'maestro' && payload.estudioId !== id) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const consulta = esquemaBusquedaClientes.safeParse(solicitud.query);
      if (!consulta.success) {
        return respuesta.code(400).send({ error: obtenerMensajeValidacion(consulta.error) });
      }

      const { buscar } = consulta.data;
      const where: Record<string, unknown> = { estudioId: id, activo: true };
      if (buscar) {
        where['OR'] = [
          { nombre: { contains: buscar } },
          { telefono: { contains: buscar } },
        ];
      }

      const clientes = await prisma.cliente.findMany({
        where,
        orderBy: { nombre: 'asc' },
        include: {
          reservas: {
            select: { fecha: true, estado: true },
            orderBy: { fecha: 'desc' },
          },
        },
      });

      const resultado = clientes.map((c) => {
        const total = c.reservas.length;
        const ultimaVisita = c.reservas[0]?.fecha ?? null;
        const hoy = new Date();
        const nacimiento = new Date(c.fechaNacimiento);
        let edad = hoy.getFullYear() - nacimiento.getFullYear();
        const cumpleEsteAnio = new Date(hoy.getFullYear(), nacimiento.getMonth(), nacimiento.getDate());
        if (hoy < cumpleEsteAnio) edad--;

        return {
          id: c.id,
          nombre: c.nombre,
          telefono: c.telefono,
          email: c.email,
          fechaNacimiento: c.fechaNacimiento.toISOString().split('T')[0],
          edad,
          notas: c.notas,
          activo: c.activo,
          totalReservas: total,
          ultimaVisita,
        };
      });

      return respuesta.send({ datos: resultado });
    },
  );

  // GET /clientes/:id — detalle con historial
  servidor.get<{ Params: { id: string } }>(
    '/clientes/:id',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const cliente = await prisma.cliente.findUnique({
        where: { id: solicitud.params.id },
        include: {
          reservas: {
            orderBy: [{ fecha: 'desc' }, { horaInicio: 'asc' }],
          },
        },
      });
      if (!cliente) return respuesta.code(404).send({ error: 'Cliente no encontrado' });
      if (payload.rol !== 'maestro' && payload.estudioId !== cliente.estudioId) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const hoy = new Date();
      const nacimiento = new Date(cliente.fechaNacimiento);
      let edad = hoy.getFullYear() - nacimiento.getFullYear();
      const cumpleEsteAnio = new Date(hoy.getFullYear(), nacimiento.getMonth(), nacimiento.getDate());
      if (hoy < cumpleEsteAnio) edad--;

      return respuesta.send({
        datos: {
          ...cliente,
          fechaNacimiento: cliente.fechaNacimiento.toISOString().split('T')[0],
          edad,
        },
      });
    },
  );

  // PUT /clientes/:id — actualizar notas y datos
  servidor.put<{
    Params: { id: string };
    Body: { nombre?: string; email?: string; notas?: string };
  }>(
    '/clientes/:id',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const clienteExistente = await prisma.cliente.findUnique({
        where: { id: solicitud.params.id },
        select: { estudioId: true },
      });
      if (!clienteExistente) return respuesta.code(404).send({ error: 'Cliente no encontrado' });
      if (payload.rol !== 'maestro' && payload.estudioId !== clienteExistente.estudioId) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const resultado = esquemaActualizarCliente.safeParse(solicitud.body);
      if (!resultado.success) {
        return respuesta.code(400).send({ error: obtenerMensajeValidacion(resultado.error) });
      }

      const { nombre, email, notas } = resultado.data;
      const actualizado = await prisma.cliente.update({
        where: { id: solicitud.params.id },
        data: {
          ...(nombre !== undefined && { nombre }),
          ...(email !== undefined && { email }),
          ...(notas !== undefined && { notas }),
        },
      });

      return respuesta.send({ datos: actualizado });
    },
  );
}
