import { prisma } from '../src/prismaCliente.js';
import { generarHashContrasena } from '../src/utils/contrasenas.js';

const EMAIL = 'miguel@salonpromaster.com';
const CONTRASENA = 'Administrador1234*';

async function main() {
  const hash = await generarHashContrasena(CONTRASENA);

  const usuario = await prisma.usuario.upsert({
    where: { email: EMAIL },
    update: {
      nombre: 'Miguel Baigts',
      rol: 'maestro',
      activo: true,
      emailVerificado: true,
      hashContrasena: hash,
    },
    create: {
      email: EMAIL,
      nombre: 'Miguel Baigts',
      rol: 'maestro',
      activo: true,
      emailVerificado: true,
      hashContrasena: hash,
    },
    select: { id: true, email: true },
  });

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

  console.log(JSON.stringify({ ok: true, email: EMAIL }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
