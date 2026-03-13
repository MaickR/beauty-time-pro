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
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { DialogoConfirmacion } from '../../../componentes/ui/DialogoConfirmacion';
import { usarContextoApp } from '../../../contextos/ContextoApp';
import { formatearDinero } from '../../../utils/formato';
import { actualizarEstadoReserva } from '../../../servicios/servicioReservas';
import type { Estudio, Reserva, Moneda, EstadoReserva } from '../../../tipos';

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

interface PropsTarjetaCita {
  reserva: Reserva;
  moneda: Moneda;
  onCompletar: (id: string) => void;
  onCancelar: (id: string) => void;
}

function TarjetaCita({ reserva: b, moneda, onCompletar, onCancelar }: PropsTarjetaCita) {
  const horaFin = calcularHoraFin(b.time, b.totalDuration);
  const estaCompletada = b.status === 'completed';
  const estaCancelada = b.status === 'cancelled';

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

  return (
    <div className={`rounded-2xl border p-4 relative transition-all ${cardBg}`}>
      <div className={`absolute left-1.5 top-3 bottom-3 w-1 rounded-full ${franjaColor}`} />

      {/* Encabezado: hora + precio */}
      <div className="flex items-start justify-between gap-2 pl-5 mb-3">
        <div>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-xl font-black text-slate-900">{b.time}</span>
            <span className="text-xs text-slate-400 font-bold">→ {horaFin}</span>
          </div>
          <BadgeEstado estado={b.status} />
        </div>
        <div className="rounded-xl bg-pink-50 border border-pink-100 px-3 py-2 text-right shrink-0">
          <p className="text-base font-black text-pink-700">
            {formatearDinero(b.totalPrice, moneda)}
          </p>
          <p className="text-[9px] text-slate-400">{b.totalDuration} min</p>
        </div>
      </div>

      {/* Info cliente */}
      <div className="pl-5">
        <p className="font-black text-base text-slate-900 leading-tight">{b.clientName}</p>
        <p className="text-xs text-slate-500 flex items-center gap-1 mt-0.5">
          <Phone className="w-3 h-3 text-pink-400" aria-hidden="true" /> {b.clientPhone}
        </p>
      </div>

      {/* Servicios */}
      <div className="pl-5 mt-3 space-y-1.5">
        {b.services.map((s, idx) => (
          <div key={idx} className="flex justify-between items-center text-xs">
            <span className="flex items-center gap-1.5 text-slate-700 font-medium">
              <CheckCircle2
                className={`w-3 h-3 shrink-0 ${estaCompletada ? 'text-slate-400' : 'text-pink-400'}`}
                aria-hidden="true"
              />
              {s.name}
            </span>
            <span className="text-slate-500 font-bold shrink-0">
              {formatearDinero(s.price, moneda)} · {s.duration}m
            </span>
          </div>
        ))}
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

      {/* Pie: especialista (izquierda) + acciones (derecha) */}
      <div className="pl-5 mt-3 flex items-center justify-between gap-2 flex-wrap">
        <span className="flex items-center gap-1.5 bg-slate-100 rounded-full px-2.5 py-1 text-[10px] font-black text-slate-600">
          <Users className="w-3 h-3" aria-hidden="true" /> {b.staffName}
        </span>
        {!estaCompletada && !estaCancelada && (
          <div className="flex items-center gap-1.5">
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

  const { mutate: cambiarEstado, isPending: actualizando } = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: EstadoReserva }) =>
      actualizarEstadoReserva(id, estado),
    onSuccess: async () => {
      setConfirmacion(null);
      await recargar();
    },
  });

  const confirmarAccion = () => {
    if (!confirmacion) return;
    const nuevoEstatus: EstadoReserva =
      confirmacion.tipo === 'completar' ? 'completed' : 'cancelled';
    cambiarEstado({ id: confirmacion.reservaId, estado: nuevoEstatus });
  };

  const moneda: Moneda = estudio.country === 'Colombia' ? 'COP' : 'MXN';
  const fechaStr = obtenerFechaLocalISO(fechaVista);

  const citasDelDia = reservas
    .filter((r) => r.studioId === estudio.id && r.status !== 'cancelled' && r.date === fechaStr)
    .sort((a, b) => a.time.localeCompare(b.time));

  const idsConCitas = [...new Set(citasDelDia.map((c) => c.staffId))];
  const especialistasConCitas = estudio.staff.filter((s) => idsConCitas.includes(s.id));

  const citasFiltradas =
    especialistaTab === 'todos'
      ? citasDelDia
      : citasDelDia.filter((c) => c.staffId === especialistaTab);

  const [anioH, mesH] = mesHistorial.split('-').map(Number);
  const citasHistorial = reservas
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
                    />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      )}

      <DialogoConfirmacion
        abierto={!!confirmacion}
        mensaje={confirmacion?.tipo === 'completar' ? '¿Confirmar cobro?' : '¿Cancelar cita?'}
        descripcion={
          confirmacion?.tipo === 'completar'
            ? 'Se registrará el ingreso en el balance.'
            : 'La cita quedará marcada como cancelada.'
        }
        variante={confirmacion?.tipo === 'cancelar' ? 'peligro' : 'advertencia'}
        textoConfirmar={confirmacion?.tipo === 'completar' ? 'Confirmar Cobro' : 'Cancelar Cita'}
        cargando={actualizando}
        onConfirmar={confirmarAccion}
        onCancelar={() => setConfirmacion(null)}
      />
    </section>
  );
}
