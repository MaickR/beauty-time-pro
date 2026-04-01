/**
 * Script de backfill: genera slugs para estudios existentes que no tienen uno.
 * Ejecutar con: npx tsx scripts/rellenarSlugs.ts
 */
import { prisma } from '../src/prismaCliente';
import { textoASlug } from '../src/utils/generarSlug';

async function rellenarSlugs() {
  const estudios = await prisma.estudio.findMany({
    where: { slug: null },
    select: { id: true, nombre: true },
  });

  console.log(`Estudios sin slug: ${estudios.length}`);

  for (const estudio of estudios) {
    const base = textoASlug(estudio.nombre) || 'estudio';
    let candidato = base;
    let sufijo = 2;

    // Verificar colisiones
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const existente = await prisma.estudio.findUnique({
        where: { slug: candidato },
        select: { id: true },
      });

      if (!existente || existente.id === estudio.id) break;
      candidato = `${base}-${sufijo}`;
      sufijo++;
    }

    await prisma.estudio.update({
      where: { id: estudio.id },
      data: { slug: candidato },
    });

    console.log(`  ✓ ${estudio.nombre} → ${candidato}`);
  }

  console.log('Backfill completado.');
}

rellenarSlugs()
  .catch(console.error)
  .finally(() => void prisma.$disconnect());
