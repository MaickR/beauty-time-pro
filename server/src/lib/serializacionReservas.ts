import type { Prisma } from '../generated/prisma/client.js';
import { sanitizarTexto } from '../utils/sanitizar.js';

interface ServicioDetallePersistido {
  id: string;
  nombre: string;
  duracion: number;
  precio: number;
  categoria: string | null;
  orden: number;
  estado: string;
  motivo?: string | null;
}

interface ReservaConServicios {
  id: string;
  estudioId: string;
  personalId: string;
  clienteId: string;
  nombreCliente: string;
  telefonoCliente: string;
  fecha: string;
  horaInicio: string;
  duracion: number;
  servicios: unknown;
  precioTotal: number;
  estado: string;
  sucursal: string;
  marcaTinte: string | null;
  tonalidad: string | null;
  notasMenorEdad?: string | null;
  observaciones?: string | null;
  metodoPago?: string | null;
  motivoCancelacion?: string | null;
  productosAdicionales?: unknown;
  clienteAppId?: string | null;
  tokenCancelacion?: string;
  creadoEn: Date;
  serviciosDetalle?: ServicioDetallePersistido[];
}

interface ProductoAdicionalNormalizado {
  id: string;
  nombre: string;
  categoria?: string;
  cantidad: number;
  precioUnitario: number;
  total: number;
}

export interface ServicioReservaNormalizado {
  id?: string;
  name: string;
  duration: number;
  price: number;
  category?: string;
  status?: string;
  order?: number;
  motivo?: string | null;
}

function esObjetoRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null;
}

function normalizarNumero(valor: unknown): number {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
  if (typeof valor === 'string') {
    const convertido = Number(valor);
    if (Number.isFinite(convertido)) return convertido;
  }
  return 0;
}

function normalizarTexto(valor: unknown): string {
  return typeof valor === 'string' ? sanitizarTexto(valor) : '';
}

function normalizarClaveServicio(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function normalizarProductosAdicionales(productos: unknown): ProductoAdicionalNormalizado[] {
  if (!Array.isArray(productos)) return [];

  return productos
    .map((producto): ProductoAdicionalNormalizado | null => {
      if (!esObjetoRegistro(producto)) return null;

      const nombre = normalizarTexto(producto['nombre']);
      if (!nombre) return null;

      const cantidad = Math.max(1, normalizarNumero(producto['cantidad']));
      const precioUnitario = Math.max(0, normalizarNumero(producto['precioUnitario']));
      const total = Math.max(
        precioUnitario * cantidad,
        normalizarNumero(producto['total']) || precioUnitario * cantidad,
      );
      const categoria = normalizarTexto(producto['categoria']);

      return {
        id: normalizarTexto(producto['id']) || nombre,
        nombre,
        categoria: categoria || undefined,
        cantidad,
        precioUnitario,
        total,
      };
    })
    .filter((producto): producto is ProductoAdicionalNormalizado => Boolean(producto));
}

function obtenerPrecioTotalProductosAdicionales(productos: ProductoAdicionalNormalizado[]): number {
  return productos.reduce((acumulado, producto) => acumulado + producto.total, 0);
}

export function normalizarServiciosEntrada(servicios: unknown): ServicioReservaNormalizado[] {
  if (!Array.isArray(servicios)) return [];

  return servicios
    .map((servicio): ServicioReservaNormalizado | null => {
      if (typeof servicio === 'string') {
        const nombre = servicio.trim();
        if (!nombre) return null;
        return { name: nombre, duration: 0, price: 0 } satisfies ServicioReservaNormalizado;
      }

      if (!esObjetoRegistro(servicio)) return null;

      const nombre = normalizarTexto(servicio['name'] ?? servicio['nombre']);
      if (!nombre) return null;

      const categoria = normalizarTexto(servicio['category'] ?? servicio['categoria']);

      return {
        id: normalizarTexto(servicio['id']) || undefined,
        name: nombre,
        duration: normalizarNumero(servicio['duration'] ?? servicio['duracion']),
        price: normalizarNumero(servicio['price'] ?? servicio['precio']),
        category: categoria || undefined,
        status: normalizarTexto(servicio['status'] ?? servicio['estado']) || undefined,
        order: normalizarNumero(servicio['order'] ?? servicio['orden']) || undefined,
        motivo: normalizarTexto(servicio['motivo']) || undefined,
      } satisfies ServicioReservaNormalizado;
    })
    .filter((servicio): servicio is ServicioReservaNormalizado => Boolean(servicio));
}

export function recalcularServiciosContraCatalogo(
  serviciosSolicitados: unknown,
  catalogoSalon: unknown,
): ServicioReservaNormalizado[] {
  const solicitados = normalizarServiciosEntrada(serviciosSolicitados);
  const catalogo = normalizarServiciosEntrada(catalogoSalon);
  const catalogoPorClave = new Map(
    catalogo.map((servicio) => [normalizarClaveServicio(servicio.name), servicio]),
  );

  return solicitados.flatMap((servicioSolicitado, indice) => {
    const servicioCatalogo = catalogoPorClave.get(normalizarClaveServicio(servicioSolicitado.name));
    if (!servicioCatalogo) {
      return [];
    }

    return {
      id: servicioSolicitado.id,
      name: servicioCatalogo.name,
      duration: servicioCatalogo.duration,
      price: servicioCatalogo.price,
      category: servicioCatalogo.category,
      status: servicioSolicitado.status,
      order: servicioSolicitado.order ?? indice,
      motivo: servicioSolicitado.motivo ?? null,
    } satisfies ServicioReservaNormalizado;
  });
}

export function obtenerServiciosNormalizados(reserva: {
  servicios: unknown;
  serviciosDetalle?: ServicioDetallePersistido[] | unknown[];
}): ServicioReservaNormalizado[] {
  if (Array.isArray(reserva.serviciosDetalle) && reserva.serviciosDetalle.length > 0) {
    return reserva.serviciosDetalle
      .map((servicio): ServicioReservaNormalizado | null => {
        if (!esObjetoRegistro(servicio)) return null;

        const nombre = normalizarTexto(servicio['nombre'] ?? servicio['name']);
        if (!nombre) return null;

        const categoria = normalizarTexto(servicio['categoria'] ?? servicio['category']);

        return {
          id: normalizarTexto(servicio['id']) || undefined,
          name: nombre,
          duration: normalizarNumero(servicio['duracion'] ?? servicio['duration']),
          price: normalizarNumero(servicio['precio'] ?? servicio['price']),
          category: categoria || undefined,
          status: normalizarTexto(servicio['estado'] ?? servicio['status']) || undefined,
          order: normalizarNumero(servicio['orden'] ?? servicio['order']) || undefined,
          motivo: normalizarTexto(servicio['motivo']) || undefined,
        };
      })
      .filter((servicio): servicio is ServicioReservaNormalizado => Boolean(servicio));
  }

  return normalizarServiciosEntrada(reserva.servicios);
}

export function esServicioActivoParaResumen(servicio: ServicioReservaNormalizado): boolean {
  return !['cancelled', 'no_show'].includes(servicio.status ?? '');
}

export function calcularResumenServicios(servicios: ServicioReservaNormalizado[]) {
  const serviciosActivos = servicios.filter(esServicioActivoParaResumen);

  return {
    serviciosActivos,
    duracionTotal: obtenerDuracionTotalServicios(serviciosActivos),
    precioTotal: obtenerPrecioTotalServicios(serviciosActivos),
  };
}

export function obtenerDuracionTotalServicios(servicios: ServicioReservaNormalizado[]): number {
  return servicios.reduce((total, servicio) => total + servicio.duration, 0);
}

export function obtenerPrecioTotalServicios(servicios: ServicioReservaNormalizado[]): number {
  return servicios.reduce((total, servicio) => total + servicio.price, 0);
}

export function serializarReservaApi(reserva: ReservaConServicios) {
  const serviciosNormalizados = obtenerServiciosNormalizados(reserva);
  const resumen = calcularResumenServicios(serviciosNormalizados);
  const productosAdicionales = normalizarProductosAdicionales(reserva.productosAdicionales);
  const totalCalculado = resumen.precioTotal + obtenerPrecioTotalProductosAdicionales(productosAdicionales);

  return {
    id: reserva.id,
    estudioId: reserva.estudioId,
    personalId: reserva.personalId,
    clienteId: reserva.clienteId,
    nombreCliente: reserva.nombreCliente,
    telefonoCliente: reserva.telefonoCliente,
    fecha: reserva.fecha,
    horaInicio: reserva.horaInicio,
    duracion: resumen.duracionTotal || reserva.duracion,
    servicios: (resumen.serviciosActivos.length > 0 ? resumen.serviciosActivos : serviciosNormalizados).map((servicio) => ({
      name: servicio.name,
      duration: servicio.duration,
      price: servicio.price,
      ...(servicio.category ? { category: servicio.category } : {}),
    })),
    serviciosDetalle: serviciosNormalizados.map((servicio, indice) => ({
      ...(servicio.id ? { id: servicio.id } : {}),
      name: servicio.name,
      duration: servicio.duration,
      price: servicio.price,
      ...(servicio.category ? { category: servicio.category } : {}),
      status: servicio.status ?? reserva.estado,
      order: servicio.order ?? indice,
      motivo: servicio.motivo ?? null,
    })),
    precioTotal: totalCalculado || reserva.precioTotal,
    estado: reserva.estado,
    sucursal: reserva.sucursal,
    marcaTinte: reserva.marcaTinte,
    tonalidad: reserva.tonalidad,
    observaciones: reserva.observaciones ?? null,
    metodoPago: reserva.metodoPago ?? null,
    motivoCancelacion: reserva.motivoCancelacion ?? null,
    productosAdicionales,
    notasMenorEdad: reserva.notasMenorEdad ?? null,
    clienteAppId: reserva.clienteAppId ?? null,
    tokenCancelacion: reserva.tokenCancelacion,
    creadoEn: reserva.creadoEn.toISOString(),
  };
}

export const incluirServiciosDetalleReserva = {
  serviciosDetalle: {
    select: {
      id: true,
      nombre: true,
      duracion: true,
      precio: true,
      categoria: true,
      orden: true,
      estado: true,
      motivo: true,
      creadoEn: true,
    },
    orderBy: { orden: 'asc' },
  },
} satisfies Prisma.ReservaInclude;

export const incluirReservaConRelaciones = {
  estudio: true,
  empleado: true,
  cliente: true,
  clienteApp: true,
  serviciosDetalle: {
    select: {
      id: true,
      nombre: true,
      duracion: true,
      precio: true,
      categoria: true,
      orden: true,
      estado: true,
      motivo: true,
      creadoEn: true,
    },
    orderBy: { orden: 'asc' },
  },
} satisfies Prisma.ReservaInclude;
