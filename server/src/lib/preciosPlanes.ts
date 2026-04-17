import type { PlanEstudio, PrecioPlan, Prisma } from '../generated/prisma/client.js';
import { prisma } from '../prismaCliente.js';

export type PaisPrecio = 'Mexico' | 'Colombia';
export type MonedaPrecio = 'MXN' | 'COP';

interface PrecioPlanLigero {
  id: string;
  plan: PlanEstudio;
  pais: string;
  moneda: string;
  monto: number;
  version: number;
  vigenteDesde: Date;
}

interface EstudioConPrecioAsignado {
  id: string;
  nombre: string;
  propietario: string;
  pais: string;
  plan: PlanEstudio;
  activo: boolean;
  estado: string;
  fechaVencimiento: string;
  emailContacto: string | null;
  precioPlanActualId: string | null;
  precioPlanProximoId: string | null;
  fechaAplicacionPrecioProximo: string | null;
  precioPlanActual?: PrecioPlanLigero | null;
  precioPlanProximo?: PrecioPlanLigero | null;
}

interface ResumenPaisActivo {
  total: number;
  moneda: MonedaPrecio;
  totalSuscripciones: number;
  desglose: {
    pro: { salones: number; monto: number };
    standard: { salones: number; monto: number };
  };
}

export interface ResumenSuscripcionesActivas {
  totalSuscripcionesActivas: number;
  totalActivasStandard: number;
  totalActivasPro: number;
  porPais: Record<PaisPrecio, ResumenPaisActivo>;
}

export interface PrecioPlanActualDTO {
  id: string;
  plan: PlanEstudio;
  pais: PaisPrecio;
  moneda: MonedaPrecio;
  monto: number;
  version: number;
  vigenteDesde: string;
  creadoEn: string;
}

export interface ResultadoPrecioRenovacion {
  precioAplicado: PrecioPlanLigero | null;
  precioActual: PrecioPlanLigero | null;
  precioProximo: PrecioPlanLigero | null;
  cambiaEnRenovacion: boolean;
}

function obtenerHoyISO() {
  return new Date().toISOString().split('T')[0]!;
}

export function normalizarPaisPrecio(pais?: string | null): PaisPrecio {
  return pais === 'Colombia' ? 'Colombia' : 'Mexico';
}

export function obtenerMonedaPrecio(pais?: string | null): MonedaPrecio {
  return normalizarPaisPrecio(pais) === 'Colombia' ? 'COP' : 'MXN';
}

function crearClavePrecio(plan: PlanEstudio, pais: string) {
  return `${plan}:${normalizarPaisPrecio(pais)}`;
}

export function esSuscripcionActiva(estudio: Pick<EstudioConPrecioAsignado, 'activo' | 'estado' | 'fechaVencimiento'>, hoy = obtenerHoyISO()) {
  return estudio.activo && estudio.estado === 'aprobado' && estudio.fechaVencimiento >= hoy;
}

export function resolverPrecioRenovacion(estudio: Pick<EstudioConPrecioAsignado, 'fechaVencimiento' | 'fechaAplicacionPrecioProximo' | 'precioPlanActual' | 'precioPlanProximo'>, fechaBaseRenovacion: string): ResultadoPrecioRenovacion {
  const precioActual = estudio.precioPlanActual ?? null;
  const precioProximo = estudio.precioPlanProximo ?? null;
  const fechaCambio = estudio.fechaAplicacionPrecioProximo;
  const cambiaEnRenovacion = Boolean(precioProximo && fechaCambio && fechaBaseRenovacion >= fechaCambio);

  return {
    precioAplicado: cambiaEnRenovacion ? precioProximo : precioActual,
    precioActual,
    precioProximo,
    cambiaEnRenovacion,
  };
}

export async function listarPreciosPlanesActuales(): Promise<PrecioPlanActualDTO[]> {
  const precios = await prisma.precioPlan.findMany({
    orderBy: [{ plan: 'asc' }, { pais: 'asc' }, { version: 'desc' }],
  });

  const porClave = new Map<string, PrecioPlan>();
  for (const precio of precios) {
    const clave = crearClavePrecio(precio.plan, precio.pais);
    if (!porClave.has(clave)) {
      porClave.set(clave, precio);
    }
  }

  return Array.from(porClave.values())
    .sort((a, b) => crearClavePrecio(a.plan, a.pais).localeCompare(crearClavePrecio(b.plan, b.pais)))
    .map((precio) => ({
      id: precio.id,
      plan: precio.plan,
      pais: normalizarPaisPrecio(precio.pais),
      moneda: obtenerMonedaPrecio(precio.pais),
      monto: precio.monto,
      version: precio.version,
      vigenteDesde: precio.vigenteDesde.toISOString(),
      creadoEn: precio.creadoEn.toISOString(),
    }));
}

export async function obtenerPrecioPlanActual(plan: PlanEstudio, pais?: string | null) {
  return prisma.precioPlan.findFirst({
    where: { plan, pais: normalizarPaisPrecio(pais) },
    orderBy: [{ version: 'desc' }, { creadoEn: 'desc' }],
  });
}

export async function obtenerSiguienteVersionPrecio(plan: PlanEstudio, pais?: string | null) {
  const actual = await prisma.precioPlan.aggregate({
    where: { plan, pais: normalizarPaisPrecio(pais) },
    _max: { version: true },
  });

  return (actual._max.version ?? 0) + 1;
}

export async function asegurarPrecioActualSalon(params: {
  estudioId: string;
  plan: PlanEstudio;
  pais?: string | null;
}) {
  const precio = await obtenerPrecioPlanActual(params.plan, params.pais);
  if (!precio) {
    throw new Error(`No existe un precio configurado para ${params.plan} en ${normalizarPaisPrecio(params.pais)}`);
  }

  await prisma.estudio.update({
    where: { id: params.estudioId },
    data: {
      precioPlanActualId: precio.id,
      precioPlanProximoId: null,
      fechaAplicacionPrecioProximo: null,
    },
    select: { id: true },
  });

  return precio;
}

export async function obtenerResumenSuscripcionesActivas(): Promise<ResumenSuscripcionesActivas> {
  const hoy = obtenerHoyISO();
  const preciosActuales = await listarPreciosPlanesActuales();
  const mapaPrecios = new Map(preciosActuales.map((precio) => [crearClavePrecio(precio.plan, precio.pais), precio]));

  const estudios = await prisma.estudio.findMany({
    where: {
      activo: true,
      estado: 'aprobado',
      fechaVencimiento: { gte: hoy },
    },
    select: {
      id: true,
      pais: true,
      plan: true,
      activo: true,
      estado: true,
      fechaVencimiento: true,
      precioPlanActualId: true,
      precioPlanActual: {
        select: {
          id: true,
          plan: true,
          pais: true,
          moneda: true,
          monto: true,
          version: true,
          vigenteDesde: true,
        },
      },
    },
  });

  const resumen: ResumenSuscripcionesActivas = {
    totalSuscripcionesActivas: estudios.length,
    totalActivasStandard: 0,
    totalActivasPro: 0,
    porPais: {
      Mexico: {
        total: 0,
        moneda: 'MXN',
        totalSuscripciones: 0,
        desglose: {
          pro: { salones: 0, monto: 0 },
          standard: { salones: 0, monto: 0 },
        },
      },
      Colombia: {
        total: 0,
        moneda: 'COP',
        totalSuscripciones: 0,
        desglose: {
          pro: { salones: 0, monto: 0 },
          standard: { salones: 0, monto: 0 },
        },
      },
    },
  };

  for (const estudio of estudios) {
    const pais = normalizarPaisPrecio(estudio.pais);
    const tipoPlan = estudio.plan === 'PRO' ? 'pro' : 'standard';
    const precio = estudio.precioPlanActual ?? mapaPrecios.get(crearClavePrecio(estudio.plan, estudio.pais)) ?? null;
    const monto = precio?.monto ?? 0;

    resumen.porPais[pais].totalSuscripciones += 1;
    resumen.porPais[pais].total += monto;
    resumen.porPais[pais].desglose[tipoPlan].salones += 1;
    resumen.porPais[pais].desglose[tipoPlan].monto += monto;

    if (estudio.plan === 'PRO') {
      resumen.totalActivasPro += 1;
    } else {
      resumen.totalActivasStandard += 1;
    }
  }

  return resumen;
}

export async function programarCambioPrecioPlan(params: {
  plan: PlanEstudio;
  pais: PaisPrecio;
  precioNuevoId: string;
}) {
  const hoy = obtenerHoyISO();
  const estudios = await prisma.estudio.findMany({
    where: {
      plan: params.plan,
      pais: params.pais,
    },
    select: {
      id: true,
      nombre: true,
      propietario: true,
      pais: true,
      plan: true,
      activo: true,
      estado: true,
      fechaVencimiento: true,
      emailContacto: true,
      precioPlanActualId: true,
      precioPlanProximoId: true,
      fechaAplicacionPrecioProximo: true,
      precioPlanActual: {
        select: {
          id: true,
          plan: true,
          pais: true,
          moneda: true,
          monto: true,
          version: true,
          vigenteDesde: true,
        },
      },
      precioPlanProximo: {
        select: {
          id: true,
          plan: true,
          pais: true,
          moneda: true,
          monto: true,
          version: true,
          vigenteDesde: true,
        },
      },
    },
  });

  const activosProgramados: EstudioConPrecioAsignado[] = [];
  let actualizadosInmediatos = 0;

  const operaciones: Prisma.PrismaPromise<unknown>[] = [];

  for (const estudio of estudios as EstudioConPrecioAsignado[]) {
    if (estudio.precioPlanActualId === params.precioNuevoId && !estudio.precioPlanProximoId) {
      continue;
    }

    const mantenerHastaCorte = esSuscripcionActiva(estudio, hoy);

    if (mantenerHastaCorte) {
      operaciones.push(
        prisma.estudio.update({
          where: { id: estudio.id },
          data: {
            precioPlanProximoId: params.precioNuevoId,
            fechaAplicacionPrecioProximo: estudio.fechaVencimiento,
          },
        }),
      );
      activosProgramados.push(estudio);
      continue;
    }

    operaciones.push(
      prisma.estudio.update({
        where: { id: estudio.id },
        data: {
          precioPlanActualId: params.precioNuevoId,
          precioPlanProximoId: null,
          fechaAplicacionPrecioProximo: null,
        },
      }),
    );
    actualizadosInmediatos += 1;
  }

  if (operaciones.length > 0) {
    await prisma.$transaction(operaciones);
  }

  return {
    activosProgramados,
    actualizadosInmediatos,
    totalAfectados: operaciones.length,
  };
}