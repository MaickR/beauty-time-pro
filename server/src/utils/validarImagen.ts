/**
 * Valida el tipo real de una imagen inspeccionando sus magic bytes.
 * Validar solo el mimetype del header no es suficiente: un atacante puede
 * renombrar cualquier archivo como .jpg y enviar un mimetype falso.
 */

/** Tipos de imagen permitidos con sus magic bytes iniciales */
const FIRMAS: Array<{ nombre: string; bytes: readonly number[] }> = [
  { nombre: 'jpg', bytes: [0xff, 0xd8, 0xff] },
  { nombre: 'png', bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

/**
 * Devuelve 'jpg' | 'png' si el buffer corresponde a una imagen real.
 * Devuelve null si el contenido no coincide con ninguna firma conocida.
 */
export function detectarTipoImagen(buffer: Buffer): 'jpg' | 'png' | null {
  for (const firma of FIRMAS) {
    if (buffer.length < firma.bytes.length) continue;
    const coincide = firma.bytes.every((byte, i) => buffer[i] === byte);
    if (coincide) return firma.nombre as 'jpg' | 'png';
  }
  return null;
}
