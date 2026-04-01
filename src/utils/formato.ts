import type { EstadoSuscripcion } from '../tipos/index';

const FACTOR_CENTAVOS = 100;

export function obtenerMonedaPorPais(pais: string | null | undefined): 'MXN' | 'COP' {
  return pais === 'Colombia' ? 'COP' : 'MXN';
}

export function formatearPaisMoneda(pais: string | null | undefined): string {
  const paisNormalizado = pais === 'Colombia' ? 'Colombia' : 'Mexico';
  return `${paisNormalizado} / ${obtenerMonedaPorPais(paisNormalizado)}`;
}

export function formatearFechaHumana(fechaISO: string | null | undefined): string {
  if (!fechaISO) return 'Sin fecha';

  // Tomar solo la porción de fecha (YYYY-MM-DD) para soportar ISO datetime completo
  const soloFecha = fechaISO.includes('T') ? fechaISO.split('T')[0]! : fechaISO;
  const partes = soloFecha.split('-').map(Number);
  if (partes.length < 3 || partes.some((p) => Number.isNaN(p))) return fechaISO;

  return new Date(partes[0]!, partes[1]! - 1, partes[2]!).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

/** Formatea un número como moneda. Por defecto usa MXN y locale es-MX. */
export function convertirMonedaACentavos(monto: number): number {
  if (!Number.isFinite(monto)) return 0;
  return Math.round(monto * FACTOR_CENTAVOS);
}

export function convertirCentavosAMoneda(montoCentavos: number): number {
  if (!Number.isFinite(montoCentavos)) return 0;
  return Math.trunc(montoCentavos) / FACTOR_CENTAVOS;
}

/** Formatea un monto expresado en centavos. Por defecto usa MXN y locale es-MX. */
export function formatearDinero(monto: number, moneda: string = 'MXN'): string {
  const locale = moneda === 'COP' ? 'es-CO' : 'es-MX';
  const decimales = moneda === 'COP' ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(convertirCentavosAMoneda(monto || 0));
}

/** Convierte un objeto Date a cadena "YYYY-MM-DD" usando la zona horaria local del dispositivo. */
export function obtenerFechaLocalISO(fecha: Date): string {
  const compensacion = fecha.getTimezoneOffset();
  const fechaLocal = new Date(fecha.getTime() - compensacion * 60 * 1000);
  return fechaLocal.toISOString().split('T')[0];
}

/**
 * Calcula el estado de suscripción de un estudio.
 * Devuelve null si no tiene fecha de inicio configurada.
 */
export function obtenerEstadoSuscripcion(estudio: {
  subscriptionStart?: string;
  paidUntil?: string;
}): EstadoSuscripcion | null {
  if (!estudio?.subscriptionStart) return null;

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);

  const fechaReferenciaStr = estudio.paidUntil || estudio.subscriptionStart;
  const partes = fechaReferenciaStr.split('-');
  if (partes.length < 3) return null;

  const fechaVencimiento = new Date(
    parseInt(partes[0]),
    parseInt(partes[1]) - 1,
    parseInt(partes[2]),
  );

  const diferenciaMs = fechaVencimiento.getTime() - hoy.getTime();
  const diasRestantes = Math.ceil(diferenciaMs / (1000 * 60 * 60 * 24));

  return {
    cutDay: parseInt(partes[2]),
    dueDateStr: fechaVencimiento.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }),
    daysRemaining: diasRestantes,
    status: diasRestantes < 0 ? 'OVERDUE' : diasRestantes <= 5 ? 'WARNING' : 'ACTIVE',
  };
}
