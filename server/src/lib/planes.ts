import type { PlanEstudio } from '../generated/prisma/client.js';

export const MENSAJE_FUNCION_PRO =
  'Esta función está disponible solo en el plan Pro. Actualiza tu plan para desbloquearla.';

export const LIMITE_MENSAJES_MASIVOS_BASE_ANUAL = 3;

export const LIMITE_SERVICIOS_STANDARD = Number.POSITIVE_INFINITY;
export const LIMITE_SERVICIOS_PRO = Number.POSITIVE_INFINITY;
export const LIMITE_EMPLEADOS_STANDARD = 5;
export const LIMITE_EMPLEADOS_PRO = Number.POSITIVE_INFINITY;

type ClaveFuncionPlan =
  | 'fidelidad'
  | 'productos'
  | 'ventasProductos'
  | 'sucursales'
  | 'mensajesMasivos';

interface DefinicionPlanEstudio {
  codigo: PlanEstudio;
  nombre: 'Standard' | 'Pro';
  maxServicios: number;
  maxEmpleadosActivos: number;
  fidelidad: boolean;
  productos: boolean;
  ventasProductos: boolean;
  sucursales: boolean;
  mensajesMasivos: boolean;
  mensajesMasivosBaseAnual: number;
}

const DEFINICIONES_PLAN: Record<PlanEstudio, DefinicionPlanEstudio> = {
  STANDARD: {
    codigo: 'STANDARD',
    nombre: 'Standard',
    maxServicios: LIMITE_SERVICIOS_STANDARD,
    maxEmpleadosActivos: LIMITE_EMPLEADOS_STANDARD,
    fidelidad: false,
    productos: false,
    ventasProductos: false,
    sucursales: false,
    mensajesMasivos: false,
    mensajesMasivosBaseAnual: 0,
  },
  PRO: {
    codigo: 'PRO',
    nombre: 'Pro',
    maxServicios: LIMITE_SERVICIOS_PRO,
    maxEmpleadosActivos: LIMITE_EMPLEADOS_PRO,
    fidelidad: true,
    productos: true,
    ventasProductos: true,
    sucursales: true,
    mensajesMasivos: true,
    mensajesMasivosBaseAnual: LIMITE_MENSAJES_MASIVOS_BASE_ANUAL,
  },
};

const MENSAJES_RESTRICCION_FUNCION: Record<ClaveFuncionPlan, string> = {
  fidelidad: MENSAJE_FUNCION_PRO,
  productos: 'El módulo de productos está disponible solo para salones con plan Pro.',
  ventasProductos:
    'La venta de productos está disponible solo para salones con plan Pro.',
  sucursales:
    'Las sucursales adicionales están disponibles solo para salones con plan Pro.',
  mensajesMasivos:
    'Los mensajes masivos están disponibles solo para salones con plan Pro.',
};

export function normalizarPlanEstudio(plan?: string | null): PlanEstudio {
  return plan === 'PRO' ? 'PRO' : 'STANDARD';
}

export function obtenerDefinicionPlan(plan?: string | null): DefinicionPlanEstudio {
  return DEFINICIONES_PLAN[normalizarPlanEstudio(plan)];
}

export function planPermiteFuncion(params: {
  plan?: string | null;
  funcion: ClaveFuncionPlan;
}): boolean {
  const definicion = obtenerDefinicionPlan(params.plan);
  return definicion[params.funcion];
}

export function obtenerMensajeRestriccionPlan(funcion: ClaveFuncionPlan): string {
  return MENSAJES_RESTRICCION_FUNCION[funcion];
}

export function obtenerLimiteMensajesMasivosAnual(params: {
  plan?: string | null;
  extrasAprobados?: number | null;
}): number {
  const definicion = obtenerDefinicionPlan(params.plan);
  const extras = Math.max(0, params.extrasAprobados ?? 0);
  return definicion.mensajesMasivosBaseAnual + extras;
}

export function validarReglasSucursalesPorPlan(params: {
  plan?: string | null;
  estudioPrincipalId?: string | null;
  sucursales?: string[] | null;
}): string | null {
  if (planPermiteFuncion({ plan: params.plan, funcion: 'sucursales' })) {
    return null;
  }

  if (params.estudioPrincipalId) {
    return obtenerMensajeRestriccionPlan('sucursales');
  }

  if (Array.isArray(params.sucursales) && params.sucursales.length > 0) {
    return obtenerMensajeRestriccionPlan('sucursales');
  }

  return null;
}

export function validarCantidadServiciosPlan(params: {
  plan?: string | null;
  cantidadNueva: number;
  cantidadActual?: number;
}): string | null {
  const definicion = obtenerDefinicionPlan(params.plan);
  if (!Number.isFinite(definicion.maxServicios)) {
    return null;
  }

  if (params.cantidadNueva <= definicion.maxServicios) {
    return null;
  }

  const cantidadActual = params.cantidadActual ?? 0;
  if (cantidadActual > definicion.maxServicios && params.cantidadNueva <= cantidadActual) {
    return null;
  }

  return `Tu plan ${definicion.nombre} permite máximo ${definicion.maxServicios} servicios activos.`;
}

export function validarCantidadEmpleadosActivosPlan(params: {
  plan?: string | null;
  cantidadNueva: number;
  cantidadActual?: number;
}): string | null {
  const definicion = obtenerDefinicionPlan(params.plan);
  if (!Number.isFinite(definicion.maxEmpleadosActivos)) {
    return null;
  }

  if (params.cantidadNueva <= definicion.maxEmpleadosActivos) {
    return null;
  }

  const cantidadActual = params.cantidadActual ?? 0;
  if (
    cantidadActual > definicion.maxEmpleadosActivos
    && params.cantidadNueva <= cantidadActual
  ) {
    return null;
  }

  return `Tu plan ${definicion.nombre} permite máximo ${definicion.maxEmpleadosActivos} empleados activos.`;
}
