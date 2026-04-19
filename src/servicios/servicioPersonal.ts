import { peticion } from '../lib/clienteHTTP';
import type { Personal } from '../tipos';

interface PersonalServidor {
  id: string;
  nombre: string;
  avatarUrl?: string | null;
  especialidades?: string[];
  activo?: boolean;
  desactivadoHasta?: string | null;
  horaInicio?: string | null;
  horaFin?: string | null;
  descansoInicio?: string | null;
  descansoFin?: string | null;
  diasTrabajo?: number[] | null;
  porcentajeComisionBase?: number | null;
  comisionServicios?: Record<string, number> | null;
}

interface RespuestaPersonal {
  datos: PersonalServidor;
}

interface RespuestaListaPersonal {
  datos: PersonalServidor[];
}

function mapearPersonal(personal: PersonalServidor): Personal {
  return {
    id: personal.id,
    name: personal.nombre,
    avatarUrl: personal.avatarUrl ?? null,
    specialties: personal.especialidades ?? [],
    active: personal.activo ?? true,
    inactiveUntil: personal.desactivadoHasta ?? null,
    shiftStart: personal.horaInicio ?? null,
    shiftEnd: personal.horaFin ?? null,
    breakStart: personal.descansoInicio ?? null,
    breakEnd: personal.descansoFin ?? null,
    workingDays: personal.diasTrabajo ?? null,
    commissionBasePercentage: personal.porcentajeComisionBase ?? 0,
    serviceCommissionPercentages: personal.comisionServicios ?? {},
  };
}

function serializarPersonal(personal: Partial<Personal>) {
  const cuerpo: Record<string, unknown> = {};
  if (personal.name !== undefined) cuerpo['nombre'] = personal.name;
  if (personal.specialties !== undefined) cuerpo['especialidades'] = personal.specialties;
  if (personal.active !== undefined) cuerpo['activo'] = personal.active;
  if (personal.shiftStart !== undefined) cuerpo['horaInicio'] = personal.shiftStart;
  if (personal.shiftEnd !== undefined) cuerpo['horaFin'] = personal.shiftEnd;
  if (personal.breakStart !== undefined) cuerpo['descansoInicio'] = personal.breakStart;
  if (personal.breakEnd !== undefined) cuerpo['descansoFin'] = personal.breakEnd;
  if (personal.workingDays !== undefined) cuerpo['diasTrabajo'] = personal.workingDays;
  if (personal.commissionBasePercentage !== undefined) {
    cuerpo['porcentajeComisionBase'] = personal.commissionBasePercentage;
  }
  if (personal.serviceCommissionPercentages !== undefined) {
    cuerpo['comisionServicios'] = personal.serviceCommissionPercentages;
  }
  return cuerpo;
}

export async function listarPersonal(estudioId: string): Promise<Personal[]> {
  const respuesta = await peticion<RespuestaListaPersonal>(`/estudios/${estudioId}/personal`);
  return respuesta.datos.map(mapearPersonal);
}

export async function crearPersonal(
  estudioId: string,
  personal: Omit<Personal, 'id'>,
): Promise<Personal> {
  const respuesta = await peticion<RespuestaPersonal>(`/estudios/${estudioId}/personal`, {
    method: 'POST',
    body: JSON.stringify(serializarPersonal(personal)),
  });
  return mapearPersonal(respuesta.datos);
}

export async function actualizarPersonal(
  personalId: string,
  cambios: Partial<Personal>,
): Promise<Personal> {
  const respuesta = await peticion<RespuestaPersonal>(`/personal/${personalId}`, {
    method: 'PUT',
    body: JSON.stringify(serializarPersonal(cambios)),
  });
  return mapearPersonal(respuesta.datos);
}

export async function eliminarPersonal(personalId: string): Promise<void> {
  await peticion(`/personal/${personalId}`, {
    method: 'DELETE',
  });
}

export async function subirAvatarPersonal(
  estudioId: string,
  personalId: string,
  archivo: File,
): Promise<string> {
  const datos = new FormData();
  datos.append('archivo', archivo);

  const respuesta = await peticion<{ datos: { avatarUrl: string } }>(
    `/estudio/${estudioId}/personal/${personalId}/avatar`,
    {
      method: 'POST',
      body: datos,
    },
  );

  return respuesta.datos.avatarUrl;
}

export async function sincronizarPersonalEstudio(
  estudioId: string,
  personalDeseado: Personal[],
): Promise<void> {
  const personalActual = await listarPersonal(estudioId);
  const idsActuales = new Set(personalActual.map((personal) => personal.id));

  await Promise.all(
    personalDeseado.map(async (personal) => {
      if (idsActuales.has(personal.id)) {
        await actualizarPersonal(personal.id, personal);
        return;
      }

      const { id: _id, ...personalNuevo } = personal;
      await crearPersonal(estudioId, personalNuevo);
    }),
  );
}
