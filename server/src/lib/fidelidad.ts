import { prisma } from '../prismaCliente.js';

export interface ConfigFidelidadPorDefecto {
  id: string | null;
  estudioId: string;
  activo: boolean;
  visitasRequeridas: number;
  tipoRecompensa: string;
  porcentajeDescuento: number | null;
  descripcionRecompensa: string;
}

export function configFidelidadPorDefecto(estudioId: string): ConfigFidelidadPorDefecto {
  return {
    id: null,
    estudioId,
    activo: false,
    visitasRequeridas: 5,
    tipoRecompensa: 'descuento',
    porcentajeDescuento: 100,
    descripcionRecompensa: 'Servicio gratis en tu próxima visita',
  };
}

export async function obtenerConfigFidelidad(estudioId: string): Promise<ConfigFidelidadPorDefecto> {
  const config = await prisma.configFidelidad.findUnique({ where: { estudioId } });
  return config ?? configFidelidadPorDefecto(estudioId);
}

export function calcularRecompensasDisponibles(puntos: {
  recompensasGanadas: number;
  recompensasUsadas: number;
}): number {
  return Math.max(0, puntos.recompensasGanadas - puntos.recompensasUsadas);
}

export async function registrarVisitaFidelidad(clienteId: string, estudioId: string): Promise<{
  recompensaGanada: boolean;
  descripcion: string | null;
}> {
  const config = await obtenerConfigFidelidad(estudioId);
  if (!config.activo) {
    return { recompensaGanada: false, descripcion: null };
  }

  const puntos = await prisma.puntosFidelidad.upsert({
    where: { clienteId_estudioId: { clienteId, estudioId } },
    update: {
      visitasAcumuladas: { increment: 1 },
      ultimaVisita: new Date(),
    },
    create: {
      clienteId,
      estudioId,
      visitasAcumuladas: 1,
      ultimaVisita: new Date(),
    },
  });

  const visitasDisponibles = puntos.visitasAcumuladas - puntos.visitasUsadas;
  if (visitasDisponibles < config.visitasRequeridas) {
    return { recompensaGanada: false, descripcion: null };
  }

  await prisma.puntosFidelidad.update({
    where: { id: puntos.id },
    data: {
      visitasUsadas: { increment: config.visitasRequeridas },
      recompensasGanadas: { increment: 1 },
    },
  });

  return {
    recompensaGanada: true,
    descripcion: config.descripcionRecompensa,
  };
}

export async function canjearRecompensaFidelidad(clienteId: string, estudioId: string): Promise<{
  descripcion: string;
}> {
  const config = await obtenerConfigFidelidad(estudioId);
  const puntos = await prisma.puntosFidelidad.findUnique({
    where: { clienteId_estudioId: { clienteId, estudioId } },
  });

  if (!puntos || calcularRecompensasDisponibles(puntos) < 1) {
    throw new Error('El cliente no tiene recompensas disponibles');
  }

  await prisma.puntosFidelidad.update({
    where: { id: puntos.id },
    data: { recompensasUsadas: { increment: 1 } },
  });

  return { descripcion: config.descripcionRecompensa };
}