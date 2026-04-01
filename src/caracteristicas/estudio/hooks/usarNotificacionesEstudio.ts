import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { peticion } from '../../../lib/clienteHTTP';

export interface NotificacionEstudio {
  id: string;
  estudioId: string;
  tipo: 'recordatorio_pago' | 'pago_confirmado' | 'suspension';
  titulo: string;
  mensaje: string;
  leida: boolean;
  creadoEn: string;
}

type RespuestaNotificaciones = { datos: NotificacionEstudio[] };

export function usarNotificacionesEstudio(estudioId: string | undefined) {
  const clienteConsulta = useQueryClient();

  const consulta = useQuery({
    queryKey: ['notificaciones-estudio', estudioId],
    queryFn: () =>
      peticion<RespuestaNotificaciones>(`/estudios/${estudioId}/notificaciones`).then(
        (r) => r.datos,
      ),
    enabled: !!estudioId,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const mutacionLeer = useMutation({
    mutationFn: (notifId: string) =>
      peticion(`/estudios/${estudioId}/notificaciones/${notifId}/leer`, { method: 'PUT' }),
    onSuccess: () => {
      void clienteConsulta.invalidateQueries({
        queryKey: ['notificaciones-estudio', estudioId],
      });
    },
  });

  return {
    notificaciones: consulta.data ?? [],
    cargando: consulta.isLoading,
    marcarLeida: mutacionLeer.mutate,
  };
}
