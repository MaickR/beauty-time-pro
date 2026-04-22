import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Calendar, RefreshCw, X } from 'lucide-react';
import {
  cancelarMiReserva,
  obtenerSalonPublico,
  reagendarMiReserva,
} from '../../../servicios/servicioClienteApp';
import { CalendarioEstadoSalon } from '../../../componentes/ui/CalendarioEstadoSalon';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import {
  formatearDinero,
  obtenerFechaLocalISO,
  obtenerMonedaPorPais,
} from '../../../utils/formato';
import type {
  Estudio,
  Pais,
  ProductoAdicionalReserva,
  ReservaCliente,
  SalonDetalle,
} from '../../../tipos';

const ESTADOS_RESERVA: Record<string, { etiqueta: string; color: string }> = {
  pending: { etiqueta: 'Confirmada', color: 'bg-emerald-100 text-emerald-700' },
  confirmed: { etiqueta: 'Confirmada', color: 'bg-emerald-100 text-emerald-700' },
  working: { etiqueta: 'Trabajando', color: 'bg-sky-100 text-sky-700' },
  completed: { etiqueta: 'Completada', color: 'bg-slate-100 text-slate-700' },
  cancelled: { etiqueta: 'Cancelada', color: 'bg-red-100 text-red-700' },
  no_show: { etiqueta: 'No asistiÃ³', color: 'bg-slate-200 text-slate-700' },
};

function formatearFechaReservaNatural(fecha: string, horaInicio: string): string {
  const fechaHora = new Date(`${fecha}T${horaInicio}:00`);

  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(fechaHora)
    .replace(',', ' Â·')
    .replace(/^./, (texto) => texto.toUpperCase());
}

function obtenerFechaDesdeIso(fechaIso: string): Date {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  return new Date(anio ?? 0, (mes ?? 1) - 1, dia ?? 1);
}

function formatearFechaCabecera(fechaIso: string): string {
  return obtenerFechaDesdeIso(fechaIso).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function calcularHoraFin(horaInicio: string, duracion: number): string {
  const [hora, minuto] = horaInicio.split(':').map(Number);
  const totalMinutos = (hora ?? 0) * 60 + (minuto ?? 0) + duracion;
  const horaFinal = Math.floor(totalMinutos / 60) % 24;
  const minutoFinal = totalMinutos % 60;
  return `${String(horaFinal).padStart(2, '0')}:${String(minutoFinal).padStart(2, '0')}`;
}

function formatearMetodoPagoReserva(metodoPago?: string | null): string {
  switch (metodoPago) {
    case 'cash':
      return 'Efectivo';
    case 'card':
      return 'Tarjeta';
    case 'bank_transfer':
      return 'Transferencia bancaria';
    case 'digital_transfer':
      return 'Transferencia digital';
    default:
      return 'Pendiente';
  }
}

function formatearDuracionReserva(duracion: number): string {
  const horas = Math.floor(duracion / 60);
  const minutos = duracion % 60;

  if (horas === 0) {
    return `${duracion} min`;
  }

  if (minutos === 0) {
    return `${horas} h`;
  }

  return `${horas} h ${minutos} min`;
}

function obtenerDireccionReserva(reserva: ReservaCliente): string {
  return reserva.salon.direccion?.trim() || reserva.sucursal || reserva.salon.nombre;
}

function obtenerProductosReserva(reserva: ReservaCliente): ProductoAdicionalReserva[] {
  return Array.isArray(reserva.productosAdicionales) ? reserva.productosAdicionales : [];
}

function obtenerFechaConReservaMasRelevante(
  reservas: ReservaCliente[],
  fechaBaseIso: string,
): string | null {
  const fechas = Array.from(new Set(reservas.map((reserva) => reserva.fecha))).sort();

  if (fechas.length === 0) {
    return null;
  }

  if (fechas.includes(fechaBaseIso)) {
    return fechaBaseIso;
  }

  const siguiente = fechas.find((fecha) => fecha > fechaBaseIso);
  if (siguiente) {
    return siguiente;
  }

  return fechas[fechas.length - 1] ?? null;
}

function puedeCancelarReserva(reserva: ReservaCliente): boolean {
  if (!['pending', 'confirmed'].includes(reserva.estado)) {
    return false;
  }

  const fechaHora = new Date(`${reserva.fecha}T${reserva.horaInicio}:00`).getTime();
  return fechaHora - Date.now() > 2 * 60 * 60 * 1000;
}

function puedeReagendarReserva(reserva: ReservaCliente): boolean {
  if (!['pending', 'confirmed'].includes(reserva.estado)) {
    return false;
  }

  if (reserva.reagendada || reserva.reservaOriginalId) {
    return false;
  }

  const fechaHora = new Date(`${reserva.fecha}T${reserva.horaInicio}:00`).getTime();
  return fechaHora > Date.now();
}

function construirEstudioCalendarioCliente(salon: SalonDetalle): Estudio {
  return {
    id: salon.id,
    slug: salon.slug ?? salon.id,
    name: salon.nombre,
    owner: salon.nombre,
    phone: salon.telefono,
    country: salon.pais,
    plan: salon.plan,
    branches: salon.direccion ? [salon.direccion] : ['Principal'],
    assignedKey: salon.id,
    clientKey: salon.id,
    subscriptionStart: '',
    paidUntil: '',
    holidays: salon.festivos,
    availabilityExceptions: salon.availabilityExceptions ?? [],
    schedule: salon.horario,
    selectedServices: salon.servicios,
    productos: salon.productos,
    customServices: [],
    staff: [],
    colorPrimario: salon.colorPrimario,
    logoUrl: salon.logoUrl,
    direccion: salon.direccion,
    emailContacto: salon.emailContacto,
    createdAt: '',
    updatedAt: '',
  };
}

interface PropsPanelReservasCliente {
  reservas: ReservaCliente[];
  paisCliente: Pais;
}

export function PanelReservasCliente({ reservas, paisCliente }: PropsPanelReservasCliente) {
  const queryClient = useQueryClient();
  const { mostrarToast } = usarToast();
  const [reservaCancelar, setReservaCancelar] = useState<ReservaCliente | null>(null);
  const [reservaReagendar, setReservaReagendar] = useState<ReservaCliente | null>(null);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [nuevaHora, setNuevaHora] = useState('');
  const [salonSeleccionadoId, setSalonSeleccionadoId] = useState<string>('');
  const [fechaCalendarioSalon, setFechaCalendarioSalon] = useState(new Date());

  const hoy = useMemo(() => obtenerFechaLocalISO(new Date()), []);
  const moneda = obtenerMonedaPorPais(paisCliente);

  const salonesDisponibles = useMemo(
    () =>
      Array.from(
        new Map(
          reservas.map((reserva) => [
            reserva.salon.id,
            {
              id: reserva.salon.id,
              nombre: reserva.salon.nombre,
              colorPrimario: reserva.salon.colorPrimario ?? '#C6968C',
              cantidad: reservas.filter((item) => item.salon.id === reserva.salon.id).length,
              ultimaFecha:
                reservas
                  .filter((item) => item.salon.id === reserva.salon.id)
                  .map((item) => item.fecha)
                  .sort()
                  .slice(-1)[0] ?? null,
            },
          ]),
        ).values(),
      ).sort((a, b) => a.nombre.localeCompare(b.nombre)),
    [reservas],
  );

  useEffect(() => {
    if (salonesDisponibles.length === 0) {
      setSalonSeleccionadoId('');
      return;
    }

    if (!salonesDisponibles.some((salon) => salon.id === salonSeleccionadoId)) {
      setSalonSeleccionadoId(salonesDisponibles[0]!.id);
    }
  }, [salonesDisponibles, salonSeleccionadoId]);

  const reservasSalonSeleccionado = useMemo(
    () =>
      reservas
        .filter((reserva) => reserva.salon.id === salonSeleccionadoId)
        .sort((a, b) => `${a.fecha}T${a.horaInicio}`.localeCompare(`${b.fecha}T${b.horaInicio}`)),
    [reservas, salonSeleccionadoId],
  );

  useEffect(() => {
    const fechaObjetivo = obtenerFechaConReservaMasRelevante(reservasSalonSeleccionado, hoy);

    setFechaCalendarioSalon(fechaObjetivo ? obtenerFechaDesdeIso(fechaObjetivo) : new Date());
  }, [hoy, reservasSalonSeleccionado, salonSeleccionadoId]);

  const consultaSalonCalendario = useQuery({
    queryKey: ['cliente-salon-calendario', salonSeleccionadoId],
    queryFn: () => obtenerSalonPublico(salonSeleccionadoId),
    enabled: salonSeleccionadoId.length > 0,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: () => (document.visibilityState === 'visible' ? 60_000 : false),
  });

  const estudioCalendarioCliente = consultaSalonCalendario.data
    ? construirEstudioCalendarioCliente(consultaSalonCalendario.data)
    : null;

  const fechaSeleccionadaIso = obtenerFechaLocalISO(fechaCalendarioSalon);
  const fechasConReservas = useMemo(
    () => Array.from(new Set(reservasSalonSeleccionado.map((reserva) => reserva.fecha))).sort(),
    [reservasSalonSeleccionado],
  );
  const reservasDiaSeleccionado = useMemo(
    () => reservasSalonSeleccionado.filter((reserva) => reserva.fecha === fechaSeleccionadaIso),
    [fechaSeleccionadaIso, reservasSalonSeleccionado],
  );
  const resumenDiaSeleccionado = useMemo(() => {
    if (reservasDiaSeleccionado.length === 0) {
      return null;
    }

    const primeraReserva = reservasDiaSeleccionado[0];
    const ultimaReserva = reservasDiaSeleccionado[reservasDiaSeleccionado.length - 1];
    const estados = Array.from(
      new Set(
        reservasDiaSeleccionado.map(
          (reserva) => (ESTADOS_RESERVA[reserva.estado] ?? ESTADOS_RESERVA.pending).etiqueta,
        ),
      ),
    );
    const servicios = Array.from(
      new Set(
        reservasDiaSeleccionado.flatMap((reserva) => {
          if (reserva.serviciosDetalle && reserva.serviciosDetalle.length > 0) {
            return reserva.serviciosDetalle.map((servicio) => servicio.name);
          }

          return reserva.servicios.map((servicio) => servicio.name);
        }),
      ),
    );

    return {
      cantidad: reservasDiaSeleccionado.length,
      horaInicio: primeraReserva?.horaInicio ?? '00:00',
      horaFin: ultimaReserva
        ? calcularHoraFin(ultimaReserva.horaInicio, ultimaReserva.duracion)
        : '00:00',
      total: reservasDiaSeleccionado.reduce(
        (acumulado, reserva) => acumulado + reserva.precioTotal,
        0,
      ),
      estados,
      servicios,
      citas: reservasDiaSeleccionado,
    };
  }, [reservasDiaSeleccionado]);

  useEffect(() => {}, [fechaSeleccionadaIso, salonSeleccionadoId]);

  const mutacionCancelar = useMutation({
    mutationFn: (reservaId: string) => cancelarMiReserva(reservaId),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mi-perfil'] }),
        queryClient.invalidateQueries({ queryKey: ['mis-reservas'] }),
        queryClient.invalidateQueries({ queryKey: ['reservas-proximas'] }),
      ]);
      setReservaCancelar(null);
      mostrarToast({ mensaje: 'Reserva cancelada correctamente', variante: 'exito' });
    },
    onError: (error: unknown) => {
      const mensaje = error instanceof Error ? error.message : 'No se pudo cancelar la reserva';
      mostrarToast({ mensaje, variante: 'error' });
    },
  });

  const mutacionReagendar = useMutation({
    mutationFn: (datos: { id: string; fecha: string; horaInicio: string }) =>
      reagendarMiReserva(datos.id, { fecha: datos.fecha, horaInicio: datos.horaInicio }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['mi-perfil'] }),
        queryClient.invalidateQueries({ queryKey: ['mis-reservas'] }),
        queryClient.invalidateQueries({ queryKey: ['reservas-proximas'] }),
      ]);
      setReservaReagendar(null);
      setNuevaFecha('');
      setNuevaHora('');
      mostrarToast({ mensaje: 'Reserva reagendada correctamente', variante: 'exito' });
    },
    onError: (error: unknown) => {
      const mensaje = error instanceof Error ? error.message : 'No se pudo reagendar la reserva';
      mostrarToast({ mensaje, variante: 'error' });
    },
  });

  const puedeEnviarReagendado =
    Boolean(reservaReagendar) &&
    nuevaFecha.length > 0 &&
    nuevaHora.length > 0 &&
    !mutacionReagendar.isPending;

  const salonActivo = salonesDisponibles.find((salon) => salon.id === salonSeleccionadoId) ?? null;

  return (
    <section id="reservas" aria-labelledby="titulo-reservas" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2
            id="titulo-reservas"
            className="flex items-center gap-2 text-lg font-black text-slate-900"
          >
            <Calendar className="h-5 w-5 text-pink-600" aria-hidden="true" /> Mis reservas
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Navega por el calendario de cada salÃ³n para ver las citas que ya tuviste, tienes o
            tendrÃ¡s, con todo el detalle del dÃ­a seleccionado.
          </p>
        </div>
        <span className="rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-pink-700">
          {reservas.length} cita{reservas.length === 1 ? '' : 's'} registradas
        </span>
      </div>

      {salonesDisponibles.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-sm font-bold text-slate-500">
            AÃºn no tienes reservas asociadas a tu cuenta.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            <div className="space-y-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="mx-auto max-w-3xl text-center">
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-pink-600">
                  Calendario por salÃ³n
                </p>
                <h3 className="mt-2 text-base font-black text-slate-900">Calendario</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Los puntos rosas marcan los dÃ­as en que tuviste, tienes o tendrÃ¡s una cita en el
                  salÃ³n seleccionado.
                </p>
              </div>

              {salonesDisponibles.length > 1 && (
                <div className="rounded-3xl border border-slate-100 bg-slate-50 p-3 sm:p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        Tus salones
                      </p>
                      <p className="mt-1 text-sm font-medium text-slate-500">
                        Cambia de contexto sin perder el detalle de tus reservas.
                      </p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                      {salonesDisponibles.length} salones
                    </span>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {salonesDisponibles.map((salon) => (
                      <button
                        key={salon.id}
                        type="button"
                        onClick={() => setSalonSeleccionadoId(salon.id)}
                        aria-pressed={salonSeleccionadoId === salon.id}
                        className={`rounded-[1.75rem] border px-4 py-4 text-left transition-all ${
                          salonSeleccionadoId === salon.id
                            ? 'border-slate-900 bg-slate-900 text-white shadow-lg'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-pink-200 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black">{salon.nombre}</p>
                            <p
                              className={`mt-2 text-[10px] font-black uppercase tracking-[0.18em] ${
                                salonSeleccionadoId === salon.id
                                  ? 'text-slate-300'
                                  : 'text-slate-400'
                              }`}
                            >
                              {salon.cantidad} cita{salon.cantidad === 1 ? '' : 's'} registrada
                              {salon.cantidad === 1 ? '' : 's'}
                            </p>
                          </div>
                          <span
                            className="mt-1 h-3 w-3 rounded-full"
                            style={{ backgroundColor: salon.colorPrimario }}
                            aria-hidden="true"
                          />
                        </div>
                        <p
                          className={`mt-3 text-xs font-medium ${
                            salonSeleccionadoId === salon.id ? 'text-slate-200' : 'text-slate-500'
                          }`}
                        >
                          {salon.ultimaFecha
                            ? `Ãšltima fecha con reserva: ${formatearFechaCabecera(salon.ultimaFecha)}`
                            : 'Sin fechas registradas todavÃ­a.'}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {salonActivo && (
                <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-3xl border border-slate-100 bg-gradient-to-r from-slate-50 via-white to-pink-50 px-4 py-4 text-left sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      SalÃ³n activo
                    </p>
                    <p className="mt-1 text-lg font-black text-slate-900">{salonActivo.nombre}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:w-auto">
                    <div className="rounded-2xl border border-white bg-white/80 px-3 py-2 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                        Citas
                      </p>
                      <p className="mt-1 text-sm font-black text-slate-900">
                        {salonActivo.cantidad}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white bg-white/80 px-3 py-2 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
                        Ãšltima fecha
                      </p>
                      <p className="mt-1 text-sm font-black text-slate-900">
                        {salonActivo.ultimaFecha
                          ? formatearFechaCabecera(salonActivo.ultimaFecha)
                          : 'Sin datos'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {consultaSalonCalendario.isLoading && (
                <div
                  className="mx-auto h-80 w-full max-w-3xl animate-pulse rounded-4xl bg-slate-100"
                  aria-busy="true"
                />
              )}

              {consultaSalonCalendario.isError && (
                <div className="mx-auto max-w-3xl rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
                  No se pudo cargar el calendario del salÃ³n.
                </div>
              )}

              {estudioCalendarioCliente && !consultaSalonCalendario.isLoading && (
                <div className="mx-auto w-full max-w-3xl">
                  <CalendarioEstadoSalon
                    estudio={estudioCalendarioCliente}
                    fechaSeleccionada={fechaCalendarioSalon}
                    alCambiarFecha={setFechaCalendarioSalon}
                    fechasConCitas={fechasConReservas}
                    etiquetaCitas="Tus citas"
                    titulo={salonActivo?.nombre ?? 'Calendario'}
                  />
                </div>
              )}
            </div>

            <aside className="space-y-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-pink-600">
                  Fecha seleccionada
                </p>
                <h3 className="mt-2 text-xl font-black text-slate-900">
                  {formatearFechaCabecera(fechaSeleccionadaIso)}
                </h3>
                <p className="mt-2 text-sm text-slate-500">{salonActivo?.nombre ?? 'SalÃ³n'}</p>
              </div>

              {resumenDiaSeleccionado ? (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                        Citas
                      </p>
                      <p className="mt-1 text-sm font-black text-slate-900">
                        {resumenDiaSeleccionado.cantidad}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                        Horario
                      </p>
                      <p className="mt-1 text-sm font-black text-slate-900">
                        {resumenDiaSeleccionado.horaInicio} - {resumenDiaSeleccionado.horaFin}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                        Total
                      </p>
                      <p className="mt-1 text-sm font-black text-slate-900">
                        {formatearDinero(resumenDiaSeleccionado.total, moneda)}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
                      <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                        Estados
                      </p>
                      <p className="mt-1 text-sm font-black text-slate-900">
                        {resumenDiaSeleccionado.estados.join(', ')}
                      </p>
                    </div>
                  </div>

                  {resumenDiaSeleccionado.servicios.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                        Servicios del dÃ­a
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {resumenDiaSeleccionado.servicios.map((servicio) => (
                          <span
                            key={`${fechaSeleccionadaIso}-${servicio}`}
                            className="rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-xs font-bold text-pink-700"
                          >
                            {servicio}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                      Agendamientos del dÃ­a
                    </p>
                    {resumenDiaSeleccionado.citas.map((reserva) => (
                      <article
                        key={reserva.id}
                        className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4"
                      >
                        {(() => {
                          const estado = ESTADOS_RESERVA[reserva.estado] ?? ESTADOS_RESERVA.pending;
                          const cancelable = puedeCancelarReserva(reserva);
                          const reagendable = puedeReagendarReserva(reserva);
                          const productos = obtenerProductosReserva(reserva);

                          return (
                            <>
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
                                    {formatearFechaReservaNatural(
                                      reserva.fecha,
                                      reserva.horaInicio,
                                    )}
                                  </p>
                                  <p className="mt-1 text-base font-black text-slate-900">
                                    {reserva.salon.nombre}
                                  </p>
                                  <p className="mt-1 text-sm text-slate-500">
                                    {obtenerDireccionReserva(reserva)}
                                  </p>
                                </div>
                                <span
                                  className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${estado.color}`}
                                >
                                  {estado.etiqueta}
                                </span>
                              </div>

                              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                                <div className="rounded-2xl border border-white bg-white px-3 py-3">
                                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                                    Especialista
                                  </p>
                                  <p className="mt-1 text-sm font-black text-slate-900">
                                    {reserva.especialista.nombre}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-white bg-white px-3 py-3">
                                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                                    Horario
                                  </p>
                                  <p className="mt-1 text-sm font-black text-slate-900">
                                    {reserva.horaInicio} -{' '}
                                    {calcularHoraFin(reserva.horaInicio, reserva.duracion)}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-white bg-white px-3 py-3">
                                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                                    DuraciÃ³n aproximada
                                  </p>
                                  <p className="mt-1 text-sm font-black text-slate-900">
                                    {formatearDuracionReserva(reserva.duracion)}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-white bg-white px-3 py-3">
                                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                                    MÃ©todo de pago
                                  </p>
                                  <p className="mt-1 text-sm font-black text-slate-900">
                                    {formatearMetodoPagoReserva(reserva.metodoPago)}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-white bg-white px-3 py-3">
                                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                                    Total
                                  </p>
                                  <p className="mt-1 text-sm font-black text-slate-900">
                                    {formatearDinero(reserva.precioTotal, moneda)}
                                  </p>
                                </div>
                                <div className="rounded-2xl border border-white bg-white px-3 py-3">
                                  <p className="text-[10px] font-black uppercase tracking-wide text-slate-400">
                                    Estado actual
                                  </p>
                                  <p className="mt-1 text-sm font-black text-slate-900">
                                    {estado.etiqueta}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-4">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                                  Servicios
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {(reserva.serviciosDetalle && reserva.serviciosDetalle.length > 0
                                    ? reserva.serviciosDetalle.map((servicio) => servicio.name)
                                    : reserva.servicios.map((servicio) => servicio.name)
                                  ).map((servicio) => (
                                    <span
                                      key={`${reserva.id}-${servicio}`}
                                      className="rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-xs font-bold text-pink-700"
                                    >
                                      {servicio}
                                    </span>
                                  ))}
                                </div>
                              </div>

                              {productos.length > 0 ? (
                                <div className="mt-4">
                                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                                    Productos adicionales
                                  </p>
                                  <div className="mt-2 space-y-2">
                                    {productos.map((producto) => (
                                      <div
                                        key={`${reserva.id}-${producto.id}`}
                                        className="rounded-2xl border border-white bg-white px-3 py-3 text-sm text-slate-600"
                                      >
                                        <p className="font-black text-slate-900">
                                          {producto.nombre}
                                        </p>
                                        <p className="mt-1 text-xs text-slate-500">
                                          {producto.cantidad} Ã—{' '}
                                          {formatearDinero(producto.precioUnitario, moneda)}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              {reserva.observaciones || reserva.marcaTinte || reserva.tonalidad ? (
                                <div className="mt-4 rounded-2xl border border-white bg-white px-3 py-3 text-sm text-slate-600">
                                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                                    Detalles adicionales
                                  </p>
                                  {reserva.marcaTinte ? (
                                    <p className="mt-2">
                                      <span className="font-black text-slate-900">Marca:</span>{' '}
                                      {reserva.marcaTinte}
                                    </p>
                                  ) : null}
                                  {reserva.tonalidad ? (
                                    <p className="mt-1">
                                      <span className="font-black text-slate-900">Tonalidad:</span>{' '}
                                      {reserva.tonalidad}
                                    </p>
                                  ) : null}
                                  {reserva.observaciones ? (
                                    <p className="mt-1">
                                      <span className="font-black text-slate-900">Notas:</span>{' '}
                                      {reserva.observaciones}
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}

                              {cancelable || reagendable ? (
                                <div className="mt-4 flex flex-wrap gap-2">
                                  {cancelable ? (
                                    <button
                                      type="button"
                                      onClick={() => setReservaCancelar(reserva)}
                                      className="inline-flex items-center gap-1.5 rounded-2xl bg-red-50 px-3 py-2 text-xs font-black text-red-700"
                                    >
                                      <Ban className="h-3.5 w-3.5" aria-hidden="true" /> Cancelar
                                      reserva
                                    </button>
                                  ) : null}
                                  {reagendable ? (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReservaReagendar(reserva);
                                        setNuevaFecha(reserva.fecha);
                                        setNuevaHora(reserva.horaInicio);
                                      }}
                                      className="inline-flex items-center gap-1.5 rounded-2xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700"
                                    >
                                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />{' '}
                                      Reagendar reserva
                                    </button>
                                  ) : null}
                                </div>
                              ) : null}
                            </>
                          );
                        })()}
                      </article>
                    ))}
                  </div>
                </>
              ) : (
                <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center">
                  <p className="text-sm font-bold text-slate-600">
                    No tienes citas registradas en esta fecha.
                  </p>
                  <p className="mt-2 text-xs text-slate-500">
                    Cambia de dÃ­a en el calendario para revisar tu historial o prÃ³ximas visitas.
                  </p>
                </div>
              )}
            </aside>
          </div>
        </>
      )}

      {reservaCancelar ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
          role="dialog"
          aria-labelledby="titulo-cancelar-reserva"
          onClick={() => setReservaCancelar(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(evento) => evento.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 id="titulo-cancelar-reserva" className="text-lg font-black text-slate-900">
                  Cancelar reserva
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Esta acciÃ³n solo aplica cuando faltan mÃ¡s de 2 horas para la cita.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReservaCancelar(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
                aria-label="Cerrar diÃ¡logo"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-600">
              <p className="font-bold text-slate-900">{reservaCancelar.salon.nombre}</p>
              <p>
                {formatearFechaReservaNatural(reservaCancelar.fecha, reservaCancelar.horaInicio)}
              </p>
              <p>{reservaCancelar.sucursal || 'Principal'}</p>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setReservaCancelar(null)}
                className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={() => mutacionCancelar.mutate(reservaCancelar.id)}
                disabled={mutacionCancelar.isPending}
                className="rounded-xl bg-red-600 px-4 py-2 text-sm font-black text-white transition-colors hover:bg-red-700 disabled:opacity-60"
              >
                {mutacionCancelar.isPending ? 'Cancelando...' : 'Confirmar cancelaciÃ³n'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {reservaReagendar ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4"
          role="dialog"
          aria-labelledby="titulo-reagendar-reserva"
          onClick={() => setReservaReagendar(null)}
        >
          <div
            className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl"
            onClick={(evento) => evento.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <h3 id="titulo-reagendar-reserva" className="text-lg font-black text-slate-900">
                  Reagendar reserva
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Solo puedes reagendar una vez la misma cita.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReservaReagendar(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
                aria-label="Cerrar diÃ¡logo"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="fecha-reagendar"
                  className="mb-1 block text-xs font-bold text-slate-600"
                >
                  Nueva fecha
                </label>
                <input
                  id="fecha-reagendar"
                  type="date"
                  min={hoy}
                  value={nuevaFecha}
                  onChange={(evento) => setNuevaFecha(evento.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-400"
                />
              </div>
              <div>
                <label
                  htmlFor="hora-reagendar"
                  className="mb-1 block text-xs font-bold text-slate-600"
                >
                  Nueva hora
                </label>
                <input
                  id="hora-reagendar"
                  type="time"
                  value={nuevaHora}
                  onChange={(evento) => setNuevaHora(evento.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-pink-400"
                />
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setReservaReagendar(null)}
                className="rounded-xl px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-100"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() =>
                  puedeEnviarReagendado
                    ? mutacionReagendar.mutate({
                        id: reservaReagendar.id,
                        fecha: nuevaFecha,
                        horaInicio: nuevaHora,
                      })
                    : undefined
                }
                disabled={!puedeEnviarReagendado}
                className="rounded-xl bg-pink-600 px-4 py-2 text-sm font-black text-white transition-colors hover:bg-pink-700 disabled:opacity-60"
              >
                {mutacionReagendar.isPending ? 'Guardando...' : 'Guardar cambio'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
