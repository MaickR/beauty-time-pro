import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  Phone,
  CheckCircle,
  AlertCircle,
  CalendarDays,
  CalendarRange,
  CalendarCheck,
  Link2,
  Copy,
  ExternalLink,
  MessageCircle,
  Plus,
} from 'lucide-react';
import { env } from '../../lib/env';
import { NavegacionEmpleado } from '../../componentes/diseno/NavegacionEmpleado';
import { PanelNotificaciones } from '../estudio/componentes/PanelNotificaciones';
import { ModalSuspension } from '../estudio/componentes/ModalSuspension';
import { usarNotificacionesEstudio } from '../estudio/hooks/usarNotificacionesEstudio';
import {
  obtenerMiAgenda,
  obtenerMiAgendaMes,
  actualizarEstadoReservaEmpleado,
  obtenerMiPerfilEmpleado,
  obtenerMisMetricas,
} from '../../servicios/servicioEmpleados';
import { usarToast } from '../../componentes/ui/ProveedorToast';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';
import { formatearDinero } from '../../utils/formato';
import { agregarServicioAReserva } from '../../servicios/servicioReservas';
import type { ReservaEmpleado, Servicio } from '../../tipos';

function obtenerOrigenReservas(): string {
  const origenActual = window.location.origin;
  if (/localhost|127\.0\.0\.1/.test(env.VITE_URL_API)) {
    return origenActual;
  }
  if (env.VITE_URL_PUBLICA) {
    return env.VITE_URL_PUBLICA;
  }
  return origenActual;
}

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

type BadgeEstado = { etiqueta: string; fondo: string; texto: string; barra: string };

function badgePorEstado(estado: ReservaEmpleado['estado']): BadgeEstado {
  const mapa: Record<ReservaEmpleado['estado'], BadgeEstado> = {
    pending: {
      etiqueta: 'Pendiente',
      fondo: 'bg-amber-100',
      texto: 'text-amber-700',
      barra: 'bg-amber-400',
    },
    confirmed: {
      etiqueta: 'Confirmada',
      fondo: 'bg-green-100',
      texto: 'text-green-700',
      barra: 'bg-green-400',
    },
    completed: {
      etiqueta: 'Completada',
      fondo: 'bg-slate-100',
      texto: 'text-slate-600',
      barra: 'bg-slate-400',
    },
    cancelled: {
      etiqueta: 'Cancelada',
      fondo: 'bg-red-100',
      texto: 'text-red-600',
      barra: 'bg-red-400',
    },
    no_show: {
      etiqueta: 'No se presentó',
      fondo: 'bg-orange-100',
      texto: 'text-orange-700',
      barra: 'bg-orange-400',
    },
  };
  return mapa[estado];
}

interface PropsBotonEstado {
  reserva: ReservaEmpleado;
  onActualizar: (id: string, estado: 'confirmed' | 'completed' | 'no_show') => void;
  actualizando: boolean;
  yaTermino: boolean;
}

function BotonCambioEstado({ reserva, onActualizar, actualizando, yaTermino }: PropsBotonEstado) {
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
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => onActualizar(reserva.id, 'completed')}
          disabled={actualizando}
          aria-label="Marcar cita como completada"
          className="flex items-center gap-1 rounded-xl bg-green-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-green-700 disabled:opacity-50"
        >
          <CheckCircle className="h-3.5 w-3.5" aria-hidden="true" />
          Completar
        </button>
        {yaTermino && (
          <button
            onClick={() => onActualizar(reserva.id, 'no_show')}
            disabled={actualizando}
            aria-label="Marcar como no se presentó"
            className="flex items-center gap-1 rounded-xl bg-orange-500 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-orange-600 disabled:opacity-50"
          >
            <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
            No se presentó
          </button>
        )}
      </div>
    );
  }
  return null;
}

export function PaginaAgendaEmpleado() {
  const fechaHoy = hoy();
  const [fechaSeleccionada, setFechaSeleccionada] = useState(fechaHoy);
  const [mesVisible, setMesVisible] = useState(() => new Date());
  const clienteConsulta = useQueryClient();
  const { mostrarToast } = usarToast();
  const { estudioActual } = usarTiendaAuth();
  const { notificaciones, marcarLeida } = usarNotificacionesEstudio(estudioActual ?? undefined);
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

  const consultaMetricas = useQuery({
    queryKey: ['mis-metricas'],
    queryFn: obtenerMisMetricas,
    staleTime: 2 * 60_000,
  });

  const mutacionEstado = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: 'confirmed' | 'completed' | 'no_show' }) =>
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

  const [modalAdicional, setModalAdicional] = useState<string | null>(null);
  const [servicioAdicionalSeleccionado, setServicioAdicionalSeleccionado] = useState('');

  const mutacionAdicional = useMutation({
    mutationFn: ({
      reservaId,
      servicio,
    }: {
      reservaId: string;
      servicio: { nombre: string; duracion: number; precio: number; categoria?: string };
    }) => agregarServicioAReserva(reservaId, servicio),
    onSuccess: async () => {
      setModalAdicional(null);
      setServicioAdicionalSeleccionado('');
      await clienteConsulta.invalidateQueries({ queryKey: ['mi-agenda', fechaSeleccionada] });
      await clienteConsulta.invalidateQueries({ queryKey: ['mi-agenda-mes', mesSeleccionado] });
      await clienteConsulta.invalidateQueries({ queryKey: ['mis-metricas'] });
      mostrarToast({ mensaje: 'Extra added successfully', variante: 'exito' });
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
  const catalogoServicios: Servicio[] = (perfil?.estudio?.servicios ?? []) as Servicio[];
  const moneda = perfil?.estudio?.pais === 'Colombia' ? 'COP' : 'MXN';

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
  const metricas = consultaMetricas.data;

  const linkReservas = perfil?.estudio?.claveCliente
    ? `${obtenerOrigenReservas()}/reservar/${perfil.estudio.claveCliente}`
    : null;

  const copiarLink = () => {
    if (!linkReservas) return;
    navigator.clipboard
      .writeText(linkReservas)
      .then(() => mostrarToast({ mensaje: 'Enlace copiado al portapapeles', variante: 'exito' }));
  };

  const compartirWhatsApp = () => {
    if (!linkReservas) return;
    const mensajeWA = encodeURIComponent(
      `Reserva tu cita en ${perfil?.estudio?.nombre ?? 'nuestro salón'}: ${linkReservas}`,
    );
    window.open(`https://wa.me/?text=${mensajeWA}`, '_blank', 'noopener');
  };

  const abrirLinkReservas = () => {
    if (!perfil?.estudio?.claveCliente) return;
    window.open(`/reservar/${perfil.estudio.claveCliente}`, '_blank', 'noopener');
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      <NavegacionEmpleado />

      <main className="mx-auto max-w-5xl px-4 py-6">
        {/* KPI cards */}
        <div className="mb-6 grid grid-cols-3 gap-3">
          {[
            { icono: CalendarDays, etiqueta: 'TODAY', valor: metricas?.citasHoy ?? '—' },
            { icono: CalendarRange, etiqueta: 'THIS WEEK', valor: metricas?.citasSemana ?? '—' },
            { icono: CalendarCheck, etiqueta: 'THIS MONTH', valor: metricas?.citasMes ?? '—' },
          ].map((kpi) => (
            <div
              key={kpi.etiqueta}
              className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-pink-50">
                <kpi.icono className="h-5 w-5 text-pink-600" />
              </div>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {kpi.etiqueta}
              </p>
              <p className="text-2xl font-black text-slate-900">{kpi.valor}</p>
            </div>
          ))}
        </div>

        {/* Link de reservas del salón */}
        {linkReservas && (
          <div className="mb-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2">
              <Link2 className="h-4 w-4 text-pink-500" aria-hidden="true" />
              <h2 className="text-sm font-black uppercase tracking-wide text-slate-700">
                Salon Booking Link
              </h2>
            </div>
            <div className="flex items-center overflow-hidden rounded-xl border border-slate-100 bg-slate-50 px-4 py-2.5">
              <span className="flex-1 truncate font-mono text-xs text-slate-600">
                {linkReservas}
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={copiarLink}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-100 py-2.5 text-xs font-black text-slate-700 transition-colors hover:bg-slate-200"
              >
                <Copy className="h-3.5 w-3.5" aria-hidden="true" /> Copy Link
              </button>
              <button
                type="button"
                onClick={abrirLinkReservas}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-xs font-black text-slate-700 transition-colors hover:bg-slate-100"
              >
                <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> Open
              </button>
              <button
                type="button"
                onClick={compartirWhatsApp}
                className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-green-500 py-2.5 text-xs font-black text-white transition-colors hover:bg-green-600"
              >
                <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" /> WhatsApp
              </button>
            </div>
          </div>
        )}

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
              <PanelNotificaciones
                notificaciones={notificaciones}
                pais={perfil?.estudio?.pais ?? 'Mexico'}
                onMarcarLeida={marcarLeida}
              />
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
                const estaCompletada = reserva.estado === 'completed';
                const estaCancelada = reserva.estado === 'cancelled';
                const esNoShow = reserva.estado === 'no_show';

                const ahora = new Date();
                const [anio, mes, dia] = reserva.fecha.split('-').map(Number);
                const [h, min] = reserva.horaInicio.split(':').map(Number);
                const finCita = new Date(anio, mes - 1, dia, h, min + reserva.duracion);
                const yaTermino = ahora >= finCita;

                const cardBg = estaCompletada
                  ? 'bg-slate-50 border-slate-200'
                  : estaCancelada
                    ? 'bg-red-50 border-red-100 opacity-70'
                    : esNoShow
                      ? 'bg-orange-50 border-orange-200 opacity-80'
                      : 'bg-white border-slate-100 hover:border-pink-200';

                const nombresServicios = serviciosMostrados.map((s) => s.name).join(', ');

                return (
                  <article
                    key={reserva.id}
                    className={`rounded-2xl border p-4 relative transition-all ${cardBg}`}
                  >
                    <div
                      className={`absolute left-1.5 top-3 bottom-3 w-1 rounded-full ${badge.barra}`}
                    />

                    <div className="pl-5 flex flex-col md:grid md:grid-cols-[1fr_auto] md:gap-4">
                      {/* Columna izquierda */}
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xl font-black text-slate-900">
                            {reserva.horaInicio}
                          </span>
                          <span className="text-xs text-slate-400 font-bold">— {horaFin}</span>
                        </div>
                        <p className="text-sm text-slate-800">
                          <span className="font-black">{reserva.nombreCliente}</span>
                          <span className="text-slate-400 mx-1.5">·</span>
                          <a
                            href={`tel:${reserva.telefonoCliente}`}
                            className="text-slate-500 inline-flex items-center gap-1 hover:text-pink-600 transition"
                          >
                            <Phone className="w-3 h-3 text-pink-400 inline" aria-hidden="true" />
                            {reserva.telefonoCliente}
                          </a>
                        </p>
                        {nombresServicios && (
                          <p className="text-xs text-slate-500 font-medium leading-snug">
                            {nombresServicios}
                          </p>
                        )}
                      </div>

                      {/* Columna derecha */}
                      <div className="flex flex-row md:flex-col items-start md:items-end justify-between md:justify-start gap-2 mt-3 md:mt-0">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${badge.fondo} ${badge.texto}`}
                        >
                          {badge.etiqueta}
                        </span>
                        <div className="text-right">
                          <p className="text-base font-black text-pink-700">
                            {formatearDinero(reserva.precioTotal)}
                          </p>
                          <p className="text-[9px] text-slate-400">{reserva.duracion} min</p>
                        </div>
                        {!estaCompletada && !estaCancelada && !esNoShow && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setModalAdicional(reserva.id)}
                              className="flex items-center gap-1 rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition-colors hover:bg-slate-100"
                              aria-label="Agregar servicio extra a esta cita"
                            >
                              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                              Extra
                            </button>
                            <BotonCambioEstado
                              reserva={reserva}
                              onActualizar={(id, estado) => mutacionEstado.mutate({ id, estado })}
                              actualizando={actualizando}
                              yaTermino={yaTermino}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {perfil?.estudio?.estado === 'suspendido' && (
        <ModalSuspension
          nombreSalon={perfil.estudio.nombre}
          pais={perfil.estudio.pais ?? 'Mexico'}
        />
      )}

      {/* Modal agregar servicio adicional */}
      {modalAdicional && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-modal-adicional"
          onClick={() => {
            setModalAdicional(null);
            setServicioAdicionalSeleccionado('');
          }}
        >
          <div
            className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setModalAdicional(null);
                setServicioAdicionalSeleccionado('');
              }
            }}
          >
            <h3 id="titulo-modal-adicional" className="mb-4 text-lg font-black text-slate-900">
              Add Extra Service
            </h3>

            {catalogoServicios.length === 0 ? (
              <p className="text-sm text-slate-500">No services available in the catalog.</p>
            ) : (
              <div className="max-h-64 space-y-2 overflow-y-auto">
                {catalogoServicios.map((srv) => {
                  const seleccionado = servicioAdicionalSeleccionado === srv.name;
                  return (
                    <button
                      key={srv.name}
                      type="button"
                      onClick={() => setServicioAdicionalSeleccionado(seleccionado ? '' : srv.name)}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left text-sm transition-all ${
                        seleccionado
                          ? 'border-pink-400 bg-pink-50 text-pink-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-pink-200'
                      }`}
                    >
                      <span className="font-bold">{srv.name}</span>
                      <span className="flex items-center gap-2 text-xs">
                        <span className="font-black">{formatearDinero(srv.price, moneda)}</span>
                        <span className="text-slate-400">{srv.duration} min</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setModalAdicional(null);
                  setServicioAdicionalSeleccionado('');
                }}
                className="flex-1 rounded-2xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!servicioAdicionalSeleccionado || mutacionAdicional.isPending}
                onClick={() => {
                  const srv = catalogoServicios.find(
                    (s) => s.name === servicioAdicionalSeleccionado,
                  );
                  if (!srv || !modalAdicional) return;
                  mutacionAdicional.mutate({
                    reservaId: modalAdicional,
                    servicio: {
                      nombre: srv.name,
                      duracion: srv.duration,
                      precio: srv.price,
                      categoria: srv.category,
                    },
                  });
                }}
                className="flex-1 rounded-2xl bg-pink-600 py-2.5 text-sm font-black text-white transition hover:bg-pink-700 disabled:opacity-50"
              >
                {mutacionAdicional.isPending ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
