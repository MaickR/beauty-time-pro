import type { PlanEstudio } from '../tipos';

export const MENSAJE_FUNCION_PRO =
  'Esta función está disponible solo en el plan Pro. Actualiza tu plan para desbloquearla.';

interface DefinicionPlanEstudio {
  codigo: PlanEstudio;
  nombre: 'Estándar' | 'Pro';
  maxServicios: number;
  fidelidad: boolean;
  resumen: string;
  capacidades: string[];
  restricciones: string[];
}

const PLANES_ESTUDIO: Record<PlanEstudio, DefinicionPlanEstudio> = {
  STANDARD: {
    codigo: 'STANDARD',
    nombre: 'Estándar',
    maxServicios: Number.POSITIVE_INFINITY,
    fidelidad: false,
    resumen: 'Servicios ilimitados, sin fidelidad, sin productos y con límite de 5 empleados.',
    capacidades: [
      'Servicios ilimitados',
      'Agenda, reservas y dashboard operativo',
      'Cobro mensual estándar por país',
      'Un solo salón sin sucursales Pro',
    ],
    restricciones: [
      'Sin programa de fidelidad',
      'Sin módulo de productos',
      'Sin sucursales adicionales',
      'Máximo 5 empleados',
      'Sin envíos masivos ni herramientas Pro avanzadas',
    ],
  },
  PRO: {
    codigo: 'PRO',
    nombre: 'Pro',
    maxServicios: Number.POSITIVE_INFINITY,
    fidelidad: true,
    resumen:
      'Servicios, productos y sucursales habilitados con fidelidad y funciones comerciales completas.',
    capacidades: [
      'Servicios ilimitados',
      'Programa de fidelidad',
      'Productos del salón',
      'Sucursales adicionales',
      'Herramientas comerciales Pro',
    ],
    restricciones: [],
  },
};

export function normalizarPlanEstudio(plan?: string | null): PlanEstudio {
  return plan === 'PRO' ? 'PRO' : 'STANDARD';
}

export function obtenerDefinicionPlan(plan?: string | null): DefinicionPlanEstudio {
  return PLANES_ESTUDIO[normalizarPlanEstudio(plan)];
}
