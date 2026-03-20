import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { prisma } from '../prismaCliente.js';
import { normalizarPlanEstudio } from './planes.js';

type ClientePrismaTransaccional = Prisma.TransactionClient;

type ClientePrismaDisponible = PrismaClient | ClientePrismaTransaccional;

function obtenerClientePrisma(tx?: ClientePrismaTransaccional): ClientePrismaDisponible {
  return tx ?? prisma;
}

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

export async function obtenerConfigFidelidad(
  estudioId: string,
  tx?: ClientePrismaTransaccional,
): Promise<ConfigFidelidadPorDefecto> {
  const cliente = obtenerClientePrisma(tx);
  const estudio = await cliente.estudio.findUnique({
    where: { id: estudioId },
    select: { plan: true },
  });
  if (!estudio || normalizarPlanEstudio(estudio.plan) !== 'PRO') {
    return configFidelidadPorDefecto(estudioId);
  }

  const config = await cliente.configFidelidad.findUnique({ where: { estudioId } });
  return config ?? configFidelidadPorDefecto(estudioId);
}

export function calcularRecompensasDisponibles(puntos: {
  recompensasGanadas: number;
  recompensasUsadas: number;
}): number {
  return Math.max(0, puntos.recompensasGanadas - puntos.recompensasUsadas);
}

export async function registrarVisitaFidelidad(
  clienteId: string,
  estudioId: string,
  tx?: ClientePrismaTransaccional,
): Promise<{
  recompensaGanada: boolean;
  descripcion: string | null;
}> {
  const cliente = obtenerClientePrisma(tx);
  const config = await obtenerConfigFidelidad(estudioId, tx);
  if (!config.activo) {
    return { recompensaGanada: false, descripcion: null };
  }

  const puntos = await cliente.puntosFidelidad.upsert({
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

  await cliente.puntosFidelidad.update({
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

export async function canjearRecompensaFidelidad(
  clienteId: string,
  estudioId: string,
  tx?: ClientePrismaTransaccional,
): Promise<{
  descripcion: string;
}> {
  const cliente = obtenerClientePrisma(tx);
  const config = await obtenerConfigFidelidad(estudioId, tx);
  const puntos = await cliente.puntosFidelidad.findUnique({
    where: { clienteId_estudioId: { clienteId, estudioId } },
  });

  if (!puntos || calcularRecompensasDisponibles(puntos) < 1) {
    throw new Error('El cliente no tiene recompensas disponibles');
  }

  await cliente.puntosFidelidad.update({
    where: { id: puntos.id },
    data: { recompensasUsadas: { increment: 1 } },
  });

  return { descripcion: config.descripcionRecompensa };
}

/**
 * Revierte una visita de fidelidad cuando se cancela una reserva 'confirmed'.
 * Decrementa visitasAcumuladas y ajusta recompensasGanadas si el conteo
 * de visitas ya no alcanza para sostenerlas.
 */
export async function revertirVisitaFidelidad(clienteId: string, estudioId: string): Promise<void> {
  const config = await obtenerConfigFidelidad(estudioId);
  if (!config.activo) return;

  const puntos = await prisma.puntosFidelidad.findUnique({
    where: { clienteId_estudioId: { clienteId, estudioId } },
  });
  if (!puntos || puntos.visitasAcumuladas <= 0) return;

  const visitasNuevas = puntos.visitasAcumuladas - 1;
  // Máximo de recompensas alcanzables con visitasNuevas
  const maxRecompensas = Math.floor(visitasNuevas / config.visitasRequeridas);
  const recompensasNuevas = Math.min(puntos.recompensasGanadas, maxRecompensas);

  await prisma.puntosFidelidad.update({
    where: { id: puntos.id },
    data: {
      visitasAcumuladas: visitasNuevas,
      recompensasGanadas: recompensasNuevas,
      // visitasUsadas no puede superar las visitas acumuladas nuevas
      visitasUsadas: Math.min(puntos.visitasUsadas, visitasNuevas),
    },
  });
}
