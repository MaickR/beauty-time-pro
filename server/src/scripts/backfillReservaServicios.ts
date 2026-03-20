import crypto from 'crypto';
import 'dotenv/config';
import { createRequire } from 'module';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { normalizarServiciosEntrada } from '../lib/serializacionReservas.js';

const require = createRequire(import.meta.url);
const { PrismaClient } = require('../generated/prisma/client.js') as {
  PrismaClient: new (opciones: { adapter: PrismaMariaDb }) => {
    reserva: {
      findMany: (args: unknown) => Promise<Array<{ id: string; servicios: unknown; estado: string }>>;
    };
    reservaServicio: {
      createMany: (args: unknown) => Promise<unknown>;
    };
    $disconnect: () => Promise<void>;
  };
};

const urlBaseDatos = new URL(process.env.DATABASE_URL ?? 'mysql://root:1234@localhost:3306/beauty_time_pro');

const adaptador = new PrismaMariaDb({
  host: urlBaseDatos.hostname,
  port: Number(urlBaseDatos.port || '3306'),
  user: decodeURIComponent(urlBaseDatos.username),
  password: decodeURIComponent(urlBaseDatos.password),
  database: urlBaseDatos.pathname.replace(/^\//, ''),
});

const prisma = new PrismaClient({ adapter: adaptador });

async function ejecutar(): Promise<void> {
  const reservas = await prisma.reserva.findMany({
    where: {
      serviciosDetalle: { none: {} },
    },
    select: {
      id: true,
      servicios: true,
      estado: true,
    },
  });

  const filas = reservas.flatMap((reserva) => {
    const servicios = normalizarServiciosEntrada(reserva.servicios);

    return servicios.map((servicio, indice) => ({
      id: crypto.randomUUID(),
      reservaId: reserva.id,
      nombre: servicio.name,
      duracion: servicio.duration,
      precio: servicio.price,
      categoria: servicio.category ?? null,
      orden: servicio.order ?? indice,
      estado: servicio.status ?? reserva.estado,
    }));
  });

  if (filas.length === 0) {
    console.log('No hay reservas pendientes por backfill.');
    return;
  }

  await prisma.reservaServicio.createMany({
    data: filas,
  });

  console.log(`Backfill completado. Servicios creados: ${filas.length}.`);
}

void ejecutar()
  .catch((error) => {
    console.error('Error ejecutando backfill de reserva_servicios:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
