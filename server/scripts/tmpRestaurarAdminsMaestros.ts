import { prisma } from '../src/prismaCliente.js';
import { generarHashContrasena } from '../src/utils/contrasenas.js';

const CREDENCIALES_PERSONALIZADAS = [
  {
    email: 'miguel@salonpromaster.com',
    nombre: 'Miguel Baigts',
    password: 'Admin123*',
  },
  {
    email: 'mike@salonpromaster.com',
    nombre: 'Mike Reinoso',
    password: 'Mreinos95*',
  },
];

async function main() {
  const resultados: Array<{ email: string; creado: boolean }> = [];

  for (const credencial of CREDENCIALES_PERSONALIZADAS) {
    const hash = await generarHashContrasena(credencial.password);

    const existente = await prisma.usuario.findUnique({
      where: { email: credencial.email },
      select: { id: true },
    });

    await prisma.usuario.upsert({
      where: { email: credencial.email },
      update: {
        nombre: credencial.nombre,
        rol: 'maestro',
        activo: true,
        emailVerificado: true,
        hashContrasena: hash,
      },
      create: {
        email: credencial.email,
        nombre: credencial.nombre,
        rol: 'maestro',
        activo: true,
        emailVerificado: true,
        hashContrasena: hash,
      },
      select: { id: true },
    });

    const usuario = await prisma.usuario.findUnique({
      where: { email: credencial.email },
      select: { id: true },
    });

    if (!usuario) {
      throw new Error(`No se pudo asegurar el usuario ${credencial.email}`);
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

    resultados.push({
      email: credencial.email,
      creado: !existente,
    });
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        resultados,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
