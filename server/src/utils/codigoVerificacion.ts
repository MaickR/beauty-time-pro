import crypto from 'node:crypto';

const ALFABETO = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generarCodigoVerificacion(longitud = 4): string {
  let codigo = '';

  while (codigo.length < longitud) {
    const indice = crypto.randomInt(0, ALFABETO.length);
    codigo += ALFABETO[indice];
  }

  return codigo;
}

export function normalizarCodigoVerificacion(codigo: string): string {
  return codigo.trim().toUpperCase();
}