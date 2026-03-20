/**
 * Servicio de autenticación — llama al backend Fastify (JWT).
 *
 * Todas las operaciones hablan con /auth/* en lugar de Firebase Auth.
 */
import { ErrorAPI, peticion, guardarToken, limpiarToken, URL_BASE } from '../lib/clienteHTTP';
import { obtenerSalonPublicoPorClave } from './servicioClienteApp';

export type FuncionDesuscribir = () => void;

export interface PermisosSesionMaestro {
  aprobarSalones: boolean;
  gestionarPagos: boolean;
  crearAdmins: boolean;
  verAuditLog: boolean;
  verMetricas: boolean;
  suspenderSalones: boolean;
}

export interface DatosAccesoSalon {
  estudioId: string;
  nombreSalon: string;
  claveSalon: string;
}

interface DatosSesion {
  token: string;
  rol: string;
  estudioId: string | null;
  nombre: string;
  email: string;
  esMaestroTotal: boolean;
  permisos?: PermisosSesionMaestro;
  personalId?: string | null;
  forzarCambioContrasena?: boolean;
}

interface RespuestaInicioSesion {
  datos: DatosSesion;
}

const RETRASO_REINTENTO_LOGIN_MS = 450;

function esperar(ms: number): Promise<void> {
  return new Promise((resolver) => {
    setTimeout(resolver, ms);
  });
}

function esErrorTransitorioLogin(error: unknown): boolean {
  if (!(error instanceof ErrorAPI)) return false;
  return error.estado === 404 || error.estado >= 500;
}

async function autenticarConReintento(payload: {
  email?: string;
  contrasena?: string;
  clave?: string;
}): Promise<DatosSesion> {
  try {
    const res = await peticion<RespuestaInicioSesion>('/auth/iniciar-sesion', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    guardarToken(res.datos.token);
    return res.datos;
  } catch (error) {
    // Reintento único para cubrir reinicios breves del backend durante desarrollo.
    if (esErrorTransitorioLogin(error)) {
      await esperar(RETRASO_REINTENTO_LOGIN_MS);
      const res = await peticion<RespuestaInicioSesion>('/auth/iniciar-sesion', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      guardarToken(res.datos.token);
      return res.datos;
    }
    throw error;
  }
}

/**
 * Autentica con email y contraseña — para maestro y dueño.
 * El refresh token llega en una cookie httpOnly automáticamente.
 */
export async function iniciarSesionConEmailAPI(
  email: string,
  contrasena: string,
): Promise<DatosSesion> {
  return autenticarConReintento({ email, contrasena });
}

/**
 * Resuelve la clave del salón y devuelve los datos mínimos para abrir la reserva.
 */
export async function buscarAccesoSalonPorClaveAPI(clave: string): Promise<DatosAccesoSalon> {
  limpiarToken();
  const salon = await obtenerSalonPublicoPorClave(clave);
  return {
    estudioId: salon.id,
    nombreSalon: salon.nombre,
    claveSalon: clave.trim().toUpperCase(),
  };
}

/**
 * Intenta renovar el access token usando el refresh token de la cookie.
 * Usa fetch directamente (sin peticion) para evitar el bucle de reintento
 * que causaría dos peticiones 401 en consola al arrancar sin sesión.
 * Devuelve `null` si la sesión expiró y hay que volver a hacer login.
 */
export async function refrescarSesion(): Promise<{
  token: string;
  rol: string;
  estudioId: string | null;
  nombre: string;
  email: string;
  esMaestroTotal: boolean;
  permisos?: PermisosSesionMaestro;
  personalId?: string | null;
  forzarCambioContrasena?: boolean;
} | null> {
  try {
    const res = await fetch(`${URL_BASE}/auth/refrescar`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) return null;
    const json = (await res.json()) as RespuestaInicioSesion;
    guardarToken(json.datos.token);
    return json.datos;
  } catch {
    return null;
  }
}

/**
 * Solicita email de recuperación de contraseña.
 * Siempre devuelve éxito por seguridad.
 */
export async function solicitarResetAPI(email: string): Promise<void> {
  await peticion('/auth/solicitar-reset', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

/**
 * Confirma el reset de contraseña con el token del email.
 */
export async function confirmarResetAPI(token: string, contrasenaNueva: string): Promise<void> {
  await peticion('/auth/confirmar-reset', {
    method: 'POST',
    body: JSON.stringify({ token, contrasenaNueva }),
  });
}

/**
 * Cambia la contraseña con la contraseña actual (usuario autenticado).
 */
export async function cambiarContrasenaAPI(
  contrasenaActual: string,
  contrasenaNueva: string,
): Promise<void> {
  await peticion('/auth/cambiar-contrasena', {
    method: 'POST',
    body: JSON.stringify({ contrasenaActual, contrasenaNueva }),
  });
}

export async function solicitarCambioEmailAPI(emailNuevo: string): Promise<{ mensaje: string }> {
  const respuesta = await peticion<{ datos: { mensaje: string } }>('/auth/solicitar-cambio-email', {
    method: 'POST',
    body: JSON.stringify({ emailNuevo }),
  });
  return respuesta.datos;
}

/**
 * Cierra sesión en el servidor (limpia la cookie httpOnly) y el estado local.
 */
export async function cerrarSesionAPI(): Promise<void> {
  try {
    await peticion('/auth/cerrar-sesion', { method: 'POST' });
  } finally {
    limpiarToken();
  }
}
