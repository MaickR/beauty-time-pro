import { peticion } from '../lib/clienteHTTP';

// ─── Tipos ───────────────────────────────────────────────────────────────

export interface PreregistroSalon {
  id: string;
  nombreSalon: string;
  propietario: string;
  emailPropietario: string;
  telefonoPropietario: string;
  pais: string;
  direccion: string | null;
  categorias: string | null;
  plan: 'STANDARD' | 'PRO';
  estado: 'pendiente' | 'aprobado' | 'rechazado';
  motivoRechazo: string | null;
  estudioCreadoId: string | null;
  notas: string | null;
  creadoEn: string;
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

// ─── Servicios ───────────────────────────────────────────────────────────

export async function obtenerMisPreregistros(): Promise<PreregistroSalon[]> {
  const res = await peticion<{ datos: PreregistroSalon[] }>('/vendedor/mis-preregistros');
  return res.datos;
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
