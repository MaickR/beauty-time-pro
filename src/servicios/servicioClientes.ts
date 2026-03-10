/**
 * Servicio de clientes — llama al backend Fastify.
 */
import { peticion } from '../lib/clienteHTTP';

export interface ClienteResumen {
  id: string;
  nombre: string;
  telefono: string;
  email: string | null;
  fechaNacimiento: string; // "YYYY-MM-DD"
  edad: number;
  notas: string | null;
  activo: boolean;
  totalReservas: number;
  ultimaVisita: string | null;
}

export interface ClienteDetalle extends ClienteResumen {
  reservas: ReservaHistorial[];
}

export interface ReservaHistorial {
  id: string;
  fecha: string;
  horaInicio: string;
  servicios: unknown;
  precioTotal: number;
  estado: string;
  sucursal: string;
}

export async function obtenerClientesEstudio(
  estudioId: string,
  buscar?: string,
): Promise<ClienteResumen[]> {
  const url = buscar
    ? `/estudios/${estudioId}/clientes?buscar=${encodeURIComponent(buscar)}`
    : `/estudios/${estudioId}/clientes`;
  const res = await peticion<{ datos: ClienteResumen[] }>(url);
  return res.datos;
}

export async function obtenerDetalleCliente(id: string): Promise<ClienteDetalle> {
  const res = await peticion<{ datos: ClienteDetalle }>(`/clientes/${id}`);
  return res.datos;
}

export async function actualizarNotasCliente(
  id: string,
  notas: string,
): Promise<void> {
  await peticion(`/clientes/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ notas }),
  });
}
