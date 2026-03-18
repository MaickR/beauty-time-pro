import { peticion } from '../lib/clienteHTTP';
import { URL_BASE } from '../lib/clienteHTTP';
import type { PlanEstudio } from '../tipos';

export interface PerfilEstudio {
  id: string;
  nombre: string;
  descripcion: string | null;
  direccion: string | null;
  telefono: string;
  emailContacto: string | null;
  plan: PlanEstudio;
  colorPrimario: string;
  logoUrl: string | null;
}

export async function obtenerPerfilEstudio(estudioId: string): Promise<PerfilEstudio> {
  const res = await peticion<{ datos: PerfilEstudio }>(`/estudio/${estudioId}/perfil`);
  return res.datos;
}

export async function actualizarPerfilEstudio(
  estudioId: string,
  datos: Partial<Omit<PerfilEstudio, 'id' | 'logoUrl' | 'plan'>>,
): Promise<PerfilEstudio> {
  const cuerpo: Record<string, unknown> = {};

  if (datos.nombre !== undefined) cuerpo['nombre'] = datos.nombre.trim();
  if (datos.descripcion !== undefined) {
    const descripcion = typeof datos.descripcion === 'string' ? datos.descripcion.trim() : '';
    cuerpo['descripcion'] = descripcion === '' ? null : descripcion;
  }
  if (datos.direccion !== undefined) {
    const direccion = typeof datos.direccion === 'string' ? datos.direccion.trim() : '';
    cuerpo['direccion'] = direccion === '' ? null : direccion;
  }
  if (datos.telefono !== undefined) {
    const telefono = datos.telefono.trim();
    cuerpo['telefono'] = telefono === '' ? '' : telefono;
  }
  if (datos.emailContacto !== undefined) {
    const emailContacto = typeof datos.emailContacto === 'string' ? datos.emailContacto.trim() : '';
    cuerpo['emailContacto'] = emailContacto === '' ? null : emailContacto;
  }
  if (datos.colorPrimario !== undefined) cuerpo['colorPrimario'] = datos.colorPrimario;

  const res = await peticion<{ datos: PerfilEstudio }>(`/estudio/${estudioId}/perfil`, {
    method: 'PUT',
    body: JSON.stringify(cuerpo),
  });
  return res.datos;
}

export async function subirLogo(estudioId: string, archivo: File): Promise<{ logoUrl: string }> {
  const formData = new FormData();
  formData.append('logo', archivo);

  const token = sessionStorage.getItem('btp_access_token');
  const res = await fetch(`${URL_BASE}/estudio/${estudioId}/logo`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
    credentials: 'include',
  });

  const json = (await res.json()) as { datos?: { logoUrl: string }; error?: string };
  if (!res.ok) throw new Error(json.error ?? 'Error al subir logo');
  return json.datos!;
}
