import { peticion } from '../lib/clienteHTTP';
import type { SolicitudSalon } from '../tipos';

type RespuestaSolicitudes = { datos: SolicitudSalon[] };
type RespuestaSolicitud = { datos: SolicitudSalon };
type RespuestaMensaje = { datos: { mensaje: string } };

/** Lista todas las solicitudes pendientes */
export async function obtenerSolicitudesPendientes(): Promise<SolicitudSalon[]> {
  const res = await peticion<RespuestaSolicitudes>('/admin/solicitudes');
  return res.datos;
}

/** Detalle de una solicitud */
export async function obtenerSolicitud(id: string): Promise<SolicitudSalon> {
  const res = await peticion<RespuestaSolicitud>(`/admin/solicitudes/${id}`);
  return res.datos;
}

/** Aprueba una solicitud de salón */
export async function aprobarSolicitud(id: string, fechaVencimiento: string): Promise<void> {
  await peticion(`/admin/solicitudes/${id}/aprobar`, {
    method: 'POST',
    body: JSON.stringify({ fechaVencimiento }),
  });
}

/** Rechaza una solicitud con motivo */
export async function rechazarSolicitud(id: string, motivo: string): Promise<void> {
  await peticion(`/admin/solicitudes/${id}/rechazar`, {
    method: 'POST',
    body: JSON.stringify({ motivo }),
  });
}

/** Reactiva una solicitud rechazada */
export async function reactivarSolicitud(id: string): Promise<void> {
  await peticion<RespuestaMensaje>(`/admin/solicitudes/${id}/reactivar`, { method: 'POST' });
}
