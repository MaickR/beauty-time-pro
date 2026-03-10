/**
 * Script de semilla de datos de demostración — Beauty Time Pro
 *
 * Uso: npm run semilla
 *
 * Requiere que MySQL esté corriendo y que server/.env tenga DATABASE_URL configurada.
 * Solo ejecutar en desarrollo local. Prohibido en producción.
 */

import 'dotenv/config';
import bcrypt from 'bcrypt';
import { PrismaClient } from '../server/src/generated/prisma/index.js';

const prisma = new PrismaClient({
  datasources: { db: { url: process.env['DATABASE_URL'] } },
});

function obtenerFechaLocalISO(fecha: Date): string {
  const compensacion = fecha.getTimezoneOffset();
  const fechaLocal = new Date(fecha.getTime() - compensacion * 60 * 1000);
  return fechaLocal.toISOString().split('T')[0]!;
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

async function sembrarMikelovStudio(): Promise<void> {
  const existe = await prisma.estudio.findFirst({
    where: { claveDueno: 'MIKELOV123' },
    select: { id: true },
  });

  if (existe) {
    console.log('ℹ️  MIKELOV STUDIO ya existe. No se insertaron datos duplicados.');
    return;
  }

  console.log('🌱 Generando MIKELOV STUDIO...');

  const todayStr = obtenerFechaLocalISO(new Date());
  const due = new Date();
  due.setMonth(due.getMonth() + 1);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = obtenerFechaLocalISO(tomorrow);

  const horario = DIAS.reduce(
    (acc, dia) => ({
      ...acc,
      [dia]: { isOpen: dia !== 'Domingo', openTime: '09:00', closeTime: '20:00' },
    }),
    {} as Record<string, { isOpen: boolean; openTime: string; closeTime: string }>,
  );

  const estudio = await prisma.estudio.create({
    data: {
      nombre: 'MIKELOV STUDIO',
      propietario: 'Miguel Ángel Lovato',
      telefono: '55 1234 5678',
      sitioWeb: 'www.mikelovstudio.com',
      pais: 'Mexico',
      sucursales: [
        'Av. Presidente Masaryk 123, Polanco, CDMX',
        'Insurgentes Sur 456, Roma, CDMX',
      ],
      claveDueno: 'MIKELOV123',
      claveCliente: 'MIKELOVSTUDIO',
      inicioSuscripcion: '2026-02-15',
      fechaVencimiento: obtenerFechaLocalISO(due),
      festivos: [],
      colorPrimario: '#C2185B',
      descripcion: 'Color, uñas y estética premium con atención personalizada.',
      direccion: 'Av. Presidente Masaryk 123, Polanco, CDMX',
      emailContacto: 'hola@mikelovstudio.com',
      horario,
      servicios: [
        { name: 'Corte Dama / Niña', duration: 60, price: 800 },
        { name: 'Balayage', duration: 240, price: 3500 },
        { name: 'Tinte Global', duration: 120, price: 1800 },
        { name: 'Diseño de Ceja', duration: 30, price: 400 },
        { name: 'Lash Lifting', duration: 90, price: 950 },
        { name: 'Mani Spa', duration: 60, price: 600 },
        { name: 'Pedi Spa', duration: 60, price: 700 },
        { name: 'Gel Semi Permanente', duration: 60, price: 500 },
      ],
      serviciosCustom: [],
    },
  });

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
        servicios: [{ name: 'Corte Dama / Niña', duration: 60, price: 800 }],
        duracion: 60,
        precioTotal: 800,
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
        servicios: [{ name: 'Balayage', duration: 240, price: 3500 }],
        duracion: 240,
        precioTotal: 3500,
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
          { name: 'Mani Spa', duration: 60, price: 600 },
          { name: 'Gel Semi Permanente', duration: 60, price: 500 },
        ],
        duracion: 120,
        precioTotal: 1100,
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

  console.log(`✅ MIKELOV STUDIO (id: ${estudio.id}), 3 empleados y 3 citas de demostración creados.`);
  // sofia is created but only used structurally to avoid TS unused var warning
  void sofia;
}

async function crearUsuarioMaestro(): Promise<void> {
  const existente = await prisma.usuario.findUnique({
    where: { email: 'miguel@beautytimepro.com' },
  });

  if (existente) {
    console.log('ℹ️  Usuario maestro ya existe. No se creó duplicado.');
    return;
  }

  const hashContrasena = await bcrypt.hash('Admin1234!', 12);
  await prisma.usuario.create({
    data: {
      email: 'miguel@beautytimepro.com',
      hashContrasena,
      nombre: 'Miguel Ángel',
      rol: 'maestro',
      estudioId: null,
    },
  });

  console.log('✅ Usuario maestro creado: miguel@beautytimepro.com / Admin1234!');
}

Promise.all([sembrarMikelovStudio(), crearUsuarioMaestro()])
  .catch((err) => {
    console.error('❌ Error al ejecutar la semilla:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
