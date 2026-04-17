interface SalonConIdentificador {
  id: string;
  slug?: string | null;
}

export function obtenerIdentificadorSalonCliente(salon: SalonConIdentificador): string {
  return salon.slug?.trim() || salon.id;
}

export function construirRutaSalonCliente(salon: SalonConIdentificador): string {
  return `/cliente/salon/${encodeURIComponent(obtenerIdentificadorSalonCliente(salon))}`;
}

export function construirRutaReservaSalonCliente(salon: SalonConIdentificador): string {
  return `${construirRutaSalonCliente(salon)}/reservar`;
}
