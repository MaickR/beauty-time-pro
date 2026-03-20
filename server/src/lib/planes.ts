import type { PlanEstudio } from '../generated/prisma/client.js';

export const MENSAJE_FUNCION_PRO =
  'Esta función está disponible solo en el plan Pro. Actualiza tu plan para desbloquearla.';

export const LIMITE_SERVICIOS_STANDARD = 4;

interface DefinicionPlanEstudio {
  codigo: PlanEstudio;
  nombre: 'Standard' | 'Pro';
  maxServicios: number | null;
  fidelidad: boolean;
}

const DEFINICIONES_PLAN: Record<PlanEstudio, DefinicionPlanEstudio> = {
  STANDARD: {
    codigo: 'STANDARD',
    nombre: 'Standard',
    maxServicios: LIMITE_SERVICIOS_STANDARD,
    fidelidad: false,
  },
  PRO: {
    codigo: 'PRO',
    nombre: 'Pro',
    maxServicios: null,
    fidelidad: true,
  },
};

export function normalizarPlanEstudio(plan?: string | null): PlanEstudio {
  return plan === 'PRO' ? 'PRO' : 'STANDARD';
}

export function obtenerDefinicionPlan(plan?: string | null): DefinicionPlanEstudio {
  return DEFINICIONES_PLAN[normalizarPlanEstudio(plan)];
}

export function validarCantidadServiciosPlan(params: {
  plan?: string | null;
  cantidadNueva: number;
  cantidadActual?: number;
}): string | null {
  const definicion = obtenerDefinicionPlan(params.plan);
  if (definicion.maxServicios === null) {
    return null;
  }

  if (params.cantidadNueva <= definicion.maxServicios) {
    return null;
  }

  const cantidadActual = params.cantidadActual ?? 0;
  if (cantidadActual > definicion.maxServicios && params.cantidadNueva <= cantidadActual) {
    return null;
  }

  return `El plan ${definicion.nombre} permite hasta ${definicion.maxServicios} servicios activos. Actualiza a Pro para agregar más.`;
}
