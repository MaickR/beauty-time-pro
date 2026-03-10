/**
 * Servicio de pagos — llama al backend Fastify en lugar de Firebase.
 */
import type { Estudio } from '../tipos/index';
import { peticion } from '../lib/clienteHTTP';
import { obtenerFechaLocalISO } from '../utils/formato';

interface DatosPago {
  estudioId: string;
  monto: number;
  moneda: string;
  fecha: string;
}

/** Registra un pago en el historial (sin extender suscripción). */
export async function registrarPago(datos: DatosPago): Promise<void> {
  await peticion('/pagos', {
    method: 'POST',
    body: JSON.stringify(datos),
  });
}

/**
 * Registra un pago y extiende la suscripción del estudio un mes.
 * Devuelve la nueva fecha de vencimiento en formato "YYYY-MM-DD".
 */
export async function confirmarPago(
  estudio: Estudio,
  monto: number,
  moneda: 'MXN' | 'COP',
): Promise<string> {
  type RespuestaPago = { datos: { id: string } };
  await peticion<RespuestaPago>('/pagos', {
    method: 'POST',
    body: JSON.stringify({
      estudioId: estudio.id,
      monto,
      moneda,
      fecha: obtenerFechaLocalISO(new Date()),
      extenderSuscripcion: true,
    }),
  });
  // Calcular la nueva fecha localmente (el backend la calcula igual: +1 mes)
  const baseStr = estudio.paidUntil || estudio.subscriptionStart || obtenerFechaLocalISO(new Date());
  const partes = baseStr.split('-').map(Number);
  const fechaBase = new Date(partes[0]!, partes[1]! - 1, partes[2]!);
  fechaBase.setMonth(fechaBase.getMonth() + 1);
  return obtenerFechaLocalISO(fechaBase);
}
