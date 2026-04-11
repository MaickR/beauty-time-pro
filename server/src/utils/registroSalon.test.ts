import { describe, expect, it } from 'vitest';
import {
  esNombrePersonaRegistroValido,
  esNombreSalonRegistroValido,
  esTelefonoSalonRegistroValido,
  limpiarNombrePersonaRegistro,
  limpiarNombreSalonRegistro,
  normalizarTelefonoSalonRegistro,
} from './registroSalon.js';

describe('registroSalon', () => {
  it('valida nombre de salon con letras y numeros', () => {
    expect(esNombreSalonRegistroValido('Salon 2026')).toBe(true);
    expect(esNombreSalonRegistroValido('Salon #1')).toBe(false);
    expect(limpiarNombreSalonRegistro('Salon #1')).toBe('Salon 1');
  });

  it('valida nombre de persona solo con letras', () => {
    expect(esNombrePersonaRegistroValido('Ana Maria')).toBe(true);
    expect(esNombrePersonaRegistroValido('Ana Maria 2')).toBe(false);
    expect(limpiarNombrePersonaRegistro('Ana Maria 2')).toBe('Ana Maria');
  });

  it('normaliza telefono a 10 digitos', () => {
    expect(normalizarTelefonoSalonRegistro('+52 5512345678')).toBe('5512345678');
    expect(esTelefonoSalonRegistroValido('5512345678')).toBe(true);
    expect(esTelefonoSalonRegistroValido('551234567')).toBe(false);
  });
});