import { prisma } from '../src/prismaCliente.js';
import { generarHashContrasena } from '../src/utils/contrasenas.js';

const CLAVE = 'QaLogin2026!';

async function asegurarUsuario({ email, nombre, rol, estudioId = null }) {
  const hash = await generarHashContrasena(CLAVE);
  const usuario = await prisma.usuario.upsert({
    where: { email },
    update: {
      nombre,
      rol,
      activo: true,
      emailVerificado: true,
      estudioId,
      hashContrasena: hash,
    },
    create: {
      email,
      nombre,
      rol,
      activo: true,
      emailVerificado: true,
      estudioId,
      hashContrasena: hash,
    },
    select: { id: true, email: true, rol: true },
  });
  return usuario;
}

async function main() {
  const estudio = await prisma.estudio.findFirst({
    where: { activo: true, estado: 'aprobado' },
    orderBy: { creadoEn: 'asc' },
    select: { id: true, nombre: true },
  });

  if (!estudio) throw new Error('No hay estudio aprobado para QA');

  const maestro = await asegurarUsuario({ email: 'qa.maestro@beautytimepro.com', nombre: 'QA Maestro', rol: 'maestro' });
  await prisma.permisosMaestro.upsert({
    where: { usuarioId: maestro.id },
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
      usuarioId: maestro.id,
      aprobarSalones: true,
      gestionarPagos: true,
      crearAdmins: true,
      verAuditLog: true,
      verMetricas: true,
      suspenderSalones: true,
      esMaestroTotal: true,
    },
  });

  const supervisor = await asegurarUsuario({ email: 'qa.supervisor@beautytimepro.com', nombre: 'QA Supervisor', rol: 'supervisor' });
  await prisma.permisosSupervisor.upsert({
    where: { usuarioId: supervisor.id },
    update: {
      verTotalSalones: true,
      verControlSalones: true,
      verReservas: true,
      verVentas: true,
      verDirectorio: true,
      editarDirectorio: true,
      verControlCobros: true,
      accionRecordatorio: true,
      accionRegistroPago: true,
      accionSuspension: true,
      activarSalones: true,
      verPreregistros: true,
    },
    create: {
      usuarioId: supervisor.id,
      verTotalSalones: true,
      verControlSalones: true,
      verReservas: true,
      verVentas: true,
      verDirectorio: true,
      editarDirectorio: true,
      verControlCobros: true,
      accionRecordatorio: true,
      accionRegistroPago: true,
      accionSuspension: true,
      activarSalones: true,
      verPreregistros: true,
    },
  });

  await asegurarUsuario({ email: 'qa.vendedor@beautytimepro.com', nombre: 'QA Vendedor', rol: 'vendedor' });
  await asegurarUsuario({ email: 'qa.dueno@beautytimepro.com', nombre: 'QA Dueño', rol: 'dueno', estudioId: estudio.id });

  const personal = await prisma.personal.findFirst({
    where: { estudioId: estudio.id, activo: true },
    select: { id: true, nombre: true },
  });

  let personalId = personal?.id;
  if (!personalId) {
    const creado = await prisma.personal.create({
      data: {
        estudioId: estudio.id,
        nombre: 'QA Especialista',
        especialidades: ['Corte Dama / Niña'],
        activo: true,
      },
      select: { id: true },
    });
    personalId = creado.id;
  }

  await prisma.empleadoAcceso.upsert({
    where: { email: 'qa.empleado@beautytimepro.com' },
    update: {
      personalId,
      activo: true,
      forzarCambioContrasena: false,
      hashContrasena: await generarHashContrasena(CLAVE),
    },
    create: {
      personalId,
      email: 'qa.empleado@beautytimepro.com',
      activo: true,
      forzarCambioContrasena: false,
      hashContrasena: await generarHashContrasena(CLAVE),
    },
  });

  await prisma.clienteApp.upsert({
    where: { email: 'qa.cliente@beautytimepro.com' },
    update: {
      nombre: 'QA',
      apellido: 'Cliente',
      emailVerificado: true,
      activo: true,
      hashContrasena: await generarHashContrasena(CLAVE),
      pais: 'Mexico',
    },
    create: {
      email: 'qa.cliente@beautytimepro.com',
      nombre: 'QA',
      apellido: 'Cliente',
      emailVerificado: true,
      activo: true,
      hashContrasena: await generarHashContrasena(CLAVE),
      pais: 'Mexico',
    },
  });

  console.log(JSON.stringify({
    estudioQa: estudio,
    credenciales: {
      maestro: 'qa.maestro@beautytimepro.com',
      supervisor: 'qa.supervisor@beautytimepro.com',
      vendedor: 'qa.vendedor@beautytimepro.com',
      dueno: 'qa.dueno@beautytimepro.com',
      empleado: 'qa.empleado@beautytimepro.com',
      cliente: 'qa.cliente@beautytimepro.com',
      contrasenaComun: CLAVE,
    }
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
