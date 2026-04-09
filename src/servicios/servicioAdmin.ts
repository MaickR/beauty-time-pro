import { peticion } from '../lib/clienteHTTP';
import type { SolicitudSalon, ClienteAdmin, RespuestaBaseClientes } from '../tipos';

type RespuestaSolicitudes = { datos: SolicitudSalon[] };
type RespuestaSolicitud = { datos: SolicitudSalon };
type RespuestaMensaje = { datos: { mensaje: string } };

// ─── Tipos para métricas y control del panel administrativo ──────────────────

export interface SalonTotalMetrica {
  id: string;
  nombre: string;
  fechaCreacion: string;
  plan: string;
  pais: string;
  dueno: string;
  vendedor: string | null;
}

export interface RespuestaTotalSalones {
  datos: SalonTotalMetrica[];
  total: number;
  pagina: number;
  totalPaginas: number;
}

export interface SalonActivo {
  id: string;
  nombre: string;
  dueno: string;
  correo: string | null;
  periodo: { inicio: string; fin: string };
  plan: string;
  claveDueno: string;
}

export interface SalonSuspendido {
  id: string;
  nombre: string;
  correo: string | null;
  fechaSuspension: string | null;
  plan: string;
  claveDueno: string;
}

export interface SalonBloqueado {
  id: string;
  nombre: string;
  correo: string | null;
  fechaBloqueo: string | null;
  motivoBloqueo: string | null;
  claveDueno: string;
}

export interface RespuestaListaPaginada<T> {
  datos: T[];
  total: number;
  pagina: number;
  totalPaginas: number;
}

export interface ReservaMetrica {
  id: string;
  salon: string;
  fecha: string;
  estado: string;
  pais: string;
}

export interface RespuestaReservasMetrica {
  datos: ReservaMetrica[];
  totalReservas: number;
  total: number;
  pagina: number;
  totalPaginas: number;
}

export interface DesglosePlan {
  salones: number;
  monto: number;
}

export interface VentasPais {
  total: number;
  moneda: string;
  desglose: {
    pro: DesglosePlan;
    standard: DesglosePlan;
  };
}

export interface RespuestaVentas {
  datos: {
    mexico: VentasPais;
    colombia: VentasPais;
  };
}

export interface SalonDirectorio {
  id: string;
  nombre: string;
  dueno: string;
  correo: string | null;
  pais: string;
  plan: 'STANDARD' | 'PRO';
  estado: string;
  activo: boolean;
  duenoActivo: boolean;
  ultimoAccesoDueno: string | null;
}

export interface DetalleSalonDirectorio {
  id: string;
  nombre: string;
  propietario: string;
  telefono: string;
  pais: string;
  plan: string;
  estado: string;
  activo: boolean;
  inicioSuscripcion: string;
  fechaVencimiento: string;
  emailContacto: string | null;
  direccion: string | null;
  descripcion: string | null;
  colorPrimario: string | null;
  logoUrl: string | null;
  claveCliente: string;
  creadoEn: string;
  usuarios: { nombre: string; email: string }[];
}

export interface HistorialPagoSalon {
  id: string;
  fechaPago: string;
  fechaCreacionSalon: string;
  plan: string;
  monto: number;
  moneda: string;
  concepto: string;
}

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

// ═══════════════════════════════════════════════════════════════════════════
// FASE 1 — Servicios de métricas y control del panel administrativo
// ═══════════════════════════════════════════════════════════════════════════

export async function obtenerTotalSalones(params: {
  buscar?: string;
  plan?: string;
  pais?: string;
  vendedor?: string;
  pagina?: number;
  limite?: number;
}): Promise<RespuestaTotalSalones> {
  const qs = new URLSearchParams();
  if (params.buscar) qs.set('buscar', params.buscar);
  if (params.plan) qs.set('plan', params.plan);
  if (params.pais) qs.set('pais', params.pais);
  if (params.vendedor) qs.set('vendedor', params.vendedor);
  if (params.pagina) qs.set('pagina', String(params.pagina));
  if (params.limite) qs.set('limite', String(params.limite));
  return peticion<RespuestaTotalSalones>(`/admin/metricas/total-salones?${qs}`);
}

export async function obtenerSalonesActivos(
  pagina = 1,
  limite = 10,
): Promise<RespuestaListaPaginada<SalonActivo>> {
  return peticion<RespuestaListaPaginada<SalonActivo>>(
    `/admin/salones/activos?pagina=${pagina}&limite=${limite}`,
  );
}

export async function obtenerSalonesSuspendidos(
  pagina = 1,
  limite = 10,
): Promise<RespuestaListaPaginada<SalonSuspendido>> {
  return peticion<RespuestaListaPaginada<SalonSuspendido>>(
    `/admin/salones/suspendidos?pagina=${pagina}&limite=${limite}`,
  );
}

export async function obtenerSalonesBloqueados(
  pagina = 1,
  limite = 10,
): Promise<RespuestaListaPaginada<SalonBloqueado>> {
  return peticion<RespuestaListaPaginada<SalonBloqueado>>(
    `/admin/salones/bloqueados?pagina=${pagina}&limite=${limite}`,
  );
}

export async function suspenderSalon(id: string): Promise<void> {
  await peticion(`/admin/salones/${id}/suspender`, { method: 'PUT' });
}

export async function bloquearSalon(id: string, motivo: string): Promise<void> {
  await peticion(`/admin/salones/${id}/bloquear`, {
    method: 'PUT',
    body: JSON.stringify({ motivo }),
  });
}

export async function activarSalon(id: string): Promise<void> {
  await peticion(`/admin/salones/${id}/activar`, { method: 'PUT' });
}

export async function editarSuscripcionSalon(
  id: string,
  datos: {
    inicioSuscripcion?: string;
    fechaVencimiento?: string;
    plan?: 'STANDARD' | 'PRO';
    contrasena?: string;
  },
): Promise<void> {
  await peticion(`/admin/salones/${id}/editar-suscripcion`, {
    method: 'PUT',
    body: JSON.stringify(datos),
  });
}

export async function obtenerReservasMetrica(params: {
  fechaInicio?: string;
  fechaFin?: string;
  estado?: string;
  pais?: string;
  pagina?: number;
  limite?: number;
}): Promise<RespuestaReservasMetrica> {
  const qs = new URLSearchParams();
  if (params.fechaInicio) qs.set('fechaInicio', params.fechaInicio);
  if (params.fechaFin) qs.set('fechaFin', params.fechaFin);
  if (params.estado) qs.set('estado', params.estado);
  if (params.pais) qs.set('pais', params.pais);
  if (params.pagina) qs.set('pagina', String(params.pagina));
  if (params.limite) qs.set('limite', String(params.limite));
  return peticion<RespuestaReservasMetrica>(`/admin/metricas/reservas?${qs}`);
}

export async function obtenerVentasMetrica(): Promise<RespuestaVentas> {
  return peticion<RespuestaVentas>('/admin/metricas/ventas');
}

export async function obtenerDirectorio(params: {
  buscar?: string;
  pagina?: number;
  limite?: number;
  pais?: string;
  estado?: string;
  plan?: string;
}): Promise<RespuestaListaPaginada<SalonDirectorio>> {
  const qs = new URLSearchParams();
  if (params.buscar) qs.set('buscar', params.buscar);
  if (params.pagina) qs.set('pagina', String(params.pagina));
  if (params.limite) qs.set('limite', String(params.limite));
  if (params.pais) qs.set('pais', params.pais);
  if (params.estado) qs.set('estado', params.estado);
  if (params.plan) qs.set('plan', params.plan);
  return peticion<RespuestaListaPaginada<SalonDirectorio>>(`/admin/directorio?${qs}`);
}

export async function obtenerDetalleSalonDirectorio(id: string): Promise<DetalleSalonDirectorio> {
  const res = await peticion<{ datos: DetalleSalonDirectorio }>(`/admin/directorio/${id}`);
  return res.datos;
}

export async function actualizarSalonDirectorio(
  id: string,
  datos: Record<string, unknown>,
): Promise<void> {
  await peticion(`/admin/directorio/${id}`, { method: 'PUT', body: JSON.stringify(datos) });
}

export async function obtenerHistorialPagosSalon(
  id: string,
  pagina = 1,
  limite = 10,
): Promise<RespuestaListaPaginada<HistorialPagoSalon>> {
  return peticion<RespuestaListaPaginada<HistorialPagoSalon>>(
    `/admin/directorio/${id}/historial?pagina=${pagina}&limite=${limite}`,
  );
}

// ─── Preregistros de vendedores ───────────────────────────────────────────────

export interface PreregistroAdmin {
  id: string;
  nombreSalon: string;
  propietario: string;
  emailPropietario: string;
  telefonoPropietario: string;
  pais: string;
  direccion: string | null;
  descripcion: string | null;
  categorias: string | null;
  plan: string;
  estado: string;
  motivoRechazo: string | null;
  estudioCreadoId: string | null;
  notas: string | null;
  vendedor: { id: string; nombre: string | null; email: string };
  creadoEn: string;
  actualizadoEn: string;
}

interface RespuestaPreregistros {
  datos: PreregistroAdmin[];
  total: number;
  pagina: number;
  limite: number;
}

interface RespuestaAprobacion {
  datos: {
    mensaje: string;
    estudioId: string;
    acceso: {
      emailDueno: string;
      contrasena: string;
      claveDueno: string;
      claveClientes: string;
    };
  };
}

export async function obtenerPreregistrosAdmin(params?: {
  estado?: string;
  pagina?: number;
  limite?: number;
}): Promise<RespuestaPreregistros> {
  const qs = new URLSearchParams();
  if (params?.estado) qs.set('estado', params.estado);
  if (params?.pagina) qs.set('pagina', String(params.pagina));
  if (params?.limite) qs.set('limite', String(params.limite));
  return peticion<RespuestaPreregistros>(`/admin/preregistros?${qs}`);
}

export async function aprobarPreregistro(
  id: string,
  datos?: {
    contrasena?: string;
    inicioSuscripcion?: string;
  },
): Promise<RespuestaAprobacion> {
  return peticion<RespuestaAprobacion>(`/admin/preregistros/${id}/aprobar`, {
    method: 'POST',
    body: JSON.stringify(datos ?? {}),
  });
}

export async function rechazarPreregistro(
  id: string,
  motivo: string,
): Promise<{ datos: { mensaje: string } }> {
  return peticion<{ datos: { mensaje: string } }>(`/admin/preregistros/${id}/rechazar`, {
    method: 'POST',
    body: JSON.stringify({ motivo }),
  });
}
