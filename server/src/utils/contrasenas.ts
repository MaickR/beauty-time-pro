import bcrypt from 'bcryptjs';
import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';

const PREFIJO_PBKDF2 = 'pbkdf2_sha256';
const ITERACIONES_PBKDF2 = 120000;
const LONGITUD_CLAVE = 32;
const DIGEST_PBKDF2 = 'sha256';

export async function generarHashContrasena(contrasena: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivado = pbkdf2Sync(
    contrasena,
    salt,
    ITERACIONES_PBKDF2,
    LONGITUD_CLAVE,
    DIGEST_PBKDF2,
  ).toString('hex');

  return `${PREFIJO_PBKDF2}$${ITERACIONES_PBKDF2}$${salt}$${derivado}`;
}

export async function compararHashContrasena(
  contrasena: string,
  hashGuardado: string,
): Promise<boolean> {
  if (!hashGuardado.startsWith(`${PREFIJO_PBKDF2}$`)) {
    return bcrypt.compare(contrasena, hashGuardado);
  }

  const [, iteracionesTexto, salt, hashEsperado] = hashGuardado.split('$');
  const iteraciones = Number.parseInt(iteracionesTexto ?? '', 10);

  if (!salt || !hashEsperado || Number.isNaN(iteraciones) || iteraciones <= 0) {
    return false;
  }

  const hashCalculado = pbkdf2Sync(
    contrasena,
    salt,
    iteraciones,
    LONGITUD_CLAVE,
    DIGEST_PBKDF2,
  );
  const hashEsperadoBuffer = Buffer.from(hashEsperado, 'hex');

  if (hashCalculado.length !== hashEsperadoBuffer.length) {
    return false;
  }

  return timingSafeEqual(hashCalculado, hashEsperadoBuffer);
}
