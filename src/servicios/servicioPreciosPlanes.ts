import { peticion } from '../lib/clienteHTTP';
import type { Moneda, Pais, PlanEstudio } from '../tipos';

export interface PrecioPlanActual {
  id: string;
  plan: PlanEstudio;
  pais: Pais;
  moneda: Moneda;
  monto: number;
  version: number;
  vigenteDesde: string;
  creadoEn: string;
}

export interface ResumenPaisSuscripcion {
  total: number;
  moneda: Moneda;
  totalSuscripciones: number;
  desglose: {
    pro: { salones: number; monto: number };
    standard: { salones: number; monto: number };
  };
}

export interface ResumenSuscripcionesActivas {
  totalSuscripcionesActivas: number;
  totalActivasStandard: number;
  totalActivasPro: number;
  porPais: Record<Pais, ResumenPaisSuscripcion>;
}

export interface RespuestaGestionPreciosPlanes {
  precios: PrecioPlanActual[];
  metricas: ResumenSuscripcionesActivas;
  cambio?: {
    plan: PlanEstudio;
    pais: Pais;
    moneda: Moneda;
    precioAnterior: number;
    precioNuevo: number;
    versionNueva: number;
    salonesProgramados: number;
    salonesActualizadosInmediato: number;
  };
}

export async function obtenerGestionPreciosPlanes(): Promise<RespuestaGestionPreciosPlanes> {
  const respuesta = await peticion<{ datos: RespuestaGestionPreciosPlanes }>(
    '/admin/precios-planes',
  );
  return respuesta.datos;
}

export async function actualizarPrecioPlan(params: {
  plan: PlanEstudio;
  pais: Pais;
  monto: number;
}): Promise<RespuestaGestionPreciosPlanes> {
  const respuesta = await peticion<{ datos: RespuestaGestionPreciosPlanes }>(
    `/admin/precios-planes/${params.plan}/${params.pais}`,
    {
      method: 'PUT',
      body: JSON.stringify({ monto: params.monto }),
    },
  );

  return respuesta.datos;
}

export async function obtenerPreciosPublicos(): Promise<PrecioPlanActual[]> {
  const respuesta = await peticion<{ datos: PrecioPlanActual[] }>('/planes/precios-publicos');
  return respuesta.datos;
}
