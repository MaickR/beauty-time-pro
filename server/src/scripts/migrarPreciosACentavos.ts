import 'dotenv/config';
import { prisma } from '../prismaCliente.js';
import { convertirMonedaACentavos, normalizarNumeroMoneda } from '../utils/moneda.js';

const argumentos = new Set(process.argv.slice(2));
const incluirEstudios = argumentos.has('--incluir-estudios');

function mapearServiciosACentavos(servicios: unknown): { valor: unknown; cambios: boolean } {
  if (!Array.isArray(servicios)) {
    return { valor: servicios, cambios: false };
  }

  let cambios = false;
  const valor = servicios.map((servicio) => {
    if (!servicio || typeof servicio !== 'object' || Array.isArray(servicio)) {
      return servicio;
    }

    const servicioActual = servicio as Record<string, unknown>;
    const precioActual = normalizarNumeroMoneda(servicioActual.price ?? servicioActual.precio);
    const precioCentavos = convertirMonedaACentavos(precioActual);

    if (precioCentavos === precioActual) {
      return servicio;
    }

    cambios = true;
    return {
      ...servicioActual,
      ...(servicioActual.price !== undefined ? { price: precioCentavos } : {}),
      ...(servicioActual.precio !== undefined ? { precio: precioCentavos } : {}),
    };
  });

  return { valor, cambios };
}

function sumarPreciosServicios(servicios: unknown): number | null {
  if (!Array.isArray(servicios)) {
    return null;
  }

  return servicios.reduce<number>((acumulado, servicio) => {
    if (!servicio || typeof servicio !== 'object' || Array.isArray(servicio)) {
      return acumulado;
    }

    const servicioActual = servicio as Record<string, unknown>;
    return acumulado + normalizarNumeroMoneda(servicioActual.price ?? servicioActual.precio);
  }, 0);
}

function reservaRequiereMigracion(servicios: unknown, totalCentavos: number, totalDetalleCentavos: number): boolean {
  const totalServicios = sumarPreciosServicios(servicios);
  if (totalServicios === null) {
    return false;
  }

  if (Math.round(totalServicios) === totalCentavos || Math.round(totalServicios) === totalDetalleCentavos) {
    return false;
  }

  if (Math.round(totalServicios * 100) === totalCentavos || Math.round(totalServicios * 100) === totalDetalleCentavos) {
    return true;
  }

  return totalServicios % 1 !== 0;
}

async function ejecutar(): Promise<void> {
  const [estudios, reservas] = await Promise.all([
    incluirEstudios
      ? prisma.estudio.findMany({
          select: { id: true, servicios: true },
        })
      : Promise.resolve([]),
    prisma.reserva.findMany({
      select: {
        id: true,
        servicios: true,
        precioTotal: true,
        serviciosDetalle: {
          select: { precio: true },
        },
      },
    }),
  ]);

  let estudiosActualizados = 0;
  let reservasActualizadas = 0;

  for (const estudio of estudios) {
    const servicios = mapearServiciosACentavos(estudio.servicios);
    if (!servicios.cambios) continue;

    await prisma.estudio.update({
      where: { id: estudio.id },
      data: { servicios: servicios.valor as never },
    });
    estudiosActualizados += 1;
  }

  for (const reserva of reservas) {
    const totalDetalleCentavos = reserva.serviciosDetalle.reduce((acumulado, servicio) => acumulado + servicio.precio, 0);
    const requiereMigracion = reservaRequiereMigracion(reserva.servicios, reserva.precioTotal, totalDetalleCentavos);
    if (!requiereMigracion) continue;

    const servicios = mapearServiciosACentavos(reserva.servicios);
    if (!servicios.cambios) continue;

    await prisma.reserva.update({
      where: { id: reserva.id },
      data: { servicios: servicios.valor as never },
    });
    reservasActualizadas += 1;
  }

  console.log(
    JSON.stringify(
      {
        estudiosRevisados: incluirEstudios ? estudios.length : 0,
        estudiosActualizados,
        reservasRevisadas: reservas.length,
        reservasActualizadas,
        estudiosIncluidos: incluirEstudios,
      },
      null,
      2,
    ),
  );
}

void ejecutar()
  .catch((error) => {
    console.error('Error migrando precios a centavos:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });