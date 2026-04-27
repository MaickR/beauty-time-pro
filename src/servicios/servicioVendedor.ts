import { peticion } from '../lib/clienteHTTP';

function construirQuery(params: Record<string, string | number | boolean | undefined>) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([clave, valor]) => {
    if (valor === undefined || valor === '') return;
    query.set(clave, String(valor));
  });
  const serializado = query.toString();
  return serializado ? `?${serializado}` : '';
}

// ─── Tipos ───────────────────────────────────────────────────────────────

export interface PreregistroSalon {
  id: string;
  nombreSalon: string;
  propietario: string;
  emailPropietario: string;
  telefonoPropietario: string;
  pais: string;
  direccion: string | null;
  descripcion: string | null;
  categorias: string | null;
  plan: 'STANDARD' | 'PRO';
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  motivoRechazo: string | null;
  estudioCreadoId: string | null;
  notas: string | null;
  creadoEn: string;
}

export interface RespuestaPreregistrosVendedor {
  datos: PreregistroSalon[];
  total: number;
  pagina: number;
  limite: number;
}

export interface ParametrosPreregistrosVendedor {
  busqueda?: string;
  estado?: 'pendiente' | 'aprobado' | 'rechazado';
  pagina?: number;
  limite?: number;
}

export interface SalonVendedor {
  id: string;
  nombre: string;
  propietario: string;
  plan: 'STANDARD' | 'PRO';
  pais: string;
  estado: string;
  activo: boolean;
  inicioSuscripcion: string;
  fechaVencimiento: string;
  totalReservas: number;
  creadoEn: string;
}

export interface ResumenVendedor {
  totalPreregistros: number;
  pendientes: number;
  aprobados: number;
  rechazados: number;
  totalSalones: number;
  salonesActivos: number;
  salonesPendientesPago: number;
  ventasRegistradas: number;
  ingresosGenerados: number;
  ingresosStandard: number;
  ingresosPro: number;
  porcentajeComision: number;
  porcentajeComisionPro: number;
  comisionGenerada: number;
  comisionGeneradaStandard: number;
  comisionGeneradaPro: number;
}

export interface SalonDemoVendedor {
  id: string;
  slug: string | null;
  nombre: string;
  plan: 'STANDARD' | 'PRO';
  estado: string;
  activo: boolean;
  fechaVencimiento: string;
  actualizadoEn: string;
  totales: {
    reservas: number;
    pagos: number;
    clientes: number;
    personal: number;
    productos: number;
  };
  credencialesDemo: {
    adminEmail: string;
    adminContrasena: string;
    empleadoEmail: string;
    empleadoContrasena: string;
    contrasenaCompartida: string | null;
    claveReservas?: string | null;
    urlReservas?: string | null;
  };
}

export interface VentaVendedor {
  id: string;
  fecha: string;
  monto: number;
  moneda: string;
  concepto: string;
  referencia: string | null;
  salonId: string;
  salonNombre: string;
  adminSalonNombre: string;
  adminSalonEmail: string | null;
  plan: 'STANDARD' | 'PRO';
  tipoSuscripcion: string;
  valorSuscripcion: number;
  pais: string;
  fechaVencimiento: string;
  pendientePago: boolean;
  porcentajeComisionAplicado: number;
  comision: number;
}

export interface DatosPreregistro {
  nombreSalon: string;
  propietario: string;
  emailPropietario: string;
  telefonoPropietario: string;
  pais: 'Mexico' | 'Colombia';
  direccion?: string;
  descripcion?: string;
  categorias?: string;
  plan?: 'STANDARD' | 'PRO';
  notas?: string;
}

export interface NotificacionVendedor {
  id: string;
  tipo:
    | 'preregistro_aprobado'
    | 'preregistro_rechazado'
    | 'preregistro_pendiente'
    | 'pago_pendiente';
  titulo: string;
  mensaje: string;
  prioridad: 'alta' | 'media' | 'baja';
  creadoEn: string;
  referenciaId: string;
}

// ─── Servicios ───────────────────────────────────────────────────────────

export async function obtenerMisPreregistros(
  params: ParametrosPreregistrosVendedor = {},
): Promise<RespuestaPreregistrosVendedor> {
  return peticion<RespuestaPreregistrosVendedor>(
    `/vendedor/mis-preregistros${construirQuery({
      busqueda: params.busqueda,
      estado: params.estado,
      pagina: params.pagina,
      limite: params.limite,
    })}`,
  );
}

export async function crearPreregistro(
  datos: DatosPreregistro,
): Promise<{ id: string; nombreSalon: string; estado: string }> {
  const res = await peticion<{
    datos: { id: string; nombreSalon: string; estado: string };
  }>('/vendedor/preregistro', {
    method: 'POST',
    body: JSON.stringify(datos),
  });
  return res.datos;
}

export async function obtenerMisSalones(): Promise<SalonVendedor[]> {
  const res = await peticion<{ datos: SalonVendedor[] }>('/vendedor/mis-salones');
  return res.datos;
}

export async function obtenerResumenVendedor(): Promise<ResumenVendedor> {
  const res = await peticion<{ datos: ResumenVendedor }>('/vendedor/resumen');
  return res.datos;
}

export async function obtenerSalonDemoVendedor(): Promise<SalonDemoVendedor> {
  const res = await peticion<{ datos: SalonDemoVendedor }>('/vendedor/demo');
  return res.datos;
}

export async function reiniciarSalonDemoVendedor(): Promise<{
  mensaje: string;
  id: string;
  slug: string | null;
}> {
  const res = await peticion<{ datos: { mensaje: string; id: string; slug: string | null } }>(
    '/vendedor/demo/reset',
    { method: 'POST', body: '{}' },
  );
  return res.datos;
}

export async function actualizarPlanSalonDemoVendedor(plan: 'STANDARD' | 'PRO'): Promise<{
  id: string;
  slug: string | null;
  plan: 'STANDARD' | 'PRO';
}> {
  const res = await peticion<{
    datos: { id: string; slug: string | null; plan: 'STANDARD' | 'PRO' };
  }>('/vendedor/demo/plan', {
    method: 'PATCH',
    body: JSON.stringify({ plan }),
  });
  return res.datos;
}

export async function obtenerVentasVendedor(
  params: {
    fechaDesde?: string;
    fechaHasta?: string;
    soloPendientesPago?: boolean;
  } = {},
): Promise<VentaVendedor[]> {
  const res = await peticion<{ datos: VentaVendedor[] }>(
    `/vendedor/ventas${construirQuery(params)}`,
  );
  return res.datos;
}

export async function obtenerNotificacionesVendedor(): Promise<NotificacionVendedor[]> {
  const res = await peticion<{ datos: NotificacionVendedor[] }>('/vendedor/notificaciones');
  return res.datos;
}
