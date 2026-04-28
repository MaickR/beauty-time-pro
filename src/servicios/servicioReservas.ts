/**
 * Servicio de reservas — llama al backend Fastify en lugar de Firebase.
 */
import type { Reserva, EstadoReserva, SlotTiempo } from '../tipos/index';
import { peticion } from '../lib/clienteHTTP';

type ServicioReservaPayload = Reserva['services'][number] & {
  motivo?: string | null;
};

interface SlotBackend {
  hora?: string;
  disponible?: boolean;
  time?: string;
  status?: SlotTiempo['status'];
}

function normalizarFechaReserva(fecha: string): string {
  const fechaLimpia = fecha.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(fechaLimpia)) {
    return fechaLimpia;
  }

  const fechaParseada = new Date(fechaLimpia);
  if (Number.isNaN(fechaParseada.getTime())) {
    throw new Error('La fecha de la reserva no es válida.');
  }

  const compensacion = fechaParseada.getTimezoneOffset();
  const fechaLocal = new Date(fechaParseada.getTime() - compensacion * 60 * 1000);
  return fechaLocal.toISOString().split('T')[0] ?? '';
}

function normalizarSlots(slots: SlotBackend[]): SlotTiempo[] {
  return slots
    .map((slot) => {
      if (slot.time && slot.status) {
        return { time: slot.time, status: slot.status };
      }

      if (slot.hora) {
        return {
          time: slot.hora,
          status: slot.disponible ? 'AVAILABLE' : 'OCCUPIED',
        };
      }

      return null;
    })
    .filter((slot): slot is SlotTiempo => slot !== null);
}

interface DatosCrearReserva extends Omit<Reserva, 'id' | 'services'> {
  services: ServicioReservaPayload[];
  fechaNacimiento?: string; // "YYYY-MM-DD"
  email: string;
  usarRecompensa?: boolean;
  productosSeleccionados?: Array<{ productoId: string; cantidad: number }>;
}

export interface ResultadoCrearReserva {
  datos: Reserva;
  recompensaGanada: boolean;
  descripcion: string | null;
  recompensaUsada: boolean;
}

export interface ReservaCancelable {
  id: string;
  fecha: string;
  horaInicio: string;
  estado: string;
  nombreCliente: string;
  especialista: string;
  especialistaEliminado: boolean;
  salon: string;
  servicios: Array<{ name?: string } | string>;
}

/** Crea una nueva reserva. */
export async function crearReserva(datos: DatosCrearReserva): Promise<ResultadoCrearReserva> {
  const personalId = datos.staffId.trim();
  const estudioId = datos.studioId.trim();
  const fecha = normalizarFechaReserva(datos.date);
  const servicios = Array.isArray(datos.services) ? datos.services : [];

  if (!estudioId) {
    throw new Error('El estudio es obligatorio para crear la reserva.');
  }
  if (!personalId) {
    throw new Error('Debes seleccionar un especialista.');
  }
  if (servicios.length === 0) {
    throw new Error('Debes seleccionar al menos un servicio.');
  }

  return peticion('/reservas', {
    method: 'POST',
    body: JSON.stringify({
      estudioId,
      personalId,
      nombreCliente: datos.clientName,
      telefonoCliente: datos.clientPhone,
      fechaNacimiento: datos.fechaNacimiento,
      email: datos.email || undefined,
      fecha,
      horaInicio: datos.time,
      duracion: datos.totalDuration,
      servicios,
      precioTotal: datos.totalPrice,
      estado: datos.status,
      sucursal: datos.branch,
      marcaTinte: datos.colorBrand ?? null,
      tonalidad: datos.colorNumber ?? null,
      observaciones: datos.observaciones ?? null,
      metodoPago: datos.paymentMethod ?? null,
      productosSeleccionados: datos.productosSeleccionados ?? [],
      usarRecompensa: datos.usarRecompensa ?? false,
    }),
  });
}

/** Actualiza el estado de una reserva existente. */
export async function actualizarEstadoReserva(
  id: string,
  estado: EstadoReserva,
  motivoCancelacion?: string,
): Promise<void> {
  await peticion(`/reservas/${id}/estado`, {
    method: 'PUT',
    body: JSON.stringify({ estado, ...(motivoCancelacion ? { motivo: motivoCancelacion } : {}) }),
  });
}

export async function obtenerReservaCancelable(token: string): Promise<ReservaCancelable> {
  const respuesta = await peticion<{ datos: ReservaCancelable }>(`/reservas/cancelar/${token}`);
  return respuesta.datos;
}

export async function cancelarReservaPorToken(token: string): Promise<void> {
  await peticion(`/reservas/cancelar/${token}`, {
    method: 'POST',
  });
}

export async function actualizarEstadoServicioReserva(
  reservaId: string,
  servicioId: string,
  estado: string,
  motivo?: string,
): Promise<void> {
  await peticion(`/reservas/${reservaId}/servicios/${servicioId}/estado`, {
    method: 'PUT',
    body: JSON.stringify({ estado, ...(motivo ? { motivo } : {}) }),
  });
}

export async function agregarProductoAReserva(
  reservaId: string,
  productoId: string,
  cantidad = 1,
): Promise<Reserva> {
  const respuesta = await peticion<{ datos: Reserva }>(`/reservas/${reservaId}/productos`, {
    method: 'POST',
    body: JSON.stringify({ productoId, cantidad }),
  });
  return respuesta.datos;
}

/** Agrega un servicio adicional a una reserva existente. */
export async function agregarServicioAReserva(
  reservaId: string,
  servicio: { nombre: string; duracion: number; precio: number; categoria?: string },
): Promise<Reserva> {
  const respuesta = await peticion<{ datos: Reserva }>(`/reservas/${reservaId}/servicios`, {
    method: 'POST',
    body: JSON.stringify(servicio),
  });
  return respuesta.datos;
}

export async function obtenerDisponibilidadEstudio(
  estudioId: string,
  personalId: string,
  fecha: string,
  duracion: number,
): Promise<SlotTiempo[]> {
  const respuesta = await peticion<{ datos: SlotBackend[] }>(
    `/estudios/${estudioId}/disponibilidad?personalId=${personalId}&fecha=${fecha}&duracion=${duracion}`,
  );
  return normalizarSlots(respuesta.datos);
}
