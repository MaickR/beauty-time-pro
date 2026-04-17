import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { obtenerMiPerfil } from '../../../servicios/servicioClienteApp';
import { peticion } from '../../../lib/clienteHTTP';
import { normalizarMetodosPagoReserva } from '../../../lib/metodosPagoReserva';
import { obtenerFechaLocalISO } from '../../../utils/formato';
import type {
  MetodoPagoReserva,
  PerfilClienteApp,
  ProductoAdicionalReserva,
  ProductoPublicoReserva,
  Servicio,
  SalonDetalle,
  SlotTiempo,
} from '../../../tipos';

export interface ResultadoReserva {
  id: string;
  horaInicio: string;
  fecha: string;
  nombreCliente: string;
}

export type PasoReserva = 'especialista' | 'servicios' | 'fecha' | 'hora' | 'confirmar' | 'exitosa';

interface EstadoFlujo {
  paso: PasoReserva;
  sucursalSeleccionada: string;
  personalId: string;
  serviciosSeleccionados: Servicio[];
  observaciones: string;
  fechaSeleccionada: Date;
  horaSeleccionada: string;
  slots: SlotTiempo[];
  cargandoSlots: boolean;
  enviando: boolean;
  metodoPago: MetodoPagoReserva;
  productosSeleccionados: ProductoAdicionalReserva[];
  reservaResultado: ResultadoReserva | null;
}

export function usarFlujoReservaCliente(salon: SalonDetalle) {
  const queryClient = useQueryClient();
  const metodosPagoDisponibles = normalizarMetodosPagoReserva(salon.metodosPagoReserva);
  const [estado, setEstado] = useState<EstadoFlujo>({
    paso: 'especialista',
    sucursalSeleccionada: salon.nombre,
    personalId: '',
    serviciosSeleccionados: [],
    observaciones: '',
    fechaSeleccionada: new Date(),
    horaSeleccionada: '',
    slots: [],
    cargandoSlots: false,
    enviando: false,
    metodoPago: metodosPagoDisponibles[0] ?? 'cash',
    productosSeleccionados: [],
    reservaResultado: null,
  });

  useEffect(() => {
    const metodoPredeterminado = metodosPagoDisponibles[0] ?? 'cash';
    setEstado((actual) =>
      metodosPagoDisponibles.includes(actual.metodoPago)
        ? actual
        : { ...actual, metodoPago: metodoPredeterminado },
    );
  }, [metodosPagoDisponibles]);

  const duracionTotal = estado.serviciosSeleccionados.reduce((s, sv) => s + sv.duration, 0);
  const precioTotal = estado.serviciosSeleccionados.reduce((s, sv) => s + sv.price, 0);
  const totalProductos = estado.productosSeleccionados.reduce(
    (s, producto) => s + producto.total,
    0,
  );

  const mutacionCrearReserva = useMutation({
    mutationFn: async () => {
      const perfilCliente =
        queryClient.getQueryData<PerfilClienteApp>(['mi-perfil']) ?? (await obtenerMiPerfil());

      const nombreCliente = `${perfilCliente.nombre} ${perfilCliente.apellido}`.trim();
      if (!nombreCliente || !perfilCliente.telefono || !perfilCliente.fechaNacimiento) {
        throw new Error(
          'Completa tu nombre, teléfono y fecha de nacimiento en Mi perfil antes de reservar.',
        );
      }

      const resultado = await peticion<{ datos: ResultadoReserva }>('/reservas', {
        method: 'POST',
        body: JSON.stringify({
          estudioId: salon.id,
          personalId: estado.personalId,
          nombreCliente,
          telefonoCliente: perfilCliente.telefono,
          fechaNacimiento: perfilCliente.fechaNacimiento,
          email: perfilCliente.email,
          fecha: obtenerFechaLocalISO(estado.fechaSeleccionada),
          horaInicio: estado.horaSeleccionada,
          duracion: duracionTotal,
          servicios: estado.serviciosSeleccionados,
          precioTotal,
          observaciones: estado.observaciones.trim() || undefined,
          estado: 'pending',
          sucursal: estado.sucursalSeleccionada,
          metodoPago: estado.metodoPago,
          productosSeleccionados: estado.productosSeleccionados.map((producto) => ({
            productoId: producto.id,
            cantidad: producto.cantidad,
          })),
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

  const seleccionarSucursal = (sucursal: string) => {
    setEstado((actual) => ({
      ...actual,
      sucursalSeleccionada: sucursal || salon.nombre,
      personalId: '',
      serviciosSeleccionados: [],
      observaciones: '',
      horaSeleccionada: '',
      slots: [],
      productosSeleccionados: [],
      paso: 'especialista',
    }));
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

  const actualizarObservaciones = (observaciones: string) => {
    setEstado((actual) => ({ ...actual, observaciones }));
  };

  const alternarProducto = (producto: ProductoPublicoReserva) => {
    setEstado((actual) => {
      const existente = actual.productosSeleccionados.find((item) => item.id === producto.id);

      return {
        ...actual,
        productosSeleccionados: existente
          ? actual.productosSeleccionados.filter((item) => item.id !== producto.id)
          : [
              ...actual.productosSeleccionados,
              {
                id: producto.id,
                nombre: producto.nombre,
                categoria: producto.categoria,
                cantidad: 1,
                precioUnitario: producto.precio,
                total: producto.precio,
              },
            ],
      };
    });
  };

  const actualizarCantidadProducto = (productoId: string, cantidad: number) => {
    setEstado((actual) => ({
      ...actual,
      productosSeleccionados: actual.productosSeleccionados.map((producto) =>
        producto.id === productoId
          ? {
              ...producto,
              cantidad,
              total: producto.precioUnitario * cantidad,
            }
          : producto,
      ),
    }));
  };

  const irAFecha = () => setEstado((e) => ({ ...e, paso: 'fecha' }));

  const seleccionarFecha = (d: Date) => {
    setEstado((e) => ({
      ...e,
      fechaSeleccionada: d,
      horaSeleccionada: '',
      slots: [],
      cargandoSlots: false,
      paso: 'hora',
    }));
  };

  const seleccionarHora = (hora: string) => {
    setEstado((e) => ({ ...e, horaSeleccionada: hora, paso: 'confirmar' }));
  };

  const seleccionarEspecialistaYHora = (personalId: string, hora: string) => {
    setEstado((actual) => ({
      ...actual,
      personalId,
      horaSeleccionada: hora,
      paso: 'confirmar',
    }));
  };

  const seleccionarMetodoPago = (metodoPago: MetodoPagoReserva) => {
    setEstado((e) => ({ ...e, metodoPago }));
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

  const reiniciar = () => {
    setEstado({
      paso: 'especialista',
      sucursalSeleccionada: salon.nombre,
      personalId: '',
      serviciosSeleccionados: [],
      observaciones: '',
      fechaSeleccionada: new Date(),
      horaSeleccionada: '',
      slots: [],
      cargandoSlots: false,
      enviando: false,
      metodoPago: metodosPagoDisponibles[0] ?? 'cash',
      productosSeleccionados: [],
      reservaResultado: null,
    });
  };

  const enviarReserva = async (mostrarError: (msg: string) => void) => {
    if (!estado.personalId) {
      mostrarError('Selecciona un especialista antes de continuar.');
      return;
    }
    if (estado.serviciosSeleccionados.length === 0) {
      mostrarError('Selecciona al menos un servicio para tu reserva.');
      return;
    }
    if (!estado.horaSeleccionada) {
      mostrarError('Selecciona un horario disponible antes de confirmar.');
      return;
    }
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
    totalProductos,
    seleccionarSucursal,
    seleccionarPersonal,
    alternarServicio,
    actualizarObservaciones,
    alternarProducto,
    actualizarCantidadProducto,
    irAFecha,
    seleccionarFecha,
    seleccionarHora,
    seleccionarEspecialistaYHora,
    seleccionarMetodoPago,
    retroceder,
    reiniciar,
    enviarReserva,
  };
}
