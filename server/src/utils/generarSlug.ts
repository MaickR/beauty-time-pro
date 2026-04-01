import { prisma } from '../prismaCliente.js';

/**
 * Convierte un nombre en un slug URL-friendly.
 * Ejemplo: "Salón de Belleza María" → "salon-de-belleza-maria"
 */
export function textoASlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // quitar acentos
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // solo alfanuméricos, espacios y guiones
    .trim()
    .replace(/\s+/g, '-') // espacios → guiones
    .replace(/-+/g, '-') // guiones consecutivos → uno solo
    .replace(/^-|-$/g, ''); // quitar guiones al inicio/final
}

/**
 * Genera un slug único para un estudio, añadiendo sufijo numérico si hay colisión.
 * Ejemplo: "mikelov-studio" → si ya existe → "mikelov-studio-2"
 */
export async function generarSlugUnico(nombre: string, excluirId?: string): Promise<string> {
  const base = textoASlug(nombre) || 'estudio';
  let candidato = base;
  let sufijo = 2;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existente = await prisma.estudio.findUnique({
      where: { slug: candidato },
      select: { id: true },
    });

    if (!existente || existente.id === excluirId) {
      return candidato;
    }

    candidato = `${base}-${sufijo}`;
    sufijo++;
  }
}
