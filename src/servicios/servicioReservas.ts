/**
 * Servicio de reservas — llama al backend Fastify en lugar de Firebase.
 */
import type { Reserva, EstadoReserva } from '../tipos/index';
import { peticion } from '../lib/clienteHTTP';

interface DatosCrearReserva extends Omit<Reserva, 'id'> {
  fechaNacimiento: string; // "YYYY-MM-DD"
  email: string;
  usarRecompensa?: boolean;
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
  salon: string;
  servicios: Array<{ name?: string } | string>;
}

/** Crea una nueva reserva. */
export async function crearReserva(datos: DatosCrearReserva): Promise<ResultadoCrearReserva> {
  return peticion('/reservas', {
    method: 'POST',
    body: JSON.stringify({
      estudioId: datos.studioId,
      personalId: datos.staffId,
      nombreCliente: datos.clientName,
      telefonoCliente: datos.clientPhone,
      fechaNacimiento: datos.fechaNacimiento,
      email: datos.email || undefined,
      fecha: datos.date,
      horaInicio: datos.time,
      duracion: datos.totalDuration,
      servicios: datos.services,
      precioTotal: datos.totalPrice,
      estado: datos.status,
      sucursal: datos.branch,
      marcaTinte: datos.colorBrand ?? null,
      tonalidad: datos.colorNumber ?? null,
      usarRecompensa: datos.usarRecompensa ?? false,
    }),
  });
}

/** Actualiza el estado de una reserva existente. */
export async function actualizarEstadoReserva(id: string, estado: EstadoReserva): Promise<void> {
  await peticion(`/reservas/${id}/estado`, {
    method: 'PUT',
    body: JSON.stringify({ estado }),
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
