import { generarContrasenaSegura } from './seguridad';

export const DOMINIOS_EMAIL_SALON_PERMITIDOS = [
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'hotmail.es',
  'hotmail.com.mx',
  'hotmail.com.co',
  'outlook.com',
  'outlook.es',
  'outlook.com.mx',
  'yahoo.com',
  'yahoo.es',
  'yahoo.com.mx',
  'yahoo.com.co',
] as const;

const DOMINIOS_TEMPORALES_BLOQUEADOS = [
  'mailinator.com',
  'guerrillamail.com',
  '10minutemail.com',
  'temp-mail.org',
  'tempmail.com',
  'yopmail.com',
  'sharklasers.com',
  'dispostable.com',
] as const;

function normalizarEspacios(valor: string): string {
  return valor.replace(/\s+/g, ' ').trimStart();
}

export function limpiarNombreSalonEntrada(valor: string): string {
  return normalizarEspacios(valor.replace(/[^\p{L}\p{N}\s]/gu, ''));
}

export function limpiarNombrePersonaEntrada(valor: string): string {
  return normalizarEspacios(valor.normalize('NFC').replace(/[^\p{L}\p{M}\s'’-]/gu, ''));
}

export function limpiarTelefonoEntrada(valor: string): string {
  const digitos = valor.replace(/\D/g, '');
  const telefonoSinPrefijo =
    digitos.length > 10 && (digitos.startsWith('52') || digitos.startsWith('57'))
      ? digitos.slice(2)
      : digitos;

  return telefonoSinPrefijo.slice(0, 10);
}

export function esEmailSalonValido(email: string): boolean {
  const correo = email.trim().toLowerCase();
  const partes = correo.split('@');
  if (partes.length !== 2 || !partes[0] || !partes[1]) {
    return false;
  }

  return DOMINIOS_EMAIL_SALON_PERMITIDOS.includes(
    partes[1] as (typeof DOMINIOS_EMAIL_SALON_PERMITIDOS)[number],
  );
}

export function esEmailColaboradorValido(email: string): boolean {
  const correo = email.trim().toLowerCase();
  const partes = correo.split('@');

  if (partes.length !== 2 || !partes[0] || !partes[1]) {
    return false;
  }

  const dominio = partes[1];
  const tieneFormatoValido = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo);
  const esTemporal = DOMINIOS_TEMPORALES_BLOQUEADOS.includes(
    dominio as (typeof DOMINIOS_TEMPORALES_BLOQUEADOS)[number],
  );

  return tieneFormatoValido && !esTemporal;
}

function asegurarSufijoContrasena(sufijoBase: string, intento: number): string {
  const caracteres = sufijoBase.padEnd(5, '2').slice(0, 5).split('');

  if (!caracteres.some((caracter) => /\d/.test(caracter))) {
    caracteres[4] = String((intento % 8) + 2);
  }

  if (!caracteres.some((caracter) => /[!@#$%&*]/.test(caracter))) {
    caracteres[3] = '!';
  }

  return caracteres.join('');
}

export function generarContrasenaSalon(nombreSalon: string, intento: number = 0): string {
  const baseNombre = limpiarNombreSalonEntrada(nombreSalon).replace(/\s+/g, '').toUpperCase();
  const prefijo = `${baseNombre || 'SAL'}SAL`.slice(0, 3);
  const sufijoBase = generarContrasenaSegura(8 + Math.max(0, intento)).slice(0, 5);
  const sufijo = asegurarSufijoContrasena(sufijoBase, intento);

  return `${prefijo}${sufijo}`.slice(0, 8);
}

function obtenerPrefijoNombreColaborador(nombre: string): string {
  return `${limpiarNombrePersonaEntrada(nombre).replace(/\s+/g, '').toUpperCase()}XXX`.slice(0, 3);
}

function obtenerPrefijoCorreoColaborador(email: string): string {
  const local = email.trim().toLowerCase().split('@')[0] ?? '';
  return `${local.replace(/[^a-z]/g, '')}usr`.slice(0, 3);
}

export function generarContrasenaColaborador(
  nombre: string,
  email: string,
  longitudObjetivo: number = 8,
): string {
  const longitudFinal = Math.max(8, Math.min(10, longitudObjetivo));
  const prefijo = `${obtenerPrefijoNombreColaborador(nombre)}${obtenerPrefijoCorreoColaborador(email)}`;
  const longitudRestante = Math.max(2, longitudFinal - prefijo.length);
  const caracteres = '!@#$%&*0123456789';
  const baseAleatoria = generarContrasenaSegura(longitudFinal + 4)
    .split('')
    .filter((caracter) => caracteres.includes(caracter));
  const sufijo = Array.from({ length: longitudRestante }, (_, indice) => {
    const caracter = baseAleatoria[indice] ?? caracteres[indice % caracteres.length];
    return caracter;
  }).join('');

  const contrasena = `${prefijo}${sufijo}`.slice(0, longitudFinal);

  if (!/[0-9]/.test(contrasena) || !/[!@#$%&*]/.test(contrasena)) {
    return `${prefijo}${'!2#4&6*8'.slice(0, longitudRestante)}`.slice(0, longitudFinal);
  }

  return contrasena;
}
