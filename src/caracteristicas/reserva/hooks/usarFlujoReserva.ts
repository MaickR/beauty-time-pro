import { useState } from 'react';
import { crearReserva } from '../../../servicios/servicioReservas';
import { obtenerFechaLocalISO } from '../../../utils/formato';
import type { Estudio, Servicio, SlotTiempo } from '../../../tipos';

interface DatosContactoFormulario {
  nombreCliente: string;
  telefonoCliente: string;
  fechaNacimiento: string;
  email?: string;
  usarRecompensa?: boolean;
}

interface EstadoFlujo {
  personalSeleccionado: string;
  serviciosSeleccionados: Servicio[];
  fechaSeleccionada: Date;
  horaSeleccionada: string;
  sucursalSeleccionada: string;
  nombreCliente: string;
  telefonoCliente: string;
  fechaNacimiento: string;
  email: string;
  marcaTinte: string;
  numeroTinte: string;
  reservaExitosa: boolean;
  nombreClienteReservado: string;
  descripcionRecompensaGanada: string;
}

export interface HookFlujoReserva extends EstadoFlujo {
  slots: SlotTiempo[];
  seleccionarPersonal: (id: string) => void;
  alternarServicio: (servicio: Servicio) => void;
  seleccionarFecha: (d: Date) => void;
  seleccionarHora: (h: string) => void;
  seleccionarSucursal: (b: string) => void;
  actualizarContacto: (campo: keyof Pick<EstadoFlujo, 'nombreCliente' | 'telefonoCliente' | 'fechaNacimiento' | 'email' | 'marcaTinte' | 'numeroTinte'>, valor: string) => void;
  enviarReserva: (estudio: Estudio, mostrarError: (msg: string) => void, datos: DatosContactoFormulario) => Promise<void>;
  reiniciar: () => void;
}

const PALABRAS_COLOR = ['tinte', 'color', 'balayage', 'babylights', 'canas', 'ombré', 'decoloración', 'rayitos', 'mechas'];

export function usarFlujoReserva(): Omit<HookFlujoReserva, 'slots'> {
  const [personalSeleccionado, setPersonalSeleccionado] = useState('');
  const [serviciosSeleccionados, setServiciosSeleccionados] = useState<Servicio[]>([]);
  const [fechaSeleccionada, setFechaSeleccionada] = useState(new Date());
  const [horaSeleccionada, setHoraSeleccionada] = useState('');
  const [sucursalSeleccionada, setSucursalSeleccionada] = useState('');
  const [nombreCliente, setNombreCliente] = useState('');
  const [telefonoCliente, setTelefonoCliente] = useState('');
  const [fechaNacimiento, setFechaNacimiento] = useState('');
  const [email, setEmail] = useState('');
  const [marcaTinte, setMarcaTinte] = useState('');
  const [numeroTinte, setNumeroTinte] = useState('');
  const [reservaExitosa, setReservaExitosa] = useState(false);
  const [nombreClienteReservado, setNombreClienteReservado] = useState('');
  const [descripcionRecompensaGanada, setDescripcionRecompensaGanada] = useState('');

  const seleccionarPersonal = (id: string) => {
    setPersonalSeleccionado(id);
    setServiciosSeleccionados([]);
    setHoraSeleccionada('');
  };

  const alternarServicio = (servicio: Servicio) => {
    setServiciosSeleccionados((prev) => {
      const idx = prev.findIndex((s) => s.name === servicio.name);
      const siguiente = idx > -1 ? prev.filter((_, i) => i !== idx) : [...prev, servicio];
      return siguiente;
    });
    setHoraSeleccionada('');
  };

  const seleccionarFecha = (d: Date) => { setFechaSeleccionada(d); setHoraSeleccionada(''); };
  const seleccionarHora = (h: string) => setHoraSeleccionada(h);
  const seleccionarSucursal = (b: string) => setSucursalSeleccionada(b);

  const actualizarContacto = (
    campo: keyof Pick<EstadoFlujo, 'nombreCliente' | 'telefonoCliente' | 'fechaNacimiento' | 'email' | 'marcaTinte' | 'numeroTinte'>,
    valor: string,
  ) => {
    const setters: Record<string, (v: string) => void> = {
      nombreCliente: setNombreCliente,
      telefonoCliente: setTelefonoCliente,
      fechaNacimiento: setFechaNacimiento,
      email: setEmail,
      marcaTinte: setMarcaTinte,
      numeroTinte: setNumeroTinte,
    };
    setters[campo](valor);
  };

  const enviarReserva = async (
    estudio: Estudio,
    mostrarError: (msg: string) => void,
    datos: DatosContactoFormulario,
  ) => {
    if (serviciosSeleccionados.length === 0 || !horaSeleccionada || !sucursalSeleccionada || !personalSeleccionado) {
      mostrarError('Por favor completa todos los campos requeridos antes de confirmar.');
      return;
    }

    const totalDuracion = serviciosSeleccionados.reduce((acc, s) => acc + s.duration, 0);
    const totalPrecio = serviciosSeleccionados.reduce((acc, s) => acc + (s.price ?? 0), 0);
    const fechaStr = obtenerFechaLocalISO(fechaSeleccionada);
    const requiereColor = serviciosSeleccionados.some((s) =>
      PALABRAS_COLOR.some((kw) => s.name.toLowerCase().includes(kw)),
    );

    try {
      const resultado = await crearReserva({
        studioId: estudio.id,
        studioName: estudio.name,
        clientName: datos.nombreCliente,
        clientPhone: datos.telefonoCliente,
        fechaNacimiento: datos.fechaNacimiento,
        email: datos.email ?? '',
        usarRecompensa: datos.usarRecompensa ?? false,
        services: serviciosSeleccionados,
        totalDuration: totalDuracion,
        totalPrice: totalPrecio,
        status: 'confirmed',
        branch: sucursalSeleccionada,
        staffId: personalSeleccionado,
        staffName: estudio.staff.find((s) => s.id === personalSeleccionado)?.name ?? '',
        colorBrand: requiereColor ? marcaTinte : null,
        colorNumber: requiereColor ? numeroTinte : null,
        date: fechaStr,
        time: horaSeleccionada,
        createdAt: new Date().toISOString(),
      });

      setNombreClienteReservado(datos.nombreCliente);
  setDescripcionRecompensaGanada(resultado.descripcion ?? '');
      setReservaExitosa(true);
      setNombreCliente('');
      setTelefonoCliente('');
      setFechaNacimiento('');
      setEmail('');
      setMarcaTinte('');
      setNumeroTinte('');
      setHoraSeleccionada('');
      setServiciosSeleccionados([]);
      setPersonalSeleccionado('');
    } catch (err) {
      console.error(err);
      mostrarError('Ocurrió un error al agendar tu cita. Inténtalo de nuevo.');
    }
  };

  const reiniciar = () => {
    setReservaExitosa(false);
    setDescripcionRecompensaGanada('');
  };

  return {
    personalSeleccionado,
    serviciosSeleccionados,
    fechaSeleccionada,
    horaSeleccionada,
    sucursalSeleccionada,
    nombreCliente,
    telefonoCliente,
    fechaNacimiento,
    email,
    marcaTinte,
    numeroTinte,
    reservaExitosa,
    nombreClienteReservado,
    descripcionRecompensaGanada,
    seleccionarPersonal,
    alternarServicio,
    seleccionarFecha,
    seleccionarHora,
    seleccionarSucursal,
    actualizarContacto,
    enviarReserva,
    reiniciar,
  };
}
