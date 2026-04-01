import { useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Phone,
  Plus,
  History,
  ChevronLeft,
  ChevronRight,
  Users,
  Palette,
  XCircle,
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { DialogoConfirmacion } from '../../../componentes/ui/DialogoConfirmacion';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { usarContextoApp } from '../../../contextos/ContextoApp';
import { formatearDinero } from '../../../utils/formato';
import {
  actualizarEstadoReserva,
  actualizarEstadoServicioReserva,
  agregarServicioAReserva,
} from '../../../servicios/servicioReservas';
import type {
  Estudio,
  Reserva,
  Moneda,
  EstadoReserva,
  DetalleServicioReserva,
} from '../../../tipos';

interface PropsAgendaDiaria {
  estudio: Estudio;
  reservas: Reserva[];
  fechaVista: Date;
  onCrearCitaManual: () => void;
}

function obtenerFechaLocalISO(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

function calcularHoraFin(horaInicio: string, duracionMin: number): string {
  const [h, m] = horaInicio.split(':').map(Number);
  const totalMin = (h ?? 0) * 60 + (m ?? 0) + duracionMin;
  return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
}

interface ColorBadge {
  fondo: string;
  texto: string;
  etiqueta: string;
}

const BADGE_ESTADO: Record<EstadoReserva, ColorBadge> = {
  pending: { fondo: 'bg-amber-100', texto: 'text-amber-700', etiqueta: 'Pendiente' },
  confirmed: { fondo: 'bg-green-100', texto: 'text-green-700', etiqueta: 'Confirmada' },
  completed: { fondo: 'bg-slate-100', texto: 'text-slate-600', etiqueta: 'Completada' },
  cancelled: { fondo: 'bg-red-100', texto: 'text-red-600', etiqueta: 'Cancelada' },
  no_show: { fondo: 'bg-orange-100', texto: 'text-orange-700', etiqueta: 'No se presentó' },
};

const BADGE_ESTADO_SERVICIO: Record<string, ColorBadge> = {
  pending: { fondo: 'bg-slate-100', texto: 'text-slate-500', etiqueta: 'Pendiente' },
  confirmed: { fondo: 'bg-slate-100', texto: 'text-slate-500', etiqueta: 'Pendiente' },
  completed: { fondo: 'bg-green-100', texto: 'text-green-700', etiqueta: 'Realizado' },
  cancelled: { fondo: 'bg-red-100', texto: 'text-red-600', etiqueta: 'Cancelado' },
  no_show: { fondo: 'bg-red-100', texto: 'text-red-600', etiqueta: 'No se realizó' },
};

function BadgeEstado({ estado }: { estado: EstadoReserva }) {
  const cfg = BADGE_ESTADO[estado] ?? BADGE_ESTADO.pending;
  return (
    <span
      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wide ${cfg.fondo} ${cfg.texto}`}
    >
      {cfg.etiqueta}
    </span>
  );
}

interface PropsItemServicio {
  servicio: DetalleServicioReserva;
  moneda: Moneda;
  puedeMarcarNoShow: boolean;
  onNoShow: () => void;
}

function ItemServicio({ servicio, moneda, puedeMarcarNoShow, onNoShow }: PropsItemServicio) {
  const badge = BADGE_ESTADO_SERVICIO[servicio.status] ?? BADGE_ESTADO_SERVICIO['pending']!;
  return (
    <div className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-50 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        {servicio.status === 'completed' ? (
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-green-500" aria-hidden="true" />
        ) : servicio.status === 'no_show' || servicio.status === 'cancelled' ? (
          <XCircle className="w-3.5 h-3.5 shrink-0 text-red-400" aria-hidden="true" />
        ) : (
          <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-slate-300" aria-hidden="true" />
        )}
        <span className="text-xs font-medium text-slate-700 truncate">{servicio.name}</span>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <span className="text-[10px] text-slate-500 font-bold">
          {formatearDinero(servicio.price, moneda)}
        </span>
        <span
          className={`rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${badge.fondo} ${badge.texto}`}
        >
          {badge.etiqueta}
        </span>
        {puedeMarcarNoShow && (
          <button
            type="button"
            onClick={onNoShow}
            className="rounded-lg bg-red-50 px-2 py-0.5 text-[9px] font-black uppercase text-red-600 hover:bg-red-100 transition-colors"
          >
            No realizó
          </button>
        )}
      </div>
    </div>
  );
}

// ── Modal mini para marcar un servicio como no_show ──────────────────────────
interface PropsModalNoShow {
  nombreServicio: string;
  onConfirmar: (pin: string, motivo: string) => void;
  onCancelar: () => void;
  cargando: boolean;
  mensajeError?: string | null;
  onLimpiarError: () => void;
}

function ModalNoShow({
  nombreServicio,
  onConfirmar,
  onCancelar,
  cargando,
  mensajeError,
  onLimpiarError,
}: PropsModalNoShow) {
  const [pin, setPin] = useState('');
  const [motivo, setMotivo] = useState('');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-no-show-titulo"
      className="fixed inset-0 z-300 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onKeyDown={(e) => e.key === 'Escape' && onCancelar()}
    >
      <div className="bg-white rounded-4xl p-6 max-w-sm w-full shadow-2xl">
        <h2
          id="modal-no-show-titulo"
          className="text-base font-black uppercase tracking-tight text-slate-900 mb-1"
        >
          ¿Servicio no realizado?
        </h2>
        <p className="text-xs text-slate-500 font-medium mb-5">
          <span className="font-black text-slate-700">{nombreServicio}</span> será marcado como "No
          se realizó". El total de la cita se recalculará.
        </p>
        <div className="space-y-3">
          <label className="block">
            <span className="text-[11px] font-black uppercase tracking-wide text-slate-600 block mb-1.5">
              PIN de cancelación *
            </span>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => {
                onLimpiarError();
                setPin(e.target.value.replace(/\D/g, '').slice(0, 6));
              }}
              placeholder="••••"
              className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-black uppercase tracking-wide text-slate-600 block mb-1.5">
              Motivo (opcional)
            </span>
            <input
              type="text"
              maxLength={120}
              value={motivo}
              onChange={(e) => {
                onLimpiarError();
                setMotivo(e.target.value);
              }}
              placeholder="Ej: cliente no llegó, producto sin stock…"
              className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
            />
          </label>
          {mensajeError && <p className="text-xs font-medium text-red-600">{mensajeError}</p>}
        </div>
        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={onCancelar}
            className="flex-1 py-3 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase text-xs hover:bg-slate-200 transition-colors"
          >
            Volver
          </button>
          <button
            type="button"
            disabled={cargando || !pin}
            aria-busy={cargando}
            onClick={() => onConfirmar(pin, motivo)}
            className="flex-1 py-3 bg-red-600 text-white font-black rounded-2xl uppercase text-xs hover:bg-red-700 transition-colors disabled:opacity-60"
          >
            {cargando ? 'Procesando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface PropsTarjetaCita {
  reserva: Reserva;
  moneda: Moneda;
  onCompletar: (id: string) => void;
  onCancelar: (id: string) => void;
  onNoShow: (reservaId: string, servicioId: string, nombre: string) => void;
  onAgregarServicio: (reservaId: string) => void;
}

function TarjetaCita({
  reserva: b,
  moneda,
  onCompletar,
  onCancelar,
  onNoShow,
  onAgregarServicio,
}: PropsTarjetaCita) {
  const horaFin = calcularHoraFin(b.time, b.totalDuration);
  const estaCompletada = b.status === 'completed';
  const estaCancelada = b.status === 'cancelled';
  const detallesServicio = b.serviceDetails ?? [];
  const serviciosReserva = b.services ?? [];

  const franjaColor = estaCompletada
    ? 'bg-slate-400'
    : estaCancelada
      ? 'bg-red-400'
      : b.status === 'pending'
        ? 'bg-amber-400'
        : 'bg-green-400';

  const cardBg = estaCompletada
    ? 'bg-slate-50 border-slate-200'
    : estaCancelada
      ? 'bg-red-50 border-red-100 opacity-70'
      : 'bg-white border-slate-100 hover:border-pink-200';

  // Nombres de servicios para la línea compacta
  const nombresServicios =
    detallesServicio.length > 0
      ? detallesServicio
          .filter((s) => s.status !== 'cancelled')
          .map((s) => s.name)
          .join(', ')
      : serviciosReserva.map((s) => s.name).join(', ');

  return (
    <div className={`rounded-2xl border p-4 relative transition-all ${cardBg}`}>
      <div className={`absolute left-1.5 top-3 bottom-3 w-1 rounded-full ${franjaColor}`} />

      {/* Layout desktop: grid 2 columnas / Móvil: columna */}
      <div className="pl-5 flex flex-col md:grid md:grid-cols-[1fr_auto] md:gap-4">
        {/* Columna izquierda */}
        <div className="space-y-1.5">
          {/* Hora */}
          <div className="flex items-center gap-1.5">
            <span className="text-xl font-black text-slate-900">{b.time}</span>
            <span className="text-xs text-slate-400 font-bold">— {horaFin}</span>
          </div>
          {/* Cliente · Teléfono */}
          <p className="text-sm text-slate-800">
            <span className="font-black">{b.clientName}</span>
            <span className="text-slate-400 mx-1.5">·</span>
            <span className="text-slate-500 inline-flex items-center gap-1">
              <Phone className="w-3 h-3 text-pink-400 inline" aria-hidden="true" />
              {b.clientPhone}
            </span>
          </p>
          {/* Servicios en línea */}
          {nombresServicios && (
            <p className="text-xs text-slate-500 font-medium leading-snug">{nombresServicios}</p>
          )}
          {/* Especialista badge */}
          <span className="inline-flex items-center gap-1.5 bg-slate-100 rounded-full px-2.5 py-1 text-[10px] font-black text-slate-600 w-fit">
            <Users className="w-3 h-3" aria-hidden="true" /> {b.staffName}
          </span>
        </div>

        {/* Columna derecha */}
        <div className="flex flex-row md:flex-col items-start md:items-end justify-between md:justify-start gap-2 mt-3 md:mt-0">
          <BadgeEstado estado={b.status} />
          <div className="text-right">
            <p className="text-base font-black text-pink-700">
              {formatearDinero(b.totalPrice, moneda)}
            </p>
            <p className="text-[9px] text-slate-400">{b.totalDuration} min</p>
          </div>
          {!estaCompletada && !estaCancelada && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => onAgregarServicio(b.id)}
                className="rounded-xl bg-blue-100 px-3 py-1.5 text-[10px] font-black text-blue-700 hover:bg-blue-200 transition-colors"
              >
                + Extra
              </button>
              <button
                type="button"
                onClick={() => onCompletar(b.id)}
                className="rounded-xl bg-green-100 px-3 py-1.5 text-[10px] font-black text-green-700 hover:bg-green-200 transition-colors"
              >
                Completar
              </button>
              <button
                type="button"
                onClick={() => onCancelar(b.id)}
                className="rounded-xl bg-red-100 px-3 py-1.5 text-[10px] font-black text-red-600 hover:bg-red-200 transition-colors"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Info color / tinte */}
      {(b.colorBrand ?? b.colorNumber) && (
        <div className="pl-5 mt-3 bg-pink-50 border border-pink-100 p-2.5 rounded-xl">
          <p className="text-[10px] font-black text-pink-700 uppercase flex items-center gap-1">
            <Palette className="w-3 h-3" aria-hidden="true" /> Color / tono:
          </p>
          <p className="text-xs font-bold text-pink-900 mt-0.5">
            {[b.colorBrand, b.colorNumber].filter(Boolean).join(' · ')}
          </p>
        </div>
      )}

      {/* Observaciones del cliente */}
      {b.observaciones && (
        <div className="pl-5 mt-3 bg-amber-50 border border-amber-100 p-2.5 rounded-xl">
          <p className="text-[10px] font-black text-amber-700 uppercase">Notes</p>
          <p className="text-xs text-amber-900 mt-0.5">{b.observaciones}</p>
        </div>
      )}

      {/* Servicios detallados expandibles — solo cuando hay serviceDetails con estados */}
      {detallesServicio.length > 0 && detallesServicio.some((s) => s.status === 'no_show') && (
        <div className="pl-5 mt-3 space-y-0">
          {detallesServicio
            .filter((s) => s.status !== 'cancelled')
            .map((s) => (
              <ItemServicio
                key={s.id ?? s.name}
                servicio={s}
                moneda={moneda}
                puedeMarcarNoShow={false}
                onNoShow={() => {}}
              />
            ))}
        </div>
      )}

      {/* Botón "No realizó" para servicios individuales cuando la cita está activa */}
      {!estaCompletada && !estaCancelada && detallesServicio.length > 0 && (
        <div className="pl-5 mt-2 space-y-0">
          {detallesServicio
            .filter(
              (s) =>
                s.status !== 'cancelled' && (s.status === 'pending' || s.status === 'confirmed'),
            )
            .map((s) => (
              <div key={s.id ?? s.name} className="flex items-center justify-between py-1 text-xs">
                <span className="text-slate-600">{s.name}</span>
                <button
                  type="button"
                  onClick={() => onNoShow(b.id, s.id ?? '', s.name)}
                  className="rounded-lg bg-red-50 px-2 py-0.5 text-[9px] font-black uppercase text-red-600 hover:bg-red-100 transition-colors"
                >
                  No realizó
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────

export function AgendaDiaria({
  estudio,
  reservas,
  fechaVista,
  onCrearCitaManual,
}: PropsAgendaDiaria) {
  const { recargar } = usarContextoApp();
  const { mostrarToast } = usarToast();
  const reservasDisponibles = reservas ?? [];
  const personalDisponible = estudio.staff ?? [];
  const [pinCancelacion, setPinCancelacion] = useState('');
  const [tab, setTab] = useState<'agenda' | 'historial'>('agenda');
  const [especialistaTab, setEspecialistaTab] = useState<string>('todos');
  const [mesHistorial, setMesHistorial] = useState(() => {
    const ahora = new Date();
    return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
  });
  const [confirmacion, setConfirmacion] = useState<{
    tipo: 'completar' | 'cancelar';
    reservaId: string;
  } | null>(null);
  const [modalNoShow, setModalNoShow] = useState<{
    reservaId: string;
    servicioId: string;
    nombre: string;
  } | null>(null);
  const [mensajeErrorNoShow, setMensajeErrorNoShow] = useState<string | null>(null);
  const [modalAdicional, setModalAdicional] = useState<string | null>(null);
  const [servicioAdicionalSeleccionado, setServicioAdicionalSeleccionado] = useState('');

  const serviciosCatalogo = estudio.selectedServices ?? [];

  const { mutate: cambiarEstado, isPending: actualizando } = useMutation({
    mutationFn: ({ id, estado, pin }: { id: string; estado: EstadoReserva; pin?: string }) =>
      actualizarEstadoReserva(id, estado, pin),
    onSuccess: async () => {
      setPinCancelacion('');
      setConfirmacion(null);
      mostrarToast({ mensaje: 'Estado de la cita actualizado', variante: 'exito' });
      await recargar();
    },
    onError: (error: unknown) => {
      mostrarToast({
        mensaje: error instanceof Error ? error.message : 'No se pudo actualizar la cita',
        variante: 'error',
      });
    },
  });

  const { mutate: marcarNoShow, isPending: marcandoNoShow } = useMutation({
    mutationFn: ({
      reservaId,
      servicioId,
      pin,
      motivo,
    }: {
      reservaId: string;
      servicioId: string;
      pin: string;
      motivo: string;
    }) =>
      actualizarEstadoServicioReserva(reservaId, servicioId, 'no_show', pin, motivo || undefined),
    onSuccess: async () => {
      setModalNoShow(null);
      setMensajeErrorNoShow(null);
      mostrarToast({ mensaje: 'Servicio marcado como no realizado', variante: 'exito' });
      await recargar();
    },
    onError: (error: unknown) => {
      setMensajeErrorNoShow(
        error instanceof Error ? error.message : 'No se pudo marcar el servicio como no realizado',
      );
      mostrarToast({
        mensaje:
          error instanceof Error
            ? error.message
            : 'No se pudo marcar el servicio como no realizado',
        variante: 'error',
      });
    },
  });

  const { mutate: agregarAdicional, isPending: agregandoAdicional } = useMutation({
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
      mostrarToast({ mensaje: 'Extra added successfully', variante: 'exito' });
      await recargar();
    },
    onError: (error: unknown) => {
      mostrarToast({
        mensaje: error instanceof Error ? error.message : 'Could not add extra service',
        variante: 'error',
      });
    },
  });

  const confirmarAccion = () => {
    if (!confirmacion) return;
    const nuevoEstatus: EstadoReserva =
      confirmacion.tipo === 'completar' ? 'completed' : 'cancelled';
    cambiarEstado({
      id: confirmacion.reservaId,
      estado: nuevoEstatus,
      pin: confirmacion.tipo === 'cancelar' ? pinCancelacion : undefined,
    });
  };

  const moneda: Moneda = estudio.country === 'Colombia' ? 'COP' : 'MXN';
  const fechaStr = obtenerFechaLocalISO(fechaVista);

  const citasDelDia = reservasDisponibles
    .filter((r) => r.studioId === estudio.id && r.status !== 'cancelled' && r.date === fechaStr)
    .sort((a, b) => a.time.localeCompare(b.time));

  const idsConCitas = [...new Set(citasDelDia.map((c) => c.staffId))];
  const especialistasConCitas = personalDisponible.filter((s) => idsConCitas.includes(s.id));

  const citasFiltradas =
    especialistaTab === 'todos'
      ? citasDelDia
      : citasDelDia.filter((c) => c.staffId === especialistaTab);

  const [anioH, mesH] = mesHistorial.split('-').map(Number);
  const citasHistorial = reservasDisponibles
    .filter((r) => {
      if (r.studioId !== estudio.id) return false;
      if (r.status !== 'completed' && r.status !== 'cancelled') return false;
      const [y, m] = r.date.split('-').map(Number);
      return y === anioH && m === mesH;
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time));

  const cambiarMesHistorial = (offset: number) => {
    const [y, m] = mesHistorial.split('-').map(Number);
    const nuevaFecha = new Date(y ?? 0, (m ?? 1) - 1 + offset, 1);
    setMesHistorial(
      `${nuevaFecha.getFullYear()}-${String(nuevaFecha.getMonth() + 1).padStart(2, '0')}`,
    );
  };

  return (
    <section className="bg-white rounded-[3rem] border border-slate-200 shadow-sm">
      {/* Cabecera */}
      <div className="p-6 md:p-8 border-b bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 rounded-t-[3rem]">
        <div>
          <h2 className="text-2xl font-black italic uppercase flex items-center gap-3">
            <Calendar className="text-pink-600" aria-hidden="true" /> Agenda
          </h2>
          <p className="text-xs font-bold text-slate-500 mt-1">
            {fechaVista.toLocaleDateString('es-ES', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-slate-200 rounded-xl p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => setTab('agenda')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-colors ${tab === 'agenda' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Agenda
            </button>
            <button
              type="button"
              onClick={() => setTab('historial')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-colors ${tab === 'historial' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <History className="w-3.5 h-3.5" aria-hidden="true" /> Historial
            </button>
          </div>
          {tab === 'agenda' && (
            <>
              <button
                type="button"
                onClick={onCrearCitaManual}
                className="inline-flex items-center gap-2 rounded-xl bg-pink-600 px-4 py-2 text-xs font-black text-white transition-colors hover:bg-pink-700"
              >
                <Plus className="h-4 w-4" aria-hidden="true" /> Crear cita manual
              </button>
              <span className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-black shrink-0">
                {citasDelDia.length} Citas
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── HISTORIAL ─────────────────────────────────────────────── */}
      {tab === 'historial' && (
        <div className="p-4 md:p-6 space-y-4">
          <div className="flex items-center justify-between bg-slate-50 rounded-2xl px-4 py-2 border border-slate-100">
            <button
              type="button"
              onClick={() => cambiarMesHistorial(-1)}
              aria-label="Mes anterior"
              className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-black capitalize text-slate-800">
              {new Date(`${mesHistorial}-01`).toLocaleDateString('es-ES', {
                month: 'long',
                year: 'numeric',
              })}
            </span>
            <button
              type="button"
              onClick={() => cambiarMesHistorial(1)}
              aria-label="Mes siguiente"
              className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {citasHistorial.length === 0 ? (
            <p className="text-center text-sm text-slate-400 italic py-8 font-bold">
              No hay citas en el historial para este mes.
            </p>
          ) : (
            <div className="space-y-3">
              {citasHistorial.map((b) => (
                <TarjetaCita
                  key={b.id}
                  reserva={b}
                  moneda={moneda}
                  onCompletar={(id) => setConfirmacion({ tipo: 'completar', reservaId: id })}
                  onCancelar={(id) => setConfirmacion({ tipo: 'cancelar', reservaId: id })}
                  onNoShow={(reservaId, servicioId, nombre) =>
                    setModalNoShow({ reservaId, servicioId, nombre })
                  }
                  onAgregarServicio={(reservaId) => setModalAdicional(reservaId)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── AGENDA DEL DÍA ────────────────────────────────────────── */}
      {tab === 'agenda' && (
        <div className="p-4 md:p-6">
          {citasDelDia.length === 0 ? (
            <p className="text-center text-sm text-slate-400 italic py-12 font-bold">
              No hay citas para este día.
            </p>
          ) : (
            <>
              {/* Filtro por especialista */}
              {especialistasConCitas.length > 1 && (
                <div className="flex flex-wrap gap-1.5 mb-5 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setEspecialistaTab('todos')}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-colors ${especialistaTab === 'todos' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    Todos
                  </button>
                  {especialistasConCitas.map((esp) => (
                    <button
                      key={esp.id}
                      type="button"
                      onClick={() => setEspecialistaTab(esp.id)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-colors ${especialistaTab === esp.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {esp.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Lista de citas — siempre en columna única, ordenadas por hora */}
              <div className="space-y-3">
                {citasFiltradas.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 italic py-8 font-bold">
                    Sin citas para este especialista hoy.
                  </p>
                ) : (
                  citasFiltradas.map((b) => (
                    <TarjetaCita
                      key={b.id}
                      reserva={b}
                      moneda={moneda}
                      onCompletar={(id) => setConfirmacion({ tipo: 'completar', reservaId: id })}
                      onCancelar={(id) => setConfirmacion({ tipo: 'cancelar', reservaId: id })}
                      onNoShow={(reservaId, servicioId, nombre) =>
                        setModalNoShow({ reservaId, servicioId, nombre })
                      }
                      onAgregarServicio={(reservaId) => setModalAdicional(reservaId)}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      {modalNoShow && (
        <ModalNoShow
          nombreServicio={modalNoShow.nombre}
          cargando={marcandoNoShow}
          mensajeError={mensajeErrorNoShow}
          onLimpiarError={() => setMensajeErrorNoShow(null)}
          onConfirmar={(pin, motivo) =>
            marcarNoShow({
              reservaId: modalNoShow.reservaId,
              servicioId: modalNoShow.servicioId,
              pin,
              motivo,
            })
          }
          onCancelar={() => {
            setMensajeErrorNoShow(null);
            setModalNoShow(null);
          }}
        />
      )}

      {/* ── MODAL AGREGAR ADICIONAL ──────────────────────────────── */}
      {modalAdicional && (
        <div
          className="fixed inset-0 z-210 bg-slate-950/70 p-4 backdrop-blur-sm flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-adicional"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 id="titulo-adicional" className="text-lg font-black text-slate-900 mb-4">
              Add Extra Service
            </h3>
            {serviciosCatalogo.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No services available in catalog.</p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                {serviciosCatalogo.map((srv) => {
                  const activo = servicioAdicionalSeleccionado === srv.name;
                  return (
                    <button
                      key={srv.name}
                      type="button"
                      onClick={() => setServicioAdicionalSeleccionado(srv.name)}
                      className={`w-full flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
                        activo
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200'
                      }`}
                    >
                      <span className="font-bold text-sm">{srv.name}</span>
                      <span className="text-xs font-black">
                        {formatearDinero(srv.price, moneda)} · {srv.duration} min
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setModalAdicional(null);
                  setServicioAdicionalSeleccionado('');
                }}
                className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!servicioAdicionalSeleccionado || agregandoAdicional}
                onClick={() => {
                  const srv = serviciosCatalogo.find(
                    (s) => s.name === servicioAdicionalSeleccionado,
                  );
                  if (!srv || !modalAdicional) return;
                  agregarAdicional({
                    reservaId: modalAdicional,
                    servicio: {
                      nombre: srv.name,
                      duracion: srv.duration,
                      precio: srv.price,
                    },
                  });
                }}
                className="flex-1 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {agregandoAdicional ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        </div>
      )}

      <DialogoConfirmacion
        abierto={!!confirmacion}
        mensaje={confirmacion?.tipo === 'completar' ? '¿Confirmar cobro?' : '¿Cancelar cita?'}
        descripcion={
          confirmacion?.tipo === 'completar'
            ? 'Se registrará el ingreso en el balance.'
            : 'La cita quedará marcada como cancelada. Ingresa el PIN del dueño para confirmar.'
        }
        etiquetaCampo={confirmacion?.tipo === 'cancelar' ? 'PIN de cancelación' : undefined}
        placeholderCampo={
          confirmacion?.tipo === 'cancelar' ? 'Ingresa el PIN del dueño' : undefined
        }
        valorCampo={confirmacion?.tipo === 'cancelar' ? pinCancelacion : undefined}
        onCambiarCampo={confirmacion?.tipo === 'cancelar' ? setPinCancelacion : undefined}
        variante={confirmacion?.tipo === 'cancelar' ? 'peligro' : 'advertencia'}
        textoConfirmar={confirmacion?.tipo === 'completar' ? 'Confirmar Cobro' : 'Cancelar Cita'}
        cargando={actualizando}
        onConfirmar={confirmarAccion}
        onCancelar={() => {
          setPinCancelacion('');
          setConfirmacion(null);
        }}
      />
    </section>
  );
}
