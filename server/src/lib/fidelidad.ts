import { Prisma } from '../generated/prisma/client.js';
import type { PrismaClient } from '../generated/prisma/client.js';
import { obtenerColumnasTabla } from './compatibilidadEsquema.js';
import { prisma } from '../prismaCliente.js';
import { normalizarPlanEstudio } from './planes.js';

type ClientePrismaTransaccional = Prisma.TransactionClient;

type ClientePrismaDisponible = PrismaClient | ClientePrismaTransaccional;

interface PuntosFidelidadBloqueados {
  id: string;
  visitasAcumuladas: number;
  visitasUsadas: number;
  recompensasGanadas: number;
  recompensasUsadas: number;
}

function obtenerClientePrisma(tx?: ClientePrismaTransaccional): ClientePrismaDisponible {
  return tx ?? prisma;
}

async function ejecutarOperacionFidelidad<T>(
  operacion: (tx: ClientePrismaTransaccional) => Promise<T>,
  tx?: ClientePrismaTransaccional,
): Promise<T> {
  if (tx) {
    return operacion(tx);
  }

  return prisma.$transaction(async (nuevoTx) => operacion(nuevoTx));
}

async function bloquearPuntosFidelidad(
  cliente: ClientePrismaTransaccional,
  clienteId: string,
  estudioId: string,
): Promise<PuntosFidelidadBloqueados> {
  await cliente.puntosFidelidad.upsert({
    where: { clienteId_estudioId: { clienteId, estudioId } },
    update: {},
    create: {
      clienteId,
      estudioId,
      visitasAcumuladas: 0,
      visitasUsadas: 0,
      recompensasGanadas: 0,
      recompensasUsadas: 0,
    },
  });

  const filas = await cliente.$queryRaw<PuntosFidelidadBloqueados[]>(Prisma.sql`
    SELECT
      id,
      visitasAcumuladas,
      visitasUsadas,
      recompensasGanadas,
      recompensasUsadas
    FROM puntos_fidelidad
    WHERE clienteId = ${clienteId} AND estudioId = ${estudioId}
    FOR UPDATE
  `);

  const puntos = filas[0];
  if (!puntos) {
    throw new Error('No se pudo bloquear el registro de fidelidad');
  }

  return puntos;
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
    porcentajeDescuento: 10,
    descripcionRecompensa: 'Servicio gratis en tu próxima visita',
  };
}

export async function obtenerConfigFidelidad(
  estudioId: string,
  tx?: ClientePrismaTransaccional,
): Promise<ConfigFidelidadPorDefecto> {
  const cliente = obtenerClientePrisma(tx);
  const columnasEstudios = await obtenerColumnasTabla('estudios');
  if (!columnasEstudios.has('plan')) {
    return configFidelidadPorDefecto(estudioId);
  }

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
  return ejecutarOperacionFidelidad(async (cliente) => {
    const config = await obtenerConfigFidelidad(estudioId, cliente);
    if (!config.activo) {
      return { recompensaGanada: false, descripcion: null };
    }

    const puntos = await bloquearPuntosFidelidad(cliente, clienteId, estudioId);
    const visitasAcumuladasActualizadas = puntos.visitasAcumuladas + 1;
    const visitasDisponibles = visitasAcumuladasActualizadas - puntos.visitasUsadas;

    await cliente.puntosFidelidad.update({
      where: { id: puntos.id },
      data: {
        visitasAcumuladas: visitasAcumuladasActualizadas,
        ultimaVisita: new Date(),
        ...(visitasDisponibles >= config.visitasRequeridas
          ? {
              visitasUsadas: { increment: config.visitasRequeridas },
              recompensasGanadas: { increment: 1 },
            }
          : {}),
      },
    });

    if (visitasDisponibles < config.visitasRequeridas) {
      return { recompensaGanada: false, descripcion: null };
    }

    return {
      recompensaGanada: true,
      descripcion: config.descripcionRecompensa,
    };
  }, tx);
}

export async function canjearRecompensaFidelidad(
  clienteId: string,
  estudioId: string,
  tx?: ClientePrismaTransaccional,
): Promise<{
  descripcion: string;
}> {
  return ejecutarOperacionFidelidad(async (cliente) => {
    const config = await obtenerConfigFidelidad(estudioId, cliente);
    const puntos = await bloquearPuntosFidelidad(cliente, clienteId, estudioId);

    if (calcularRecompensasDisponibles(puntos) < 1) {
      throw new Error('El cliente no tiene recompensas disponibles');
    }

    await cliente.puntosFidelidad.update({
      where: { id: puntos.id },
      data: { recompensasUsadas: { increment: 1 } },
    });

    return { descripcion: config.descripcionRecompensa };
  }, tx);
}

/**
 * Revierte una visita de fidelidad cuando se cancela una reserva 'confirmed'.
 * Decrementa visitasAcumuladas y ajusta recompensasGanadas si el conteo
 * de visitas ya no alcanza para sostenerlas.
 */
export async function revertirVisitaFidelidad(
  clienteId: string,
  estudioId: string,
  tx?: ClientePrismaTransaccional,
): Promise<void> {
  await ejecutarOperacionFidelidad(async (cliente) => {
    const config = await obtenerConfigFidelidad(estudioId, cliente);
    if (!config.activo) return;

    const puntos = await bloquearPuntosFidelidad(cliente, clienteId, estudioId);
    if (puntos.visitasAcumuladas <= 0) return;

    const visitasNuevas = puntos.visitasAcumuladas - 1;
    const maxRecompensas = Math.floor(visitasNuevas / config.visitasRequeridas);
    const recompensasNuevas = Math.min(puntos.recompensasGanadas, maxRecompensas);

    await cliente.puntosFidelidad.update({
      where: { id: puntos.id },
      data: {
        visitasAcumuladas: visitasNuevas,
        recompensasGanadas: recompensasNuevas,
        visitasUsadas: Math.min(puntos.visitasUsadas, visitasNuevas),
      },
    });
  }, tx);
}
