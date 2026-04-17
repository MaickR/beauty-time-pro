import { prisma } from '../prismaCliente.js';
import type { RolUsuario } from '../generated/prisma/enums.js';
import { generarHashContrasena } from '../utils/contrasenas.js';

const CLAVE_QA = 'QaLogin2026!';
const EMAIL_EMPLEADO_QA = 'qa.empleado@salonpromaster.com';
const NOMBRE_EMPLEADO_QA = 'QA Especialista';

async function asegurarUsuario(params: {
  email: string;
  nombre: string;
  rol: RolUsuario;
  estudioId?: string | null;
}) {
  const { email, nombre, rol, estudioId = null } = params;
  const hash = await generarHashContrasena(CLAVE_QA);

  return prisma.usuario.upsert({
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
}

async function asegurarPersonalQa(estudioId: string) {
  const accesoQaExistente = await prisma.empleadoAcceso.findUnique({
    where: { email: EMAIL_EMPLEADO_QA },
    select: {
      personalId: true,
      personal: {
        select: {
          id: true,
          estudioId: true,
        },
      },
    },
  });

  if (accesoQaExistente?.personal?.estudioId === estudioId) {
    return accesoQaExistente.personalId;
  }

  const personalQaExistente = await prisma.personal.findFirst({
    where: {
      estudioId,
      nombre: NOMBRE_EMPLEADO_QA,
      activo: true,
    },
    orderBy: { creadoEn: 'asc' },
    select: { id: true },
  });

  if (personalQaExistente) {
    const accesoVinculado = await prisma.empleadoAcceso.findUnique({
      where: { personalId: personalQaExistente.id },
      select: { email: true },
    });

    if (!accesoVinculado || accesoVinculado.email === EMAIL_EMPLEADO_QA) {
      return personalQaExistente.id;
    }
  }

  const personalQaCreado = await prisma.personal.create({
    data: {
      estudioId,
      nombre: NOMBRE_EMPLEADO_QA,
      especialidades: ['Corte Dama / Niña'],
      activo: true,
    },
    select: { id: true },
  });

  return personalQaCreado.id;
}

export async function asegurarCredencialesQaLogin(): Promise<{
  estudioQa: { id: string; nombre: string };
  credenciales: {
    maestro: string;
    supervisor: string;
    vendedor: string;
    dueno: string;
    empleado: string;
    cliente: string;
    contrasenaComun: string;
  };
}> {
  const estudio = await prisma.estudio.findFirst({
    where: { activo: true, estado: 'aprobado' },
    orderBy: { creadoEn: 'asc' },
    select: { id: true, nombre: true },
  });

  if (!estudio) {
    throw new Error('No hay estudio aprobado para QA');
  }

  const maestro = await asegurarUsuario({
    email: 'qa.maestro@salonpromaster.com',
    nombre: 'QA Maestro',
    rol: 'maestro',
  });

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

  const supervisor = await asegurarUsuario({
    email: 'qa.supervisor@salonpromaster.com',
    nombre: 'QA Supervisor',
    rol: 'supervisor',
  });

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

  await asegurarUsuario({ email: 'qa.vendedor@salonpromaster.com', nombre: 'QA Vendedor', rol: 'vendedor' });
  await asegurarUsuario({
    email: 'qa.dueno@salonpromaster.com',
    nombre: 'QA Dueño',
    rol: 'dueno',
    estudioId: estudio.id,
  });

  const personalId = await asegurarPersonalQa(estudio.id);

  await prisma.empleadoAcceso.upsert({
    where: { email: EMAIL_EMPLEADO_QA },
    update: {
      personalId,
      activo: true,
      forzarCambioContrasena: false,
      hashContrasena: await generarHashContrasena(CLAVE_QA),
    },
    create: {
      personalId,
      email: EMAIL_EMPLEADO_QA,
      activo: true,
      forzarCambioContrasena: false,
      hashContrasena: await generarHashContrasena(CLAVE_QA),
    },
  });

  await prisma.clienteApp.upsert({
    where: { email: 'qa.cliente@salonpromaster.com' },
    update: {
      nombre: 'QA',
      apellido: 'Cliente',
      emailVerificado: true,
      activo: true,
      hashContrasena: await generarHashContrasena(CLAVE_QA),
      pais: 'Mexico',
    },
    create: {
      email: 'qa.cliente@salonpromaster.com',
      nombre: 'QA',
      apellido: 'Cliente',
      emailVerificado: true,
      activo: true,
      hashContrasena: await generarHashContrasena(CLAVE_QA),
      pais: 'Mexico',
    },
  });

  return {
    estudioQa: estudio,
    credenciales: {
      maestro: 'qa.maestro@salonpromaster.com',
      supervisor: 'qa.supervisor@salonpromaster.com',
      vendedor: 'qa.vendedor@salonpromaster.com',
      dueno: 'qa.dueno@salonpromaster.com',
      empleado: EMAIL_EMPLEADO_QA,
      cliente: 'qa.cliente@salonpromaster.com',
      contrasenaComun: CLAVE_QA,
    },
  };
}