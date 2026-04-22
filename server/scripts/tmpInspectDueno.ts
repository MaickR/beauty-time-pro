import { prisma } from '../src/prismaCliente.js';

async function main() {
  const usuario = await prisma.usuario.findUnique({
    where: { email: 'qa.dueno@salonpromaster.com' },
    select: {
      id: true,
      email: true,
      rol: true,
      activo: true,
      estudioId: true,
      estudio: {
        select: {
          id: true,
          nombre: true,
          slug: true,
          activo: true,
          estado: true,
          motivoRechazo: true,
        },
      },
    },
  });

  console.log(JSON.stringify(usuario, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
