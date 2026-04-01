import type { FastifyInstance } from 'fastify';
import { prisma } from '../prismaCliente.js';
import { verificarJWT } from '../middleware/autenticacion.js';

function tieneAccesoAdminEstudio(payload: { rol: string; estudioId: string | null }, estudioId: string): boolean {
  return payload.rol === 'maestro' || (payload.rol === 'dueno' && payload.estudioId === estudioId);
}

export async function rutasProductos(servidor: FastifyInstance): Promise<void> {
  /**
   * GET /estudio/:id/productos — listar productos del salón
   */
  servidor.get<{ Params: { id: string } }>(
    '/estudio/:id/productos',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const { id } = solicitud.params;

      if (!tieneAccesoAdminEstudio(payload, id)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const productos = await prisma.producto.findMany({
        where: { estudioId: id },
        orderBy: [{ activo: 'desc' }, { nombre: 'asc' }],
      });

      return respuesta.send({ datos: productos });
    },
  );

  /**
   * POST /estudio/:id/productos — crear producto
   */
  servidor.post<{
    Params: { id: string };
    Body: {
      nombre: string;
      categoria?: string;
      precio: number;
    };
  }>(
    '/estudio/:id/productos',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const { id } = solicitud.params;

      if (!tieneAccesoAdminEstudio(payload, id)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { nombre, categoria, precio } = solicitud.body;

      if (!nombre || nombre.trim().length === 0) {
        return respuesta.code(400).send({ error: 'El nombre es obligatorio' });
      }

      if (typeof precio !== 'number' || precio < 1) {
        return respuesta.code(400).send({ error: 'El precio debe ser mayor a 0' });
      }

      if (!Number.isInteger(precio)) {
        return respuesta.code(400).send({ error: 'El precio debe estar en centavos (entero)' });
      }

      const producto = await prisma.producto.create({
        data: {
          estudioId: id,
          nombre: nombre.trim(),
          categoria: categoria?.trim() || 'General',
          precio,
        },
      });

      return respuesta.code(201).send({ datos: producto });
    },
  );

  /**
   * PUT /estudio/:id/productos/:productoId — editar producto
   */
  servidor.put<{
    Params: { id: string; productoId: string };
    Body: {
      nombre?: string;
      categoria?: string;
      precio?: number;
      activo?: boolean;
    };
  }>(
    '/estudio/:id/productos/:productoId',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const { id, productoId } = solicitud.params;

      if (!tieneAccesoAdminEstudio(payload, id)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const existente = await prisma.producto.findFirst({
        where: { id: productoId, estudioId: id },
      });

      if (!existente) {
        return respuesta.code(404).send({ error: 'Producto no encontrado' });
      }

      const { nombre, categoria, precio, activo } = solicitud.body;

      if (nombre !== undefined && nombre.trim().length === 0) {
        return respuesta.code(400).send({ error: 'El nombre no puede estar vacío' });
      }

      if (precio !== undefined && (typeof precio !== 'number' || precio < 1 || !Number.isInteger(precio))) {
        return respuesta.code(400).send({ error: 'El precio debe ser un entero mayor a 0 (en centavos)' });
      }

      const producto = await prisma.producto.update({
        where: { id: productoId },
        data: {
          ...(nombre !== undefined && { nombre: nombre.trim() }),
          ...(categoria !== undefined && { categoria: categoria.trim() || 'General' }),
          ...(precio !== undefined && { precio }),
          ...(activo !== undefined && { activo }),
        },
      });

      return respuesta.send({ datos: producto });
    },
  );

  /**
   * DELETE /estudio/:id/productos/:productoId — eliminar producto
   */
  servidor.delete<{ Params: { id: string; productoId: string } }>(
    '/estudio/:id/productos/:productoId',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const { id, productoId } = solicitud.params;

      if (!tieneAccesoAdminEstudio(payload, id)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const existente = await prisma.producto.findFirst({
        where: { id: productoId, estudioId: id },
      });

      if (!existente) {
        return respuesta.code(404).send({ error: 'Producto no encontrado' });
      }

      await prisma.producto.delete({ where: { id: productoId } });

      return respuesta.send({ datos: { mensaje: 'Producto eliminado correctamente' } });
    },
  );
}
