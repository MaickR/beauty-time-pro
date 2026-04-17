/**
 * Cliente HTTP para llamadas al backend Fastify.
 *
 * - Base URL tomada de VITE_URL_API (validada al arranque por env.ts).
 * - Adjunta automáticamente el access token JWT en memoria.
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
const URL_BASE_DESARROLLO_LOCAL = 'http://localhost:3000';
const CLAVE_CSRF = 'btp_csrf_token';
const CLAVE_SESION = 'btp_tiene_sesion';
const CODIGOS_BLOQUEO_SESION = new Set([
  'CUENTA_SUSPENDIDA',
  'SALON_SUSPENDIDO',
  'ACCESO_REVOCADO',
  'CUENTA_DESACTIVADA',
]);
let tokenEnMemoria: string | null = null;

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

function puedeUsarFallbackLocal(error: unknown): boolean {
  return Boolean(env.DEV && URL_BASE !== URL_BASE_DESARROLLO_LOCAL && error instanceof TypeError);
}

function debeUsarProxyAuthLocal(ruta: string): boolean {
  return Boolean(env.DEV && typeof window !== 'undefined' && /^\/auth(?:\/|$)/.test(ruta));
}

function construirUrlPeticion(ruta: string): string {
  if (debeUsarProxyAuthLocal(ruta)) {
    return `${window.location.origin}${ruta}`;
  }

  return `${URL_BASE}${ruta}`;
}

function construirUrlFallback(ruta: string, error: unknown): string | null {
  if (!(error instanceof TypeError)) {
    return null;
  }

  if (debeUsarProxyAuthLocal(ruta)) {
    return `${URL_BASE}${ruta}`;
  }

  if (puedeUsarFallbackLocal(error)) {
    return `${URL_BASE_DESARROLLO_LOCAL}${ruta}`;
  }

  return null;
}

function esperar(ms: number): Promise<void> {
  return new Promise((resolve) => globalThis.setTimeout(resolve, ms));
}

async function fetchConFallbackLocal(ruta: string, init: RequestInit): Promise<Response> {
  const urlPrincipal = construirUrlPeticion(ruta);

  try {
    return await fetch(urlPrincipal, init);
  } catch (errorPrimario) {
    const urlFallback = construirUrlFallback(ruta, errorPrimario);
    if (urlFallback) {
      try {
        return await fetch(urlFallback, init);
      } catch {
        // continuar al reintento corto en desarrollo
      }
    }

    if (env.DEV && errorPrimario instanceof TypeError) {
      await esperar(450);
      try {
        return await fetch(urlPrincipal, init);
      } catch (errorReintento) {
        const fallbackReintento = construirUrlFallback(ruta, errorReintento);
        if (fallbackReintento) {
          return fetch(fallbackReintento, init);
        }
        throw errorReintento;
      }
    }

    throw errorPrimario;
  }
}

export async function peticionCruda(ruta: string, init: RequestInit): Promise<Response> {
  return fetchConFallbackLocal(ruta, init);
}

/** Lee el token del almacenamiento de sesión. */
function leerToken(): string | null {
  return tokenEnMemoria;
}

export function obtenerCabecerasAutenticadas(
  metodo: string,
  cabecerasIniciales?: HeadersInit,
): Headers {
  const cabeceras = new Headers(cabecerasIniciales);
  const token = leerToken();
  if (token) {
    cabeceras.set('Authorization', `Bearer ${token}`);
  }

  const csrfToken = obtenerTokenCsrf();
  if (csrfToken && metodo !== 'GET' && metodo !== 'HEAD') {
    cabeceras.set('x-csrf-token', csrfToken);
  }

  return cabeceras;
}

export function obtenerTokenCsrf(): string | null {
  return localStorage.getItem(CLAVE_CSRF);
}

function guardarTokenCsrf(token: string): void {
  localStorage.setItem(CLAVE_CSRF, token);
}

/** Persiste el token en memoria y el CSRF en sessionStorage. */
export function guardarToken(token: string): void {
  tokenEnMemoria = token;
}

export function guardarSesionAutenticacion(datos: { token: string; csrfToken?: string }): void {
  tokenEnMemoria = datos.token;
  if (datos.csrfToken) {
    guardarTokenCsrf(datos.csrfToken);
  }
}

/** Elimina el token en memoria y el CSRF persistido. */
export function limpiarToken(): void {
  tokenEnMemoria = null;
  localStorage.removeItem(CLAVE_CSRF);
}

function tieneSesionPersistida(): boolean {
  if (typeof window === 'undefined') {
    return true;
  }

  return localStorage.getItem(CLAVE_SESION) === '1';
}

/** Intenta refrescar el access token usando la cookie httpOnly de refresh. */
async function intentarRefrescar(): Promise<string | null> {
  if (!tieneSesionPersistida()) {
    return null;
  }

  try {
    const cabeceras = new Headers();
    const csrfToken = obtenerTokenCsrf();
    if (csrfToken) {
      cabeceras.set('x-csrf-token', csrfToken);
    }
    cabeceras.set('Content-Type', 'application/json');

    const res = await fetchConFallbackLocal('/auth/refrescar', {
      method: 'POST',
      credentials: 'include',
      headers: cabeceras,
      body: '{}',
    });
    if (!res.ok) {
      if (res.status === 401 && typeof window !== 'undefined') {
        localStorage.removeItem(CLAVE_SESION);
        limpiarToken();
      }
      return null;
    }
    const json = (await res.json()) as { datos: { token: string; csrfToken?: string } };
    guardarSesionAutenticacion(json.datos);
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
    opciones.body === undefined && (metodo === 'POST' || metodo === 'PUT' || metodo === 'PATCH')
      ? '{}'
      : opciones.body;
  const cabeceras = obtenerCabecerasAutenticadas(metodo, opciones.headers);
  if (
    !cabeceras.has('Content-Type') &&
    cuerpoNormalizado &&
    !(cuerpoNormalizado instanceof FormData)
  ) {
    cabeceras.set('Content-Type', 'application/json');
  }

  let respuesta: Response;
  try {
    respuesta = await fetchConFallbackLocal(ruta, {
      ...opciones,
      body: cuerpoNormalizado,
      headers: cabeceras,
      credentials: 'include',
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new ErrorAPI(
        'No fue posible conectar con el servidor en este momento. Intenta nuevamente en unos segundos.',
        503,
        'SERVIDOR_NO_DISPONIBLE',
      );
    }

    throw error;
  }

  // Intento único de refresh ante 401
  if (respuesta.status === 401) {
    const nuevoToken = await intentarRefrescar();
    if (nuevoToken) {
      cabeceras.set('Authorization', `Bearer ${nuevoToken}`);
      const reintento = await fetchConFallbackLocal(ruta, {
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
