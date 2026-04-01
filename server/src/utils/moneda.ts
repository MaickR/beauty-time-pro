const FACTOR_CENTAVOS = 100;

export function normalizarNumeroMoneda(valor: unknown): number {
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor;
  if (typeof valor === 'string') {
    const limpio = valor.trim().replace(/,/g, '');
    const convertido = Number(limpio);
    if (Number.isFinite(convertido)) return convertido;
  }
  return 0;
}

export function convertirMonedaACentavos(valor: unknown): number {
  return Math.round(normalizarNumeroMoneda(valor) * FACTOR_CENTAVOS);
}

export function normalizarCentavos(valor: unknown): number {
  const numero = normalizarNumeroMoneda(valor);
  if (!Number.isFinite(numero)) return 0;
  return Math.max(0, Math.trunc(numero));
}

export function convertirCentavosAMoneda(centavos: unknown): number {
  return normalizarCentavos(centavos) / FACTOR_CENTAVOS;
}

export function formatearMoneda(centavos: unknown, moneda: 'MXN' | 'COP' = 'MXN'): string {
  const locale = moneda === 'COP' ? 'es-CO' : 'es-MX';
  const decimales = moneda === 'COP' ? 0 : 2;
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  }).format(convertirCentavosAMoneda(centavos));
}

export function sumarCentavos(valores: Array<number | null | undefined>): number {
  return valores.reduce<number>((total, valor) => total + normalizarCentavos(valor), 0);
}