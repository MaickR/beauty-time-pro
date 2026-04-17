import { describe, expect, it } from 'vitest';
import { construirEnlaceSoporteWhatsApp, obtenerNumeroSoporteWhatsApp } from './soporteSalon';

describe('soporteSalon', () => {
  it('usa el número de soporte correcto para cada país', () => {
    expect(obtenerNumeroSoporteWhatsApp('Mexico')).toBe('5255641341516');
    expect(obtenerNumeroSoporteWhatsApp('Colombia')).toBe('573006934216');
  });

  it('genera un enlace de WhatsApp contextualizado con el salón', () => {
    const enlace = construirEnlaceSoporteWhatsApp({
      pais: 'Colombia',
      nombreSalon: 'Aurora Studio',
      nombreResponsable: 'Laura Gómez',
    });

    expect(enlace).toContain('https://wa.me/573006934216?text=');
    expect(decodeURIComponent(enlace)).toContain('Laura del salón Aurora Studio');
  });
});