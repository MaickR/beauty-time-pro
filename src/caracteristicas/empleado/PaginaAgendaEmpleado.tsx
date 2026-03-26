import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Phone, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { NavegacionEmpleado } from '../../componentes/diseno/NavegacionEmpleado';
import {
  obtenerMiAgenda,
  obtenerMiAgendaMes,
  actualizarEstadoReservaEmpleado,
  obtenerMiPerfilEmpleado,
} from '../../servicios/servicioEmpleados';
import { usarToast } from '../../componentes/ui/ProveedorToast';
import type { ReservaEmpleado } from '../../tipos';

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DIAS_SEMANA_COMPLETOS = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
];
const MESES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

function hoy(): string {
  const ahora = new Date();
  const y = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, '0');
  const d = String(ahora.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function obtenerMesISO(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`;
}

function formatearFecha(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  return `${DIAS_SEMANA_COMPLETOS[fecha.getDay()]} ${d} de ${MESES[m - 1]}`;
}

function calcularHoraFin(horaInicio: string, duracionMinutos: number): string {
  const [h, min] = horaInicio.split(':').map(Number);
  const totalMin = h * 60 + min + duracionMinutos;
  const hFin = Math.floor(totalMin / 60) % 24;
  const mFin = totalMin % 60;
  return `${String(hFin).padStart(2, '0')}:${String(mFin).padStart(2, '0')}`;
}

function construirDiasCalendario(
  fechaBase: Date,
): Array<{ fecha: string; numero: number; actual: boolean }> {
  const primerDiaMes = new Date(fechaBase.getFullYear(), fechaBase.getMonth(), 1);
  const inicio = new Date(primerDiaMes);
  inicio.setDate(1 - primerDiaMes.getDay());

  return Array.from({ length: 42 }, (_, indice) => {
    const fecha = new Date(inicio.getFullYear(), inicio.getMonth(), inicio.getDate() + indice);
    return {
      fecha: `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(
        fecha.getDate(),
      ).padStart(2, '0')}`,
      numero: fecha.getDate(),
      actual: fecha.getMonth() === fechaBase.getMonth(),
    };
  });
}

type BadgeEstado = { etiqueta: string; clases: string };

function badgePorEstado(estado: ReservaEmpleado['estado']): BadgeEstado {
  const mapa: Record<ReservaEmpleado['estado'], BadgeEstado> = {
    pending: { etiqueta: 'Pendiente', clases: 'bg-yellow-100 text-yellow-800' },
    confirmed: { etiqueta: 'Confirmada', clases: 'bg-blue-100 text-blue-800' },
    completed: { etiqueta: 'Completada', clases: 'bg-green-100 text-green-800' },
    cancelled: { etiqueta: 'Cancelada', clases: 'bg-red-100 text-red-800' },
  };
  return mapa[estado];
}

interface PropsBotonEstado {
  reserva: ReservaEmpleado;
  onActualizar: (id: string, estado: 'confirmed' | 'completed') => void;
  actualizando: boolean;
}

function BotonCambioEstado({ reserva, onActualizar, actualizando }: PropsBotonEstado) {
  if (reserva.estado === 'pending') {
    return (
      <button
        onClick={() => onActualizar(reserva.id, 'confirmed')}
        disabled={actualizando}
        aria-label="Confirmar cita"
        className="flex items-center gap-1 rounded-xl bg-blue-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
      >
        <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
        Confirmar
      </button>
    );
  }
  if (reserva.estado === 'confirmed') {
    return (
      <button
        onClick={() => onActualizar(reserva.id, 'completed')}
        disabled={actualizando}
        aria-label="Marcar cita como completada"
        className="flex items-center gap-1 rounded-xl bg-green-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
      >
        <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
        Completar
      </button>
    );
  }
  return null;
}

function BotonCancelarDeshabilitado() {
  return (
    <button
      type="button"
      disabled
      aria-label="Cancelar cita no disponible para empleado"
      className="flex items-center gap-1 rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-400 opacity-70 cursor-not-allowed"
    >
      Cancelar
    </button>
  );
}

export function PaginaAgendaEmpleado() {
  const fechaHoy = hoy();
  const [fechaSeleccionada, setFechaSeleccionada] = useState(fechaHoy);
  const [mesVisible, setMesVisible] = useState(() => new Date());
  const clienteConsulta = useQueryClient();
  const { mostrarToast } = usarToast();
  const mesSeleccionado = obtenerMesISO(mesVisible);

  const consultaAgenda = useQuery({
    queryKey: ['mi-agenda', fechaSeleccionada],
    queryFn: () => obtenerMiAgenda(fechaSeleccionada),
    staleTime: 60_000,
  });

  const consultaAgendaMes = useQuery({
    queryKey: ['mi-agenda-mes', mesSeleccionado],
    queryFn: () => obtenerMiAgendaMes(mesSeleccionado),
    staleTime: 60_000,
  });

  const consultaPerfil = useQuery({
    queryKey: ['mi-perfil-empleado'],
    queryFn: obtenerMiPerfilEmpleado,
    staleTime: 5 * 60_000,
  });

  const mutacionEstado = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: 'confirmed' | 'completed' }) =>
      actualizarEstadoReservaEmpleado(id, estado),
    onSuccess: async () => {
      await clienteConsulta.invalidateQueries({ queryKey: ['mi-agenda', fechaSeleccionada] });
      await clienteConsulta.invalidateQueries({ queryKey: ['mi-agenda-mes', mesSeleccionado] });
      mostrarToast({ mensaje: 'La cita se actualizó correctamente', variante: 'exito' });
    },
    onError: (error: Error) => {
      mostrarToast({ mensaje: error.message, variante: 'error' });
    },
  });

  const perfil = consultaPerfil.data;
  const reservas = consultaAgenda.data ?? [];
  const reservasMes = consultaAgendaMes.data ?? [];
  const fechasConCitas = new Set(reservasMes.map((reserva) => reserva.fecha));
  const diasCalendario = construirDiasCalendario(mesVisible);

  const cambiarMes = (offset: number) => {
    const siguiente = new Date(mesVisible.getFullYear(), mesVisible.getMonth() + offset, 1);
    setMesVisible(siguiente);
    const nuevaFecha = `${siguiente.getFullYear()}-${String(siguiente.getMonth() + 1).padStart(2, '0')}-01`;
    setFechaSeleccionada(nuevaFecha);
  };

  const irAHoy = () => {
    const ahora = new Date();
    setMesVisible(ahora);
    setFechaSeleccionada(fechaHoy);
  };

  const horarioInicio = perfil?.horaInicio ?? perfil?.estudio.horarioApertura ?? '—';
  const horarioFin = perfil?.horaFin ?? perfil?.estudio.horarioCierre ?? '—';
  const estaEnHoy = fechaSeleccionada === fechaHoy;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      <NavegacionEmpleado />

      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6 rounded-4xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-pink-600">
                Agenda visual
              </p>
              <h1 className="mt-1 text-2xl font-black text-slate-900">
                {perfil?.nombre ?? 'Mi agenda'}
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={irAHoy}
                disabled={estaEnHoy}
                className="rounded-2xl border border-pink-200 bg-pink-50 px-4 py-2 text-sm font-bold text-pink-700 transition hover:bg-pink-100 disabled:cursor-default disabled:opacity-60"
              >
                Hoy
              </button>
              <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm font-bold text-slate-600">
                {horarioInicio} a {horarioFin}
              </div>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <button
              onClick={() => cambiarMes(-1)}
              aria-label="Mes anterior"
              className="rounded-2xl p-2 text-slate-600 transition hover:bg-slate-100"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="text-lg font-black capitalize text-slate-900">
              {mesVisible.toLocaleString('es-MX', { month: 'long', year: 'numeric' })}
            </h2>
            <button
              onClick={() => cambiarMes(1)}
              aria-label="Mes siguiente"
              className="rounded-2xl p-2 text-slate-600 transition hover:bg-slate-100"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div className="mb-3 grid grid-cols-7 text-center text-[11px] font-black uppercase tracking-wide text-slate-400">
            {DIAS_SEMANA.map((dia) => (
              <span key={dia}>{dia}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2">
            {diasCalendario.map((dia) => {
              const seleccionado = dia.fecha === fechaSeleccionada;
              const pasado = dia.fecha < fechaHoy;
              const tieneCitas = fechasConCitas.has(dia.fecha);
              return (
                <button
                  key={dia.fecha}
                  type="button"
                  onClick={() => setFechaSeleccionada(dia.fecha)}
                  className={`relative flex aspect-square flex-col items-center justify-center rounded-2xl text-sm font-black transition ${seleccionado ? 'bg-pink-600 text-white shadow-lg shadow-pink-200' : dia.actual ? 'bg-white text-slate-800 hover:border-pink-200 hover:bg-pink-50' : 'bg-slate-100 text-slate-400'} ${pasado && !seleccionado ? 'text-slate-300' : ''}`}
                  aria-pressed={seleccionado}
                >
                  <span>{dia.numero}</span>
                  {tieneCitas && (
                    <span
                      className={`mt-1 h-1.5 w-1.5 rounded-full ${seleccionado ? 'bg-white' : 'bg-pink-500'}`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.24em] text-slate-500">
                Día seleccionado
              </p>
              <h3 className="mt-1 text-xl font-black capitalize text-slate-900">
                {formatearFecha(fechaSeleccionada)}
              </h3>
            </div>
            {consultaAgenda.isFetching && (
              <span className="text-xs font-bold text-slate-400">Actualizando...</span>
            )}
          </div>

          {consultaAgenda.isLoading && (
            <div className="space-y-3" aria-busy="true" aria-label="Cargando citas">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-28 animate-pulse rounded-3xl bg-white shadow-sm" />
              ))}
            </div>
          )}

          {consultaAgenda.isError && (
            <div className="rounded-3xl border border-red-200 bg-red-50 p-4 text-center text-sm font-medium text-red-700">
              No se pudo cargar la agenda. Intenta de nuevo.
            </div>
          )}

          {!consultaAgenda.isLoading && !consultaAgenda.isError && reservas.length === 0 && (
            <div className="rounded-4xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <p className="text-4xl">🌸</p>
              <p className="mt-3 text-lg font-black text-slate-800">Sin citas para este día</p>
              <p className="mt-1 text-sm text-slate-500">Cuando haya reservas aparecerán aquí.</p>
            </div>
          )}

          {!consultaAgenda.isLoading && reservas.length > 0 && (
            <div className="space-y-3">
              {reservas.map((reserva) => {
                const badge = badgePorEstado(reserva.estado);
                const horaFin = calcularHoraFin(reserva.horaInicio, reserva.duracion);
                const actualizando =
                  mutacionEstado.isPending && mutacionEstado.variables?.id === reserva.id;
                const serviciosMostrados = reserva.serviciosDetalle ?? reserva.servicios;

                return (
                  <article
                    key={reserva.id}
                    className="rounded-4xl border border-slate-200 bg-white p-5 shadow-sm"
                  >
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 text-slate-500">
                          <Clock className="h-4 w-4 text-pink-500" />
                          <span className="text-sm font-black text-slate-900">
                            {reserva.horaInicio} - {horaFin}
                          </span>
                        </div>
                        <p className="mt-2 text-base font-black text-slate-900">
                          {reserva.nombreCliente}
                        </p>
                        <a
                          href={`tel:${reserva.telefonoCliente}`}
                          className="mt-1 inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-pink-600"
                        >
                          <Phone className="h-3.5 w-3.5" />
                          {reserva.telefonoCliente}
                        </a>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-[11px] font-black ${badge.clases}`}
                        >
                          {badge.etiqueta}
                        </span>
                        <BotonCambioEstado
                          reserva={reserva}
                          onActualizar={(id, estado) => mutacionEstado.mutate({ id, estado })}
                          actualizando={actualizando}
                        />
                        {reserva.estado !== 'cancelled' && <BotonCancelarDeshabilitado />}
                      </div>
                    </div>

                    <div className="mb-3 flex flex-wrap gap-2">
                      {serviciosMostrados.map((servicio, indice) => (
                        <span
                          key={`${reserva.id}-${indice}`}
                          className="rounded-full bg-pink-50 px-2.5 py-1 text-[11px] font-bold text-pink-700"
                        >
                          {servicio.name}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center justify-between text-sm text-slate-500">
                      <span>{reserva.duracion} min</span>
                      <span className="font-black text-pink-600">
                        ${reserva.precioTotal.toLocaleString('es-MX')}
                      </span>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
