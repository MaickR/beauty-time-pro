import { randomUUID } from 'node:crypto';
import { prisma } from '../prismaCliente.js';
import { asegurarCamposComisionVendedorUsuario } from './comisionVendedor.js';
import { obtenerColumnasTabla } from './compatibilidadEsquema.js';
import { generarClavesSalonUnicas } from './clavesSalon.js';
import { generarSlugUnico } from '../utils/generarSlug.js';
import { obtenerFechaISOEnZona, obtenerZonaHorariaPorPais } from '../utils/zonasHorarias.js';
import { generarHashContrasena } from '../utils/contrasenas.js';

function filtrarDatosPorColumnasDisponibles(
  datos: Record<string, unknown>,
  columnasDisponibles: Set<string>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(datos).filter(([llave, valor]) => columnasDisponibles.has(llave) && valor !== undefined),
  );
}

const PAIS_DEMO = 'Mexico';
const TELEFONO_DEMO = '5512345678';
const DIRECCION_DEMO = 'Av. Reforma 245, Juarez, Ciudad de Mexico';
const SITIO_WEB_DEMO = 'https://demo.salonpromaster.com';
const DESCRIPCION_DEMO =
  'Salon demo completamente operativo para presentar Beauty Time Pro con agenda, productos, clientes y cobros sin tocar informacion productiva.';
const NOMBRE_ADMIN_DEMO = 'Admin Demo';
const NOMBRE_EMPLEADO_DEMO = 'Especialista Demo';

const SERVICIOS_DEMO = [
  { name: 'Haircut Signature', duration: 60, price: 42000 },
  { name: 'Color Balance', duration: 120, price: 98000 },
  { name: 'Gel Manicure Pro', duration: 75, price: 39000 },
  { name: 'Lash Lifting Premium', duration: 55, price: 36000 },
  { name: 'Blow Dry Finish', duration: 35, price: 22000 },
];

const SERVICIOS_CUSTOM_DEMO = [
  { name: 'Haircut Signature', category: 'Hair' },
  { name: 'Color Balance', category: 'Hair' },
  { name: 'Gel Manicure Pro', category: 'Nails' },
  { name: 'Lash Lifting Premium', category: 'Lashes' },
  { name: 'Blow Dry Finish', category: 'Styling' },
];

const PRODUCTOS_DEMO = [
  { nombre: 'Ampolleta nutritiva', categoria: 'Retail', precio: 18000 },
  { nombre: 'Shampoo matizante', categoria: 'Retail', precio: 24000 },
  { nombre: 'Serum post color', categoria: 'Cabina', precio: 16000 },
  { nombre: 'Top coat gel', categoria: 'Cabina', precio: 14000 },
];

const CLIENTES_DEMO = [
  {
    nombre: 'Camila Torres',
    telefono: '5510001111',
    fechaNacimiento: new Date('1996-03-18T00:00:00.000Z'),
    email: 'camila.torres@example.com',
    notas: 'Prefiere confirmacion por WhatsApp y tonos calidos.',
  },
  {
    nombre: 'Daniela Ruiz',
    telefono: '5510002222',
    fechaNacimiento: new Date('1992-07-09T00:00:00.000Z'),
    email: 'daniela.ruiz@example.com',
    notas: 'Cliente frecuente de manicure y cabina.',
  },
  {
    nombre: 'Fernanda Cruz',
    telefono: '5510003333',
    fechaNacimiento: new Date('1989-11-24T00:00:00.000Z'),
    email: 'fernanda.cruz@example.com',
    notas: 'Solicita factura y seguimiento puntual.',
  },
  {
    nombre: 'Mariana Solis',
    telefono: '5510004444',
    fechaNacimiento: new Date('1998-01-29T00:00:00.000Z'),
    email: 'mariana.solis@example.com',
    notas: 'Reserva casi siempre despues de las 17:00.',
  },
  {
    nombre: 'Regina Vega',
    telefono: '5510005555',
    fechaNacimiento: new Date('1994-05-12T00:00:00.000Z'),
    email: 'regina.vega@example.com',
    notas: 'Le gustan extras de retail en cierre de servicio.',
  },
];

function crearHorarioDemo() {
  return {
    Lunes: { isOpen: true, openTime: '09:00', closeTime: '19:00' },
    Martes: { isOpen: true, openTime: '09:00', closeTime: '19:00' },
    Miercoles: { isOpen: true, openTime: '09:00', closeTime: '19:00' },
    Jueves: { isOpen: true, openTime: '09:00', closeTime: '19:00' },
    Viernes: { isOpen: true, openTime: '09:00', closeTime: '19:00' },
    Sabado: { isOpen: true, openTime: '09:00', closeTime: '15:00' },
    Domingo: { isOpen: false, openTime: '09:00', closeTime: '15:00' },
  };
}

function construirNombreSalonDemo(nombreUsuario: string) {
  const nombreBase = nombreUsuario.trim() || 'Vendedor';
  return `Demo ${nombreBase}`.slice(0, 120);
}

function normalizarSegmentoCorreo(valor: string) {
  const base = valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .trim();

  return base.replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'vendedor';
}

function obtenerPrimerNombreDemo(nombreBase: string | undefined, emailBase: string) {
  const primerNombre = nombreBase?.trim().split(/\s+/)[0] ?? '';
  if (primerNombre) {
    return normalizarSegmentoCorreo(primerNombre);
  }

  const [parteLocal] = emailBase.trim().toLowerCase().split('@');
  return normalizarSegmentoCorreo(parteLocal ?? 'vendedor');
}

function obtenerFechaDemoRelativa(dias: number, zonaHoraria: string) {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return obtenerFechaISOEnZona(fecha, zonaHoraria, PAIS_DEMO);
}

function construirResumenServiciosDemo(nombresServicios: readonly string[]) {
  return SERVICIOS_DEMO.filter((servicio) => nombresServicios.includes(servicio.name)).map((servicio) => ({
    name: servicio.name,
    duration: servicio.duration,
    price: servicio.price,
  }));
}

export function obtenerCorreosDemoVendedor(params: {
  emailBase: string;
  nombreBase?: string;
  usuarioId?: string;
}) {
  const primerNombre = obtenerPrimerNombreDemo(params.nombreBase, params.emailBase);
  const sufijoUsuario = params.usuarioId
    ? params.usuarioId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase().slice(-5)
    : '';
  const baseCorreo = primerNombre.replace(/-/g, '');
  const segmentoUnico = `${baseCorreo}${sufijoUsuario || 'demo'}`.slice(0, 24);

  return {
    admin: `${segmentoUnico}@salonpromaster.com`,
    empleado: `${segmentoUnico}.equipo@salonpromaster.com`,
  };
}

function construirSufijoUsuario(usuarioId: string) {
  const semilla = usuarioId.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return semilla.slice(-4) || 'demo';
}

function generarContrasenaDemoPorTipo(params: {
  usuarioId: string;
  nombreBase?: string;
  emailBase: string;
  tipo: 'admin' | 'empleado';
}) {
  const primerNombre = obtenerPrimerNombreDemo(params.nombreBase, params.emailBase).replace(/-/g, '');
  const nombreSegmento = `${primerNombre.charAt(0).toUpperCase()}${primerNombre.slice(1)}`.slice(0, 6) || 'Demo';
  const tipoSegmento = params.tipo === 'admin' ? 'Adm' : 'Emp';
  const sufijo = construirSufijoUsuario(params.usuarioId);
  const contrasena = `${nombreSegmento}${tipoSegmento}${sufijo}`;
  return contrasena.length >= 8 ? contrasena : `${contrasena}2025`.slice(0, 12);
}

function esErrorColumnaComisionLegacy(error: unknown): boolean {
  const mensaje = error instanceof Error ? error.message : String(error ?? '');
  return /porcentajeComision(Pro)?/i.test(mensaje) && /does not exist|Unknown column|P2022/i.test(mensaje);
}

export function obtenerCredencialesDemoVendedor(params: {
  usuarioId: string;
  emailBase: string;
  nombreBase?: string;
  claveReservas?: string | null;
  urlReservas?: string | null;
}) {
  const correos = obtenerCorreosDemoVendedor({
    usuarioId: params.usuarioId,
    emailBase: params.emailBase,
    nombreBase: params.nombreBase,
  });
  const adminContrasena = generarContrasenaDemoPorTipo({
    usuarioId: params.usuarioId,
    emailBase: params.emailBase,
    nombreBase: params.nombreBase,
    tipo: 'admin',
  });
  const empleadoContrasena = generarContrasenaDemoPorTipo({
    usuarioId: params.usuarioId,
    emailBase: params.emailBase,
    nombreBase: params.nombreBase,
    tipo: 'empleado',
  });

  return {
    adminEmail: correos.admin,
    adminContrasena,
    empleadoEmail: correos.empleado,
    empleadoContrasena,
    contrasenaCompartida: null,
    claveReservas: params.claveReservas ?? null,
    urlReservas: params.urlReservas ?? null,
  };
}

async function asegurarUsuarioDuenoDemo(params: {
  estudioId: string;
  nombreUsuario: string;
  email: string;
  contrasena: string;
}) {
  const existente = await prisma.usuario.findFirst({
    where: { estudioId: params.estudioId, rol: 'dueno' },
    select: { id: true },
  });
  const existentePorEmail = await prisma.usuario.findUnique({
    where: { email: params.email },
    select: { id: true },
  });

  await asegurarCamposComisionVendedorUsuario();
  const hashContrasena = await generarHashContrasena(params.contrasena);

  if (existente) {
    return prisma.usuario.update({
      where: { id: existente.id },
      data: {
        email: params.email,
        nombre: `${params.nombreUsuario.trim() || 'Vendedor'} ${NOMBRE_ADMIN_DEMO}`.slice(0, 120),
        hashContrasena,
        activo: true,
        emailVerificado: true,
        estudioId: params.estudioId,
      },
      select: { id: true },
    });
  }

  if (existentePorEmail) {
    return prisma.usuario.update({
      where: { id: existentePorEmail.id },
      data: {
        email: params.email,
        nombre: `${params.nombreUsuario.trim() || 'Vendedor'} ${NOMBRE_ADMIN_DEMO}`.slice(0, 120),
        hashContrasena,
        rol: 'dueno',
        activo: true,
        emailVerificado: true,
        estudioId: params.estudioId,
      },
      select: { id: true },
    });
  }

  try {
    return await prisma.usuario.create({
      data: {
        email: params.email,
        nombre: `${params.nombreUsuario.trim() || 'Vendedor'} ${NOMBRE_ADMIN_DEMO}`.slice(0, 120),
        hashContrasena,
        rol: 'dueno',
        activo: true,
        emailVerificado: true,
        estudioId: params.estudioId,
      },
      select: { id: true },
    });
  } catch (error) {
    if (!esErrorColumnaComisionLegacy(error)) {
      throw error;
    }

    const idUsuario = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO usuarios (id, email, hashContrasena, nombre, rol, activo, emailVerificado, estudioId)
      VALUES (
        ${idUsuario},
        ${params.email},
        ${hashContrasena},
        ${`${params.nombreUsuario.trim() || 'Vendedor'} ${NOMBRE_ADMIN_DEMO}`.slice(0, 120)},
        ${'dueno'},
        ${true},
        ${true},
        ${params.estudioId}
      )
    `;
    return { id: idUsuario };
  }
}

async function asegurarEmpleadoDemo(params: {
  estudioId: string;
  email: string;
  contrasena: string;
}) {
  const hashContrasena = await generarHashContrasena(params.contrasena);
  const accesoExistente = await prisma.empleadoAcceso.findUnique({
    where: { email: params.email },
    select: { id: true },
  });

  if (accesoExistente) {
    return prisma.empleadoAcceso.update({
      where: { id: accesoExistente.id },
      data: {
        hashContrasena,
        activo: true,
        forzarCambioContrasena: false,
      },
      select: { id: true },
    });
  }

  const personalExistente = await prisma.personal.findFirst({
    where: { estudioId: params.estudioId, nombre: NOMBRE_EMPLEADO_DEMO },
    select: { id: true },
  });
  if (!personalExistente) {
    return prisma.personal.create({
      data: {
        estudioId: params.estudioId,
        nombre: NOMBRE_EMPLEADO_DEMO,
        especialidades: ['Agenda demo', 'Servicio demo'],
        activo: true,
        acceso: {
          create: {
            email: params.email,
            hashContrasena,
            activo: true,
            forzarCambioContrasena: false,
          },
        },
      },
      select: { id: true },
    });
  }

  return prisma.empleadoAcceso.create({
    data: {
      personalId: personalExistente.id,
      email: params.email,
      hashContrasena,
      activo: true,
      forzarCambioContrasena: false,
    },
    select: { id: true },
  });
}

async function asegurarEstructuraDemoVendedor(params: {
  usuarioId: string;
  estudioId: string;
  nombreUsuario: string;
  emailBase: string;
}) {
  const credencialesDemo = obtenerCredencialesDemoVendedor({
    usuarioId: params.usuarioId,
    emailBase: params.emailBase,
    nombreBase: params.nombreUsuario,
  });

  await asegurarUsuarioDuenoDemo({
    estudioId: params.estudioId,
    nombreUsuario: params.nombreUsuario,
    email: credencialesDemo.adminEmail,
    contrasena: credencialesDemo.adminContrasena,
  });
  await asegurarEmpleadoDemo({
    estudioId: params.estudioId,
    email: credencialesDemo.empleadoEmail,
    contrasena: credencialesDemo.empleadoContrasena,
  });

  return credencialesDemo;
}

async function asegurarContenidoDemoVendedor(params: {
  estudioId: string;
  nombreUsuario: string;
  emailBase: string;
}) {
  const { zonaHoraria } = obtenerFechasDemo();
  const columnasEstudios = await obtenerColumnasTabla('estudios');

  const datosActualizacionEstudio = filtrarDatosPorColumnasDisponibles(
    {
      descripcion: DESCRIPCION_DEMO,
      direccion: DIRECCION_DEMO,
      sitioWeb: SITIO_WEB_DEMO,
      categorias: 'Hair, Nails, Lashes, Retail',
      metodosPagoReserva: ['cash', 'card', 'bank_transfer', 'digital_transfer'],
      servicios: SERVICIOS_DEMO,
      serviciosCustom: SERVICIOS_CUSTOM_DEMO,
      numeroEspecialistas: 3,
      emailContacto: params.emailBase,
      colorPrimario: '#9F1D4C',
      horarioApertura: '09:00',
      horarioCierre: '19:00',
      diasAtencion: 'lunes,martes,miercoles,jueves,viernes,sabado',
      sucursales: ['Cabina principal', 'Nails bar'],
    },
    columnasEstudios,
  );

  if (Object.keys(datosActualizacionEstudio).length > 0) {
    await prisma.estudio.update({
      where: { id: params.estudioId },
      data: datosActualizacionEstudio,
      select: { id: true },
    });
  }

  const personalExistente = await prisma.personal.findMany({
    where: { estudioId: params.estudioId },
    select: { id: true, nombre: true },
  });
  const personalPorNombre = new Map(personalExistente.map((persona) => [persona.nombre, persona.id]));

  const personalDemo = [
    {
      nombre: NOMBRE_EMPLEADO_DEMO,
      especialidades: ['Haircut Signature', 'Color Balance'],
      horaInicio: '09:00',
      horaFin: '18:00',
      descansoInicio: '14:00',
      descansoFin: '15:00',
      diasTrabajo: [1, 2, 3, 4, 5],
    },
    {
      nombre: 'Colorista Senior',
      especialidades: ['Color Balance', 'Blow Dry Finish'],
      horaInicio: '10:00',
      horaFin: '19:00',
      descansoInicio: '15:00',
      descansoFin: '16:00',
      diasTrabajo: [2, 3, 4, 5, 6],
    },
    {
      nombre: 'Lash Artist Pro',
      especialidades: ['Lash Lifting Premium', 'Gel Manicure Pro'],
      horaInicio: '11:00',
      horaFin: '19:00',
      descansoInicio: '16:00',
      descansoFin: '16:30',
      diasTrabajo: [1, 3, 4, 5, 6],
    },
  ] as const;

  for (const persona of personalDemo) {
    if (personalPorNombre.has(persona.nombre)) {
      continue;
    }

    const creada = await prisma.personal.create({
      data: {
        estudioId: params.estudioId,
        nombre: persona.nombre,
        especialidades: persona.especialidades,
        activo: true,
        horaInicio: persona.horaInicio,
        horaFin: persona.horaFin,
        descansoInicio: persona.descansoInicio,
        descansoFin: persona.descansoFin,
        diasTrabajo: persona.diasTrabajo,
      },
      select: { id: true, nombre: true },
    });
    personalPorNombre.set(creada.nombre, creada.id);
  }

  const clientesExistentes = await prisma.cliente.findMany({
    where: { estudioId: params.estudioId },
    select: { id: true, nombre: true },
  });
  const clientesPorNombre = new Map(clientesExistentes.map((cliente) => [cliente.nombre, cliente.id]));

  for (const cliente of CLIENTES_DEMO) {
    if (clientesPorNombre.has(cliente.nombre)) {
      continue;
    }

    const creado = await prisma.cliente.create({
      data: {
        estudioId: params.estudioId,
        nombre: cliente.nombre,
        telefono: cliente.telefono,
        fechaNacimiento: cliente.fechaNacimiento,
        email: cliente.email,
        notas: cliente.notas,
        activo: true,
      },
      select: { id: true, nombre: true },
    });
    clientesPorNombre.set(creado.nombre, creado.id);
  }

  const totalProductos = await prisma.producto.count({ where: { estudioId: params.estudioId } });
  if (totalProductos === 0) {
    await prisma.producto.createMany({
      data: PRODUCTOS_DEMO.map((producto) => ({
        estudioId: params.estudioId,
        nombre: producto.nombre,
        categoria: producto.categoria,
        precio: producto.precio,
        activo: true,
      })),
    });
  }

  await prisma.configFidelidad.upsert({
    where: { estudioId: params.estudioId },
    create: {
      estudioId: params.estudioId,
      activo: true,
      visitasRequeridas: 5,
      tipoRecompensa: 'descuento',
      porcentajeDescuento: 20,
      descripcionRecompensa: '20% off in your next beauty visit',
    },
    update: {
      activo: true,
      visitasRequeridas: 5,
      tipoRecompensa: 'descuento',
      porcentajeDescuento: 20,
      descripcionRecompensa: '20% off in your next beauty visit',
    },
  });

  const clienteCamilaId = clientesPorNombre.get('Camila Torres');
  if (clienteCamilaId) {
    await prisma.puntosFidelidad.upsert({
      where: { clienteId_estudioId: { clienteId: clienteCamilaId, estudioId: params.estudioId } },
      create: {
        clienteId: clienteCamilaId,
        estudioId: params.estudioId,
        visitasAcumuladas: 4,
        recompensasGanadas: 0,
      },
      update: {
        visitasAcumuladas: 4,
      },
    });
  }

  await prisma.diaFestivo.upsert({
    where: {
      estudioId_fecha: {
        estudioId: params.estudioId,
        fecha: obtenerFechaDemoRelativa(10, zonaHoraria),
      },
    },
    create: {
      estudioId: params.estudioId,
      fecha: obtenerFechaDemoRelativa(10, zonaHoraria),
      descripcion: 'Team workshop demo day',
    },
    update: {
      descripcion: 'Team workshop demo day',
    },
  });

  const totalMensajes = await prisma.mensajeMasivo.count({ where: { estudioId: params.estudioId } });
  if (totalMensajes === 0) {
    await prisma.mensajeMasivo.create({
      data: {
        estudioId: params.estudioId,
        titulo: 'PRO campaign launch',
        texto: 'VIP week with retail bundles and premium color maintenance.',
        fechaEnvio: new Date(),
        enviado: true,
      },
    });
  }

  const totalPagos = await prisma.pago.count({ where: { estudioId: params.estudioId } });
  if (totalPagos === 0) {
    await prisma.pago.createMany({
      data: [
        {
          estudioId: params.estudioId,
          monto: 149900,
          moneda: 'MXN',
          concepto: 'Beauty Time Pro monthly subscription',
          fecha: obtenerFechaDemoRelativa(-2, zonaHoraria),
          tipo: 'suscripcion',
          referencia: 'demo-subscription',
        },
        {
          estudioId: params.estudioId,
          monto: 78000,
          moneda: 'MXN',
          concepto: 'Retail and extra services closeout',
          fecha: obtenerFechaDemoRelativa(-1, zonaHoraria),
          tipo: 'otro',
          referencia: 'demo-retail-closeout',
        },
      ],
    });
  }

  const totalReservas = await prisma.reserva.count({ where: { estudioId: params.estudioId } });
  if (totalReservas > 0) {
    return;
  }

  const reservasDemo = [
    {
      clienteNombre: 'Camila Torres',
      personalNombre: NOMBRE_EMPLEADO_DEMO,
      fecha: obtenerFechaDemoRelativa(-2, zonaHoraria),
      horaInicio: '10:00',
      estado: 'completed',
      servicios: ['Haircut Signature'],
      productosAdicionales: [
        { nombre: 'Ampolleta nutritiva', cantidad: 1, precioUnitario: 18000, total: 18000 },
      ],
      metodoPago: 'card',
      observaciones: 'Cliente atendida sin incidencias. Acepto retail.',
    },
    {
      clienteNombre: 'Daniela Ruiz',
      personalNombre: 'Colorista Senior',
      fecha: obtenerFechaDemoRelativa(-1, zonaHoraria),
      horaInicio: '12:30',
      estado: 'completed',
      servicios: ['Color Balance', 'Blow Dry Finish'],
      productosAdicionales: [],
      metodoPago: 'digital_transfer',
      observaciones: 'Servicio premium con upsell de seguimiento.',
    },
    {
      clienteNombre: 'Fernanda Cruz',
      personalNombre: NOMBRE_EMPLEADO_DEMO,
      fecha: obtenerFechaDemoRelativa(0, zonaHoraria),
      horaInicio: '11:30',
      estado: 'confirmed',
      servicios: ['Gel Manicure Pro'],
      productosAdicionales: [],
      metodoPago: 'cash',
      observaciones: 'Reservacion confirmada desde admin demo.',
    },
    {
      clienteNombre: 'Mariana Solis',
      personalNombre: 'Lash Artist Pro',
      fecha: obtenerFechaDemoRelativa(1, zonaHoraria),
      horaInicio: '17:00',
      estado: 'pending',
      servicios: ['Lash Lifting Premium'],
      productosAdicionales: [],
      metodoPago: 'bank_transfer',
      observaciones: 'Pendiente de anticipo.',
    },
    {
      clienteNombre: 'Regina Vega',
      personalNombre: 'Colorista Senior',
      fecha: obtenerFechaDemoRelativa(-3, zonaHoraria),
      horaInicio: '16:00',
      estado: 'no_show',
      servicios: ['Blow Dry Finish'],
      productosAdicionales: [],
      metodoPago: 'card',
      observaciones: 'No show registrado para demo de seguimiento.',
    },
  ] as const;

  for (const reserva of reservasDemo) {
    const clienteId = clientesPorNombre.get(reserva.clienteNombre);
    const personalId = personalPorNombre.get(reserva.personalNombre);
    const clienteBase = CLIENTES_DEMO.find((cliente) => cliente.nombre === reserva.clienteNombre);
    const serviciosResumen = construirResumenServiciosDemo(reserva.servicios);
    const precioTotal = serviciosResumen.reduce((total, servicio) => total + servicio.price, 0);

    if (!clienteId || !personalId || !clienteBase) {
      continue;
    }

    const reservaCreada = await prisma.reserva.create({
      data: {
        estudioId: params.estudioId,
        personalId,
        clienteId,
        nombreCliente: clienteBase.nombre,
        telefonoCliente: clienteBase.telefono,
        fecha: reserva.fecha,
        horaInicio: reserva.horaInicio,
        duracion: serviciosResumen.reduce((total, servicio) => total + servicio.duration, 0),
        servicios: serviciosResumen,
        precioTotal,
        estado: reserva.estado,
        sucursal: 'Cabina principal',
        observaciones: reserva.observaciones,
        metodoPago: reserva.metodoPago,
        productosAdicionales: reserva.productosAdicionales,
      },
      select: { id: true },
    });

    await prisma.reservaServicio.createMany({
      data: serviciosResumen.map((servicio, indice) => ({
        reservaId: reservaCreada.id,
        nombre: servicio.name,
        duracion: servicio.duration,
        precio: servicio.price,
        categoria:
          SERVICIOS_CUSTOM_DEMO.find((servicioCustom) => servicioCustom.name === servicio.name)
            ?.category ?? null,
        orden: indice,
        estado: reserva.estado,
      })),
    });
  }
}

function obtenerFechasDemo() {
  const ahora = new Date();
  const zonaHoraria = obtenerZonaHorariaPorPais(PAIS_DEMO);
  const inicioSuscripcion = obtenerFechaISOEnZona(ahora, zonaHoraria, PAIS_DEMO);
  const vencimiento = new Date(ahora);
  vencimiento.setMonth(vencimiento.getMonth() + 1);

  return {
    inicioSuscripcion,
    fechaVencimiento: obtenerFechaISOEnZona(vencimiento, zonaHoraria, PAIS_DEMO),
    zonaHoraria,
  };
}

export async function asegurarSalonDemoVendedor(params: {
  usuarioId: string;
  nombre: string;
  email: string;
}) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: params.usuarioId },
    select: {
      id: true,
      estudioId: true,
      estudio: {
        select: {
          id: true,
          slug: true,
          nombre: true,
          claveCliente: true,
        },
      },
    },
  });

  if (usuario?.estudio) {
    await asegurarEstructuraDemoVendedor({
      usuarioId: params.usuarioId,
      estudioId: usuario.estudio.id,
      nombreUsuario: params.nombre,
      emailBase: params.email,
    });
    await asegurarContenidoDemoVendedor({
      estudioId: usuario.estudio.id,
      nombreUsuario: params.nombre,
      emailBase: params.email,
    });

    return {
      id: usuario.estudio.id,
      slug: usuario.estudio.slug,
      nombre: usuario.estudio.nombre,
      claveCliente: usuario.estudio.claveCliente,
    };
  }

  const nombreSalon = construirNombreSalonDemo(params.nombre);
  const { claveDueno, claveCliente } = await generarClavesSalonUnicas(nombreSalon);
  const slug = await generarSlugUnico(nombreSalon);
  const { inicioSuscripcion, fechaVencimiento, zonaHoraria } = obtenerFechasDemo();

  const estudio = await prisma.estudio.create({
    data: {
      nombre: nombreSalon,
      propietario: params.nombre.trim() || 'Vendedor',
      telefono: TELEFONO_DEMO,
      pais: PAIS_DEMO,
      zonaHoraria,
      sucursales: [nombreSalon],
      claveDueno,
      claveCliente,
      slug,
      activo: true,
      plan: 'PRO',
      estado: 'aprobado',
      fechaAprobacion: new Date(),
      suscripcion: 'mensual',
      inicioSuscripcion,
      fechaVencimiento,
      horario: crearHorarioDemo(),
      servicios: [],
      serviciosCustom: [],
      festivos: [],
      descripcion: DESCRIPCION_DEMO,
      emailContacto: params.email,
      horarioApertura: '09:00',
      horarioCierre: '19:00',
      diasAtencion: 'lunes,martes,miercoles,jueves,viernes,sabado',
      numeroEspecialistas: 1,
      primeraVez: false,
    },
    select: {
      id: true,
      slug: true,
      nombre: true,
      claveCliente: true,
    },
  });

  await asegurarCamposComisionVendedorUsuario();
  await prisma.usuario.update({
    where: { id: params.usuarioId },
    data: { estudioId: estudio.id },
    select: { id: true },
  });

  await asegurarEstructuraDemoVendedor({
    usuarioId: params.usuarioId,
    estudioId: estudio.id,
    nombreUsuario: params.nombre,
    emailBase: params.email,
  });
  await asegurarContenidoDemoVendedor({
    estudioId: estudio.id,
    nombreUsuario: params.nombre,
    emailBase: params.email,
  });

  return estudio;
}

export async function obtenerSalonDemoVendedor(usuarioId: string) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      nombre: true,
      email: true,
      estudioId: true,
    },
  });

  if (usuario?.estudioId) {
    await asegurarEstructuraDemoVendedor({
      usuarioId,
      estudioId: usuario.estudioId,
      nombreUsuario: usuario.nombre,
      emailBase: usuario.email,
    });
    await asegurarContenidoDemoVendedor({
      estudioId: usuario.estudioId,
      nombreUsuario: usuario.nombre,
      emailBase: usuario.email,
    });
  }

  if (!usuario?.estudioId) {
    return null;
  }

  return prisma.estudio.findUnique({
    where: { id: usuario.estudioId },
    select: {
      id: true,
      slug: true,
      nombre: true,
      claveCliente: true,
      plan: true,
      estado: true,
      activo: true,
      fechaVencimiento: true,
      actualizadoEn: true,
      _count: {
        select: {
          reservas: true,
          pagos: true,
          clientes: true,
          personal: true,
          productos: true,
        },
      },
    },
  });
}

export async function reiniciarSalonDemoVendedor(usuarioId: string) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: {
      id: true,
      nombre: true,
      email: true,
      estudioId: true,
    },
  });

  if (!usuario?.estudioId) {
    return null;
  }

  const estudioId = usuario.estudioId;

  const nombreSalon = construirNombreSalonDemo(usuario.nombre);
  const { inicioSuscripcion, fechaVencimiento, zonaHoraria } = obtenerFechasDemo();

  const personal = await prisma.personal.findMany({
    where: { estudioId },
    select: { id: true },
  });
  const reservas = await prisma.reserva.findMany({
    where: { estudioId },
    select: { id: true },
  });
  const usuariosAsociados = await prisma.usuario.findMany({
    where: { estudioId, id: { not: usuario.id } },
    select: { id: true },
  });

  const personalIds = personal.map((item) => item.id);
  const reservaIds = reservas.map((item) => item.id);
  const usuarioIds = usuariosAsociados.map((item) => item.id);

  await prisma.$transaction(async (transaccion) => {
    if (usuarioIds.length > 0) {
      await transaccion.suscripcionPush.deleteMany({ where: { usuarioId: { in: usuarioIds } } });
      await transaccion.tokenReset.deleteMany({ where: { usuarioId: { in: usuarioIds } } });
      await transaccion.permisosMaestro.deleteMany({ where: { usuarioId: { in: usuarioIds } } });
      await transaccion.permisosSupervisor.deleteMany({ where: { usuarioId: { in: usuarioIds } } });
    }

    if (reservaIds.length > 0) {
      await transaccion.reservaServicio.deleteMany({ where: { reservaId: { in: reservaIds } } });
      await transaccion.reserva.updateMany({
        where: { estudioId, reservaOriginalId: { not: null } },
        data: { reservaOriginalId: null },
      });
    }

    if (personalIds.length > 0) {
      await transaccion.empleadoAcceso.deleteMany({ where: { personalId: { in: personalIds } } });
    }

    await transaccion.notificacionEstudio.deleteMany({ where: { estudioId } });
    await transaccion.mensajeMasivo.deleteMany({ where: { estudioId } });
    await transaccion.producto.deleteMany({ where: { estudioId } });
    await transaccion.puntosFidelidad.deleteMany({ where: { estudioId } });
    await transaccion.configFidelidad.deleteMany({ where: { estudioId } });
    await transaccion.diaFestivo.deleteMany({ where: { estudioId } });
    // Mantener este orden evita violaciones de FK (reservas/pagos dependen de cliente/personal).
    await transaccion.reserva.deleteMany({ where: { estudioId } });
    await transaccion.pago.deleteMany({ where: { estudioId } });
    await transaccion.cliente.deleteMany({ where: { estudioId } });
    await transaccion.personal.deleteMany({ where: { estudioId } });

    if (usuarioIds.length > 0) {
      await transaccion.usuario.deleteMany({
        where: {
          estudioId,
          id: { in: usuarioIds },
        },
      });
    }

    await transaccion.estudio.update({
      where: { id: estudioId },
      data: {
        nombre: nombreSalon,
        propietario: usuario.nombre.trim() || 'Vendedor',
        telefono: TELEFONO_DEMO,
        pais: PAIS_DEMO,
        zonaHoraria,
        sucursales: [nombreSalon],
        activo: true,
        plan: 'PRO',
        estado: 'aprobado',
        motivoRechazo: null,
        motivoBloqueo: null,
        fechaAprobacion: new Date(),
        fechaSuspension: null,
        fechaBloqueo: null,
        suscripcion: 'mensual',
        inicioSuscripcion,
        fechaVencimiento,
        horario: crearHorarioDemo(),
        servicios: [],
        serviciosCustom: [],
        festivos: [],
        colorPrimario: '#C2185B',
        logoUrl: null,
        descripcion: DESCRIPCION_DEMO,
        direccion: null,
        emailContacto: usuario.email,
        horarioApertura: '09:00',
        horarioCierre: '19:00',
        diasAtencion: 'lunes,martes,miercoles,jueves,viernes,sabado',
        numeroEspecialistas: 1,
        categorias: null,
        primeraVez: false,
        cancelacionSolicitada: false,
        fechaSolicitudCancelacion: null,
        motivoCancelacion: null,
        mensajesMasivosUsados: 0,
        mensajesMasivosExtra: 0,
      },
    });
  });

  await asegurarEstructuraDemoVendedor({
    usuarioId: usuario.id,
    estudioId,
    nombreUsuario: usuario.nombre,
    emailBase: usuario.email,
  });
  await asegurarContenidoDemoVendedor({
    estudioId,
    nombreUsuario: usuario.nombre,
    emailBase: usuario.email,
  });

  return obtenerSalonDemoVendedor(usuarioId);
}

export async function actualizarPlanSalonDemoVendedor(usuarioId: string, plan: 'STANDARD' | 'PRO') {
  const usuario = await prisma.usuario.findUnique({
    where: { id: usuarioId },
    select: { estudioId: true },
  });

  if (!usuario?.estudioId) {
    return null;
  }

  await prisma.estudio.update({
    where: { id: usuario.estudioId },
    data: { plan },
    select: { id: true },
  });

  return obtenerSalonDemoVendedor(usuarioId);
}