import { peticion } from '../lib/clienteHTTP';
import { URL_BASE } from '../lib/clienteHTTP';

export interface PerfilEstudio {
  id: string;
  nombre: string;
  descripcion: string | null;
  direccion: string | null;
  telefono: string;
  emailContacto: string | null;
  colorPrimario: string;
  logoUrl: string | null;
}

export async function obtenerPerfilEstudio(estudioId: string): Promise<PerfilEstudio> {
  const res = await peticion<{ datos: PerfilEstudio }>(`/estudio/${estudioId}/perfil`);
  return res.datos;
}

export async function actualizarPerfilEstudio(
  estudioId: string,
  datos: Partial<Omit<PerfilEstudio, 'id' | 'logoUrl'>>,
): Promise<PerfilEstudio> {
  const res = await peticion<{ datos: PerfilEstudio }>(`/estudio/${estudioId}/perfil`, {
    method: 'PUT',
    body: JSON.stringify(datos),
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

  const json = await res.json() as { datos?: { logoUrl: string }; error?: string };
  if (!res.ok) throw new Error(json.error ?? 'Error al subir logo');
  return json.datos!;
}
