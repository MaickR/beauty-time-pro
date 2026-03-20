import type { Prisma } from '../generated/prisma/client.js';

interface ServicioDetallePersistido {
  id: string;
  nombre: string;
  duracion: number;
  precio: number;
  categoria: string | null;
  orden: number;
  estado: string;
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
  clienteAppId?: string | null;
  tokenCancelacion?: string;
  creadoEn: Date;
  serviciosDetalle?: ServicioDetallePersistido[];
}

export interface ServicioReservaNormalizado {
  id?: string;
  name: string;
  duration: number;
  price: number;
  category?: string;
  status?: string;
  order?: number;
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
  return typeof valor === 'string' ? valor.trim() : '';
}

export function normalizarServiciosEntrada(servicios: unknown): ServicioReservaNormalizado[] {
  if (!Array.isArray(servicios)) return [];

  return servicios
    .map((servicio) => {
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
      } satisfies ServicioReservaNormalizado;
    })
    .filter((servicio): servicio is ServicioReservaNormalizado => Boolean(servicio));
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
    })),
    precioTotal: resumen.precioTotal || reserva.precioTotal,
    estado: reserva.estado,
    sucursal: reserva.sucursal,
    marcaTinte: reserva.marcaTinte,
    tonalidad: reserva.tonalidad,
    notasMenorEdad: reserva.notasMenorEdad ?? null,
    clienteAppId: reserva.clienteAppId ?? null,
    tokenCancelacion: reserva.tokenCancelacion,
    creadoEn: reserva.creadoEn.toISOString(),
  };
}

export const incluirServiciosDetalleReserva = {
  serviciosDetalle: {
    orderBy: { orden: 'asc' },
  },
} satisfies Prisma.ReservaInclude;

export const incluirReservaConRelaciones = {
  estudio: true,
  empleado: true,
  cliente: true,
  clienteApp: true,
  serviciosDetalle: {
    orderBy: { orden: 'asc' },
  },
} satisfies Prisma.ReservaInclude;
