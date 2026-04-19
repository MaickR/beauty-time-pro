export const PORCENTAJE_COMISION_BASE = 10;
const PORCENTAJE_MINIMO = 0;
const PORCENTAJE_MAXIMO = 100;

export interface PorcentajesComisionVendedor {
  standard: number;
  pro: number;
}

export function normalizarPorcentajeComision(valor: unknown): number {
  if (valor === null || valor === undefined || valor === '') {
    return PORCENTAJE_COMISION_BASE;
  }

  const numero = typeof valor === 'number' ? valor : Number(valor);

  if (!Number.isFinite(numero)) {
    return PORCENTAJE_COMISION_BASE;
  }

  return Math.min(PORCENTAJE_MAXIMO, Math.max(PORCENTAJE_MINIMO, Math.round(numero)));
}

export function resolverPorcentajeComisionVendedor(valor: unknown): number {
  const porcentaje = normalizarPorcentajeComision(valor);
  return porcentaje > 0 ? porcentaje : PORCENTAJE_COMISION_BASE;
}

export function resolverPorcentajesComisionVendedor(config: {
  porcentajeComision?: unknown;
  porcentajeComisionPro?: unknown;
}): PorcentajesComisionVendedor {
  const standard = resolverPorcentajeComisionVendedor(config.porcentajeComision);
  const proNormalizado = normalizarPorcentajeComision(config.porcentajeComisionPro);

  return {
    standard,
    pro: proNormalizado > 0 ? proNormalizado : standard,
  };
}

export function resolverPorcentajeComisionSegunPlan(
  plan: string | null | undefined,
  porcentajes: PorcentajesComisionVendedor,
): number {
  return plan === 'PRO' ? porcentajes.pro : porcentajes.standard;
}

export function calcularComisionVendedor(montoCentavos: number, porcentajeComision: number): number {
  if (montoCentavos <= 0 || porcentajeComision <= 0) {
    return 0;
  }

  return Math.round((montoCentavos * normalizarPorcentajeComision(porcentajeComision)) / 100);
}

export function estudioTienePagoPendiente(params: {
  estado?: string | null;
  activo: boolean;
  fechaVencimiento?: string | null;
  hoy?: string;
}): boolean {
  if (!params.activo || params.estado !== 'aprobado' || !params.fechaVencimiento) {
    return false;
  }

  const hoy = params.hoy ?? new Date().toISOString().slice(0, 10);
  return params.fechaVencimiento < hoy;
}