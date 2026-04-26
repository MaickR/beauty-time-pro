import { describe, expect, it } from 'vitest';
import {
  esEmailColaboradorValido,
  esEmailSalonValido,
  generarContrasenaColaborador,
  generarContrasenaSalon,
  limpiarNombrePersonaEntrada,
  limpiarNombreSalonEntrada,
  limpiarTelefonoEntrada,
} from './formularioSalon';

describe('formularioSalon', () => {
  it('limpia caracteres no permitidos del nombre del salon', () => {
    expect(limpiarNombreSalonEntrada('Beauty*Time# 2026')).toBe('BeautyTime 2026');
  });

  it('limpia caracteres no permitidos del nombre de persona', () => {
    expect(limpiarNombrePersonaEntrada('Ana María 123!')).toBe('Ana María ');
  });

  it('limita el telefono a 10 digitos', () => {
    expect(limpiarTelefonoEntrada('+52 (551) 234-567899')).toBe('5512345678');
  });

  it('acepta solo dominios de correo permitidos para el alta de salon', () => {
    expect(esEmailSalonValido('dueno@gmail.com')).toBe(true);
    expect(esEmailSalonValido('dueno@empresa.com')).toBe(false);
  });

  it('acepta correos de colaborador salvo dominios temporales', () => {
    expect(esEmailColaboradorValido('supervisor@empresa.com')).toBe(true);
    expect(esEmailColaboradorValido('vendedor@mailinator.com')).toBe(false);
  });

  it('genera una contrasena memorizable para salon y dueno', () => {
    const contrasena = generarContrasenaSalon('Nova Spa', 'Ana María', 2);

    expect(contrasena).toHaveLength(9);
    expect(contrasena.startsWith('NOVana')).toBe(true);
    expect(/[0-9]{2}/.test(contrasena.slice(6, 8))).toBe(true);
    expect(/[!@#$%&*]/.test(contrasena.charAt(contrasena.length - 1))).toBe(true);
  });

  it('genera contrasena memorizable aun con nombres cortos', () => {
    const contrasena = generarContrasenaSalon('Li', 'Jo', 0);

    expect(contrasena).toHaveLength(9);
    expect(contrasena.startsWith('LISjod')).toBe(true);
    expect(/[0-9]{2}/.test(contrasena.slice(6, 8))).toBe(true);
    expect(/[!@#$%&*]/.test(contrasena.charAt(contrasena.length - 1))).toBe(true);
  });

  it('genera contrasena de colaborador con nombre, correo y sufijo aleatorio', () => {
    const contrasena = generarContrasenaColaborador('Miguel Baigts', 'miguel@salonpromaster.com');

    expect(contrasena).toHaveLength(8);
    expect(contrasena.startsWith('MIGmig')).toBe(true);
    expect(/[0-9]/.test(contrasena)).toBe(true);
    expect(/[!@#$%&*]/.test(contrasena)).toBe(true);
  });
});
