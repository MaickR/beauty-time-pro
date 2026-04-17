import { prisma } from '../src/prismaCliente.js';

const ESTUDIOS_OBJETIVO = [
  'cmnuhs59000006gwj2v5juctg',
  '893cd6e7-c208-4382-b6c1-9134e4f067a9',
] as const;

async function asegurarHistorialClienteQa() {
  const clienteApp = await prisma.clienteApp.findUnique({
    where: { email: 'qa.cliente@salonpromaster.com' },
    select: {
      id: true,
      email: true,
      nombre: true,
      apellido: true,
      telefono: true,
      fechaNacimiento: true,
    },
  });

  if (!clienteApp?.telefono) {
    throw new Error('Cliente QA sin telefono para sembrar historial.');
  }

  const nombreCliente = `${clienteApp.nombre} ${clienteApp.apellido}`.trim();
  const fechaNacimiento = clienteApp.fechaNacimiento ?? new Date('1992-08-20T00:00:00.000Z');
  const creadas: Array<{
    id: string;
    estudio: string;
    fecha: string;
    horaInicio: string;
    reutilizada: boolean;
  }> = [];

  for (const [indice, estudioId] of ESTUDIOS_OBJETIVO.entries()) {
    const estudio = await prisma.estudio.findUnique({
      where: { id: estudioId },
      select: {
        id: true,
        nombre: true,
        direccion: true,
        servicios: true,
        personal: {
          where: { activo: true },
          select: { id: true, nombre: true },
          take: 1,
        },
      },
    });

    if (!estudio) {
      continue;
    }

    const servicio = Array.isArray(estudio.servicios) ? estudio.servicios[0] : null;
    const empleado = estudio.personal[0] ?? null;

    if (!servicio || !empleado) {
      continue;
    }

    const clienteInterno = await prisma.cliente.upsert({
      where: {
        estudioId_telefono: {
          estudioId: estudio.id,
          telefono: clienteApp.telefono,
        },
      },
      update: {
        nombre: nombreCliente,
        email: clienteApp.email,
        fechaNacimiento,
      },
      create: {
        estudioId: estudio.id,
        nombre: nombreCliente,
        telefono: clienteApp.telefono,
        email: clienteApp.email,
        fechaNacimiento,
      },
    });

    const fecha = indice === 0 ? '2026-04-10' : '2026-04-11';
    const horaInicio = indice === 0 ? '11:00' : '15:00';

    const existente = await prisma.reserva.findFirst({
      where: {
        clienteAppId: clienteApp.id,
        estudioId: estudio.id,
        fecha,
        horaInicio,
      },
      select: { id: true },
    });

    if (existente) {
      await prisma.reserva.update({
        where: { id: existente.id },
        data: {
          estado: 'completed',
          clienteId: clienteInterno.id,
          personalId: empleado.id,
          nombreCliente,
          telefonoCliente: clienteApp.telefono,
          sucursal: estudio.direccion ?? 'Principal',
          precioTotal: Number(servicio.price ?? 0),
          duracion: Number(servicio.duration ?? 0),
          servicios: [servicio],
          metodoPago: 'cash',
        },
      });

      await prisma.reservaServicio.updateMany({
        where: { reservaId: existente.id },
        data: { estado: 'completed' },
      });

      creadas.push({
        id: existente.id,
        estudio: estudio.nombre,
        fecha,
        horaInicio,
        reutilizada: true,
      });
      continue;
    }

    const reserva = await prisma.reserva.create({
      data: {
        estudioId: estudio.id,
        personalId: empleado.id,
        clienteId: clienteInterno.id,
        clienteAppId: clienteApp.id,
        nombreCliente,
        telefonoCliente: clienteApp.telefono,
        fecha,
        horaInicio,
        duracion: Number(servicio.duration ?? 0),
        servicios: [servicio],
        precioTotal: Number(servicio.price ?? 0),
        estado: 'completed',
        sucursal: estudio.direccion ?? 'Principal',
        metodoPago: 'cash',
        serviciosDetalle: {
          create: [
            {
              nombre: String(servicio.name ?? 'Servicio QA'),
              duracion: Number(servicio.duration ?? 0),
              precio: Number(servicio.price ?? 0),
              categoria: typeof servicio.category === 'string' ? servicio.category : null,
              orden: 0,
              estado: 'completed',
            },
          ],
        },
      },
    });

    creadas.push({
      id: reserva.id,
      estudio: estudio.nombre,
      fecha,
      horaInicio,
      reutilizada: false,
    });
  }

  console.log(JSON.stringify({ creadas }, null, 2));
}

asegurarHistorialClienteQa()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
