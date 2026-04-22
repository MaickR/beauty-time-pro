import { prisma } from '../server/src/prismaCliente.js';

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
await prisma.$disconnect();
