import { describe, expect, it } from 'vitest';
import {
  esCumpleanosActualValido,
  esDominioClientePermitido,
  limpiarTelefonoCliente,
  limpiarTextoSoloLetras,
} from './registroCliente';

describe('registroCliente', () => {
  it('acepta solo dominios personales permitidos para clientes', () => {
    expect(esDominioClientePermitido('cliente@gmail.com')).toBe(true);
    expect(esDominioClientePermitido('cliente@icloud.com')).toBe(true);
    expect(esDominioClientePermitido('cliente@hotmail.es')).toBe(false);
    expect(esDominioClientePermitido('cliente@empresa.com')).toBe(false);
  });

  it('limpia campos de texto a letras y espacios', () => {
    expect(limpiarTextoSoloLetras('María123 _López!!')).toBe('María López');
  });

  it('limpia teléfono a máximo 10 dígitos', () => {
    expect(limpiarTelefonoCliente('(55) 12-34-56-78-90')).toBe('5512345678');
  });

  it('valida cumpleaños solo dentro del año actual', () => {
    const anioActual = new Date().getFullYear();
    expect(esCumpleanosActualValido(`${anioActual}-03-17`)).toBe(true);
    expect(esCumpleanosActualValido(`1995-03-17`)).toBe(false);
  });
});