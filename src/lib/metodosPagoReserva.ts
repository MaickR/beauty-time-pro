import type { MetodoPagoReserva } from '../tipos';

export const METODOS_PAGO_RESERVA: MetodoPagoReserva[] = [
  'cash',
  'card',
  'bank_transfer',
  'digital_transfer',
];

export const ETIQUETAS_METODOS_PAGO_RESERVA: Record<MetodoPagoReserva, string> = {
  cash: 'Efectivo',
  card: 'Tarjeta',
  bank_transfer: 'Transferencia bancaria',
  digital_transfer: 'Transferencia digital',
};

export function normalizarMetodosPagoReserva(valor: unknown): MetodoPagoReserva[] {
  if (!Array.isArray(valor)) {
    return [...METODOS_PAGO_RESERVA];
  }

  const metodos = valor.filter(
    (entrada): entrada is MetodoPagoReserva =>
      typeof entrada === 'string' && METODOS_PAGO_RESERVA.includes(entrada as MetodoPagoReserva),
  );

  return metodos.length > 0 ? metodos : [...METODOS_PAGO_RESERVA];
}

export function obtenerOpcionesMetodosPagoReserva(metodos?: MetodoPagoReserva[]) {
  return normalizarMetodosPagoReserva(metodos).map((valor) => ({
    valor,
    etiqueta: ETIQUETAS_METODOS_PAGO_RESERVA[valor],
  }));
}

export function formatearMetodoPagoReserva(metodoPago?: MetodoPagoReserva | string | null): string {
  if (!metodoPago) return 'Pendiente';
  return ETIQUETAS_METODOS_PAGO_RESERVA[metodoPago as MetodoPagoReserva] ?? 'Pendiente';
}
