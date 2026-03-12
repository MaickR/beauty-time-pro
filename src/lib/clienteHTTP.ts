/**
 * Cliente HTTP para llamadas al backend Fastify.
 *
 * - Base URL tomada de VITE_URL_API (validada al arranque por env.ts).
 * - Adjunta automáticamente el access token JWT del almacenamiento local.
 * - Si recibe 401, intenta refrescar el token una vez antes de rechazar.
 */
import { env } from './env';

/** Error enriquecido con código de estado y campos adicionales del servidor. */
export class ErrorAPI extends Error {
  readonly codigo: string;
  readonly motivo?: string;
  readonly estado: number;
  constructor(mensaje: string, estado: number, codigo = '', motivo?: string) {
    super(mensaje);
    this.name = 'ErrorAPI';
    this.estado = estado;
    this.codigo = codigo;
    this.motivo = motivo;
  }
}

export const URL_BASE = env.VITE_URL_API;
const CLAVE_TOKEN = 'btp_access_token';

/** Lee el token del almacenamiento de sesión. */
function leerToken(): string | null {
  return sessionStorage.getItem(CLAVE_TOKEN);
}

/** Persiste el token en el almacenamiento de sesión. */
export function guardarToken(token: string): void {
  sessionStorage.setItem(CLAVE_TOKEN, token);
}

/** Elimina el token del almacenamiento de sesión. */
export function limpiarToken(): void {
  sessionStorage.removeItem(CLAVE_TOKEN);
}

/** Intenta refrescar el access token usando la cookie httpOnly de refresh. */
async function intentarRefrescar(): Promise<string | null> {
  try {
    const res = await fetch(`${URL_BASE}/auth/refrescar`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { datos: { token: string } };
    guardarToken(json.datos.token);
    return json.datos.token;
  } catch {
    return null;
  }
}

/** Realiza una petición HTTP al backend con JWT adjunto. */
export async function peticion<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  const cabeceras = new Headers(opciones.headers);

  const token = leerToken();
  if (token) cabeceras.set('Authorization', `Bearer ${token}`);
  if (!cabeceras.has('Content-Type') && opciones.body && !(opciones.body instanceof FormData)) {
    cabeceras.set('Content-Type', 'application/json');
  }

  const respuesta = await fetch(`${URL_BASE}${ruta}`, {
    ...opciones,
    headers: cabeceras,
    credentials: 'include',
  });

  // Intento único de refresh ante 401
  if (respuesta.status === 401) {
    const nuevoToken = await intentarRefrescar();
    if (nuevoToken) {
      cabeceras.set('Authorization', `Bearer ${nuevoToken}`);
      const reintento = await fetch(`${URL_BASE}${ruta}`, {
        ...opciones,
        headers: cabeceras,
        credentials: 'include',
      });
      if (!reintento.ok) {
        const cuerpo = (await reintento.json().catch(() => ({}))) as {
          error?: string;
          codigo?: string;
          motivo?: string;
        };
        throw new ErrorAPI(
          cuerpo.error ?? `Error ${reintento.status}`,
          reintento.status,
          cuerpo.codigo,
          cuerpo.motivo,
        );
      }
      return (await reintento.json()) as T;
    }
    limpiarToken();
    throw new ErrorAPI('Sesión expirada. Inicia sesión nuevamente.', 401);
  }

  if (!respuesta.ok) {
    const cuerpo = (await respuesta.json().catch(() => ({}))) as {
      error?: string;
      codigo?: string;
      motivo?: string;
    };
    throw new ErrorAPI(
      cuerpo.error ?? `Error ${respuesta.status}`,
      respuesta.status,
      cuerpo.codigo,
      cuerpo.motivo,
    );
  }

  return (await respuesta.json()) as T;
}
