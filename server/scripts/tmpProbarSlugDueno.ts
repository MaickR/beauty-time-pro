import { prisma } from '../src/prismaCliente.js';
import { generarSlugUnico } from '../src/utils/generarSlug.js';

async function main() {
  const estudio = await prisma.estudio.findUnique({
    where: { id: 'cmmkqphpa000094f13woj21gq' },
    select: { id: true, nombre: true, slug: true },
  });

  if (!estudio) {
    console.log('sin estudio');
    return;
  }

  const slug = await generarSlugUnico(estudio.nombre, estudio.id);
  console.log('slug-generado', slug);

  const actualizado = await prisma.estudio.update({
    where: { id: estudio.id },
    data: { slug },
    select: { id: true, slug: true },
  });

  console.log(JSON.stringify(actualizado, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
