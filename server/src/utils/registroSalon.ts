import { randomInt } from 'node:crypto';

function normalizarEspacios(valor: string): string {
  return valor.replace(/\s+/g, ' ').trim();
}

const CARACTERES_ESPECIALES_CONTRASENA_SALON = ['#', '*', '!', '$', '%', '&'] as const;
const REGEX_CONTRASENA_FORMATO_SALON = /^[A-Z]{3}[a-z]{3}\d{2}[#*!$%&]$/;

export const MENSAJE_FORMATO_CONTRASENA_SALON =
  'La contraseña debe tener formato SALDDdnn#, ejemplo: BELana42!';

function normalizarFragmentoContrasena(
  valor: string,
  fallback: string,
  opciones?: { mayusculas?: boolean },
): string {
  const base = normalizarEspacios(valor)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}]/gu, '')
    .toLowerCase();

  const fragmento = `${base || fallback}${fallback}`.slice(0, 3);
  return opciones?.mayusculas ? fragmento.toUpperCase() : fragmento.toLowerCase();
}

function obtenerDosDigitosContrasena(): string {
  const numero = randomInt(0, 100);
  return String(numero).padStart(2, '0');
}

function obtenerCaracterEspecialContrasena(): string {
  const indice = randomInt(0, CARACTERES_ESPECIALES_CONTRASENA_SALON.length);
  return CARACTERES_ESPECIALES_CONTRASENA_SALON[indice]!;
}

export function generarContrasenaFormatoSalon(
  nombreSalon: string,
  nombreDueno: string = '',
): string {
  const fragmentoSalon = normalizarFragmentoContrasena(nombreSalon, 'sal', { mayusculas: true });
  const fragmentoDueno = normalizarFragmentoContrasena(nombreDueno, 'due');
  const digitos = obtenerDosDigitosContrasena();
  const especial = obtenerCaracterEspecialContrasena();

  return `${fragmentoSalon}${fragmentoDueno}${digitos}${especial}`;
}

export function esContrasenaFormatoSalonValida(valor: string): boolean {
  return REGEX_CONTRASENA_FORMATO_SALON.test(valor.trim());
}

export function limpiarNombreSalonRegistro(valor: string): string {
  return normalizarEspacios(valor.replace(/[^\p{L}\p{N}\s]/gu, ''));
}

export function limpiarNombrePersonaRegistro(valor: string): string {
  return normalizarEspacios(valor.normalize('NFC').replace(/[^\p{L}\p{M}\s'’-]/gu, ''));
}

export function esNombreSalonRegistroValido(valor: string): boolean {
  const limpio = normalizarEspacios(valor);
  return limpio.length >= 2 && /^[\p{L}\p{N}\s]+$/u.test(limpio);
}

export function esNombrePersonaRegistroValido(valor: string): boolean {
  const limpio = normalizarEspacios(valor);
  return limpio.length >= 2 && /^[\p{L}\p{M}\s'’-]+$/u.test(limpio);
}

export function normalizarTelefonoSalonRegistro(valor: string): string {
  const digitos = valor.replace(/\D/g, '');
  const telefonoSinPrefijo =
    digitos.length > 10 && (digitos.startsWith('52') || digitos.startsWith('57'))
      ? digitos.slice(2)
      : digitos;

  return telefonoSinPrefijo.slice(0, 10);
}

export function esTelefonoSalonRegistroValido(valor: string): boolean {
  return /^\d{10}$/.test(normalizarTelefonoSalonRegistro(valor));
}
