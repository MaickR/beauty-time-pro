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

export interface RespuestaClientesPaginada {
  datos: ClienteResumen[];
  total: number;
  pagina: number;
  totalPaginas: number;
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

interface FiltrosClientesEstudio {
  buscar?: string;
  pagina?: number;
  limite?: number;
}

export async function obtenerClientesEstudio(
  estudioId: string,
  filtros: FiltrosClientesEstudio = {},
): Promise<RespuestaClientesPaginada> {
  const parametros = new URLSearchParams();
  if (filtros.buscar?.trim()) parametros.set('buscar', filtros.buscar.trim());
  if (filtros.pagina) parametros.set('pagina', String(filtros.pagina));
  if (filtros.limite) parametros.set('limite', String(filtros.limite));

  const queryString = parametros.toString();
  const url = queryString
    ? `/estudios/${estudioId}/clientes?${queryString}`
    : `/estudios/${estudioId}/clientes`;

  return peticion<RespuestaClientesPaginada>(url);
}

export async function exportarClientesEstudio(
  estudioId: string,
  buscar?: string,
): Promise<ClienteResumen[]> {
  const respuesta = await obtenerClientesEstudio(estudioId, {
    buscar,
    pagina: 1,
    limite: 10_000,
  });
  return respuesta.datos;
}

export async function obtenerDetalleCliente(id: string): Promise<ClienteDetalle> {
  const res = await peticion<{ datos: ClienteDetalle }>(`/clientes/${id}`);
  return res.datos;
}

export async function actualizarNotasCliente(id: string, notas: string): Promise<void> {
  await peticion(`/clientes/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ notas }),
  });
}
