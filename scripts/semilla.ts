/**
 * Script de semilla de datos de demostración — Beauty Time Pro
 *
 * Uso: npm run semilla
 *
 * Requiere que MySQL esté corriendo y que server/.env tenga DATABASE_URL configurada.
 * Solo ejecutar en desarrollo local. Prohibido en producción.
 */

import { config } from 'dotenv';
import bcrypt from 'bcrypt';
import { randomInt } from 'node:crypto';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient } from '../server/src/generated/prisma/client.js';

config({ path: 'server/.env' });

function obtenerVariableEntornoObligatoria(nombre: string): string {
  const valor = process.env[nombre]?.trim();
  if (!valor) {
    throw new Error(`La variable ${nombre} es obligatoria para ejecutar la semilla.`);
  }

  return valor;
}

function generarContrasenaTemporal(longitud: number = 16): string {
  const mayusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const minusculas = 'abcdefghijkmnpqrstuvwxyz';
  const numeros = '23456789';
  const simbolos = '!@#$%&*';
  const mezcla = `${mayusculas}${minusculas}${numeros}${simbolos}`;
  const caracteres = [
    mayusculas[randomInt(mayusculas.length)]!,
    minusculas[randomInt(minusculas.length)]!,
    numeros[randomInt(numeros.length)]!,
    simbolos[randomInt(simbolos.length)]!,
  ];

  while (caracteres.length < longitud) {
    caracteres.push(mezcla[randomInt(mezcla.length)]!);
  }

  for (let indice = caracteres.length - 1; indice > 0; indice -= 1) {
    const destino = randomInt(indice + 1);
    [caracteres[indice], caracteres[destino]] = [caracteres[destino]!, caracteres[indice]!];
  }

  return caracteres.join('');
}

const urlBaseDatos = new URL(obtenerVariableEntornoObligatoria('DATABASE_URL'));

const adaptador = new PrismaMariaDb({
  host: urlBaseDatos.hostname,
  port: Number(urlBaseDatos.port || '3306'),
  user: decodeURIComponent(urlBaseDatos.username),
  password: decodeURIComponent(urlBaseDatos.password),
  database: urlBaseDatos.pathname.replace(/^\//, ''),
});

const prisma = new PrismaClient({ adapter: adaptador });

const ARGUMENTOS = new Set(process.argv.slice(2));
const NOMBRE_SALON_MIKELOV = 'MIKELOV STUDIO';
const CLAVE_DUENO_MIKELOV = 'MIKELOV123';
const EMAIL_DUENO_MIKELOV = 'hola@mikelovstudio.com';
const CONTRASENA_ADMIN_PRINCIPAL = process.env.ADMIN_PRINCIPAL_CONTRASENA?.trim() || generarContrasenaTemporal();
const CONTRASENA_ADMIN_SECUNDARIO = process.env.ADMIN_SECUNDARIO_CONTRASENA?.trim() || generarContrasenaTemporal();
const CONTRASENA_DUENO_DEMO = process.env.DEMO_CONTRASENA_DUENO?.trim() || generarContrasenaTemporal();
const ADMINS_SEMILLA = [
  {
    email: 'miguel@beautytimepro.com',
    nombre: 'Miguel',
    apellido: 'Baigts',
    alias: 'Miguel Baigts',
    contrasena: CONTRASENA_ADMIN_PRINCIPAL,
  },
  {
    email: 'admin.secundario@beautytimepro.com',
    nombre: 'Mike',
    apellido: 'Admin',
    alias: 'Mike Admin',
    contrasena: CONTRASENA_ADMIN_SECUNDARIO,
  },
];
const ADMINS_PROTEGIDOS = (process.env.ADMINS_PROTEGIDOS ?? ADMINS_SEMILLA.map((admin) => admin.email).join(','))
  .split(',')
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean);
const ENTORNO_ACTUAL = process.env.ENTORNO ?? 'development';

function informarCredencialesSemilla() {
  console.log('🔐 Credenciales de semilla activas:');
  console.log(`   Maestro principal: miguel@beautytimepro.com / ${CONTRASENA_ADMIN_PRINCIPAL}`);
  console.log(`   Maestro secundario: admin.secundario@beautytimepro.com / ${CONTRASENA_ADMIN_SECUNDARIO}`);
  console.log(`   Dueño demo MIKELOV: ${EMAIL_DUENO_MIKELOV} / ${CONTRASENA_DUENO_DEMO}`);
}

function obtenerFechaLocalISO(fecha: Date): string {
  const compensacion = fecha.getTimezoneOffset();
  const fechaLocal = new Date(fecha.getTime() - compensacion * 60 * 1000);
  return fechaLocal.toISOString().split('T')[0]!;
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function construirHorarioMikelov() {
  return DIAS.reduce(
    (acc, dia) => ({
      ...acc,
      [dia]: { isOpen: dia !== 'Domingo', openTime: '09:00', closeTime: '20:00' },
    }),
    {} as Record<string, { isOpen: boolean; openTime: string; closeTime: string }>,
  );
}

async function sembrarMikelovStudio(): Promise<void> {
  const existe = await prisma.estudio.findFirst({
    where: { claveDueno: CLAVE_DUENO_MIKELOV },
    select: { id: true, emailContacto: true },
  });

  const todayStr = obtenerFechaLocalISO(new Date());
  const due = new Date();
  due.setMonth(due.getMonth() + 1);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = obtenerFechaLocalISO(tomorrow);

  const horario = construirHorarioMikelov();
  const datosEstudioMikelov = {
    nombre: 'MIKELOV STUDIO',
    propietario: 'Miguel Ángel Lovato',
    telefono: '55 1234 5678',
    sitioWeb: 'www.mikelovstudio.com',
    pais: 'Mexico' as const,
    sucursales: [
      'Av. Presidente Masaryk 123, Polanco, CDMX',
      'Insurgentes Sur 456, Roma, CDMX',
    ],
    claveDueno: CLAVE_DUENO_MIKELOV,
    claveCliente: 'MIKELOVSTUDIO',
    estado: 'aprobado' as const,
    fechaAprobacion: new Date(),
    inicioSuscripcion: '2026-02-15',
    fechaVencimiento: obtenerFechaLocalISO(due),
    festivos: [],
    colorPrimario: '#C2185B',
    descripcion: 'Color, uñas y estética premium con atención personalizada.',
    direccion: 'Av. Presidente Masaryk 123, Polanco, CDMX',
    emailContacto: EMAIL_DUENO_MIKELOV,
    horario,
    servicios: [
      { name: 'Corte Dama / Niña', duration: 60, price: 80000 },
      { name: 'Balayage', duration: 240, price: 350000 },
      { name: 'Tinte Global', duration: 120, price: 180000 },
      { name: 'Diseño de Ceja', duration: 30, price: 40000 },
      { name: 'Lash Lifting', duration: 90, price: 95000 },
      { name: 'Mani Spa', duration: 60, price: 60000 },
      { name: 'Pedi Spa', duration: 60, price: 70000 },
      { name: 'Gel Semi Permanente', duration: 60, price: 50000 },
    ],
    serviciosCustom: [],
  };

  const estudio = existe
    ? await prisma.estudio.update({
        where: { id: existe.id },
        data: datosEstudioMikelov,
      })
    : await prisma.estudio.create({
        data: datosEstudioMikelov,
      });

  console.log(
    existe ? '🔄 Rehidratando datos de MIKELOV STUDIO...' : '🌱 Generando MIKELOV STUDIO...',
  );

  const hashContrasenaDuenoMikelov = await bcrypt.hash(CONTRASENA_DUENO_DEMO, 12);

  await prisma.usuario.upsert({
    where: { email: EMAIL_DUENO_MIKELOV },
    update: {
      hashContrasena: hashContrasenaDuenoMikelov,
      nombre: 'Miguel Ángel Lovato',
      rol: 'dueno',
      activo: true,
      emailVerificado: true,
      estudioId: estudio.id,
    },
    create: {
      email: EMAIL_DUENO_MIKELOV,
      hashContrasena: hashContrasenaDuenoMikelov,
      nombre: 'Miguel Ángel Lovato',
      rol: 'dueno',
      activo: true,
      emailVerificado: true,
      estudioId: estudio.id,
    },
  });

  await prisma.reservaServicio.deleteMany({ where: { reserva: { estudioId: estudio.id } } });
  await prisma.reserva.deleteMany({ where: { estudioId: estudio.id } });
  await prisma.puntosFidelidad.deleteMany({ where: { estudioId: estudio.id } });
  await prisma.configFidelidad.deleteMany({ where: { estudioId: estudio.id } });
  await prisma.pago.deleteMany({ where: { estudioId: estudio.id } });
  await prisma.diaFestivo.deleteMany({ where: { estudioId: estudio.id } });
  await prisma.empleadoAcceso.deleteMany({ where: { personal: { estudioId: estudio.id } } });
  await prisma.cliente.deleteMany({ where: { estudioId: estudio.id } });
  await prisma.personal.deleteMany({ where: { estudioId: estudio.id } });

  // Personal
  const [andrea, sofia, valeria] = await Promise.all([
    prisma.personal.create({
      data: {
        estudioId: estudio.id,
        nombre: 'Andrea (Master Colorista)',
        especialidades: ['Corte Dama / Niña', 'Balayage', 'Tinte Global'],
        horaInicio: '10:00',
        horaFin: '20:00',
        descansoInicio: '14:00',
        descansoFin: '15:00',
      },
    }),
    prisma.personal.create({
      data: {
        estudioId: estudio.id,
        nombre: 'Sofía (Lashes & Brows)',
        especialidades: ['Diseño de Ceja', 'Lash Lifting'],
        horaInicio: '09:00',
        horaFin: '18:00',
        descansoInicio: '13:30',
        descansoFin: '14:30',
      },
    }),
    prisma.personal.create({
      data: {
        estudioId: estudio.id,
        nombre: 'Valeria (Nail Artist)',
        especialidades: ['Mani Spa', 'Pedi Spa', 'Gel Semi Permanente'],
        horaInicio: '11:00',
        horaFin: '20:00',
        descansoInicio: '15:00',
        descansoFin: '16:00',
      },
    }),
  ]);

  const [carla, monica, lucia] = await Promise.all([
    prisma.cliente.create({
      data: {
        estudioId: estudio.id,
        nombre: 'Carla Ruiz',
        telefono: '5598765432',
        fechaNacimiento: new Date('1994-03-10'),
        email: 'carla@correo.com',
      },
    }),
    prisma.cliente.create({
      data: {
        estudioId: estudio.id,
        nombre: 'Mónica Hernández',
        telefono: '5511223344',
        fechaNacimiento: new Date('1990-06-22'),
        email: 'monica@correo.com',
      },
    }),
    prisma.cliente.create({
      data: {
        estudioId: estudio.id,
        nombre: 'Lucía Fernández',
        telefono: '5544556677',
        fechaNacimiento: new Date('1998-09-14'),
        email: 'lucia@correo.com',
      },
    }),
  ]);

  await prisma.configFidelidad.create({
    data: {
      estudioId: estudio.id,
      activo: true,
      visitasRequeridas: 3,
      tipoRecompensa: 'descuento',
      porcentajeDescuento: 100,
      descripcionRecompensa: 'Tu próximo servicio es completamente gratis',
    },
  });

  // Reservas de demostración
  await Promise.all([
    prisma.reserva.create({
      data: {
        estudioId: estudio.id,
        personalId: andrea.id,
        clienteId: carla.id,
        nombreCliente: 'Carla Ruiz',
        telefonoCliente: '5598765432',
        servicios: [{ name: 'Corte Dama / Niña', duration: 60, price: 80000 }],
        duracion: 60,
        precioTotal: 80000,
        estado: 'completed',
        sucursal: 'Av. Presidente Masaryk 123, Polanco, CDMX',
        fecha: todayStr,
        horaInicio: '10:00',
      },
    }),
    prisma.reserva.create({
      data: {
        estudioId: estudio.id,
        personalId: andrea.id,
        clienteId: monica.id,
        nombreCliente: 'Mónica Hernández',
        telefonoCliente: '5511223344',
        servicios: [{ name: 'Balayage', duration: 240, price: 350000 }],
        duracion: 240,
        precioTotal: 350000,
        estado: 'pending',
        sucursal: 'Av. Presidente Masaryk 123, Polanco, CDMX',
        marcaTinte: "L'Oréal",
        tonalidad: '8.1',
        fecha: todayStr,
        horaInicio: '15:00',
      },
    }),
    prisma.reserva.create({
      data: {
        estudioId: estudio.id,
        personalId: valeria.id,
        clienteId: lucia.id,
        nombreCliente: 'Lucía Fernández',
        telefonoCliente: '5544556677',
        servicios: [
          { name: 'Mani Spa', duration: 60, price: 60000 },
          { name: 'Gel Semi Permanente', duration: 60, price: 50000 },
        ],
        duracion: 120,
        precioTotal: 110000,
        estado: 'pending',
        sucursal: 'Insurgentes Sur 456, Roma, CDMX',
        fecha: tomorrowStr,
        horaInicio: '12:00',
      },
    }),
  ]);

  await Promise.all([
    prisma.puntosFidelidad.create({
      data: {
        clienteId: carla.id,
        estudioId: estudio.id,
        visitasAcumuladas: 3,
        visitasUsadas: 3,
        recompensasGanadas: 1,
        recompensasUsadas: 0,
        ultimaVisita: new Date(),
      },
    }),
    prisma.puntosFidelidad.create({
      data: {
        clienteId: monica.id,
        estudioId: estudio.id,
        visitasAcumuladas: 2,
        visitasUsadas: 0,
        recompensasGanadas: 0,
        recompensasUsadas: 0,
        ultimaVisita: new Date(),
      },
    }),
    prisma.puntosFidelidad.create({
      data: {
        clienteId: lucia.id,
        estudioId: estudio.id,
        visitasAcumuladas: 1,
        visitasUsadas: 0,
        recompensasGanadas: 0,
        recompensasUsadas: 0,
        ultimaVisita: new Date(),
      },
    }),
  ]);

  console.log(
    `✅ MIKELOV STUDIO (id: ${estudio.id}) sincronizado con 3 empleados y 3 citas de demostración.`,
  );
  // sofia is created but only used structurally to avoid TS unused var warning
  void sofia;
}

async function crearUsuarioMaestro(): Promise<void> {
  await prisma.usuario.deleteMany({
    where: {
      rol: 'maestro',
      email: { notIn: ADMINS_SEMILLA.map((admin) => admin.email) },
    },
  });

  for (const admin of ADMINS_SEMILLA) {
    const usuario = await prisma.usuario.upsert({
      where: { email: admin.email },
      update: {
        nombre: admin.alias,
        hashContrasena: await bcrypt.hash(admin.contrasena, 12),
        rol: 'maestro',
        activo: true,
        emailVerificado: true,
        estudioId: null,
      },
      create: {
        email: admin.email,
        hashContrasena: await bcrypt.hash(admin.contrasena, 12),
        nombre: admin.alias,
        rol: 'maestro',
        activo: true,
        emailVerificado: true,
        estudioId: null,
      },
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

    console.log(`✅ Admin protegido listo: ${admin.alias} <${admin.email}>`);
  }
}

async function limpiarPruebas(): Promise<void> {
  const estudioMikelov = await prisma.estudio.findFirst({
    where: {
      OR: [
        { claveDueno: CLAVE_DUENO_MIKELOV },
        { emailContacto: EMAIL_DUENO_MIKELOV },
        { nombre: NOMBRE_SALON_MIKELOV },
      ],
    },
    select: { id: true },
  });

  const estudiosAEliminar = await prisma.estudio.findMany({
    where: estudioMikelov ? { id: { not: estudioMikelov.id } } : {},
    select: { id: true },
  });

  const idsEstudiosAEliminar = estudiosAEliminar.map((estudio) => estudio.id);
  const correosProtegidos = new Set([...ADMINS_PROTEGIDOS, EMAIL_DUENO_MIKELOV]);

  await prisma.tokenVerificacionApp.deleteMany({});
  await prisma.tokenReset.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.clienteApp.deleteMany({});

  if (estudioMikelov) {
    await prisma.reservaServicio.deleteMany({ where: { reserva: { estudioId: estudioMikelov.id } } });
    await prisma.reserva.deleteMany({ where: { estudioId: estudioMikelov.id } });
    await prisma.puntosFidelidad.deleteMany({ where: { estudioId: estudioMikelov.id } });
    await prisma.configFidelidad.deleteMany({ where: { estudioId: estudioMikelov.id } });
    await prisma.pago.deleteMany({ where: { estudioId: estudioMikelov.id } });
    await prisma.diaFestivo.deleteMany({ where: { estudioId: estudioMikelov.id } });
    await prisma.empleadoAcceso.deleteMany({ where: { personal: { estudioId: estudioMikelov.id } } });
    await prisma.cliente.deleteMany({ where: { estudioId: estudioMikelov.id } });
    await prisma.personal.deleteMany({ where: { estudioId: estudioMikelov.id } });
  }

  if (idsEstudiosAEliminar.length > 0) {
    await prisma.reservaServicio.deleteMany({ where: { reserva: { estudioId: { in: idsEstudiosAEliminar } } } });
    await prisma.reserva.deleteMany({ where: { estudioId: { in: idsEstudiosAEliminar } } });
    await prisma.puntosFidelidad.deleteMany({ where: { estudioId: { in: idsEstudiosAEliminar } } });
    await prisma.configFidelidad.deleteMany({ where: { estudioId: { in: idsEstudiosAEliminar } } });
    await prisma.pago.deleteMany({ where: { estudioId: { in: idsEstudiosAEliminar } } });
    await prisma.diaFestivo.deleteMany({ where: { estudioId: { in: idsEstudiosAEliminar } } });
    await prisma.empleadoAcceso.deleteMany({ where: { personal: { estudioId: { in: idsEstudiosAEliminar } } } });
    await prisma.cliente.deleteMany({ where: { estudioId: { in: idsEstudiosAEliminar } } });
    await prisma.personal.deleteMany({ where: { estudioId: { in: idsEstudiosAEliminar } } });

    await prisma.usuario.deleteMany({
      where: {
        rol: 'dueno',
        estudioId: { in: idsEstudiosAEliminar },
        email: { notIn: Array.from(correosProtegidos) },
      },
    });
    await prisma.estudio.deleteMany({ where: { id: { in: idsEstudiosAEliminar } } });
  }

  await prisma.usuario.deleteMany({
    where: {
      email: { notIn: Array.from(correosProtegidos) },
      OR: [
        { rol: 'maestro' },
        { rol: 'dueno', estudioId: null },
      ],
    },
  });

  if (estudioMikelov) {
    await prisma.usuario.upsert({
      where: { email: EMAIL_DUENO_MIKELOV },
      update: {
        nombre: 'Miguel Ángel Lovato',
        rol: 'dueno',
        activo: true,
        emailVerificado: true,
        estudioId: estudioMikelov.id,
      },
      create: {
        email: EMAIL_DUENO_MIKELOV,
        hashContrasena: await bcrypt.hash(CONTRASENA_DUENO_DEMO, 12),
        nombre: 'Miguel Ángel Lovato',
        rol: 'dueno',
        activo: true,
        emailVerificado: true,
        estudioId: estudioMikelov.id,
      },
    });
  }

  console.log(estudioMikelov
    ? '✅ Limpieza completa: se conservó únicamente MIKELOV STUDIO y los admins protegidos.'
    : '✅ Limpieza completa: se conservaron únicamente los admins protegidos.');
}

async function main() {
  informarCredencialesSemilla();

  if (ARGUMENTOS.has('--limpiar')) {
    await limpiarPruebas();
    process.exit(0);
  }

  await crearUsuarioMaestro();

  if (ENTORNO_ACTUAL === 'development') {
    await sembrarMikelovStudio();
  } else {
    console.log(`ℹ️  Demo de salón omitida en entorno ${ENTORNO_ACTUAL}.`);
  }
}

main()
  .catch((err) => {
    console.error('❌ Error al ejecutar la semilla:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
