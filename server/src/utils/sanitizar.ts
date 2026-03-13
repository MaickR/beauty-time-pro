/**
 * Sanitización de texto libre para prevenir XSS antes de guardar en BD.
 * Elimina todas las etiquetas HTML usando una regex simple (ALLOWED_TAGS: []).
 * No requiere DOM, funciona en Node.js.
 */
export function sanitizarTexto(texto: string): string {
  return texto.replace(/<[^>]*>/g, '').trim();
}
