import type { FastifyInstance } from 'fastify';
import type { Prisma } from '../generated/prisma/client.js';
import { z } from 'zod';
import { prisma } from '../prismaCliente.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import { tieneAccesoAdministrativoEstudio } from '../lib/accesoEstudio.js';
import { registrarAuditoria } from '../utils/auditoria.js';
import { normalizarZonaHorariaEstudio, obtenerFechaISOEnZona } from '../utils/zonasHorarias.js';

const esquemaRegistrarVentaProducto = z.object({
  productoId: z.string().trim().min(1, 'Debes seleccionar un producto'),
  cantidad: z.number().int().min(1, 'La cantidad mínima es 1').max(500, 'La cantidad máxima es 500'),
  empleadoId: z.string().trim().min(1).optional(),
  clienteNombre: z.string().trim().max(120).optional(),
  sucursal: z.string().trim().max(120).optional(),
  fecha: z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'La fecha debe usar formato YYYY-MM-DD').optional(),
  hora: z.string().trim().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora debe usar formato HH:mm').optional(),
  observaciones: z.string().trim().max(240).optional(),
});

function obtenerMonedaPorPais(pais: string | null | undefined): 'MXN' | 'COP' {
  return pais === 'Colombia' ? 'COP' : 'MXN';
}

function obtenerHoraActualEnZona(zonaHoraria?: string | null, pais?: string | null): string {
  const formateador = new Intl.DateTimeFormat('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: normalizarZonaHorariaEstudio(zonaHoraria, pais),
  });
  return formateador.format(new Date());
}

function esErrorCompatibilidadPago(error: unknown): boolean {
  const codigo =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  const mensaje = error instanceof Error ? error.message : '';

  return (
    codigo === 'P2022' ||
    /Unknown column/i.test(mensaje) ||
    /(tipo|referencia|concepto)/i.test(mensaje)
  );
}

async function crearPagoVentaProductoCompat(datos: {
  estudioId: string;
  monto: number;
  moneda: 'MXN' | 'COP';
  concepto: string;
  fecha: string;
  tipo: string;
  referencia: string;
}) {
  try {
    return await prisma.pago.create({
      data: {
        estudioId: datos.estudioId,
        monto: datos.monto,
        moneda: datos.moneda,
        concepto: datos.concepto,
        fecha: datos.fecha,
        tipo: datos.tipo,
        referencia: datos.referencia,
      },
    });
  } catch (error) {
    if (!esErrorCompatibilidadPago(error)) {
      throw error;
    }

    return prisma.pago.create({
      data: {
        estudioId: datos.estudioId,
        monto: datos.monto,
        moneda: datos.moneda,
        concepto: datos.concepto,
        fecha: datos.fecha,
      },
    });
  }
}

function obtenerSucursalPredeterminada(sucursales: Prisma.JsonValue): string {
  if (Array.isArray(sucursales)) {
    const primera = sucursales.find((item) => typeof item === 'string' && item.trim().length > 0);
    if (typeof primera === 'string') return primera;
  }

  return 'Principal';
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

      if (!tieneAccesoAdministrativoEstudio(payload, id)) {
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

      if (!tieneAccesoAdministrativoEstudio(payload, id)) {
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

      if (!tieneAccesoAdministrativoEstudio(payload, id)) {
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

      if (!tieneAccesoAdministrativoEstudio(payload, id)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const existente = await prisma.producto.findFirst({
        where: { id: productoId, estudioId: id },
      });

      if (!existente) {
        return respuesta.code(404).send({ error: 'Producto no encontrado' });
      }

      await prisma.producto.update({
        where: { id: productoId },
        data: { activo: false },
      });

      return respuesta.send({ datos: { mensaje: 'Producto desactivado correctamente' } });
    },
  );

  /**
   * POST /estudio/:id/productos/ventas — registrar venta de producto (solo PRO)
   */
  servidor.post<{
    Params: { id: string };
    Body: {
      productoId: string;
      cantidad: number;
      empleadoId?: string;
      clienteNombre?: string;
      sucursal?: string;
      fecha?: string;
      hora?: string;
      observaciones?: string;
    };
  }>(
    '/estudio/:id/productos/ventas',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as {
        rol: string;
        estudioId: string | null;
        sub: string;
        nombre?: string;
        email?: string;
      };
      const { id } = solicitud.params;

      if (!tieneAccesoAdministrativoEstudio(payload, id)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const validacion = esquemaRegistrarVentaProducto.safeParse(solicitud.body);
      if (!validacion.success) {
        return respuesta.code(400).send({ error: validacion.error.issues[0]?.message ?? 'Datos inválidos' });
      }

      const estudio = await prisma.estudio.findUnique({
        where: { id },
        select: {
          id: true,
          nombre: true,
          plan: true,
          pais: true,
          zonaHoraria: true,
          sucursales: true,
        },
      });

      if (!estudio) {
        return respuesta.code(404).send({ error: 'Salón no encontrado' });
      }

      if (estudio.plan !== 'PRO') {
        return respuesta.code(403).send({ error: 'Esta función está disponible únicamente para planes PRO' });
      }

      const datos = validacion.data;
      const producto = await prisma.producto.findFirst({
        where: {
          id: datos.productoId,
          estudioId: id,
          activo: true,
        },
        select: {
          id: true,
          nombre: true,
          precio: true,
          categoria: true,
        },
      });

      if (!producto) {
        return respuesta.code(404).send({ error: 'Producto no disponible para este salón' });
      }

      let empleadoNombre: string | null = null;
      if (datos.empleadoId) {
        const empleado = await prisma.personal.findFirst({
          where: {
            id: datos.empleadoId,
            estudioId: id,
            activo: true,
          },
          select: { id: true, nombre: true },
        });

        if (!empleado) {
          return respuesta.code(400).send({ error: 'El especialista seleccionado no está activo en este salón' });
        }

        empleadoNombre = empleado.nombre;
      }

      const fechaOperacion =
        datos.fecha ??
        obtenerFechaISOEnZona(
          new Date(),
          normalizarZonaHorariaEstudio(estudio.zonaHoraria, estudio.pais),
          estudio.pais,
        );
      const horaOperacion = datos.hora ?? obtenerHoraActualEnZona(estudio.zonaHoraria, estudio.pais);
      const clienteNombre = (datos.clienteNombre?.trim() || 'Venta mostrador').slice(0, 120);
      const sucursal =
        (datos.sucursal?.trim() || obtenerSucursalPredeterminada(estudio.sucursales)).slice(0, 120);
      const total = producto.precio * datos.cantidad;
      const concepto = `Venta producto: ${producto.nombre} x${datos.cantidad}`.slice(0, 160);
      const referenciaBase = JSON.stringify({
        t: 'venta_producto',
        p: producto.id,
        pn: producto.nombre.slice(0, 40),
        q: datos.cantidad,
        e: datos.empleadoId ?? null,
        en: empleadoNombre?.slice(0, 40) ?? null,
        c: clienteNombre.slice(0, 60),
        s: sucursal.slice(0, 60),
        h: horaOperacion,
      });
      const referenciaReducida = JSON.stringify({
        t: 'venta_producto',
        p: producto.id,
        q: datos.cantidad,
        e: datos.empleadoId ?? null,
        c: clienteNombre.slice(0, 24),
        s: sucursal.slice(0, 24),
        h: horaOperacion,
      });
      const referencia =
        referenciaBase.length <= 190
          ? referenciaBase
          : referenciaReducida.length <= 190
            ? referenciaReducida
            : referenciaReducida.slice(0, 190);

      const pago = await crearPagoVentaProductoCompat({
        estudioId: id,
        monto: total,
        moneda: obtenerMonedaPorPais(estudio.pais),
        concepto,
        fecha: fechaOperacion,
        tipo: 'venta_producto',
        referencia,
      });

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'registrar_venta_producto',
        entidadTipo: 'venta_producto',
        entidadId: pago.id,
        ip: solicitud.ip,
        detalles: {
          estudioId: id,
          estudioNombre: estudio.nombre,
          productoId: producto.id,
          productoNombre: producto.nombre,
          categoriaProducto: producto.categoria,
          cantidad: datos.cantidad,
          precioUnitario: producto.precio,
          total,
          moneda: obtenerMonedaPorPais(estudio.pais),
          fecha: fechaOperacion,
          hora: horaOperacion,
          clienteNombre,
          sucursal,
          empleadoId: datos.empleadoId ?? null,
          empleadoNombre,
          observaciones: datos.observaciones ?? null,
          registradoPorNombre: payload.nombre ?? null,
          registradoPorEmail: payload.email ?? null,
        },
      });

      return respuesta.code(201).send({
        datos: {
          id: pago.id,
          estudioId: id,
          productoId: producto.id,
          productoNombre: producto.nombre,
          cantidad: datos.cantidad,
          total,
          moneda: obtenerMonedaPorPais(estudio.pais),
          fecha: fechaOperacion,
          hora: horaOperacion,
          empleadoId: datos.empleadoId ?? null,
          empleadoNombre,
          clienteNombre,
          sucursal,
          observaciones: datos.observaciones ?? null,
        },
      });
    },
  );
}
