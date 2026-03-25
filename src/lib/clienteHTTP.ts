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
const CODIGOS_BLOQUEO_SESION = new Set([
  'CUENTA_SUSPENDIDA',
  'SALON_SUSPENDIDO',
  'ACCESO_REVOCADO',
  'CUENTA_DESACTIVADA',
]);

/** Callback registrado externamente para reaccionar a la expiración de sesión. */
let _callbackSesionExpirada:
  | ((datos: { mensaje: string; codigo?: string; estado: number }) => void)
  | null = null;

/** Registra una función que se llama cuando el refresh token ha expirado y no se puede renovar la sesión. */
export function registrarCallbackSesionExpirada(
  fn: (datos: { mensaje: string; codigo?: string; estado: number }) => void,
): void {
  _callbackSesionExpirada = fn;
}

function manejarSesionInvalida(datos: { mensaje: string; codigo?: string; estado: number }): void {
  limpiarToken();
  _callbackSesionExpirada?.(datos);
}

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

/** Lee la fecha de expiración del JWT actual (Unix timestamp en segundos). */
function obtenerExpiracionToken(): number | null {
  const token = leerToken();
  if (!token) return null;
  try {
    const partes = token.split('.');
    if (partes.length !== 3) return null;
    const payload = JSON.parse(atob(partes[1])) as { exp?: number };
    return typeof payload.exp === 'number' ? payload.exp : null;
  } catch {
    return null;
  }
}

/** Promesa compartida para evitar múltiples refreshes simultáneos. */
let _promesaRefrescando: Promise<string | null> | null = null;

/**
 * Refresca el token proactivamente si caduca en menos de 60 segundos.
 * Deduplicado: varias llamadas concurrentes comparten la misma promesa.
 */
async function refrescarSiNecesario(): Promise<void> {
  const exp = obtenerExpiracionToken();
  if (!exp) return;
  const margenSegundos = 60;
  if (exp - Date.now() / 1000 > margenSegundos) return;

  if (!_promesaRefrescando) {
    _promesaRefrescando = intentarRefrescar().finally(() => {
      _promesaRefrescando = null;
    });
  }
  await _promesaRefrescando;
}

/** Realiza una petición HTTP al backend con JWT adjunto. */
export async function peticion<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  // Refresh proactivo: si el token caduca pronto, renovarlo antes de la petición
  // para evitar un 401 innecesario en consola.
  await refrescarSiNecesario();

  const metodo = (opciones.method ?? 'GET').toUpperCase();
  const cuerpoNormalizado =
    opciones.body === undefined && (metodo === 'PUT' || metodo === 'PATCH') ? '{}' : opciones.body;
  const cabeceras = new Headers(opciones.headers);

  const token = leerToken();
  if (token) cabeceras.set('Authorization', `Bearer ${token}`);
  if (
    !cabeceras.has('Content-Type') &&
    cuerpoNormalizado &&
    !(cuerpoNormalizado instanceof FormData)
  ) {
    cabeceras.set('Content-Type', 'application/json');
  }

  const respuesta = await fetch(`${URL_BASE}${ruta}`, {
    ...opciones,
    body: cuerpoNormalizado,
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
        body: cuerpoNormalizado,
        headers: cabeceras,
        credentials: 'include',
      });
      if (!reintento.ok) {
        const cuerpo = (await reintento.json().catch(() => ({}))) as {
          error?: string;
          codigo?: string;
          motivo?: string;
        };
        if (
          reintento.status === 403 &&
          cuerpo.codigo &&
          CODIGOS_BLOQUEO_SESION.has(cuerpo.codigo)
        ) {
          manejarSesionInvalida({
            mensaje: cuerpo.error ?? 'Tu sesión ya no es válida.',
            codigo: cuerpo.codigo,
            estado: reintento.status,
          });
        }
        throw new ErrorAPI(
          cuerpo.error ?? `Error ${reintento.status}`,
          reintento.status,
          cuerpo.codigo,
          cuerpo.motivo,
        );
      }
      return (await reintento.json()) as T;
    }
    manejarSesionInvalida({
      mensaje: 'Sesión expirada. Inicia sesión nuevamente.',
      estado: 401,
    });
    throw new ErrorAPI('Sesión expirada. Inicia sesión nuevamente.', 401);
  }

  if (!respuesta.ok) {
    const cuerpo = (await respuesta.json().catch(() => ({}))) as {
      error?: string;
      codigo?: string;
      motivo?: string;
    };
    if (respuesta.status === 403 && cuerpo.codigo && CODIGOS_BLOQUEO_SESION.has(cuerpo.codigo)) {
      manejarSesionInvalida({
        mensaje: cuerpo.error ?? 'Tu sesión ya no es válida.',
        codigo: cuerpo.codigo,
        estado: respuesta.status,
      });
    }
    throw new ErrorAPI(
      cuerpo.error ?? `Error ${respuesta.status}`,
      respuesta.status,
      cuerpo.codigo,
      cuerpo.motivo,
    );
  }

  return (await respuesta.json()) as T;
}
