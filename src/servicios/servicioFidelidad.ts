import { peticion } from '../lib/clienteHTTP';

export interface ConfiguracionFidelidad {
  id: string | null;
  estudioId: string;
  activo: boolean;
  visitasRequeridas: number;
  tipoRecompensa: 'descuento' | 'servicio_gratis';
  porcentajeDescuento: number | null;
  descripcionRecompensa: string;
}

export interface ClienteRankingFidelidad {
  id: string;
  clienteId: string;
  nombre: string;
  telefono: string;
  email: string | null;
  visitasAcumuladas: number;
  visitasRequeridas: number;
  recompensasDisponibles: number;
  recompensaDisponible: boolean;
  ultimaVisita: string | null;
}

export interface EstadoFidelidadCliente {
  clienteId: string;
  nombre: string;
  telefono: string;
  activo: boolean;
  descripcionRecompensa: string;
  visitasRequeridas: number;
  visitasAcumuladas: number;
  visitasRestantes: number;
  recompensasGanadas: number;
  recompensasUsadas: number;
  recompensasDisponibles: number;
  recompensaDisponible: boolean;
  ultimaVisita: string | null;
}

interface RespuestaFidelidadTelefono {
  clienteId: string;
  descripcionRecompensa: string;
  recompensasDisponibles: number;
  recompensaDisponible: boolean;
}

export async function obtenerConfigFidelidad(estudioId: string): Promise<ConfiguracionFidelidad> {
  const respuesta = await peticion<{ datos: ConfiguracionFidelidad }>(`/estudio/${estudioId}/fidelidad/config`);
  return respuesta.datos;
}

export async function guardarConfigFidelidad(
  estudioId: string,
  datos: Partial<ConfiguracionFidelidad>,
): Promise<ConfiguracionFidelidad> {
  const respuesta = await peticion<{ datos: ConfiguracionFidelidad }>(`/estudio/${estudioId}/fidelidad/config`, {
    method: 'PUT',
    body: JSON.stringify(datos),
  });
  return respuesta.datos;
}

export async function obtenerRankingFidelidad(estudioId: string, limite = 10): Promise<ClienteRankingFidelidad[]> {
  const respuesta = await peticion<{ datos: ClienteRankingFidelidad[] }>(`/estudio/${estudioId}/fidelidad/ranking?limite=${limite}`);
  return respuesta.datos;
}

export async function obtenerFidelidadCliente(clienteId: string, estudioId: string): Promise<EstadoFidelidadCliente> {
  const respuesta = await peticion<{ datos: EstadoFidelidadCliente }>(`/clientes/${clienteId}/fidelidad/${estudioId}`);
  return respuesta.datos;
}

export async function buscarClienteFidelidadPorTelefono(
  estudioId: string,
  telefono: string,
): Promise<EstadoFidelidadCliente | null> {
  const coincidencia = await peticion<{ datos: RespuestaFidelidadTelefono | null }>(
    `/estudio/${estudioId}/fidelidad/cliente?telefono=${encodeURIComponent(telefono)}`,
  );
  if (!coincidencia.datos?.clienteId) {
    return null;
  }
  return obtenerFidelidadCliente(coincidencia.datos.clienteId, estudioId);
}

export async function canjearRecompensa(clienteId: string, estudioId: string): Promise<void> {
  await peticion('/fidelidad/canjear', {
    method: 'POST',
    body: JSON.stringify({ clienteId, estudioId }),
  });
}