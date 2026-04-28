interface EventoDisponibilidadTiempoReal {
  tipo: 'reserva_creada' | 'reserva_actualizada' | 'reserva_cancelada';
  estudioId: string;
  reservaId: string;
  fecha: string;
  personalId: string;
  timestamp: string;
}

type OyenteEventoDisponibilidad = (evento: EventoDisponibilidadTiempoReal) => void;

const canalesPorEstudio = new Map<string, Set<OyenteEventoDisponibilidad>>();

export function publicarEventoDisponibilidadTiempoReal(
  evento: EventoDisponibilidadTiempoReal,
): void {
  const oyentes = canalesPorEstudio.get(evento.estudioId);
  if (!oyentes || oyentes.size === 0) {
    return;
  }

  for (const oyente of oyentes) {
    oyente(evento);
  }
}

export function suscribirEventosDisponibilidadTiempoReal(
  estudioId: string,
  oyente: OyenteEventoDisponibilidad,
): () => void {
  const oyentesActuales = canalesPorEstudio.get(estudioId) ?? new Set<OyenteEventoDisponibilidad>();
  oyentesActuales.add(oyente);
  canalesPorEstudio.set(estudioId, oyentesActuales);

  return () => {
    const oyentes = canalesPorEstudio.get(estudioId);
    if (!oyentes) {
      return;
    }

    oyentes.delete(oyente);
    if (oyentes.size === 0) {
      canalesPorEstudio.delete(estudioId);
    }
  };
}
