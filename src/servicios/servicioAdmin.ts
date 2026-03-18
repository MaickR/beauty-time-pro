import { peticion } from '../lib/clienteHTTP';
import type { SolicitudSalon, ClienteAdmin, RespuestaBaseClientes } from '../tipos';

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

export async function obtenerBaseClientesAdmin(params: {
  pagina?: number;
  limite?: number;
  buscar?: string;
  salonId?: string;
  pais?: string;
  servicioFrecuente?: string;
}): Promise<RespuestaBaseClientes> {
  const qs = new URLSearchParams();
  if (params.pagina !== undefined) qs.set('pagina', String(params.pagina));
  if (params.limite !== undefined) qs.set('limite', String(params.limite));
  if (params.buscar) qs.set('buscar', params.buscar);
  if (params.salonId) qs.set('salonId', params.salonId);
  if (params.pais) qs.set('pais', params.pais);
  if (params.servicioFrecuente) qs.set('servicioFrecuente', params.servicioFrecuente);
  return peticion<RespuestaBaseClientes>(`/admin/clientes/todos?${qs}`);
}

export async function exportarBaseClientesAdmin(params: {
  buscar?: string;
  salonId?: string;
  pais?: string;
  servicioFrecuente?: string;
}): Promise<ClienteAdmin[]> {
  const qs = new URLSearchParams();
  if (params.buscar) qs.set('buscar', params.buscar);
  if (params.salonId) qs.set('salonId', params.salonId);
  if (params.pais) qs.set('pais', params.pais);
  if (params.servicioFrecuente) qs.set('servicioFrecuente', params.servicioFrecuente);
  const res = await peticion<{ clientes: ClienteAdmin[] }>(`/admin/clientes/exportar?${qs}`);
  return res.clientes;
}
