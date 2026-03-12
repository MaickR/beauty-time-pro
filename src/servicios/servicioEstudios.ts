/**
 * Servicio de estudios — llama al backend Fastify en lugar de Firebase.
 */
import type { Estudio, Servicio } from '../tipos/index';
import { peticion } from '../lib/clienteHTTP';

type RespuestaEstudio = { datos: Estudio };

/** Crea un estudio nuevo. */
export async function guardarEstudio(_id: string, datos: Omit<Estudio, 'id'>): Promise<Estudio> {
  const respuesta = await peticion<RespuestaEstudio>('/estudios', {
    method: 'POST',
    body: JSON.stringify({
      nombre: datos.name,
      propietario: datos.owner,
      telefono: datos.phone,
      sitioWeb: datos.website,
      pais: datos.country,
      sucursales: datos.branches,
      claveDueno: datos.assignedKey,
      claveCliente: datos.clientKey,
      inicioSuscripcion: datos.subscriptionStart,
      fechaVencimiento: datos.paidUntil,
      horario: datos.schedule,
      servicios: datos.selectedServices,
      serviciosCustom: datos.customServices,
      festivos: datos.holidays,
    }),
  });
  return respuesta.datos;
}

/** Actualiza campos parciales de un estudio. */
export async function actualizarEstudio(id: string, campos: Partial<Estudio>): Promise<void> {
  const cuerpo: Record<string, unknown> = {};
  if (campos.name !== undefined) cuerpo['nombre'] = campos.name;
  if (campos.owner !== undefined) cuerpo['propietario'] = campos.owner;
  if (campos.phone !== undefined) cuerpo['telefono'] = campos.phone;
  if (campos.website !== undefined) cuerpo['sitioWeb'] = campos.website;
  if (campos.country !== undefined) cuerpo['pais'] = campos.country;
  if (campos.branches !== undefined) cuerpo['sucursales'] = campos.branches;
  if (campos.schedule !== undefined) cuerpo['horario'] = campos.schedule;
  if (campos.selectedServices !== undefined) cuerpo['servicios'] = campos.selectedServices;
  if (campos.customServices !== undefined) cuerpo['serviciosCustom'] = campos.customServices;
  if (campos.holidays !== undefined) cuerpo['festivos'] = campos.holidays;
  await peticion<RespuestaEstudio>(`/estudios/${id}`, {
    method: 'PUT',
    body: JSON.stringify(cuerpo),
  });
}

/** Elimina un estudio por id. */
export async function eliminarEstudio(id: string): Promise<void> {
  await peticion(`/estudios/${id}`, { method: 'DELETE' });
}

/** Actualiza los días festivos/bloqueados de un estudio. */
export async function actualizarFestivos(id: string, festivos: string[]): Promise<void> {
  await peticion(`/estudios/${id}/festivos`, {
    method: 'PUT',
    body: JSON.stringify({ festivos }),
  });
}

/** Actualiza la lista de servicios con precios de un estudio. */
export async function actualizarPreciosServicios(id: string, servicios: Servicio[]): Promise<void> {
  await peticion<RespuestaEstudio>(`/estudios/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ servicios }),
  });
}
