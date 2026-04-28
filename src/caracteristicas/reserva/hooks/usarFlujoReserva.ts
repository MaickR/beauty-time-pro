import { useState } from 'react';
import { crearReserva } from '../../../servicios/servicioReservas';
import { obtenerFechaLocalISO } from '../../../utils/formato';
import type {
  Estudio,
  ProductoAdicionalReserva,
  ProductoPublicoReserva,
  Servicio,
  SlotTiempo,
} from '../../../tipos';
import { construirNotaServicio, obtenerClaveServicioReserva } from '../utils/detallesServicios';

interface DatosContactoFormulario {
  nombreCliente: string;
  telefonoCliente: string;
  fechaNacimiento?: string;
  email?: string;
  observaciones?: string;
  metodoPago?: 'cash' | 'card' | 'bank_transfer' | 'digital_transfer';
  usarRecompensa?: boolean;
}

interface ResumenReservaConfirmada {
  fecha: string;
  hora: string;
  especialista: string;
  servicios: string[];
  productos: Array<{ nombre: string; cantidad: number }>;
  duracion: number;
  total: number;
}

interface EstadoFlujo {
  personalSeleccionado: string;
  serviciosSeleccionados: Servicio[];
  fechaSeleccionada: Date;
  horaSeleccionada: string;
  sucursalSeleccionada: string;
  productosSeleccionados: ProductoAdicionalReserva[];
  nombreCliente: string;
  telefonoCliente: string;
  fechaNacimiento: string;
  email: string;
  metodoPago: 'cash' | 'card' | 'bank_transfer' | 'digital_transfer';
  detallesServicios: Record<string, Record<string, string>>;
  reservaExitosa: boolean;
  nombreClienteReservado: string;
  descripcionRecompensaGanada: string;
  resumenReservaConfirmada: ResumenReservaConfirmada | null;
}

export interface HookFlujoReserva extends EstadoFlujo {
  slots: SlotTiempo[];
  seleccionarPersonal: (id: string) => void;
  seleccionarEspecialistaYHora: (personalId: string, hora: string) => void;
  alternarServicio: (servicio: Servicio) => void;
  seleccionarFecha: (d: Date) => void;
  seleccionarHora: (h: string) => void;
  seleccionarSucursal: (b: string) => void;
  precargarContacto: (datos: {
    nombreCliente: string;
    telefonoCliente: string;
    fechaNacimiento: string;
    email: string;
  }) => void;
  alternarProducto: (producto: ProductoPublicoReserva) => void;
  actualizarCantidadProducto: (productoId: string, cantidad: number) => void;
  actualizarContacto: (
    campo: keyof Pick<
      EstadoFlujo,
      'nombreCliente' | 'telefonoCliente' | 'fechaNacimiento' | 'email' | 'metodoPago'
    >,
    valor: string,
  ) => void;
  actualizarDetalleServicio: (servicioClave: string, campoClave: string, valor: string) => void;
  enviarReserva: (
    estudio: Estudio,
    mostrarError: (msg: string) => void,
    datos: DatosContactoFormulario,
  ) => Promise<void>;
  reiniciar: (sucursalInicial?: string) => void;
}

export function usarFlujoReserva(): Omit<HookFlujoReserva, 'slots'> {
  const [personalSeleccionado, setPersonalSeleccionado] = useState('');
  const [serviciosSeleccionados, setServiciosSeleccionados] = useState<Servicio[]>([]);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date());
  const [horaSeleccionada, setHoraSeleccionada] = useState('');
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState('');
  const [productosSeleccionados, setProductosSeleccionados] = useState<ProductoAdicionalReserva[]>(
    [],
  );
  const [nombreCliente, setNombreCliente] = useState('');
  const [telefonoCliente, setTelefonoCliente] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [email, setEmail] = useState('');
  const [metodoPago, setMetodoPago] = useState<
    'cash' | 'card' | 'bank_transfer' | 'digital_transfer'
  >('cash');
  const [detallesServicios, setDetallesServicios] = useState<
    Record<string, Record<string, string>>
  >({});
  const [reservaExitosa, setReservaExitosa] = useState(false);
  const [nombreClienteReservado, setNombreClienteReservado] = useState('');
  const [descripcionRecompensaGanada, setDescripcionRecompensaGanada] = useState('');
  const [resumenReservaConfirmada, setResumenReservaConfirmada] =
    useState<ResumenReservaConfirmada | null>(null);

  const seleccionarPersonal = (id: string) => {
    setPersonalSeleccionado(id);
    setServiciosSeleccionados([]);
    setDetallesServicios({});
    setHoraSeleccionada('');
  };

  // Versión que selecciona especialista + hora juntos sin borrar los servicios.
  // Usada desde el nuevo SelectorEspecialistaHorario (flujo Block 8).
  const seleccionarEspecialistaYHora = (personalId: string, hora: string) => {
    setPersonalSeleccionado(personalId);
    setHoraSeleccionada(hora);
  };

  const alternarServicio = (servicio: Servicio) => {
    setServiciosSeleccionados((prev) => {
      const idx = prev.findIndex((s) => s.name === servicio.name);
      if (idx > -1) {
        const servicioEliminado = prev[idx];
        const claveServicio = obtenerClaveServicioReserva(servicioEliminado);
        setDetallesServicios((previo) => {
          if (!(claveServicio in previo)) return previo;
          const siguiente = { ...previo };
          delete siguiente[claveServicio];
          return siguiente;
        });
      }
      const siguiente = idx > -1 ? prev.filter((_, i) => i !== idx) : [...prev, servicio];
      return siguiente;
    });
    setHoraSeleccionada('');
  };

  const seleccionarFecha = (d: Date) => {
    setFechaSeleccionada(d);
    setHoraSeleccionada('');
  };
  const seleccionarHora = (h: string) => setHoraSeleccionada(h);
  const seleccionarSucursal = (b: string) => {
    setSucursalSeleccionada(b);
    setPersonalSeleccionado('');
    setServiciosSeleccionados([]);
    setDetallesServicios({});
    setProductosSeleccionados([]);
    setHoraSeleccionada('');
    setResumenReservaConfirmada(null);
  };

  const precargarContacto = (datos: {
    nombreCliente: string;
    telefonoCliente: string;
    fechaNacimiento: string;
    email: string;
  }) => {
    setNombreCliente(datos.nombreCliente);
    setTelefonoCliente(datos.telefonoCliente);
    setFechaNacimiento(datos.fechaNacimiento);
    setEmail(datos.email);
  };

  const alternarProducto = (producto: ProductoPublicoReserva) => {
    setProductosSeleccionados((previo) => {
      const existente = previo.find((item) => item.id === producto.id);
      if (existente) {
        return previo.filter((item) => item.id !== producto.id);
      }

      return [
        ...previo,
        {
          id: producto.id,
          nombre: producto.nombre,
          categoria: producto.categoria,
          cantidad: 1,
          precioUnitario: producto.precio,
          total: producto.precio,
        },
      ];
    });
  };

  const actualizarCantidadProducto = (productoId: string, cantidad: number) => {
    setProductosSeleccionados((previo) =>
      previo.map((producto) =>
        producto.id === productoId
          ? {
              ...producto,
              cantidad,
              total: producto.precioUnitario * cantidad,
            }
          : producto,
      ),
    );
  };

  const actualizarContacto = (
    campo: keyof Pick<
      EstadoFlujo,
      'nombreCliente' | 'telefonoCliente' | 'fechaNacimiento' | 'email' | 'metodoPago'
    >,
    valor: string,
  ) => {
    if (campo === 'metodoPago') {
      setMetodoPago(valor as EstadoFlujo['metodoPago']);
      return;
    }

    const setters: Record<
      'nombreCliente' | 'telefonoCliente' | 'fechaNacimiento' | 'email',
      (v: string) => void
    > = {
      nombreCliente: setNombreCliente,
      telefonoCliente: setTelefonoCliente,
      fechaNacimiento: setFechaNacimiento,
      email: setEmail,
    };
    setters[campo](valor);
  };

  const actualizarDetalleServicio = (servicioClave: string, campoClave: string, valor: string) => {
    setDetallesServicios((previo) => ({
      ...previo,
      [servicioClave]: {
        ...(previo[servicioClave] ?? {}),
        [campoClave]: valor,
      },
    }));
  };

  const enviarReserva = async (
    estudio: Estudio,
    mostrarError: (msg: string) => void,
    datos: DatosContactoFormulario,
  ) => {
    if (serviciosSeleccionados.length === 0 || !horaSeleccionada || !personalSeleccionado) {
      mostrarError('Por favor completa todos los campos requeridos antes de confirmar.');
      return;
    }

    const totalDuracion = serviciosSeleccionados.reduce((acc, s) => acc + s.duration, 0);
    const totalPrecio = serviciosSeleccionados.reduce((acc, s) => acc + (s.price ?? 0), 0);
    const totalProductos = productosSeleccionados.reduce(
      (acc, producto) => acc + producto.total,
      0,
    );
    const fechaStr = obtenerFechaLocalISO(fechaSeleccionada);
    const serviciosConDetalles = serviciosSeleccionados.map((servicio) => ({
      ...servicio,
      motivo: construirNotaServicio(
        servicio,
        detallesServicios[obtenerClaveServicioReserva(servicio)],
      ),
    }));

    try {
      const resultado = await crearReserva({
        studioId: estudio.id,
        studioName: estudio.name,
        clientName: datos.nombreCliente,
        clientPhone: datos.telefonoCliente,
        fechaNacimiento: datos.fechaNacimiento,
        email: datos.email ?? '',
        usarRecompensa: datos.usarRecompensa ?? false,
        services: serviciosConDetalles,
        totalDuration: totalDuracion,
        totalPrice: totalPrecio,
        status: 'confirmed',
        branch: estudio.name,
        staffId: personalSeleccionado,
        staffName: estudio.staff.find((s) => s.id === personalSeleccionado)?.name ?? '',
        colorBrand: null,
        colorNumber: null,
        observaciones: datos.observaciones || null,
        paymentMethod: datos.metodoPago ?? metodoPago,
        productosSeleccionados: productosSeleccionados.map((producto) => ({
          productoId: producto.id,
          cantidad: producto.cantidad,
        })),
        date: fechaStr,
        time: horaSeleccionada,
        createdAt: new Date().toISOString(),
      });

      setNombreClienteReservado(datos.nombreCliente);
      setDescripcionRecompensaGanada(resultado.descripcion ?? '');
      setResumenReservaConfirmada({
        fecha: fechaStr,
        hora: horaSeleccionada,
        especialista: estudio.staff.find((s) => s.id === personalSeleccionado)?.name ?? '',
        servicios: serviciosSeleccionados.map((servicio) => servicio.name),
        productos: productosSeleccionados.map((producto) => ({
          nombre: producto.nombre,
          cantidad: producto.cantidad,
        })),
        duracion: totalDuracion,
        total: totalPrecio + totalProductos,
      });
      setReservaExitosa(true);
      setNombreCliente('');
      setTelefonoCliente('');
      setFechaNacimiento('');
      setEmail('');
      setMetodoPago('cash');
      setDetallesServicios({});
      setHoraSeleccionada('');
      setServiciosSeleccionados([]);
      setProductosSeleccionados([]);
      setPersonalSeleccionado('');
    } catch (err) {
      console.error(err);
      mostrarError('Ocurrió un error al agendar tu cita. Inténtalo de nuevo.');
    }
  };

  const reiniciar = (sucursalInicial: string = '') => {
    setReservaExitosa(false);
    setDescripcionRecompensaGanada('');
    setResumenReservaConfirmada(null);
    setPersonalSeleccionado('');
    setServiciosSeleccionados([]);
    setFechaSeleccionada(new Date());
    setHoraSeleccionada('');
    setSucursalSeleccionada(sucursalInicial);
    setProductosSeleccionados([]);
    setNombreCliente('');
    setTelefonoCliente('');
    setFechaNacimiento('');
    setEmail('');
    setMetodoPago('cash');
    setDetallesServicios({});
  };

  return {
    personalSeleccionado,
    serviciosSeleccionados,
    fechaSeleccionada,
    horaSeleccionada,
    sucursalSeleccionada,
    productosSeleccionados,
    nombreCliente,
    telefonoCliente,
    fechaNacimiento,
    email,
    metodoPago,
    detallesServicios,
    reservaExitosa,
    nombreClienteReservado,
    descripcionRecompensaGanada,
    resumenReservaConfirmada,
    seleccionarPersonal,
    seleccionarEspecialistaYHora,
    alternarServicio,
    seleccionarFecha,
    seleccionarHora,
    seleccionarSucursal,
    precargarContacto,
    alternarProducto,
    actualizarCantidadProducto,
    actualizarContacto,
    actualizarDetalleServicio,
    enviarReserva,
    reiniciar,
  };
}
