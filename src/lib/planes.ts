import type { PlanEstudio } from '../tipos';

export const MENSAJE_FUNCION_PRO =
  'Esta función está disponible solo en el plan Pro. Actualiza tu plan para desbloquearla.';

interface DefinicionPlanEstudio {
  codigo: PlanEstudio;
  nombre: 'Standard' | 'Pro';
  maxServicios: number | null;
  fidelidad: boolean;
  resumen: string;
}

const PLANES_ESTUDIO: Record<PlanEstudio, DefinicionPlanEstudio> = {
  STANDARD: {
    codigo: 'STANDARD',
    nombre: 'Standard',
    maxServicios: 4,
    fidelidad: false,
    resumen: 'Hasta 4 servicios activos y sin programa de fidelidad.',
  },
  PRO: {
    codigo: 'PRO',
    nombre: 'Pro',
    maxServicios: null,
    fidelidad: true,
    resumen: 'Servicios ilimitados y programa de fidelidad habilitado.',
  },
};

export function normalizarPlanEstudio(plan?: string | null): PlanEstudio {
  return plan === 'PRO' ? 'PRO' : 'STANDARD';
}

export function obtenerDefinicionPlan(plan?: string | null): DefinicionPlanEstudio {
  return PLANES_ESTUDIO[normalizarPlanEstudio(plan)];
}
