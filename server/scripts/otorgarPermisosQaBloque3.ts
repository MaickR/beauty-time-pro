import { prisma } from '../src/prismaCliente.js';

async function main() {
  const usuario = await prisma.usuario.findUnique({
    where: { email: 'qa.bloque3@salonpromaster.com' },
    select: { id: true },
  });

  if (!usuario) {
    throw new Error('Usuario QA no encontrado');
  }

  await prisma.permisosMaestro.upsert({
    where: { usuarioId: usuario.id },
    update: {
      aprobarSalones: true,
      gestionarPagos: true,
      crearAdmins: true,
      verAuditLog: true,
      verMetricas: true,
      suspenderSalones: true,
      esMaestroTotal: true,
    },
    create: {
      usuarioId: usuario.id,
      aprobarSalones: true,
      gestionarPagos: true,
      crearAdmins: true,
      verAuditLog: true,
      verMetricas: true,
      suspenderSalones: true,
      esMaestroTotal: true,
    },
  });

  console.log('Permisos QA actualizados');
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
