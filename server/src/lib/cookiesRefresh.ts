const NOMBRE_COOKIE_REFRESH_ACTUAL = 'btp_refresh_token';
const NOMBRE_COOKIE_REFRESH_LEGACY = 'refresh_token';

export interface OpcionesCookieRefresh {
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'strict' | 'lax' | 'none';
  path: string;
}

export function obtenerNombreCookieRefreshActual(): string {
  return NOMBRE_COOKIE_REFRESH_ACTUAL;
}

export function obtenerNombreCookieRefreshLegacy(): string {
  return NOMBRE_COOKIE_REFRESH_LEGACY;
}

export function obtenerRefreshTokenCookie(
  cookies: Record<string, string | undefined> | null | undefined,
): string | null {
  if (!cookies) {
    return null;
  }

  return cookies[NOMBRE_COOKIE_REFRESH_ACTUAL] ?? cookies[NOMBRE_COOKIE_REFRESH_LEGACY] ?? null;
}

export function tieneCookieRefresh(
  cookies: Record<string, string | undefined> | null | undefined,
): boolean {
  return Boolean(obtenerRefreshTokenCookie(cookies));
}

export function obtenerVariantesLimpiezaCookieRefresh(
  opcionesBase: OpcionesCookieRefresh,
): Array<{ nombre: string; opciones: OpcionesCookieRefresh }> {
  const nombres = [NOMBRE_COOKIE_REFRESH_ACTUAL, NOMBRE_COOKIE_REFRESH_LEGACY];

  return nombres.flatMap((nombre) => [
    { nombre, opciones: opcionesBase },
    { nombre, opciones: { ...opcionesBase, path: '/' } },
  ]);
}