function normalizarEspacios(valor: string): string {
  return valor.replace(/\s+/g, ' ').trim();
}

export function limpiarNombreSalonRegistro(valor: string): string {
  return normalizarEspacios(valor.replace(/[^\p{L}\p{N}\s]/gu, ''));
}

export function limpiarNombrePersonaRegistro(valor: string): string {
  return normalizarEspacios(valor.replace(/[^\p{L}\s]/gu, ''));
}

export function esNombreSalonRegistroValido(valor: string): boolean {
  const limpio = normalizarEspacios(valor);
  return limpio.length >= 2 && /^[\p{L}\p{N}\s]+$/u.test(limpio);
}

export function esNombrePersonaRegistroValido(valor: string): boolean {
  const limpio = normalizarEspacios(valor);
  return limpio.length >= 2 && /^[\p{L}\s]+$/u.test(limpio);
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