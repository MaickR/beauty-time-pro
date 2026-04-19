import type { PlanEstudio } from '../tipos';

export const MENSAJE_FUNCION_PRO =
  'Esta función está disponible solo en el plan Pro. Actualiza tu plan para desbloquearla.';

interface DefinicionPlanEstudio {
  codigo: PlanEstudio;
  nombre: 'Estándar' | 'Pro';
  maxServicios: number;
  fidelidad: boolean;
  productos: boolean;
  ventasProductos: boolean;
  sucursales: boolean;
  mensajesMasivos: boolean;
  limiteMensajesMasivosAnualBase: number;
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
    productos: false,
    ventasProductos: false,
    sucursales: false,
    mensajesMasivos: false,
    limiteMensajesMasivosAnualBase: 0,
    resumen: 'Operación base del salón con agenda y reservas, sin módulos comerciales Pro.',
    capacidades: [
      'Agenda, reservas y operación base del salón.',
      'Dashboard administrativo normal.',
      'Servicios ilimitados.',
      'Un solo salón, sin sucursales adicionales.',
    ],
    restricciones: [
      'Sin programa de fidelidad.',
      'Sin módulo de productos.',
      'Sin ventas de productos integradas a reservas o agenda.',
      'Sin mensajes masivos.',
      'Máximo de 5 empleados activos por salón.',
    ],
  },
  PRO: {
    codigo: 'PRO',
    nombre: 'Pro',
    maxServicios: Number.POSITIVE_INFINITY,
    fidelidad: true,
    productos: true,
    ventasProductos: true,
    sucursales: true,
    mensajesMasivos: true,
    limiteMensajesMasivosAnualBase: 3,
    resumen:
      'Operación base + crecimiento comercial, fidelización, productos, sucursales y campañas.',
    capacidades: [
      'Todo lo del Standard.',
      'Programa de fidelidad completo.',
      'Módulo de productos del salón.',
      'Venta de productos integrada al flujo operativo y financiero.',
      'Productos adicionales dentro de reservas/citas.',
      'Sucursales adicionales.',
      'Mensajes masivos (3 por año + extras aprobados).',
      'Automatizaciones y funciones comerciales más completas.',
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
