/**
 * Servicio de autenticación — llama al backend Fastify (JWT).
 *
 * Todas las operaciones hablan con /auth/* en lugar de Firebase Auth.
 */
import { peticion, guardarToken, limpiarToken, URL_BASE } from '../lib/clienteHTTP';

export type FuncionDesuscribir = () => void;

interface RespuestaInicioSesion {
  datos: {
    token: string;
    rol: string;
    estudioId: string | null;
    nombre: string;
    email: string;
  };
}

/**
 * Autentica con email y contraseña — para maestro y dueño.
 * El refresh token llega en una cookie httpOnly automáticamente.
 */
export async function iniciarSesionConEmailAPI(
  email: string,
  contrasena: string,
): Promise<{ token: string; rol: string; estudioId: string | null; nombre: string; email: string }> {
  const res = await peticion<RespuestaInicioSesion>('/auth/iniciar-sesion', {
    method: 'POST',
    body: JSON.stringify({ email, contrasena }),
  });
  guardarToken(res.datos.token);
  return res.datos;
}

/**
 * Autentica con clave de estudio — para clientes que acceden por URL de reserva.
 */
export async function iniciarSesionConClaveAPI(
  clave: string,
): Promise<{ token: string; rol: string; estudioId: string | null; nombre: string; email: string }> {
  const res = await peticion<RespuestaInicioSesion>('/auth/iniciar-sesion', {
    method: 'POST',
    body: JSON.stringify({ clave }),
  });
  guardarToken(res.datos.token);
  return res.datos;
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
export async function cambiarContrasenaAPI(contrasenaActual: string, contrasenaNueva: string): Promise<void> {
  await peticion('/auth/cambiar-contrasena', {
    method: 'POST',
    body: JSON.stringify({ contrasenaActual, contrasenaNueva }),
  });
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

