/**
 * Servicio de pagos — llama al backend Fastify en lugar de Firebase.
 */
import type { Estudio } from '../tipos/index';
import { peticion } from '../lib/clienteHTTP';
import { convertirMonedaACentavos, obtenerFechaLocalISO } from '../utils/formato';

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
    body: JSON.stringify({
      ...datos,
      monto: convertirMonedaACentavos(datos.monto),
    }),
  });
}

export interface ResumenPagoSuscripcion {
  id: string;
  moneda: 'MXN' | 'COP';
  pais: 'Mexico' | 'Colombia';
  fechaBaseRenovacion: string | null;
  nuevaFechaVencimiento: string | null;
  estrategiaRenovacion: 'desde_vencimiento_actual' | 'desde_hoy' | null;
  registradoPorNombre: string | null;
  registradoPorEmail: string | null;
}

/**
 * Registra un pago y extiende la suscripción del estudio un mes.
 * Devuelve la nueva fecha de vencimiento en formato "YYYY-MM-DD".
 */
export async function confirmarPago(
  estudio: Estudio,
  monto: number,
  moneda: 'MXN' | 'COP',
): Promise<ResumenPagoSuscripcion> {
  type RespuestaPago = { datos: ResumenPagoSuscripcion };
  const respuesta = await peticion<RespuestaPago>('/pagos', {
    method: 'POST',
    body: JSON.stringify({
      estudioId: estudio.id,
      monto: convertirMonedaACentavos(monto),
      moneda,
      fecha: obtenerFechaLocalISO(new Date()),
      extenderSuscripcion: true,
      meses: 1,
    }),
  });
  return respuesta.datos;
}
