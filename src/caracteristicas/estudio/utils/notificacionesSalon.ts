export type TipoNotificacionSalonRelevante =
  | 'recordatorio_pago'
  | 'pago_confirmado'
  | 'suspension'
  | 'cambio_precio_plan'
  | 'nueva_reserva'
  | 'actualizacion_horario'
  | 'actualizacion_salon';

export interface NotificacionSalonRelevante {
  id: string;
  estudioId: string;
  tipo: TipoNotificacionSalonRelevante;
  titulo: string;
  mensaje: string;
  leida: boolean;
  creadoEn: string;
}

const TIPOS_RELEVANTES = new Set<TipoNotificacionSalonRelevante>([
  'recordatorio_pago',
  'pago_confirmado',
  'suspension',
  'cambio_precio_plan',
  'nueva_reserva',
  'actualizacion_horario',
  'actualizacion_salon',
]);

export function esTipoNotificacionSalonRelevante(
  tipo: string,
): tipo is TipoNotificacionSalonRelevante {
  return TIPOS_RELEVANTES.has(tipo as TipoNotificacionSalonRelevante);
}

export function filtrarNotificacionesSalonRelevantes(
  notificaciones: Array<Omit<NotificacionSalonRelevante, 'tipo'> & { tipo: string }>,
): NotificacionSalonRelevante[] {
  return notificaciones.filter((notificacion) =>
    esTipoNotificacionSalonRelevante(notificacion.tipo),
  ) as NotificacionSalonRelevante[];
}