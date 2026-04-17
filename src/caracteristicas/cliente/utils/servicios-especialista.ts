import type { SalonDetalle, Servicio } from '../../../tipos';

export function obtenerServiciosPorEspecialista(
  salon: SalonDetalle,
  personalId?: string,
): Servicio[] {
  if (!personalId) {
    return salon.servicios;
  }

  const especialista = salon.personal.find((persona) => persona.id === personalId);
  if (!especialista) {
    return salon.servicios;
  }

  const especialidades = Array.isArray(especialista.especialidades)
    ? (especialista.especialidades as string[])
    : [];

  return salon.servicios.filter((servicio) => especialidades.includes(servicio.name));
}
