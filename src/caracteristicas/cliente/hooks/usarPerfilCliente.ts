import { useEffect, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  obtenerMiPerfil,
  obtenerMisReservas,
  obtenerReservasProximas,
  actualizarMiPerfil,
  subirAvatar,
  cambiarContrasena,
} from '../../../servicios/servicioClienteApp';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { usarTiendaAuth } from '../../../tienda/tiendaAuth';
import type { PerfilClienteApp, ReservaCliente } from '../../../tipos';

const esquemaPerfil = z.object({
  nombre: z.string().min(2, 'Mínimo 2 caracteres'),
  apellido: z.string().min(2, 'Mínimo 2 caracteres'),
  telefono: z
    .string()
    .regex(/^[0-9]{10}$/, '10 dígitos sin espacios')
    .or(z.literal(''))
    .optional(),
  fechaNacimiento: z.string().optional(),
});

const esquemaContrasena = z
  .object({
    contrasenaActual: z.string().min(1, 'Campo requerido'),
    contrasenaNueva: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Debe tener una mayúscula')
      .regex(/\d/, 'Debe tener un número'),
    confirmar: z.string(),
  })
  .refine((d) => d.contrasenaNueva === d.confirmar, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmar'],
  });

type DatosPerfil = z.infer<typeof esquemaPerfil>;
type DatosContrasena = z.infer<typeof esquemaContrasena>;

interface NotificacionPerfil {
  mensaje: string;
  variante: 'exito' | 'error' | 'info';
}

const CLAVE_NOTIFICACION_PERFIL = 'btp_notificacion_perfil';

export function usarPerfilCliente() {
  const { mostrarToast } = usarToast();
  const queryClient = useQueryClient();
  const [notificacion, setNotificacion] = useState<NotificacionPerfil | null>(null);

  function mostrarNotificacion(entrada: NotificacionPerfil) {
    sessionStorage.setItem(CLAVE_NOTIFICACION_PERFIL, JSON.stringify(entrada));
    setNotificacion(entrada);
    mostrarToast(entrada);
  }

  useEffect(() => {
    const guardada = sessionStorage.getItem(CLAVE_NOTIFICACION_PERFIL);
    if (!guardada) {
      return;
    }

    try {
      const notificacionGuardada = JSON.parse(guardada) as NotificacionPerfil;
      setNotificacion(notificacionGuardada);
    } catch {
      sessionStorage.removeItem(CLAVE_NOTIFICACION_PERFIL);
    }
  }, []);

  useEffect(() => {
    if (!notificacion) {
      return undefined;
    }

    const temporizador = window.setTimeout(() => {
      sessionStorage.removeItem(CLAVE_NOTIFICACION_PERFIL);
      setNotificacion((actual) => (actual?.mensaje === notificacion.mensaje ? null : actual));
    }, 4000);

    return () => window.clearTimeout(temporizador);
  }, [notificacion]);

  function sincronizarSesionCliente(
    perfil: Pick<PerfilClienteApp, 'nombre' | 'apellido' | 'email'>,
  ) {
    usarTiendaAuth.setState((estado) => {
      if (!estado.usuario || estado.usuario.rol !== 'cliente') {
        return estado;
      }

      return {
        ...estado,
        usuario: {
          ...estado.usuario,
          nombre: `${perfil.nombre} ${perfil.apellido}`.trim(),
          email: perfil.email,
        },
      };
    });
  }

  const consulta = useQuery<PerfilClienteApp>({
    queryKey: ['mi-perfil'],
    queryFn: obtenerMiPerfil,
    staleTime: 0,
  });

  const consultaReservas = useQuery<ReservaCliente[]>({
    queryKey: ['mis-reservas'],
    queryFn: obtenerMisReservas,
    staleTime: 0,
  });

  const consultaReservasProximas = useQuery<ReservaCliente[]>({
    queryKey: ['reservas-proximas'],
    queryFn: obtenerReservasProximas,
    staleTime: 0,
  });

  const formPerfil = useForm<DatosPerfil>({
    resolver: zodResolver(esquemaPerfil),
    values: consulta.data
      ? {
          nombre: consulta.data.nombre,
          apellido: consulta.data.apellido,
          telefono: consulta.data.telefono ?? '',
          fechaNacimiento: consulta.data.fechaNacimiento ?? '',
        }
      : undefined,
  });

  const formContrasena = useForm<DatosContrasena>({
    resolver: zodResolver(esquemaContrasena),
  });

  const mutarPerfil = useMutation({
    mutationFn: (datos: DatosPerfil) =>
      actualizarMiPerfil({
        nombre: datos.nombre,
        apellido: datos.apellido,
        telefono: datos.telefono || undefined,
        fechaNacimiento: datos.fechaNacimiento || undefined,
      }),
    onSuccess: async (actualizado) => {
      const perfilEnCache = queryClient.getQueryData<PerfilClienteApp>(['mi-perfil']);
      const perfilActualizado = {
        ...perfilEnCache,
        ...actualizado,
      } as PerfilClienteApp;

      queryClient.setQueryData(['mi-perfil'], perfilActualizado);
      sincronizarSesionCliente(perfilActualizado);
      formPerfil.reset({
        nombre: perfilActualizado.nombre,
        apellido: perfilActualizado.apellido,
        telefono: perfilActualizado.telefono ?? '',
        fechaNacimiento: perfilActualizado.fechaNacimiento ?? '',
      });
      mostrarNotificacion({ mensaje: 'Perfil actualizado', variante: 'exito' });
      await queryClient.invalidateQueries({ queryKey: ['mi-perfil'] });
    },
    onError: () =>
      mostrarNotificacion({ mensaje: 'No se pudo actualizar el perfil', variante: 'error' }),
  });

  const mutarContrasena = useMutation({
    mutationFn: (datos: DatosContrasena) =>
      cambiarContrasena(datos.contrasenaActual, datos.contrasenaNueva),
    onSuccess: () => {
      formContrasena.reset();
      mostrarNotificacion({ mensaje: 'Contraseña actualizada', variante: 'exito' });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : 'Error al cambiar la contraseña';
      mostrarNotificacion({ mensaje: msg, variante: 'error' });
    },
  });

  async function guardarPerfil(datos: DatosPerfil) {
    await mutarPerfil.mutateAsync(datos);
  }

  const cambiarAvatar = async (archivo: File) => {
    const perfilActual = queryClient.getQueryData<PerfilClienteApp>(['mi-perfil']);
    const avatarAnterior = perfilActual?.avatarUrl ?? null;
    const vistaPrevia = URL.createObjectURL(archivo);

    queryClient.setQueryData(['mi-perfil'], (prev: PerfilClienteApp | undefined) =>
      prev ? { ...prev, avatarUrl: vistaPrevia } : prev,
    );

    try {
      const avatarUrl = await subirAvatar(archivo);
      queryClient.setQueryData(['mi-perfil'], (prev: PerfilClienteApp | undefined) => {
        if (!prev) {
          return prev;
        }

        return { ...prev, avatarUrl };
      });
      await queryClient.invalidateQueries({ queryKey: ['mi-perfil'] });
      URL.revokeObjectURL(vistaPrevia);
      mostrarNotificacion({ mensaje: 'Foto actualizada', variante: 'exito' });
    } catch {
      queryClient.setQueryData(['mi-perfil'], (prev: PerfilClienteApp | undefined) =>
        prev ? { ...prev, avatarUrl: avatarAnterior } : prev,
      );
      URL.revokeObjectURL(vistaPrevia);
      mostrarNotificacion({ mensaje: 'No se pudo subir la foto', variante: 'error' });
    }
  };

  return {
    consulta,
    consultaReservas,
    consultaReservasProximas,
    formPerfil,
    formContrasena,
    mutarPerfil,
    mutarContrasena,
    cambiarAvatar,
    guardarPerfil,
    notificacion,
  };
}
