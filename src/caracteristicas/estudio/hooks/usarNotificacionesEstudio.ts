import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { peticion } from '../../../lib/clienteHTTP';
import {
  filtrarNotificacionesSalonRelevantes,
  type NotificacionSalonRelevante,
} from '../utils/notificacionesSalon';

export type NotificacionEstudio = NotificacionSalonRelevante;

type RespuestaNotificaciones = {
  datos: Array<Omit<NotificacionEstudio, 'tipo'> & { tipo: string }>;
};

export function usarNotificacionesEstudio(estudioId: string | undefined) {
  const clienteConsulta = useQueryClient();

  const consulta = useQuery({
    queryKey: ['notificaciones-estudio', estudioId],
    queryFn: () =>
      peticion<RespuestaNotificaciones>(`/estudios/${estudioId}/notificaciones`).then((r) =>
        filtrarNotificacionesSalonRelevantes(r.datos),
      ),
    enabled: !!estudioId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const mutacionLeer = useMutation({
    mutationFn: (notifId: string) =>
      peticion(`/estudios/${estudioId}/notificaciones/${notifId}/leer`, { method: 'PUT' }),
    onSuccess: (_resultado, notifId) => {
      clienteConsulta.setQueryData<NotificacionEstudio[]>(
        ['notificaciones-estudio', estudioId],
        (actual) => (actual ?? []).filter((notificacion) => notificacion.id !== notifId),
      );
    },
  });

  return {
    notificaciones: consulta.data ?? [],
    cargando: consulta.isLoading,
    marcarLeida: mutacionLeer.mutate,
  };
}
