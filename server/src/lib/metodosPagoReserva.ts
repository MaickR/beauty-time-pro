export const METODOS_PAGO_RESERVA = [
  'cash',
  'card',
  'bank_transfer',
  'digital_transfer',
] as const;

export type MetodoPagoReserva = (typeof METODOS_PAGO_RESERVA)[number];

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

export function esMetodoPagoReserva(valor: unknown): valor is MetodoPagoReserva {
  return typeof valor === 'string' && METODOS_PAGO_RESERVA.includes(valor as MetodoPagoReserva);
}

export function validarMetodoPagoReservaDisponible(
  metodoPago: string | null | undefined,
  metodosDisponibles: unknown,
): boolean {
  if (!metodoPago) return true;
  if (!esMetodoPagoReserva(metodoPago)) return false;

  return normalizarMetodosPagoReserva(metodosDisponibles).includes(metodoPago);
}