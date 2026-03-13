import { peticion } from '../lib/clienteHTTP';
import type { SolicitudCancelacion } from '../tipos';

export async function solicitarCancelacion(estudioId: string, motivo?: string): Promise<void> {
  await peticion(`/estudios/${estudioId}/solicitar-cancelacion`, {
    method: 'POST',
    body: JSON.stringify({ motivo }),
  });
}

export async function retirarSolicitudCancelacion(estudioId: string): Promise<void> {
  await peticion(`/estudios/${estudioId}/cancelar-solicitud`, {
    method: 'DELETE',
  });
}

export async function obtenerSolicitudesCancelacion(): Promise<SolicitudCancelacion[]> {
  const { datos } = await peticion<{ datos: SolicitudCancelacion[] }>('/admin/cancelaciones');
  return datos;
}

export async function procesarCancelacion(
  estudioId: string,
  accion: 'aprobar' | 'rechazar',
  respuesta?: string,
): Promise<void> {
  await peticion(`/admin/salones/${estudioId}/procesar-cancelacion`, {
    method: 'POST',
    body: JSON.stringify({ accion, respuesta }),
  });
}
