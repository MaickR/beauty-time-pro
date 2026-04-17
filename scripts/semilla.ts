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
const CONTRASENA_DUENO_DEMO = process.env.DEMO_CONTRASENA_DUENO?.trim() || 'MikelovPro2026!';
const EMAIL_EMPLEADO_DEMO_MIKELOV = 'andrea.color@mikelovstudio.com';
const CONTRASENA_EMPLEADO_DEMO_MIKELOV = process.env.DEMO_CONTRASENA_EMPLEADO_MIKELOV?.trim() || 'MikelovEmp2026!';
const ADMINS_SEMILLA = [
  {
    email: 'miguel@salonpromaster.com',
    nombre: 'Miguel',
    apellido: 'Baigts',
    alias: 'Miguel Baigts',
    contrasena: CONTRASENA_ADMIN_PRINCIPAL,
  },
  {
    email: 'admin.secundario@salonpromaster.com',
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
  console.log(`   Maestro principal: miguel@salonpromaster.com / ${CONTRASENA_ADMIN_PRINCIPAL}`);
  console.log(`   Maestro secundario: admin.secundario@salonpromaster.com / ${CONTRASENA_ADMIN_SECUNDARIO}`);
  console.log(`   Dueño demo MIKELOV: ${EMAIL_DUENO_MIKELOV} / ${CONTRASENA_DUENO_DEMO}`);
  console.log(`   Empleado demo MIKELOV: ${EMAIL_EMPLEADO_DEMO_MIKELOV} / ${CONTRASENA_EMPLEADO_DEMO_MIKELOV}`);
}

function obtenerFechaLocalISO(fecha: Date): string {
  const compensacion = fecha.getTimezoneOffset();
  const fechaLocal = new Date(fecha.getTime() - compensacion * 60 * 1000);
  return fechaLocal.toISOString().split('T')[0]!;
}

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

type ServicioSemilla = {
  name: string;
  duration: number;
  price: number;
};

type EmpleadoSemilla = {
  nombre: string;
  email: string;
  contrasena: string;
  especialidades: string[];
  horaInicio: string;
  horaFin: string;
  descansoInicio: string;
  descansoFin: string;
  diasTrabajo?: number[];
  compartirCredenciales?: boolean;
};

type ClienteSemilla = {
  nombre: string;
  telefono: string;
  email: string;
  fechaNacimiento: string;
  notas?: string;
};

const SUCURSALES_MIKELOV = [
  'Av. Presidente Masaryk 123, Polanco, CDMX',
  'Insurgentes Sur 456, Roma, CDMX',
  'Av. Universidad 920, Del Valle, CDMX',
];

const SERVICIOS_MIKELOV: ServicioSemilla[] = [
  { name: 'Corte Dama / Niña', duration: 60, price: 80000 },
  { name: 'Balayage', duration: 240, price: 350000 },
  { name: 'Tinte Global', duration: 120, price: 180000 },
  { name: 'Diseño de Ceja', duration: 30, price: 40000 },
  { name: 'Lash Lifting', duration: 90, price: 95000 },
  { name: 'Mani Spa', duration: 60, price: 60000 },
  { name: 'Pedi Spa', duration: 60, price: 70000 },
  { name: 'Gel Semi Permanente', duration: 60, price: 50000 },
  { name: 'Peinado Social', duration: 75, price: 85000 },
  { name: 'Tratamiento Capilar Premium', duration: 50, price: 65000 },
];

const EMPLEADOS_MIKELOV: EmpleadoSemilla[] = [
  {
    nombre: 'Andrea López',
    email: EMAIL_EMPLEADO_DEMO_MIKELOV,
    contrasena: CONTRASENA_EMPLEADO_DEMO_MIKELOV,
    especialidades: ['Corte Dama / Niña', 'Balayage', 'Tinte Global', 'Tratamiento Capilar Premium'],
    horaInicio: '10:00',
    horaFin: '20:00',
    descansoInicio: '14:00',
    descansoFin: '15:00',
    diasTrabajo: [1, 2, 3, 4, 5, 6],
    compartirCredenciales: true,
  },
  {
    nombre: 'Sofía Ramírez',
    email: 'sofia.brows@mikelovstudio.com',
    contrasena: 'SofiaBrows2026!',
    especialidades: ['Diseño de Ceja', 'Lash Lifting'],
    horaInicio: '09:00',
    horaFin: '18:00',
    descansoInicio: '13:30',
    descansoFin: '14:15',
    diasTrabajo: [1, 2, 3, 4, 5],
  },
  {
    nombre: 'Valeria Torres',
    email: 'valeria.nails@mikelovstudio.com',
    contrasena: 'ValeriaNails2026!',
    especialidades: ['Mani Spa', 'Pedi Spa', 'Gel Semi Permanente'],
    horaInicio: '11:00',
    horaFin: '20:00',
    descansoInicio: '15:00',
    descansoFin: '16:00',
    diasTrabajo: [2, 3, 4, 5, 6],
  },
  {
    nombre: 'Fernanda Cruz',
    email: 'fernanda.social@mikelovstudio.com',
    contrasena: 'FernandaSocial2026!',
    especialidades: ['Peinado Social', 'Corte Dama / Niña', 'Diseño de Ceja'],
    horaInicio: '09:30',
    horaFin: '18:30',
    descansoInicio: '13:00',
    descansoFin: '14:00',
    diasTrabajo: [4, 5, 6, 0],
  },
  {
    nombre: 'Daniela García',
    email: 'daniela.spa@mikelovstudio.com',
    contrasena: 'DanielaSpa2026!',
    especialidades: ['Tratamiento Capilar Premium', 'Mani Spa', 'Pedi Spa'],
    horaInicio: '10:00',
    horaFin: '19:00',
    descansoInicio: '14:30',
    descansoFin: '15:30',
    diasTrabajo: [1, 2, 4, 5, 6],
  },
];

const CLIENTES_MIKELOV: ClienteSemilla[] = [
  { nombre: 'Carla Ruiz', telefono: '5598765432', email: 'carla@correo.com', fechaNacimiento: '1994-03-10', notas: 'Prefiere tonos fríos y recordatorios por WhatsApp.' },
  { nombre: 'Mónica Hernández', telefono: '5511223344', email: 'monica@correo.com', fechaNacimiento: '1990-06-22', notas: 'Balayage cada 8 semanas.' },
  { nombre: 'Lucía Fernández', telefono: '5544556677', email: 'lucia@correo.com', fechaNacimiento: '1998-09-14' },
  { nombre: 'Paola Jiménez', telefono: '5588112233', email: 'paola@correo.com', fechaNacimiento: '1992-12-03', notas: 'Siempre agenda los sábados.' },
  { nombre: 'Daniela Moreno', telefono: '5577331199', email: 'daniela@correo.com', fechaNacimiento: '1989-01-19' },
  { nombre: 'Andrea Soto', telefono: '5555667788', email: 'andrea.soto@correo.com', fechaNacimiento: '1996-05-01' },
  { nombre: 'Mariana Vega', telefono: '5533001122', email: 'mariana.vega@correo.com', fechaNacimiento: '1991-07-18', notas: 'Compra productos en cada visita.' },
  { nombre: 'Regina Campos', telefono: '5522110099', email: 'regina.campos@correo.com', fechaNacimiento: '1997-02-11' },
  { nombre: 'Karla Mejía', telefono: '5544002211', email: 'karla.mejia@correo.com', fechaNacimiento: '1988-08-28' },
  { nombre: 'Natalia Flores', telefono: '5599001122', email: 'natalia.flores@correo.com', fechaNacimiento: '1995-10-09' },
];

function sumarDias(fecha: Date, dias: number): Date {
  const resultado = new Date(fecha);
  resultado.setDate(resultado.getDate() + dias);
  return resultado;
}

function construirServicioIndice() {
  return new Map(SERVICIOS_MIKELOV.map((servicio) => [servicio.name, servicio]));
}

function calcularTotalesServicios(nombresServicios: string[]) {
  const indiceServicios = construirServicioIndice();
  const servicios = nombresServicios.map((nombre) => {
    const servicio = indiceServicios.get(nombre);

    if (!servicio) {
      throw new Error(`Servicio de semilla no encontrado: ${nombre}`);
    }

    return servicio;
  });

  return {
    servicios,
    duracion: servicios.reduce((total, servicio) => total + servicio.duration, 0),
    precioTotal: servicios.reduce((total, servicio) => total + servicio.price, 0),
  };
}

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
  const precioPlanPro =
    (await prisma.precioPlan.findFirst({
      where: { plan: 'PRO', pais: 'Mexico' },
      orderBy: [{ version: 'desc' }],
      select: { id: true },
    })) ??
    (await prisma.precioPlan.create({
      data: {
        plan: 'PRO',
        pais: 'Mexico',
        moneda: 'MXN',
        monto: 70000,
        version: 1,
        vigenteDesde: new Date('2026-01-01T00:00:00.000Z'),
      },
      select: { id: true },
    }));

  const horario = construirHorarioMikelov();
  const datosEstudioMikelov = {
    nombre: 'MIKELOV STUDIO',
    propietario: 'Miguel Ángel Lovato',
    telefono: '55 1234 5678',
    sitioWeb: 'www.mikelovstudio.com',
    pais: 'Mexico' as const,
    plan: 'PRO' as const,
    sucursales: SUCURSALES_MIKELOV,
    claveDueno: CLAVE_DUENO_MIKELOV,
    claveCliente: 'MIKELOVSTUDIO',
    estado: 'aprobado' as const,
    fechaAprobacion: new Date(),
    inicioSuscripcion: '2026-02-15',
    fechaVencimiento: obtenerFechaLocalISO(due),
    precioPlanActualId: precioPlanPro.id,
    precioPlanProximoId: null,
    fechaAplicacionPrecioProximo: null,
    festivos: [obtenerFechaLocalISO(sumarDias(new Date(), 11)), obtenerFechaLocalISO(sumarDias(new Date(), 18))],
    colorPrimario: '#C2185B',
    descripcion: 'Color, uñas, brows y tratamientos premium con atención personalizada y operación multi-sede.',
    direccion: 'Av. Presidente Masaryk 123, Polanco, CDMX',
    emailContacto: EMAIL_DUENO_MIKELOV,
    horario,
    servicios: SERVICIOS_MIKELOV,
    serviciosCustom: [],
    numeroEspecialistas: EMPLEADOS_MIKELOV.length,
    categorias: 'Cabello, Uñas, Cejas, Lashes, Tratamientos',
    mensajesMasivosExtra: 2,
    primeraVez: false,
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
  await prisma.notificacionEstudio.deleteMany({ where: { estudioId: estudio.id } });
  await prisma.mensajeMasivo.deleteMany({ where: { estudioId: estudio.id } });
  await prisma.producto.deleteMany({ where: { estudioId: estudio.id } });
  await prisma.empleadoAcceso.deleteMany({ where: { personal: { estudioId: estudio.id } } });
  await prisma.cliente.deleteMany({ where: { estudioId: estudio.id } });
  await prisma.personal.deleteMany({ where: { estudioId: estudio.id } });

  const personalCreado = await Promise.all(
    EMPLEADOS_MIKELOV.map(async (empleado) => {
      const personal = await prisma.personal.create({
        data: {
          estudioId: estudio.id,
          nombre: empleado.nombre,
          especialidades: empleado.especialidades,
          horaInicio: empleado.horaInicio,
          horaFin: empleado.horaFin,
          descansoInicio: empleado.descansoInicio,
          descansoFin: empleado.descansoFin,
          diasTrabajo: empleado.diasTrabajo ?? null,
        },
      });

      await prisma.empleadoAcceso.create({
        data: {
          personalId: personal.id,
          email: empleado.email,
          hashContrasena: await bcrypt.hash(empleado.contrasena, 12),
          activo: true,
          forzarCambioContrasena: !empleado.compartirCredenciales,
        },
      });

      return { ...personal, email: empleado.email };
    }),
  );

  const clientesCreados = await Promise.all(
    CLIENTES_MIKELOV.map((cliente) =>
      prisma.cliente.create({
        data: {
          estudioId: estudio.id,
          nombre: cliente.nombre,
          telefono: cliente.telefono,
          fechaNacimiento: new Date(cliente.fechaNacimiento),
          email: cliente.email,
          notas: cliente.notas,
        },
      }),
    ),
  );

  await prisma.producto.createMany({
    data: [
      { estudioId: estudio.id, nombre: 'Shampoo Matizante Pro', categoria: 'Cabello', precio: 42000, activo: true },
      { estudioId: estudio.id, nombre: 'Mascarilla Reparadora', categoria: 'Cabello', precio: 38000, activo: true },
      { estudioId: estudio.id, nombre: 'Aceite de Cutícula', categoria: 'Uñas', precio: 19000, activo: true },
      { estudioId: estudio.id, nombre: 'Sérum de Pestañas', categoria: 'Lashes', precio: 45000, activo: true },
      { estudioId: estudio.id, nombre: 'Protector Térmico', categoria: 'Cabello', precio: 29000, activo: true },
      { estudioId: estudio.id, nombre: 'Gift Card Spa', categoria: 'Retail', precio: 100000, activo: false },
    ],
  });

  await prisma.configFidelidad.create({
    data: {
      estudioId: estudio.id,
      activo: true,
      visitasRequeridas: 4,
      tipoRecompensa: 'descuento',
      porcentajeDescuento: 25,
      descripcionRecompensa: '25% off en tu próxima visita premium',
    },
  });

  const empleadosPorNombre = new Map(personalCreado.map((empleado) => [empleado.nombre, empleado]));
  const clientesPorNombre = new Map(clientesCreados.map((cliente) => [cliente.nombre, cliente]));
  const planesReserva = [
    {
      cliente: 'Carla Ruiz',
      empleado: 'Andrea López',
      servicios: ['Corte Dama / Niña', 'Tratamiento Capilar Premium'],
      fecha: obtenerFechaLocalISO(sumarDias(new Date(), -21)),
      horaInicio: '10:00',
      estado: 'completed',
      sucursal: SUCURSALES_MIKELOV[0],
      observaciones: 'Cliente VIP, pidió sellado ligero.',
    },
    {
      cliente: 'Mónica Hernández',
      empleado: 'Andrea López',
      servicios: ['Balayage'],
      fecha: obtenerFechaLocalISO(sumarDias(new Date(), -15)),
      horaInicio: '11:30',
      estado: 'completed',
      sucursal: SUCURSALES_MIKELOV[0],
      marcaTinte: "L'Oréal",
      tonalidad: '8.1',
    },
    {
      cliente: 'Lucía Fernández',
      empleado: 'Valeria Torres',
      servicios: ['Mani Spa', 'Gel Semi Permanente'],
      fecha: obtenerFechaLocalISO(sumarDias(new Date(), -12)),
      horaInicio: '16:00',
      estado: 'completed',
      sucursal: SUCURSALES_MIKELOV[1],
    },
    {
      cliente: 'Paola Jiménez',
      empleado: 'Sofía Ramírez',
      servicios: ['Diseño de Ceja', 'Lash Lifting'],
      fecha: obtenerFechaLocalISO(sumarDias(new Date(), -9)),
      horaInicio: '13:00',
      estado: 'completed',
      sucursal: SUCURSALES_MIKELOV[0],
    },
    {
      cliente: 'Daniela Moreno',
      empleado: 'Fernanda Cruz',
      servicios: ['Peinado Social'],
      fecha: obtenerFechaLocalISO(sumarDias(new Date(), -6)),
      horaInicio: '17:00',
      estado: 'cancelled',
      sucursal: SUCURSALES_MIKELOV[2],
      observaciones: 'Canceló por viaje de trabajo.',
    },
    {
      cliente: 'Andrea Soto',
      empleado: 'Daniela García',
      servicios: ['Pedi Spa'],
      fecha: obtenerFechaLocalISO(sumarDias(new Date(), -4)),
      horaInicio: '12:00',
      estado: 'completed',
      sucursal: SUCURSALES_MIKELOV[1],
    },
    {
      cliente: 'Mariana Vega',
      empleado: 'Andrea López',
      servicios: ['Tinte Global', 'Tratamiento Capilar Premium'],
      fecha: obtenerFechaLocalISO(sumarDias(new Date(), -1)),
      horaInicio: '15:30',
      estado: 'confirmed',
      sucursal: SUCURSALES_MIKELOV[0],
      marcaTinte: 'Wella',
      tonalidad: '7.43',
    },
    {
      cliente: 'Regina Campos',
      empleado: 'Sofía Ramírez',
      servicios: ['Diseño de Ceja'],
      fecha: todayStr,
      horaInicio: '09:30',
      estado: 'pending',
      sucursal: SUCURSALES_MIKELOV[0],
    },
    {
      cliente: 'Karla Mejía',
      empleado: 'Valeria Torres',
      servicios: ['Mani Spa', 'Pedi Spa'],
      fecha: todayStr,
      horaInicio: '13:00',
      estado: 'confirmed',
      sucursal: SUCURSALES_MIKELOV[1],
    },
    {
      cliente: 'Natalia Flores',
      empleado: 'Fernanda Cruz',
      servicios: ['Peinado Social', 'Diseño de Ceja'],
      fecha: obtenerFechaLocalISO(sumarDias(new Date(), 1)),
      horaInicio: '11:00',
      estado: 'pending',
      sucursal: SUCURSALES_MIKELOV[2],
      observaciones: 'Preparación para boda civil.',
    },
    {
      cliente: 'Carla Ruiz',
      empleado: 'Daniela García',
      servicios: ['Tratamiento Capilar Premium'],
      fecha: obtenerFechaLocalISO(sumarDias(new Date(), 3)),
      horaInicio: '18:00',
      estado: 'confirmed',
      sucursal: SUCURSALES_MIKELOV[0],
    },
    {
      cliente: 'Mónica Hernández',
      empleado: 'Andrea López',
      servicios: ['Balayage', 'Corte Dama / Niña'],
      fecha: obtenerFechaLocalISO(sumarDias(new Date(), 6)),
      horaInicio: '10:30',
      estado: 'pending',
      sucursal: SUCURSALES_MIKELOV[0],
      marcaTinte: 'Redken',
      tonalidad: '9N',
    },
  ] as const;

  for (const planReserva of planesReserva) {
    const cliente = clientesPorNombre.get(planReserva.cliente);
    const empleado = empleadosPorNombre.get(planReserva.empleado);

    if (!cliente || !empleado) {
      throw new Error(`No fue posible construir la reserva de ${planReserva.cliente}.`);
    }

    const totales = calcularTotalesServicios([...planReserva.servicios]);

    const reserva = await prisma.reserva.create({
      data: {
        estudioId: estudio.id,
        personalId: empleado.id,
        clienteId: cliente.id,
        nombreCliente: cliente.nombre,
        telefonoCliente: cliente.telefono,
        servicios: totales.servicios,
        duracion: totales.duracion,
        precioTotal: totales.precioTotal,
        estado: planReserva.estado,
        sucursal: planReserva.sucursal,
        fecha: planReserva.fecha,
        horaInicio: planReserva.horaInicio,
        marcaTinte: planReserva.marcaTinte,
        tonalidad: planReserva.tonalidad,
        observaciones: planReserva.observaciones,
      },
    });

    await prisma.reservaServicio.createMany({
      data: totales.servicios.map((servicio, indice) => ({
        reservaId: reserva.id,
        nombre: servicio.name,
        duracion: servicio.duration,
        precio: servicio.price,
        orden: indice,
        estado: planReserva.estado,
      })),
    });
  }

  await Promise.all([
    prisma.puntosFidelidad.create({
      data: {
        clienteId: clientesPorNombre.get('Carla Ruiz')!.id,
        estudioId: estudio.id,
        visitasAcumuladas: 4,
        visitasUsadas: 1,
        recompensasGanadas: 1,
        recompensasUsadas: 0,
        ultimaVisita: new Date(),
      },
    }),
    prisma.puntosFidelidad.create({
      data: {
        clienteId: clientesPorNombre.get('Mónica Hernández')!.id,
        estudioId: estudio.id,
        visitasAcumuladas: 3,
        visitasUsadas: 0,
        recompensasGanadas: 0,
        recompensasUsadas: 0,
        ultimaVisita: new Date(),
      },
    }),
    prisma.puntosFidelidad.create({
      data: {
        clienteId: clientesPorNombre.get('Lucía Fernández')!.id,
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
        clienteId: clientesPorNombre.get('Paola Jiménez')!.id,
        estudioId: estudio.id,
        visitasAcumuladas: 5,
        visitasUsadas: 4,
        recompensasGanadas: 1,
        recompensasUsadas: 1,
        ultimaVisita: new Date(),
      },
    }),
  ]);

  await prisma.diaFestivo.createMany({
    data: [
      {
        estudioId: estudio.id,
        fecha: obtenerFechaLocalISO(sumarDias(new Date(), 11)),
        descripcion: 'Capacitación interna de técnicas de color',
      },
      {
        estudioId: estudio.id,
        fecha: obtenerFechaLocalISO(sumarDias(new Date(), 18)),
        descripcion: 'Mantenimiento general de la sede Polanco',
      },
    ],
  });

  await prisma.pago.createMany({
    data: [
      { estudioId: estudio.id, monto: 70000, moneda: 'MXN', concepto: 'Plan PRO febrero 2026', fecha: '2026-02-15', tipo: 'suscripcion', referencia: 'MIKELOV-FEB-2026' },
      { estudioId: estudio.id, monto: 70000, moneda: 'MXN', concepto: 'Plan PRO marzo 2026', fecha: '2026-03-15', tipo: 'suscripcion', referencia: 'MIKELOV-MAR-2026' },
      { estudioId: estudio.id, monto: 70000, moneda: 'MXN', concepto: 'Plan PRO abril 2026', fecha: '2026-04-11', tipo: 'suscripcion', referencia: 'MIKELOV-APR-2026' },
      { estudioId: estudio.id, monto: 250000, moneda: 'MXN', concepto: 'Venta retail quincenal', fecha: '2026-04-10', tipo: 'otro', referencia: 'MIKELOV-RETAIL-01' },
    ],
  });

  await prisma.notificacionEstudio.createMany({
    data: [
      {
        estudioId: estudio.id,
        tipo: 'pago_confirmado',
        titulo: 'Subscription updated',
        mensaje: 'Your PRO subscription was renewed successfully.',
      },
      {
        estudioId: estudio.id,
        tipo: 'recordatorio_pago',
        titulo: 'Top seller this week',
        mensaje: 'Andrea López closed 3 premium services this week.',
      },
      {
        estudioId: estudio.id,
        tipo: 'mensaje_masivo',
        titulo: 'Campaign ready',
        mensaje: 'Mother’s Day campaign is scheduled for next Monday.',
      },
    ],
  });

  await prisma.mensajeMasivo.createMany({
    data: [
      {
        estudioId: estudio.id,
        titulo: 'Mother’s Day Beauty Week',
        texto: 'Book your beauty session this week and get an exclusive add-on for free.',
        fechaEnvio: sumarDias(new Date(), 2),
        enviado: false,
      },
      {
        estudioId: estudio.id,
        titulo: 'Thanks for your visit',
        texto: 'Thank you for choosing Mikelov Studio. Your loyalty rewards are waiting for you.',
        fechaEnvio: sumarDias(new Date(), -3),
        enviado: true,
      },
    ],
  });

  console.log(
    `✅ MIKELOV STUDIO (id: ${estudio.id}) sincronizado como PRO con ${personalCreado.length} empleados, ${clientesCreados.length} clientes y ${planesReserva.length} citas.`,
  );
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
    await prisma.notificacionEstudio.deleteMany({ where: { estudioId: estudioMikelov.id } });
    await prisma.mensajeMasivo.deleteMany({ where: { estudioId: estudioMikelov.id } });
    await prisma.producto.deleteMany({ where: { estudioId: estudioMikelov.id } });
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
    await prisma.notificacionEstudio.deleteMany({ where: { estudioId: { in: idsEstudiosAEliminar } } });
    await prisma.mensajeMasivo.deleteMany({ where: { estudioId: { in: idsEstudiosAEliminar } } });
    await prisma.producto.deleteMany({ where: { estudioId: { in: idsEstudiosAEliminar } } });
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
