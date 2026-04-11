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

  it('genera una contrasena de 8 caracteres con prefijo del salon', () => {
    const contrasena = generarContrasenaSalon('Nova Spa', 2);

    expect(contrasena).toHaveLength(8);
    expect(contrasena.startsWith('NOV')).toBe(true);
    expect(/[0-9]/.test(contrasena)).toBe(true);
    expect(/[!@#$%&*]/.test(contrasena)).toBe(true);
  });

  it('genera contrasena de colaborador con nombre, correo y sufijo aleatorio', () => {
    const contrasena = generarContrasenaColaborador('Miguel Baigts', 'miguel@beautytimepro.com');

    expect(contrasena).toHaveLength(8);
    expect(contrasena.startsWith('MIGmig')).toBe(true);
    expect(/[0-9]/.test(contrasena)).toBe(true);
    expect(/[!@#$%&*]/.test(contrasena)).toBe(true);
  });
});
