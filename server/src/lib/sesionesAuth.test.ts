import { describe, expect, it } from 'vitest';
import {
  hashValorSesion,
  validarCredencialesSesion,
} from './sesionesAuthCredenciales.js';

describe('sesionesAuth', () => {
  it('valida credenciales correctas de sesion', () => {
    const resultado = validarCredencialesSesion(
      {
        refreshTokenHash: hashValorSesion('refresh-valido'),
        csrfTokenHash: hashValorSesion('csrf-valido'),
      },
      'refresh-valido',
      'csrf-valido',
    );

    expect(resultado).toBe('valida');
  });

  it('detecta reutilizacion o refresh invalido antes de revisar csrf', () => {
    const resultado = validarCredencialesSesion(
      {
        refreshTokenHash: hashValorSesion('refresh-actual'),
        csrfTokenHash: hashValorSesion('csrf-actual'),
      },
      'refresh-viejo',
      'csrf-actual',
    );

    expect(resultado).toBe('refresh_invalido');
  });

  it('detecta csrf invalido cuando el refresh coincide', () => {
    const resultado = validarCredencialesSesion(
      {
        refreshTokenHash: hashValorSesion('refresh-actual'),
        csrfTokenHash: hashValorSesion('csrf-actual'),
      },
      'refresh-actual',
      'csrf-viejo',
    );

    expect(resultado).toBe('csrf_invalido');
  });
});