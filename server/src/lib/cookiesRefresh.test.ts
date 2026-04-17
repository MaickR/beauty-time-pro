import { describe, expect, it } from 'vitest';
import {
  obtenerNombreCookieRefreshActual,
  obtenerNombreCookieRefreshLegacy,
  obtenerRefreshTokenCookie,
  obtenerVariantesLimpiezaCookieRefresh,
  tieneCookieRefresh,
} from './cookiesRefresh';

describe('cookiesRefresh', () => {
  it('prioriza la cookie actual sobre la legacy cuando ambas existen', () => {
    expect(
      obtenerRefreshTokenCookie({
        [obtenerNombreCookieRefreshLegacy()]: 'legacy-token',
        [obtenerNombreCookieRefreshActual()]: 'token-actual',
      }),
    ).toBe('token-actual');
  });

  it('acepta la cookie legacy mientras se migra la sesion', () => {
    expect(
      obtenerRefreshTokenCookie({
        [obtenerNombreCookieRefreshLegacy()]: 'legacy-token',
      }),
    ).toBe('legacy-token');
    expect(
      tieneCookieRefresh({
        [obtenerNombreCookieRefreshLegacy()]: 'legacy-token',
      }),
    ).toBe(true);
  });

  it('genera variantes de limpieza para /auth y /', () => {
    expect(
      obtenerVariantesLimpiezaCookieRefresh({
        httpOnly: true,
        secure: false,
        sameSite: 'lax',
        path: '/auth',
      }),
    ).toEqual([
      {
        nombre: 'btp_refresh_token',
        opciones: { httpOnly: true, secure: false, sameSite: 'lax', path: '/auth' },
      },
      {
        nombre: 'btp_refresh_token',
        opciones: { httpOnly: true, secure: false, sameSite: 'lax', path: '/' },
      },
      {
        nombre: 'refresh_token',
        opciones: { httpOnly: true, secure: false, sameSite: 'lax', path: '/auth' },
      },
      {
        nombre: 'refresh_token',
        opciones: { httpOnly: true, secure: false, sameSite: 'lax', path: '/' },
      },
    ]);
  });
});