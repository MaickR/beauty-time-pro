import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { obtenerDisponibilidad } from '../../../servicios/servicioClienteApp';
import { peticion } from '../../../lib/clienteHTTP';
import { obtenerFechaLocalISO } from '../../../utils/formato';
import type { Servicio, SalonDetalle, SlotTiempo } from '../../../tipos';

export interface ResultadoReserva {
  id: string;
  horaInicio: string;
  fecha: string;
  nombreCliente: string;
}

export type PasoReserva = 'especialista' | 'servicios' | 'fecha' | 'hora' | 'confirmar' | 'exitosa';

interface EstadoFlujo {
  paso: PasoReserva;
  personalId: string;
  serviciosSeleccionados: Servicio[];
  fechaSeleccionada: Date;
  horaSeleccionada: string;
  slots: SlotTiempo[];
  cargandoSlots: boolean;
  enviando: boolean;
  reservaResultado: ResultadoReserva | null;
}

export function usarFlujoReservaCliente(salon: SalonDetalle) {
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<EstadoFlujo>({
    paso: 'especialista',
    personalId: '',
    serviciosSeleccionados: [],
    fechaSeleccionada: new Date(),
    horaSeleccionada: '',
    slots: [],
    cargandoSlots: false,
    enviando: false,
    reservaResultado: null,
  });

  const duracionTotal = estado.serviciosSeleccionados.reduce((s, sv) => s + sv.duration, 0);
  const precioTotal = estado.serviciosSeleccionados.reduce((s, sv) => s + sv.price, 0);

  const mutacionCrearReserva = useMutation({
    mutationFn: async () => {
      const resultado = await peticion<{ datos: ResultadoReserva }>('/reservas', {
        method: 'POST',
        body: JSON.stringify({
          estudioId: salon.id,
          personalId: estado.personalId,
          fecha: obtenerFechaLocalISO(estado.fechaSeleccionada),
          horaInicio: estado.horaSeleccionada,
          duracion: duracionTotal,
          servicios: estado.serviciosSeleccionados,
          precioTotal,
          estado: 'pending',
          sucursal: '',
        }),
      });
      return resultado.datos;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['mi-perfil'] });
      await queryClient.invalidateQueries({ queryKey: ['mis-reservas'] });
      await queryClient.invalidateQueries({ queryKey: ['reservas-proximas'] });
    },
  });

  const seleccionarPersonal = (id: string) => {
    setEstado((e) => ({ ...e, personalId: id, serviciosSeleccionados: [], paso: 'servicios' }));
  };

  const alternarServicio = (servicio: Servicio) => {
    setEstado((e) => {
      const idx = e.serviciosSeleccionados.findIndex((s) => s.name === servicio.name);
      const siguientes =
        idx > -1
          ? e.serviciosSeleccionados.filter((_, i) => i !== idx)
          : [...e.serviciosSeleccionados, servicio];
      return { ...e, serviciosSeleccionados: siguientes };
    });
  };

  const irAFecha = () => setEstado((e) => ({ ...e, paso: 'fecha' }));

  const seleccionarFecha = (d: Date) => {
    setEstado((e) => ({
      ...e,
      fechaSeleccionada: d,
      horaSeleccionada: '',
      slots: [],
      paso: 'hora',
    }));
    void cargarSlots(d);
  };

  const cargarSlots = async (fecha: Date) => {
    if (!estado.personalId || duracionTotal === 0) return;
    setEstado((e) => ({ ...e, cargandoSlots: true }));
    try {
      const slots = await obtenerDisponibilidad(
        salon.id,
        estado.personalId,
        obtenerFechaLocalISO(fecha),
        duracionTotal,
      );
      setEstado((e) => ({ ...e, slots, cargandoSlots: false }));
    } catch {
      setEstado((e) => ({ ...e, slots: [], cargandoSlots: false }));
    }
  };

  const seleccionarHora = (hora: string) => {
    setEstado((e) => ({ ...e, horaSeleccionada: hora, paso: 'confirmar' }));
  };

  const retroceder = () => {
    setEstado((e) => {
      const anterior: Record<PasoReserva, PasoReserva> = {
        especialista: 'especialista',
        servicios: 'especialista',
        fecha: 'servicios',
        hora: 'fecha',
        confirmar: 'hora',
        exitosa: 'exitosa',
      };
      return { ...e, paso: anterior[e.paso] };
    });
  };

  const enviarReserva = async (mostrarError: (msg: string) => void) => {
    setEstado((e) => ({ ...e, enviando: true }));
    try {
      const resultado = await mutacionCrearReserva.mutateAsync();
      setEstado((e) => ({ ...e, enviando: false, reservaResultado: resultado, paso: 'exitosa' }));
    } catch (err: unknown) {
      const mensaje = err instanceof Error ? err.message : 'No se pudo crear la reserva';
      mostrarError(mensaje);
      setEstado((e) => ({ ...e, enviando: false }));
    }
  };

  return {
    ...estado,
    duracionTotal,
    precioTotal,
    seleccionarPersonal,
    alternarServicio,
    irAFecha,
    seleccionarFecha,
    seleccionarHora,
    retroceder,
    enviarReserva,
  };
}
