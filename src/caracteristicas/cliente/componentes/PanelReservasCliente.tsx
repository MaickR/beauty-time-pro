import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ban, Calendar, ChevronDown, ChevronUp, Clock, RefreshCw, User, X } from 'lucide-react';
import { cancelarMiReserva, obtenerSalonPublico, reagendarMiReserva } from '../../../servicios/servicioClienteApp';
import { CalendarioEstadoSalon } from '../../../componentes/ui/CalendarioEstadoSalon';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import {
  formatearDinero,
  obtenerFechaLocalISO,
  obtenerMonedaPorPais,
} from '../../../utils/formato';
import type { Estudio, Pais, ReservaCliente, SalonDetalle } from '../../../tipos';

const REGISTROS_POR_PAGINA = 10;

const ESTADOS_RESERVA: Record<string, { etiqueta: string; color: string }> = {
  pending: { etiqueta: 'Confirmada', color: 'bg-emerald-100 text-emerald-700' },
  confirmed: { etiqueta: 'Confirmada', color: 'bg-emerald-100 text-emerald-700' },
  working: { etiqueta: 'Trabajando', color: 'bg-sky-100 text-sky-700' },
  completed: { etiqueta: 'Completada', color: 'bg-slate-100 text-slate-700' },
  cancelled: { etiqueta: 'Cancelada', color: 'bg-red-100 text-red-700' },
  no_show: { etiqueta: 'No asistió', color: 'bg-slate-200 text-slate-700' },
};

function obtenerServiciosNombre(reserva: ReservaCliente): string {
  if (reserva.serviciosDetalle && reserva.serviciosDetalle.length > 0) {
    return reserva.serviciosDetalle.map((servicio) => servicio.name).join(', ');
  }

  if (reserva.servicios.length > 0) {
    return reserva.servicios.map((servicio) => servicio.name).join(', ');
  }

  return 'Sin servicios registrados';
}

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
    .replace(',', ' ·')
    .replace(/^./, (texto) => texto.toUpperCase());
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
  pestanaInicial?: 'proximas' | 'historial';
}

export function PanelReservasCliente({
  reservas,
  paisCliente,
  pestanaInicial = 'proximas',
}: PropsPanelReservasCliente) {
  const queryClient = useQueryClient();
  const { mostrarToast } = usarToast();
  const [pestana, setPestana] = useState<'proximas' | 'historial'>(pestanaInicial);
  const [pagina, setPagina] = useState(1);
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [reservaCancelar, setReservaCancelar] = useState<ReservaCliente | null>(null);
  const [reservaReagendar, setReservaReagendar] = useState<ReservaCliente | null>(null);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [nuevaHora, setNuevaHora] = useState('');
  const [salonSeleccionadoId, setSalonSeleccionadoId] = useState<string>('');
  const [fechaCalendarioSalon, setFechaCalendarioSalon] = useState(new Date());

  const hoy = useMemo(() => obtenerFechaLocalISO(new Date()), []);
  const moneda = obtenerMonedaPorPais(paisCliente);

  const proximas = useMemo(
    () =>
      reservas
        .filter((reserva) => reserva.fecha >= hoy && reserva.estado !== 'cancelled')
        .sort((a, b) => `${a.fecha}T${a.horaInicio}`.localeCompare(`${b.fecha}T${b.horaInicio}`)),
    [hoy, reservas],
  );

  const historial = useMemo(
    () =>
      reservas
        .filter((reserva) => reserva.fecha < hoy || reserva.estado === 'cancelled')
        .sort((a, b) => `${b.fecha}T${b.horaInicio}`.localeCompare(`${a.fecha}T${a.horaInicio}`)),
    [hoy, reservas],
  );

  const salonesDisponibles = useMemo(
    () =>
      Array.from(
        new Map(
          reservas.map((reserva) => [
            reserva.salon.id,
            {
              id: reserva.salon.id,
              nombre: reserva.salon.nombre,
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

  const listaActiva = pestana === 'proximas' ? proximas : historial;
  const totalPaginas = Math.max(1, Math.ceil(listaActiva.length / REGISTROS_POR_PAGINA));
  const reservasPaginadas = listaActiva.slice(
    (pagina - 1) * REGISTROS_POR_PAGINA,
    pagina * REGISTROS_POR_PAGINA,
  );

  useEffect(() => {
    setPestana(pestanaInicial);
  }, [pestanaInicial]);

  useEffect(() => {
    setPagina(1);
    setExpandidos(new Set());
  }, [pestana]);

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

  const alternarExpandido = (reservaId: string) => {
    setExpandidos((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(reservaId)) {
        siguiente.delete(reservaId);
      } else {
        siguiente.add(reservaId);
      }
      return siguiente;
    });
  };

  const puedeEnviarReagendado =
    Boolean(reservaReagendar) &&
    nuevaFecha.length > 0 &&
    nuevaHora.length > 0 &&
    !mutacionReagendar.isPending;

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
            Consulta tus citas activas, tu historial y gestiona cancelaciones o reagendados.
          </p>
        </div>
        <div className="flex gap-2">
          {(
            [
              ['proximas', `Próximas (${proximas.length})`],
              ['historial', `Historial (${historial.length})`],
            ] as const
          ).map(([valor, etiqueta]) => (
            <button
              key={valor}
              type="button"
              onClick={() => setPestana(valor)}
              className={`rounded-2xl px-4 py-2 text-sm font-black transition-colors ${
                pestana === valor
                  ? 'bg-pink-600 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:border-pink-300'
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>
      </div>

      {salonesDisponibles.length > 0 && (
        <div className="space-y-4 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-slate-900">Calendario del salón</h3>
              <p className="mt-1 text-sm text-slate-500">
                Aquí solo ves cierres y cambios reales de horario del salón seleccionado.
              </p>
            </div>

            {salonesDisponibles.length > 1 && (
              <div className="flex flex-wrap gap-2">
                {salonesDisponibles.map((salon) => (
                  <button
                    key={salon.id}
                    type="button"
                    onClick={() => {
                      setSalonSeleccionadoId(salon.id);
                      setFechaCalendarioSalon(new Date());
                    }}
                    className={`rounded-2xl px-4 py-2 text-sm font-black transition-colors ${salonSeleccionadoId === salon.id ? 'bg-pink-600 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-pink-300'}`}
                  >
                    {salon.nombre}
                  </button>
                ))}
              </div>
            )}
          </div>

          {consultaSalonCalendario.isLoading && (
            <div className="h-80 animate-pulse rounded-[3rem] bg-slate-100" aria-busy="true" />
          )}

          {consultaSalonCalendario.isError && (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
              No se pudo cargar el calendario del salón.
            </div>
          )}

          {estudioCalendarioCliente && !consultaSalonCalendario.isLoading && (
            <CalendarioEstadoSalon
              estudio={estudioCalendarioCliente}
              fechaSeleccionada={fechaCalendarioSalon}
              alCambiarFecha={setFechaCalendarioSalon}
              mostrarCitas={false}
              titulo={salonesDisponibles.find((salon) => salon.id === salonSeleccionadoId)?.nombre ?? 'Calendario del salón'}
            />
          )}
        </div>
      )}

      {listaActiva.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-sm font-bold text-slate-500">
            No tienes reservas {pestana === 'proximas' ? 'próximas' : 'en el historial'}.
          </p>
        </div>
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-left">
                  <th className="px-4 py-3 font-bold text-slate-600">Fecha</th>
                  <th className="px-4 py-3 font-bold text-slate-600">Salón</th>
                  <th className="px-4 py-3 font-bold text-slate-600">Sede</th>
                  <th className="px-4 py-3 font-bold text-slate-600">Especialista</th>
                  <th className="px-4 py-3 font-bold text-slate-600">Servicios</th>
                  <th className="px-4 py-3 text-right font-bold text-slate-600">Total</th>
                  <th className="px-4 py-3 text-center font-bold text-slate-600">Estado</th>
                  <th className="px-4 py-3 text-center font-bold text-slate-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {reservasPaginadas.map((reserva) => {
                  const estado = ESTADOS_RESERVA[reserva.estado] ?? ESTADOS_RESERVA.pending;
                  const cancelable = puedeCancelarReserva(reserva);
                  const reagendable = puedeReagendarReserva(reserva);

                  return (
                    <tr key={reserva.id} className="align-top hover:bg-slate-50/70">
                      <td className="px-4 py-4 font-medium text-slate-900">
                        <div>{formatearFechaReservaNatural(reserva.fecha, reserva.horaInicio)}</div>
                        {reserva.reagendada && (
                          <span className="mt-2 inline-flex rounded-full bg-blue-50 px-2 py-1 text-[11px] font-black uppercase tracking-wide text-blue-700">
                            Reagendada
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-4 text-slate-700">{reserva.salon.nombre}</td>
                      <td className="px-4 py-4 text-slate-600">
                        {reserva.sucursal || 'Principal'}
                      </td>
                      <td className="px-4 py-4 text-slate-600">{reserva.especialista.nombre}</td>
                      <td className="max-w-64 px-4 py-4 text-slate-600">
                        {obtenerServiciosNombre(reserva)}
                      </td>
                      <td className="px-4 py-4 text-right font-black text-slate-900">
                        {formatearDinero(reserva.precioTotal, moneda)}
                      </td>
                      <td className="px-4 py-4 text-center">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-black ${estado.color}`}
                        >
                          {estado.etiqueta}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {cancelable ? (
                            <button
                              type="button"
                              onClick={() => setReservaCancelar(reserva)}
                              className="rounded-xl p-2 text-red-600 transition-colors hover:bg-red-50"
                              aria-label="Cancelar reserva"
                              title="Cancelar reserva"
                            >
                              <Ban className="h-4 w-4" aria-hidden="true" />
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
                              className="rounded-xl p-2 text-blue-600 transition-colors hover:bg-blue-50"
                              aria-label="Reagendar reserva"
                              title="Reagendar reserva"
                            >
                              <RefreshCw className="h-4 w-4" aria-hidden="true" />
                            </button>
                          ) : null}
                          {!cancelable && !reagendable ? (
                            <span className="text-slate-300">—</span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {reservasPaginadas.map((reserva) => {
              const estado = ESTADOS_RESERVA[reserva.estado] ?? ESTADOS_RESERVA.pending;
              const expandido = expandidos.has(reserva.id);
              const cancelable = puedeCancelarReserva(reserva);
              const reagendable = puedeReagendarReserva(reserva);

              return (
                <article
                  key={reserva.id}
                  className="overflow-hidden rounded-3xl border border-slate-100 bg-white shadow-sm"
                >
                  <button
                    type="button"
                    onClick={() => alternarExpandido(reserva.id)}
                    className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left"
                    aria-expanded={expandido}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-slate-900">
                        {reserva.salon.nombre}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {formatearFechaReservaNatural(reserva.fecha, reserva.horaInicio)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[10px] font-black ${estado.color}`}
                      >
                        {estado.etiqueta}
                      </span>
                      {expandido ? (
                        <ChevronUp className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-slate-400" aria-hidden="true" />
                      )}
                    </div>
                  </button>

                  {expandido ? (
                    <div className="space-y-3 border-t border-slate-100 px-4 py-4 text-sm text-slate-600">
                      <p className="flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        <span>{reserva.sucursal || 'Principal'}</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <User className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        <span>{reserva.especialista.nombre}</span>
                      </p>
                      <p className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-slate-400" aria-hidden="true" />
                        <span>{obtenerServiciosNombre(reserva)}</span>
                      </p>
                      <p className="font-black text-slate-900">
                        {formatearDinero(reserva.precioTotal, moneda)}
                      </p>
                      {reserva.reagendada ? (
                        <p className="rounded-2xl bg-blue-50 px-3 py-2 text-xs font-bold text-blue-700">
                          Esta reserva ya fue reagendada una vez.
                        </p>
                      ) : null}
                      {cancelable || reagendable ? (
                        <div className="flex flex-wrap gap-2 pt-1">
                          {cancelable ? (
                            <button
                              type="button"
                              onClick={() => setReservaCancelar(reserva)}
                              className="inline-flex items-center gap-1.5 rounded-xl bg-red-50 px-3 py-2 text-xs font-black text-red-700"
                            >
                              <Ban className="h-3.5 w-3.5" aria-hidden="true" /> Cancelar
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
                              className="inline-flex items-center gap-1.5 rounded-xl bg-blue-50 px-3 py-2 text-xs font-black text-blue-700"
                            >
                              <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" /> Reagendar
                            </button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>

          {totalPaginas > 1 ? (
            <div className="flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setPagina((actual) => Math.max(1, actual - 1))}
                disabled={pagina === 1}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-sm font-bold text-slate-500">
                Página {pagina} de {totalPaginas}
              </span>
              <button
                type="button"
                onClick={() => setPagina((actual) => Math.min(totalPaginas, actual + 1))}
                disabled={pagina === totalPaginas}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-40"
              >
                Siguiente
              </button>
            </div>
          ) : null}
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
                  Esta acción solo aplica cuando faltan más de 2 horas para la cita.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setReservaCancelar(null)}
                className="rounded-xl p-2 text-slate-400 hover:bg-slate-100"
                aria-label="Cerrar diálogo"
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
                {mutacionCancelar.isPending ? 'Cancelando...' : 'Confirmar cancelación'}
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
                aria-label="Cerrar diálogo"
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
