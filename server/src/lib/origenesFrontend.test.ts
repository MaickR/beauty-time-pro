import { describe, expect, it } from 'vitest';
import {
  coincideOrigenConPatron,
  esPatronOrigenFrontendValido,
  extraerOrigenDesdeUrl,
  obtenerPatronesOrigenFrontend,
  tieneOrigenFrontendPermitido,
} from './origenesFrontend';

describe('origenesFrontend', () => {
  it('normaliza el origen principal y los adicionales exactos', () => {
    expect(
      obtenerPatronesOrigenFrontend(
        'https://app.beautytimepro.com/login',
        'https://beauty-time-pro.vercel.app, https://demo.beautytimepro.com/ruta',
      ),
    ).toEqual([
      'https://app.beautytimepro.com',
      'https://beauty-time-pro.vercel.app',
      'https://demo.beautytimepro.com',
    ]);
  });

  it('acepta previews de vercel mediante patron con comodin acotado', () => {
    expect(
      coincideOrigenConPatron(
        'https://beauty-time-pro-git-main-maickr.vercel.app',
        'https://beauty-time-pro-git-*.vercel.app',
      ),
    ).toBe(true);
    expect(
      coincideOrigenConPatron(
        'https://otro-proyecto.vercel.app',
        'https://beauty-time-pro-git-*.vercel.app',
      ),
    ).toBe(false);
  });

  it('evalua si un origen esta permitido por cualquier patron', () => {
    const patrones = obtenerPatronesOrigenFrontend(
      'https://app.beautytimepro.com',
      'https://beauty-time-pro-git-*.vercel.app',
    );

    expect(tieneOrigenFrontendPermitido('https://app.beautytimepro.com', patrones)).toBe(true);
    expect(
      tieneOrigenFrontendPermitido(
        'https://beauty-time-pro-git-feature-maickr.vercel.app',
        patrones,
      ),
    ).toBe(true);
    expect(tieneOrigenFrontendPermitido('https://malicioso.example.com', patrones)).toBe(false);
  });

  it('extrae el origin desde un referer valido', () => {
    expect(extraerOrigenDesdeUrl('https://app.beautytimepro.com/agenda?tab=dia')).toBe(
      'https://app.beautytimepro.com',
    );
    expect(extraerOrigenDesdeUrl('no-es-url')).toBeNull();
  });

  it('valida patrones exactos y con comodin', () => {
    expect(esPatronOrigenFrontendValido('https://app.beautytimepro.com')).toBe(true);
    expect(esPatronOrigenFrontendValido('https://beauty-time-pro-git-*.vercel.app')).toBe(true);
    expect(esPatronOrigenFrontendValido('app.beautytimepro.com')).toBe(false);
  });
});