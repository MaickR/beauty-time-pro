import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Phone,
  Plus,
  History,
  ChevronLeft,
  ChevronRight,
  Palette,
  StickyNote,
  Scissors,
  Package2,
  WalletCards,
} from 'lucide-react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { DialogoConfirmacion } from '../../../componentes/ui/DialogoConfirmacion';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { usarContextoApp } from '../../../contextos/ContextoApp';
import { formatearDinero, formatearFechaHumana } from '../../../utils/formato';
import {
  obtenerPestanaAgendaPorFecha,
  normalizarFechaReservaAgenda,
  obtenerReservasActivasDelDiaAgenda,
  obtenerReservasHistorialAgenda,
} from '../utils/estadoCalendarioAgenda';
import {
  actualizarEstadoReserva,
  actualizarEstadoServicioReserva,
  agregarServicioAReserva,
  agregarProductoAReserva,
} from '../../../servicios/servicioReservas';
import { obtenerProductos } from '../../../servicios/servicioProductos';
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

const BADGE_CONFIG: Record<
  EstadoReserva,
  { bg: string; text: string; dot: string; label: string }
> = {
  pending: {
    bg: 'bg-green-50',
    text: 'text-green-800',
    dot: 'bg-green-500',
    label: 'Confirmada',
  },
  confirmed: {
    bg: 'bg-green-50',
    text: 'text-green-800',
    dot: 'bg-green-500',
    label: 'Confirmada',
  },
  working: {
    bg: 'bg-sky-50',
    text: 'text-sky-800',
    dot: 'bg-sky-500',
    label: 'Trabajando',
  },
  completed: {
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    dot: 'bg-slate-400',
    label: 'Completada',
  },
  cancelled: {
    bg: 'bg-red-50',
    text: 'text-red-800',
    dot: 'bg-red-400',
    label: 'Cancelada',
  },
  no_show: {
    bg: 'bg-orange-50',
    text: 'text-orange-800',
    dot: 'bg-orange-400',
    label: 'No se presentó',
  },
};

const STATUS_BAR: Record<EstadoReserva, string> = {
  pending: 'bg-green-500',
  confirmed: 'bg-green-500',
  working: 'bg-sky-500',
  completed: 'bg-slate-300',
  cancelled: 'bg-red-400',
  no_show: 'bg-orange-400',
};

const METODOS_PAGO = [
  { valor: 'cash', etiqueta: 'Efectivo' },
  { valor: 'card', etiqueta: 'Tarjeta' },
  { valor: 'bank_transfer', etiqueta: 'Transferencia bancaria' },
  { valor: 'digital_transfer', etiqueta: 'Transferencia digital' },
] as const;

function formatearMetodoPago(metodo?: string | null): string {
  return METODOS_PAGO.find((item) => item.valor === metodo)?.etiqueta ?? 'A confirmar en el salón';
}

function BadgeEstado({
  estado,
  editable = false,
  cargando = false,
  onCambiar,
}: {
  estado: EstadoReserva;
  editable?: boolean;
  cargando?: boolean;
  onCambiar?: (estado: EstadoReserva) => void;
}) {
  const estadoVisual = estado === 'pending' ? 'confirmed' : estado;
  const cfg = BADGE_CONFIG[estadoVisual] ?? BADGE_CONFIG.confirmed;

  if (!editable || !onCambiar || ['completed', 'cancelled', 'no_show'].includes(estadoVisual)) {
    return (
      <span
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${cfg.bg} ${cfg.text}`}
      >
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dot}`} />
        {cfg.label}
      </span>
    );
  }

  return (
    <label
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${cfg.bg} ${cfg.text}`}
    >
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${cfg.dot}`} />
      <select
        value={estadoVisual}
        onChange={(evento) => onCambiar(evento.target.value as EstadoReserva)}
        disabled={cargando}
        aria-label="Cambiar estado de la cita"
        className="cursor-pointer appearance-none bg-transparent pr-1 text-[10px] font-semibold uppercase tracking-wide outline-none disabled:cursor-not-allowed"
      >
        <option value="confirmed">Confirmada</option>
        <option value="working">Trabajando</option>
      </select>
    </label>
  );
}

function AvatarCliente({ nombre }: { nombre: string }) {
  const iniciales = nombre
    .split(' ')
    .slice(0, 2)
    .map((parte) => parte[0])
    .join('')
    .toUpperCase();

  return (
    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-pink-50 text-[12px] font-semibold text-pink-700">
      {iniciales}
    </span>
  );
}

function obtenerNombresServiciosReserva(reserva: Reserva): string[] {
  const detallesServicio = reserva.serviceDetails ?? [];
  if (detallesServicio.length > 0) {
    return detallesServicio.filter((servicio) => servicio.status !== 'cancelled').map((servicio) => servicio.name);
  }

  return (reserva.services ?? []).map((servicio) => servicio.name);
}

function coincideFiltroEstado(estadoReserva: EstadoReserva, filtroEstado: string): boolean {
  if (filtroEstado === 'todos') return true;
  if (filtroEstado === 'confirmed') {
    return estadoReserva === 'pending' || estadoReserva === 'confirmed';
  }

  return estadoReserva === filtroEstado;
}

interface PropsItemServicio {
  servicio: DetalleServicioReserva;
  moneda: Moneda;
  puedeMarcarNoShow: boolean;
  onNoShow: () => void;
}

function ItemServicio({ servicio, puedeMarcarNoShow, onNoShow }: PropsItemServicio) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm">
      <span className="text-[12.5px] font-medium text-slate-800">{servicio.name}</span>
      {puedeMarcarNoShow && (
        <button
          type="button"
          onClick={onNoShow}
          className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-black uppercase tracking-wide text-red-700 transition-colors hover:bg-red-100"
        >
          No realizó
        </button>
      )}
    </div>
  );
}

function MetaItem({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-3 py-2.5 shadow-sm ${
        accent ? 'border-pink-100 bg-pink-50/80' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <p className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
      <p
        className={`mt-1 text-[13px] font-semibold leading-tight ${
          accent ? 'text-pink-700' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
    </div>
  );
}

interface PropsModalMotivoAccion {
  titulo: string;
  descripcion: string;
  textoConfirmar: string;
  motivoInicial?: string;
  onConfirmar: (motivo: string) => void;
  onCancelar: () => void;
  cargando: boolean;
  mensajeError?: string | null;
  onLimpiarError: () => void;
}

function ModalMotivoAccion({
  titulo,
  descripcion,
  textoConfirmar,
  motivoInicial = '',
  onConfirmar,
  onCancelar,
  cargando,
  mensajeError,
  onLimpiarError,
}: PropsModalMotivoAccion) {
  const [motivo, setMotivo] = useState(motivoInicial);
  const motivoValido = motivo.trim().length >= 4;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-motivo-accion-titulo"
      className="fixed inset-0 z-300 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      onKeyDown={(e) => e.key === 'Escape' && onCancelar()}
    >
      <div className="w-full max-w-md rounded-4xl bg-white p-6 shadow-2xl">
        <h2
          id="modal-motivo-accion-titulo"
          className="mb-1 text-base font-black uppercase tracking-tight text-slate-900"
        >
          {titulo}
        </h2>
        <p className="mb-5 text-sm font-medium leading-relaxed text-slate-500">{descripcion}</p>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-black uppercase tracking-wide text-slate-600">
            Motivo de cancelación *
          </span>
          <textarea
            rows={4}
            maxLength={200}
            value={motivo}
            onChange={(e) => {
              onLimpiarError();
              setMotivo(e.target.value.slice(0, 200));
            }}
            placeholder="Ej: el cliente no asistió, pidió reprogramar o el producto no estuvo disponible..."
            className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
          />
        </label>

        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400">Este motivo quedará guardado en el historial.</p>
          <span className="text-[11px] font-bold text-slate-500">{motivo.length}/200</span>
        </div>

        {mensajeError && <p className="mt-3 text-xs font-medium text-red-600">{mensajeError}</p>}

        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancelar}
            className="flex-1 rounded-2xl bg-slate-100 py-3 text-xs font-black uppercase text-slate-600 transition-colors hover:bg-slate-200"
          >
            Volver
          </button>
          <button
            type="button"
            disabled={cargando || !motivoValido}
            aria-busy={cargando}
            onClick={() => onConfirmar(motivo.trim())}
            className="flex-1 rounded-2xl bg-red-600 py-3 text-xs font-black uppercase text-white transition-colors hover:bg-red-700 disabled:opacity-60"
          >
            {cargando ? 'Procesando...' : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}

interface PropsPaginadorLista {
  paginaActual: number;
  totalPaginas: number;
  totalRegistros?: number;
  etiquetaRegistros?: string;
  onCambiar: (pagina: number) => void;
}

function PaginadorLista({
  paginaActual,
  totalPaginas,
  totalRegistros,
  etiquetaRegistros = 'registros',
  onCambiar,
}: PropsPaginadorLista) {
  if (totalPaginas <= 1) return null;

  const paginasVisibles = Array.from({ length: totalPaginas }, (_, indice) => indice + 1).filter(
    (pagina) =>
      pagina === 1 ||
      pagina === totalPaginas ||
      Math.abs(pagina - paginaActual) <= 1,
  );

  return (
    <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs font-black uppercase tracking-wide text-slate-500">
          Página {paginaActual} de {totalPaginas}
          {typeof totalRegistros === 'number' ? ` · ${totalRegistros} ${etiquetaRegistros}` : ''}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={paginaActual === 1}
            onClick={() => onCambiar(1)}
            className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition-colors hover:bg-slate-100 disabled:opacity-40"
          >
            Inicio
          </button>
          <button
            type="button"
            disabled={paginaActual === 1}
            onClick={() => onCambiar(paginaActual - 1)}
            className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition-colors hover:bg-slate-100 disabled:opacity-40"
          >
            Anterior
          </button>
          <div className="flex items-center gap-1">
            {paginasVisibles.map((pagina) => (
              <button
                key={pagina}
                type="button"
                onClick={() => onCambiar(pagina)}
                className={`rounded-xl px-3 py-2 text-xs font-black transition-colors ${
                  pagina === paginaActual
                    ? 'bg-slate-900 text-white'
                    : 'bg-white text-slate-700 shadow-sm hover:bg-slate-100'
                }`}
              >
                {pagina}
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={paginaActual === totalPaginas}
            onClick={() => onCambiar(paginaActual + 1)}
            className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition-colors hover:bg-slate-100 disabled:opacity-40"
          >
            Siguiente
          </button>
          <button
            type="button"
            disabled={paginaActual === totalPaginas}
            onClick={() => onCambiar(totalPaginas)}
            className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition-colors hover:bg-slate-100 disabled:opacity-40"
          >
            Final
          </button>
        </div>
      </div>
    </div>
  );
}

interface PropsTarjetaCita {
  reserva: Reserva;
  moneda: Moneda;
  esPlanPro: boolean;
  mostrarFecha?: boolean;
  onCompletar: (id: string) => void;
  onCancelar: (id: string) => void;
  onNoShow: (reservaId: string, servicioId: string, nombre: string) => void;
  onAgregarServicio: (reservaId: string) => void;
  onCambiarEstado: (id: string, estado: EstadoReserva) => void;
  actualizandoEstado?: boolean;
}

function TarjetaCita({
  reserva: b,
  moneda,
  esPlanPro,
  mostrarFecha = false,
  onCompletar,
  onCancelar,
  onNoShow,
  onAgregarServicio,
  onCambiarEstado,
  actualizandoEstado = false,
}: PropsTarjetaCita) {
  const horaFin = calcularHoraFin(b.time, b.totalDuration);
  const estadoVisible: EstadoReserva = b.status === 'pending' ? 'confirmed' : b.status;
  const estaCompletada = estadoVisible === 'completed';
  const estaCancelada = estadoVisible === 'cancelled';
  const estaNoShow = estadoVisible === 'no_show';
  const estaTrabajando = estadoVisible === 'working';
  const mostrarAcciones = !estaCompletada && !estaCancelada && !estaNoShow;

  const detallesServicio = b.serviceDetails ?? [];
  const serviciosReserva = b.services ?? [];

  const nombresServicios =
    detallesServicio.length > 0
      ? detallesServicio.filter((s) => s.status !== 'cancelled').map((s) => s.name)
      : serviciosReserva.map((s) => s.name);

  const serviciosActivos = detallesServicio.filter(
    (s) => !['cancelled', 'no_show'].includes(s.status) && ['pending', 'confirmed', 'working'].includes(s.status),
  );
  const productosAdicionales = b.productItems ?? [];
  const incidenciasServicios = detallesServicio.filter(
    (s) => ['cancelled', 'no_show'].includes(s.status) && Boolean(s.motivo),
  );

  return (
    <div
      className={[
        'overflow-hidden rounded-2xl border transition-all',
        estaCompletada
          ? 'border-slate-200 bg-slate-50 opacity-70'
          : estaCancelada || estaNoShow
            ? 'border-red-100 bg-red-50/40 opacity-60'
            : estaTrabajando
              ? 'border-sky-100 bg-sky-50/30 hover:border-sky-200 hover:shadow-sm'
              : 'border-slate-100 bg-white hover:border-pink-200 hover:shadow-sm',
      ].join(' ')}
    >
      <div className={`h-0.75 w-full ${STATUS_BAR[estadoVisible]}`} />

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-serif text-2xl font-normal leading-none tracking-tight text-slate-900">
              {b.time}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">hasta las {horaFin}</p>
            {mostrarFecha && (
              <p className="mt-1 text-[11px] font-black uppercase tracking-wide text-slate-500">
                {formatearFechaHumana(normalizarFechaReservaAgenda(b.date))}
              </p>
            )}
          </div>
          <BadgeEstado
            estado={estadoVisible}
            editable={mostrarAcciones}
            cargando={actualizandoEstado}
            onCambiar={(nuevoEstado) => {
              if (nuevoEstado !== estadoVisible) {
                onCambiarEstado(b.id, nuevoEstado);
              }
            }}
          />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3">
          <p className="mb-2 text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
            Cliente
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <AvatarCliente nombre={b.clientName} />
              <p className="truncate text-sm font-semibold leading-tight text-slate-900">
                {b.clientName}
              </p>
            </div>
            <p className="flex items-center gap-1.5 text-[11.5px] font-medium text-slate-500 sm:justify-end">
              <Phone className="h-3 w-3 shrink-0 text-pink-400" aria-hidden="true" />
              {b.clientPhone}
            </p>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="mb-2 flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
            <Scissors className="h-3 w-3" aria-hidden="true" /> Servicios
          </p>
          {nombresServicios.length > 0 ? (
            <div className="space-y-2">
              {estaTrabajando && (
                <div className="rounded-xl border border-sky-100 bg-sky-50 px-3 py-2 text-[11px] font-semibold text-sky-700">
                  La cita está en proceso de ejecución.
                </div>
              )}
              {mostrarAcciones && serviciosActivos.length > 0
                ? serviciosActivos.map((s, indiceServicio) => (
                    <ItemServicio
                      key={`${s.id ?? s.name}-${indiceServicio}`}
                      servicio={s}
                      moneda={moneda}
                      puedeMarcarNoShow
                      onNoShow={() => onNoShow(b.id, s.id ?? '', s.name)}
                    />
                  ))
                : nombresServicios.map((nombre, indiceNombre) => (
                    <div
                      key={`${nombre}-${indiceNombre}`}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12.5px] text-slate-700 shadow-sm"
                    >
                      {nombre}
                    </div>
                  ))}
            </div>
          ) : (
            <p className="text-[12px] text-slate-400">Sin servicios registrados</p>
          )}
        </div>

        {esPlanPro && productosAdicionales.length > 0 && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-3">
            <p className="mb-2 flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-wide text-emerald-700">
              <Package2 className="h-3.5 w-3.5" aria-hidden="true" /> Productos
            </p>
            <div className="space-y-2">
              {productosAdicionales.map((producto) => (
                <div
                  key={`${producto.id}-${producto.nombre}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-[12px] text-slate-700 shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{producto.nombre}</p>
                    <p className="text-[11px] text-slate-500">
                      {producto.cantidad} × {formatearDinero(producto.precioUnitario, moneda)}
                    </p>
                  </div>
                  <span className="text-[11px] font-black text-emerald-700">
                    {formatearDinero(producto.total, moneda)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <MetaItem label="Estilista" value={b.staffName} />
          <MetaItem label="Duración" value={`${b.totalDuration} min`} />
          <MetaItem label="Método de pago" value={formatearMetodoPago(b.paymentMethod)} />
          <MetaItem label="Total" value={formatearDinero(b.totalPrice, moneda)} accent />
        </div>

        {(b.colorBrand ?? b.colorNumber) && (
          <div className="flex items-start gap-2 rounded-xl border border-pink-100 bg-pink-50 px-3 py-2">
            <Palette className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pink-400" aria-hidden="true" />
            <div>
              <p className="text-[9.5px] font-semibold uppercase tracking-wide text-pink-600">
                Color / tono
              </p>
              <p className="mt-0.5 text-[12px] font-medium text-pink-900">
                {[b.colorBrand, b.colorNumber].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
        )}

        {b.observaciones && (
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-3">
            <p className="mb-2 flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-wide text-amber-700">
              <StickyNote className="h-3.5 w-3.5" aria-hidden="true" /> Registro de notas
            </p>
            <div className="space-y-1.5 text-[12px] text-amber-900">
              <p>
                <span className="font-black">Reserva:</span> {b.observaciones}
              </p>
            </div>
          </div>
        )}

        {(b.cancellationReason || incidenciasServicios.length > 0) && (
          <div className="rounded-xl border border-red-100 bg-red-50 px-3 py-3">
            <p className="mb-2 flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-wide text-red-700">
              <WalletCards className="h-3.5 w-3.5" aria-hidden="true" /> Registro de cancelación
            </p>
            <div className="space-y-1.5 text-[12px] text-red-900">
              {b.cancellationReason && (
                <p>
                  <span className="font-black">Cita:</span> {b.cancellationReason}
                </p>
              )}
              {incidenciasServicios.map((servicio) => (
                <p key={`${servicio.id ?? servicio.name}-motivo`}>
                  <span className="font-black">{servicio.name}:</span> {servicio.motivo}
                </p>
              ))}
            </div>
          </div>
        )}

        {mostrarAcciones && (
          <div className="grid grid-cols-1 gap-2 pt-0.5 sm:grid-cols-3">
            <button
              type="button"
              onClick={() => onAgregarServicio(b.id)}
              className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-blue-700 transition-colors hover:bg-blue-100"
            >
              + Extra
            </button>
            <button
              type="button"
              onClick={() => onCompletar(b.id)}
              className="rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-green-800 transition-colors hover:bg-green-100"
            >
              {estaTrabajando ? 'Finalizar' : 'Completar'}
            </button>
            <button
              type="button"
              onClick={() => onCancelar(b.id)}
              className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-red-700 transition-colors hover:bg-red-100"
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
  const { mostrarToast } = usarToast();
  const [reservasVista, setReservasVista] = useState<Reserva[]>(reservas ?? []);
  const reservasDisponibles = reservasVista;
  const personalDisponible = estudio.staff ?? [];
  const [tab, setTab] = useState<'agenda' | 'historial'>('agenda');
  const [especialistaTab, setEspecialistaTab] = useState<string>('todos');
  const [filtroEstadoAgenda, setFiltroEstadoAgenda] = useState<string>('todos');
  const [filtroServicioAgenda, setFiltroServicioAgenda] = useState<string>('todos');
  const [ordenAgenda, setOrdenAgenda] = useState<'tempranas' | 'tardias'>('tempranas');
  const [paginaAgenda, setPaginaAgenda] = useState(1);
  const [paginaHistorial, setPaginaHistorial] = useState(1);
  const [modoHistorial, setModoHistorial] = useState<'dia' | 'rango' | 'mes'>('mes');
  const [fechaHistorial, setFechaHistorial] = useState(() => obtenerFechaLocalISO(new Date()));
  const [rangoInicio, setRangoInicio] = useState('');
  const [rangoFin, setRangoFin] = useState('');
  const [mesHistorial, setMesHistorial] = useState(() => {
    const ahora = new Date();
    return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
  });
  const [confirmacion, setConfirmacion] = useState<{
    tipo: 'completar' | 'cancelar';
    reservaId: string;
  } | null>(null);
  const [mensajeErrorCancelacion, setMensajeErrorCancelacion] = useState<string | null>(null);
  const [modalNoShow, setModalNoShow] = useState<{
    reservaId: string;
    servicioId: string;
    nombre: string;
  } | null>(null);
  const [mensajeErrorNoShow, setMensajeErrorNoShow] = useState<string | null>(null);
  const [modalAdicional, setModalAdicional] = useState<string | null>(null);
  const [tabAdicional, setTabAdicional] = useState<'servicio' | 'producto'>('servicio');
  const [servicioAdicionalSeleccionado, setServicioAdicionalSeleccionado] = useState('');
  const [productoAdicionalSeleccionado, setProductoAdicionalSeleccionado] = useState('');
  const [cantidadProductoAdicional, setCantidadProductoAdicional] = useState(1);

  const serviciosCatalogo = useMemo(
    () =>
      (estudio.selectedServices ?? []).filter((servicio, indice, arreglo) => {
        const claveServicio = servicio.name.trim().toLowerCase();
        return (
          arreglo.findIndex((item) => item.name.trim().toLowerCase() === claveServicio) === indice
        );
      }),
    [estudio.selectedServices],
  );
  const LIMITE_AGENDA_POR_PAGINA = 3;
  const LIMITE_HISTORIAL_POR_PAGINA = 3;

  const consultaProductos = useQuery({
    queryKey: ['productos-agenda', estudio.id],
    queryFn: () => obtenerProductos(estudio.id),
    enabled: Boolean(modalAdicional) && estudio.plan === 'PRO',
    staleTime: 60_000,
  });
  const productosCatalogo = useMemo(
    () =>
      (consultaProductos.data ?? []).filter(
        (producto, indice, arreglo) =>
          producto.activo && arreglo.findIndex((item) => item.id === producto.id) === indice,
      ),
    [consultaProductos.data],
  );

  useEffect(() => {
    setReservasVista(reservas ?? []);
  }, [reservas]);

  const actualizarReservaEnVista = useCallback(
    (reservaId: string, actualizador: (reservaActual: Reserva) => Reserva) => {
      setReservasVista((previas) =>
        previas.map((reservaActual) =>
          reservaActual.id === reservaId ? actualizador(reservaActual) : reservaActual,
        ),
      );
    },
    [],
  );

  const cerrarModalAdicional = () => {
    setModalAdicional(null);
    setTabAdicional('servicio');
    setServicioAdicionalSeleccionado('');
    setProductoAdicionalSeleccionado('');
    setCantidadProductoAdicional(1);
  };

  const { mutate: cambiarEstado, isPending: actualizando } = useMutation({
    mutationFn: ({ id, estado, motivo }: { id: string; estado: EstadoReserva; motivo?: string }) =>
      actualizarEstadoReserva(id, estado, motivo),
    onSuccess: async (_, variables) => {
      actualizarReservaEnVista(variables.id, (reservaActual) => {
        const detallesActuales =
          reservaActual.serviceDetails && reservaActual.serviceDetails.length > 0
            ? [...reservaActual.serviceDetails]
            : (reservaActual.services ?? []).map((servicio, indice) => ({
                ...servicio,
                status: reservaActual.status,
                order: indice,
                motivo: null,
              }));

        const detallesActualizados = detallesActuales.map((servicio) => {
          if (['cancelled', 'no_show'].includes(servicio.status)) return servicio;

          if (variables.estado === 'confirmed' && ['pending', 'working'].includes(servicio.status)) {
            return { ...servicio, status: 'confirmed' };
          }

          if (variables.estado === 'working' && ['pending', 'confirmed'].includes(servicio.status)) {
            return { ...servicio, status: 'working' };
          }

          if (
            variables.estado === 'completed' &&
            ['pending', 'confirmed', 'working'].includes(servicio.status)
          ) {
            return { ...servicio, status: 'completed' };
          }

          if (
            variables.estado === 'cancelled' &&
            ['pending', 'confirmed', 'working'].includes(servicio.status)
          ) {
            return { ...servicio, status: 'cancelled', motivo: variables.motivo ?? null };
          }

          return servicio;
        });

        return {
          ...reservaActual,
          status: variables.estado,
          serviceDetails: detallesActualizados,
          cancellationReason: variables.estado === 'cancelled' ? variables.motivo ?? null : null,
        };
      });
      setConfirmacion(null);
      setMensajeErrorCancelacion(null);
      mostrarToast({ mensaje: 'Estado de la cita actualizado', variante: 'exito' });
      recargar();
    },
    onError: (error: unknown) => {
      const mensaje = error instanceof Error ? error.message : 'No se pudo actualizar la cita';
      setMensajeErrorCancelacion(mensaje);
      mostrarToast({ mensaje, variante: 'error' });
    },
  });

  const { mutate: marcarNoShow, isPending: marcandoNoShow } = useMutation({
    mutationFn: ({
      reservaId,
      servicioId,
      motivo,
    }: {
      reservaId: string;
      servicioId: string;
      motivo: string;
    }) => actualizarEstadoServicioReserva(reservaId, servicioId, 'no_show', motivo || undefined),
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
    onSuccess: async (_, variables) => {
      actualizarReservaEnVista(variables.reservaId, (reservaActual) => {
        const estadoServicio = reservaActual.status === 'working' ? 'working' : 'confirmed';
        const detallesActuales =
          reservaActual.serviceDetails && reservaActual.serviceDetails.length > 0
            ? [...reservaActual.serviceDetails]
            : (reservaActual.services ?? []).map((servicio, indice) => ({
                ...servicio,
                status: estadoServicio,
                order: indice,
                motivo: null,
              }));
        const ordenNuevo = detallesActuales.length;

        return {
          ...reservaActual,
          services: [
            ...(reservaActual.services ?? []),
            {
              name: variables.servicio.nombre,
              duration: variables.servicio.duracion,
              price: variables.servicio.precio,
              ...(variables.servicio.categoria ? { category: variables.servicio.categoria } : {}),
            },
          ],
          serviceDetails: [
            ...detallesActuales,
            {
              id: `extra-servicio-${variables.reservaId}-${ordenNuevo}`,
              name: variables.servicio.nombre,
              duration: variables.servicio.duracion,
              price: variables.servicio.precio,
              ...(variables.servicio.categoria ? { category: variables.servicio.categoria } : {}),
              status: estadoServicio,
              order: ordenNuevo,
              motivo: null,
            },
          ],
          totalDuration: reservaActual.totalDuration + variables.servicio.duracion,
          totalPrice: reservaActual.totalPrice + variables.servicio.precio,
        };
      });
      cerrarModalAdicional();
      mostrarToast({ mensaje: 'Servicio adicional agregado', variante: 'exito' });
      recargar();
    },
    onError: (error: unknown) => {
      mostrarToast({
        mensaje:
          error instanceof Error ? error.message : 'No se pudo agregar el servicio adicional',
        variante: 'error',
      });
    },
  });

  const { mutate: agregarProductoExtra, isPending: agregandoProducto } = useMutation({
    mutationFn: ({
      reservaId,
      productoId,
      cantidad,
    }: {
      reservaId: string;
      productoId: string;
      cantidad: number;
    }) => agregarProductoAReserva(reservaId, productoId, cantidad),
    onSuccess: async (_, variables) => {
      const productoSeleccionado = productosCatalogo.find(
        (producto) => producto.id === variables.productoId,
      );

      if (productoSeleccionado) {
        actualizarReservaEnVista(variables.reservaId, (reservaActual) => {
          const productosActuales = [...(reservaActual.productItems ?? [])];
          const indiceExistente = productosActuales.findIndex(
            (producto) => producto.id === productoSeleccionado.id,
          );
          const totalExtra = productoSeleccionado.precio * variables.cantidad;

          if (indiceExistente >= 0) {
            const actual = productosActuales[indiceExistente]!;
            const cantidadNueva = actual.cantidad + variables.cantidad;
            productosActuales[indiceExistente] = {
              ...actual,
              cantidad: cantidadNueva,
              total: actual.precioUnitario * cantidadNueva,
            };
          } else {
            productosActuales.push({
              id: productoSeleccionado.id,
              nombre: productoSeleccionado.nombre,
              categoria: productoSeleccionado.categoria ?? null,
              cantidad: variables.cantidad,
              precioUnitario: productoSeleccionado.precio,
              total: totalExtra,
            });
          }

          return {
            ...reservaActual,
            productItems: productosActuales,
            totalPrice: reservaActual.totalPrice + totalExtra,
          };
        });
      }

      cerrarModalAdicional();
      mostrarToast({ mensaje: 'Producto agregado a la cita', variante: 'exito' });
      recargar();
    },
    onError: (error: unknown) => {
      mostrarToast({
        mensaje: error instanceof Error ? error.message : 'No se pudo agregar el producto',
        variante: 'error',
      });
    },
  });

  const confirmarAccion = () => {
    if (!confirmacion || confirmacion.tipo !== 'completar') return;
    cambiarEstado({
      id: confirmacion.reservaId,
      estado: 'completed',
    });
  };

  const moneda: Moneda = estudio.country === 'Colombia' ? 'COP' : 'MXN';
  const fechaStr = obtenerFechaLocalISO(fechaVista);
  const fechaHoy = obtenerFechaLocalISO(new Date());
  const fechaMaxHistorial = obtenerFechaLocalISO(
    new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate() - 1),
  );
  const mesActualHistorial = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
  const citasDelDia = useMemo(
    () =>
      obtenerReservasActivasDelDiaAgenda(
        reservasDisponibles.filter((reserva) => reserva.studioId === estudio.id),
        fechaStr,
      ),
    [reservasDisponibles, estudio.id, fechaStr],
  );
  const estadosDisponiblesAgenda = useMemo(
    () =>
      ['confirmed', 'working', 'completed', 'cancelled', 'no_show'].filter((estado) =>
        citasDelDia.some((cita) => coincideFiltroEstado(cita.status, estado)),
      ),
    [citasDelDia],
  );

  useEffect(() => {
    setPaginaAgenda(1);
  }, [fechaStr, especialistaTab, filtroEstadoAgenda, filtroServicioAgenda, ordenAgenda]);

  useEffect(() => {
    if (filtroEstadoAgenda !== 'todos' && !estadosDisponiblesAgenda.includes(filtroEstadoAgenda)) {
      setFiltroEstadoAgenda('todos');
    }
  }, [filtroEstadoAgenda, estadosDisponiblesAgenda]);

  useEffect(() => {
    setPaginaHistorial(1);
  }, [modoHistorial, mesHistorial, fechaHistorial, rangoInicio, rangoFin]);

  useEffect(() => {
    if (!rangoInicio) {
      return;
    }

    if (!rangoFin || rangoFin < rangoInicio) {
      setRangoFin(rangoInicio);
    }
  }, [rangoInicio, rangoFin]);

  useEffect(() => {
    const siguienteTab = obtenerPestanaAgendaPorFecha(fechaStr, fechaHoy);

    if (siguienteTab === 'historial') {
      setTab('historial');
      setModoHistorial('dia');
      setFechaHistorial(fechaStr);
      return;
    }

    setTab('agenda');
  }, [fechaStr, fechaHoy]);

  const idsConCitas = [...new Set(citasDelDia.map((cita) => cita.staffId))];
  const especialistasConCitas = personalDisponible.filter((especialista) =>
    idsConCitas.includes(especialista.id),
  );
  const serviciosConCitas = [...new Set(citasDelDia.flatMap(obtenerNombresServiciosReserva))].sort(
    (a, b) => a.localeCompare(b),
  );

  const citasFiltradas = [...citasDelDia]
    .filter((cita) => (especialistaTab === 'todos' ? true : cita.staffId === especialistaTab))
    .filter((cita) => coincideFiltroEstado(cita.status, filtroEstadoAgenda))
    .filter((cita) =>
      filtroServicioAgenda === 'todos'
        ? true
        : obtenerNombresServiciosReserva(cita).includes(filtroServicioAgenda),
    )
    .sort((a, b) =>
      ordenAgenda === 'tempranas'
        ? a.time.localeCompare(b.time)
        : b.time.localeCompare(a.time),
    );

  const citasHistorial = useMemo(() => {
    return obtenerReservasHistorialAgenda({
      reservas: reservasDisponibles,
      estudioId: estudio.id,
      modo: modoHistorial,
      fechaHistorial,
      rangoInicio,
      rangoFin,
      mesHistorial,
      fechaActual: fechaHoy,
    });
  }, [
    reservasDisponibles,
    estudio.id,
    modoHistorial,
    fechaHistorial,
    rangoInicio,
    rangoFin,
    mesHistorial,
    fechaHoy,
  ]);

  const totalPaginasAgenda = Math.max(
    1,
    Math.ceil(citasFiltradas.length / LIMITE_AGENDA_POR_PAGINA),
  );
  const citasAgendaPaginadas = citasFiltradas.slice(
    (paginaAgenda - 1) * LIMITE_AGENDA_POR_PAGINA,
    paginaAgenda * LIMITE_AGENDA_POR_PAGINA,
  );
  const totalPaginasHistorial = Math.max(
    1,
    Math.ceil(citasHistorial.length / LIMITE_HISTORIAL_POR_PAGINA),
  );
  const citasHistorialPaginadas = citasHistorial.slice(
    (paginaHistorial - 1) * LIMITE_HISTORIAL_POR_PAGINA,
    paginaHistorial * LIMITE_HISTORIAL_POR_PAGINA,
  );

  const cambiarMesHistorial = (offset: number) => {
    const [y, m] = mesHistorial.split('-').map(Number);
    const nuevaFecha = new Date(y ?? 0, (m ?? 1) - 1 + offset, 1);
    const siguienteMes = `${nuevaFecha.getFullYear()}-${String(nuevaFecha.getMonth() + 1).padStart(2, '0')}`;
    setMesHistorial(siguienteMes > mesActualHistorial ? mesActualHistorial : siguienteMes);
  };

  const [anioMesHistorial, mesNumeroHistorial] = mesHistorial.split('-').map(Number);
  const esMesActualHistorial = mesHistorial >= mesActualHistorial;

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
                {citasDelDia.length} citas
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── HISTORIAL ─────────────────────────────────────────────── */}
      {tab === 'historial' && (
        <div className="p-4 md:p-6 space-y-4">
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
            <button
              type="button"
              onClick={() => setModoHistorial('dia')}
              className={`rounded-xl px-3 py-2 text-xs font-black uppercase ${modoHistorial === 'dia' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}
            >
              Fecha exacta
            </button>
            <button
              type="button"
              onClick={() => setModoHistorial('rango')}
              className={`rounded-xl px-3 py-2 text-xs font-black uppercase ${modoHistorial === 'rango' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}
            >
              Rango de fechas
            </button>
            <button
              type="button"
              onClick={() => setModoHistorial('mes')}
              className={`rounded-xl px-3 py-2 text-xs font-black uppercase ${modoHistorial === 'mes' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}
            >
              Mes completo
            </button>
          </div>

          {modoHistorial === 'dia' && (
            <label className="block rounded-2xl border border-slate-200 bg-white p-4">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-500">
                Selecciona una fecha pasada
              </span>
              <input
                type="date"
                max={fechaMaxHistorial}
                value={fechaHistorial}
                onChange={(evento) => setFechaHistorial(evento.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800"
              />
            </label>
          )}

          {modoHistorial === 'rango' && (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block rounded-2xl border border-slate-200 bg-white p-4">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-500">
                  Desde
                </span>
                <input
                  type="date"
                  max={fechaMaxHistorial}
                  value={rangoInicio}
                  onChange={(evento) => setRangoInicio(evento.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800"
                />
              </label>
              <label className="block rounded-2xl border border-slate-200 bg-white p-4">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-500">
                  Hasta
                </span>
                <input
                  type="date"
                  max={fechaMaxHistorial}
                  min={rangoInicio || undefined}
                  value={rangoFin}
                  onChange={(evento) => setRangoFin(evento.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800"
                />
              </label>
            </div>
          )}

          {modoHistorial === 'mes' && (
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
                {new Date(anioMesHistorial ?? 0, (mesNumeroHistorial ?? 1) - 1, 1).toLocaleDateString('es-ES', {
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
              <button
                type="button"
                onClick={() => cambiarMesHistorial(1)}
                aria-label="Mes siguiente"
                disabled={esMesActualHistorial}
                className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {citasHistorial.length === 0 ? (
            <p className="text-center text-sm text-slate-400 italic py-8 font-bold">
              No hay citas en el historial para este filtro.
            </p>
          ) : (
            <div className="space-y-3">
              {citasHistorialPaginadas.map((b) => (
                <TarjetaCita
                  key={b.id}
                  reserva={b}
                  moneda={moneda}
                  esPlanPro={estudio.plan === 'PRO'}
                  mostrarFecha={modoHistorial !== 'dia'}
                  actualizandoEstado={actualizando}
                  onCompletar={(id) => setConfirmacion({ tipo: 'completar', reservaId: id })}
                  onCancelar={(id) => setConfirmacion({ tipo: 'cancelar', reservaId: id })}
                  onNoShow={(reservaId, servicioId, nombre) =>
                    setModalNoShow({ reservaId, servicioId, nombre })
                  }
                  onAgregarServicio={(reservaId) => setModalAdicional(reservaId)}
                  onCambiarEstado={(id, estado) => cambiarEstado({ id, estado })}
                />
              ))}
              <PaginadorLista
                paginaActual={paginaHistorial}
                totalPaginas={totalPaginasHistorial}
                totalRegistros={citasHistorial.length}
                etiquetaRegistros="citas en historial"
                onCambiar={setPaginaHistorial}
              />
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
              <div className="mb-5 overflow-hidden rounded-4xl border border-slate-200 bg-linear-to-br from-white via-slate-50 to-pink-50 shadow-sm">
                <div className="border-b border-slate-200/80 px-4 py-4 md:px-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-pink-600">
                        Filtros avanzados
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Filtra por estado, empleado o servicio y ordena por primeras citas o últimas citas.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-900 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white">
                        {citasFiltradas.length} resultados
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setEspecialistaTab('todos');
                          setFiltroEstadoAgenda('todos');
                          setFiltroServicioAgenda('todos');
                          setOrdenAgenda('tempranas');
                        }}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-black uppercase text-slate-600 transition-colors hover:bg-slate-100"
                      >
                        Limpiar filtros
                      </button>
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4 md:p-5">
                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">
                      Estado
                    </span>
                    <select
                      value={filtroEstadoAgenda}
                      onChange={(evento) => setFiltroEstadoAgenda(evento.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-pink-400"
                    >
                      <option value="todos">Todos los estados</option>
                      {estadosDisponiblesAgenda.map((estado) => (
                        <option key={estado} value={estado}>
                          {BADGE_CONFIG[estado as EstadoReserva]?.label ?? estado}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">
                      Empleado
                    </span>
                    <select
                      value={especialistaTab}
                      onChange={(evento) => setEspecialistaTab(evento.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-pink-400"
                    >
                      <option value="todos">Todos</option>
                      {especialistasConCitas.map((especialista) => (
                        <option key={especialista.id} value={especialista.id}>
                          {especialista.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">
                      Servicio
                    </span>
                    <select
                      value={filtroServicioAgenda}
                      onChange={(evento) => setFiltroServicioAgenda(evento.target.value)}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-pink-400"
                    >
                      <option value="todos">Todos los servicios</option>
                      {serviciosConCitas.map((servicio) => (
                        <option key={servicio} value={servicio}>
                          {servicio}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-[10px] font-black uppercase tracking-wide text-slate-500">
                      Orden
                    </span>
                    <select
                      value={ordenAgenda}
                      onChange={(evento) => setOrdenAgenda(evento.target.value as 'tempranas' | 'tardias')}
                      className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-800 outline-none focus:border-pink-400"
                    >
                      <option value="tempranas">Primeras citas</option>
                      <option value="tardias">Últimas citas</option>
                    </select>
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                {citasFiltradas.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 italic py-8 font-bold">
                    No hay citas que coincidan con los filtros seleccionados para este día.
                  </p>
                ) : (
                  citasAgendaPaginadas.map((b) => (
                    <TarjetaCita
                      key={b.id}
                      reserva={b}
                      moneda={moneda}
                      esPlanPro={estudio.plan === 'PRO'}
                      actualizandoEstado={actualizando}
                      onCompletar={(id) => setConfirmacion({ tipo: 'completar', reservaId: id })}
                      onCancelar={(id) => setConfirmacion({ tipo: 'cancelar', reservaId: id })}
                      onNoShow={(reservaId, servicioId, nombre) =>
                        setModalNoShow({ reservaId, servicioId, nombre })
                      }
                      onAgregarServicio={(reservaId) => setModalAdicional(reservaId)}
                      onCambiarEstado={(id, estado) => cambiarEstado({ id, estado })}
                    />
                  ))
                )}
              </div>
              <PaginadorLista
                paginaActual={paginaAgenda}
                totalPaginas={totalPaginasAgenda}
                totalRegistros={citasFiltradas.length}
                etiquetaRegistros="citas del día"
                onCambiar={setPaginaAgenda}
              />
            </>
          )}
        </div>
      )}

      {modalNoShow && (
        <ModalMotivoAccion
          titulo="¿Marcar servicio como no realizado?"
          descripcion={`${modalNoShow.nombre} se registrará como no realizado. El total de la cita se recalculará y el motivo quedará guardado en el historial del agendamiento.`}
          textoConfirmar="Registrar"
          cargando={marcandoNoShow}
          mensajeError={mensajeErrorNoShow}
          onLimpiarError={() => setMensajeErrorNoShow(null)}
          onConfirmar={(motivo) =>
            marcarNoShow({
              reservaId: modalNoShow.reservaId,
              servicioId: modalNoShow.servicioId,
              motivo,
            })
          }
          onCancelar={() => {
            setMensajeErrorNoShow(null);
            setModalNoShow(null);
          }}
        />
      )}

      {confirmacion?.tipo === 'cancelar' && (
        <ModalMotivoAccion
          titulo="¿Cancelar esta cita?"
          descripcion="La cita completa quedará cancelada. El motivo se almacenará en el historial para que el salón pueda consultarlo después con claridad."
          textoConfirmar="Cancelar cita"
          cargando={actualizando}
          mensajeError={mensajeErrorCancelacion}
          onLimpiarError={() => setMensajeErrorCancelacion(null)}
          onConfirmar={(motivo) => {
            cambiarEstado({
              id: confirmacion.reservaId,
              estado: 'cancelled',
              motivo,
            });
          }}
          onCancelar={() => {
            setMensajeErrorCancelacion(null);
            setConfirmacion(null);
          }}
        />
      )}

      {/* ── MODAL AGREGAR ADICIONAL ──────────────────────────────── */}
      {modalAdicional && (
        <div
          className="fixed inset-0 z-210 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-adicional"
        >
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <h3 id="titulo-adicional" className="mb-4 text-lg font-black text-slate-900">
              Agregar extra a la cita
            </h3>

            <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setTabAdicional('servicio')}
                className={`rounded-xl px-3 py-2 text-xs font-black uppercase transition-colors ${tabAdicional === 'servicio' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                Servicio adicional
              </button>
              <button
                type="button"
                disabled={estudio.plan !== 'PRO'}
                onClick={() => setTabAdicional('producto')}
                className={`rounded-xl px-3 py-2 text-xs font-black uppercase transition-colors ${tabAdicional === 'producto' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'} disabled:cursor-not-allowed disabled:opacity-50`}
              >
                Producto {estudio.plan !== 'PRO' ? '· PRO' : ''}
              </button>
            </div>

            {tabAdicional === 'servicio' ? (
              serviciosCatalogo.length === 0 ? (
                <p className="text-sm italic text-slate-400">
                  No hay servicios disponibles en el catálogo.
                </p>
              ) : (
                <div className="mb-4 max-h-60 space-y-2 overflow-y-auto">
                  {serviciosCatalogo.map((srv, indiceServicio) => {
                    const activo = servicioAdicionalSeleccionado === srv.name;
                    return (
                      <button
                        key={`${srv.name}-${indiceServicio}`}
                        type="button"
                        onClick={() => setServicioAdicionalSeleccionado(srv.name)}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
                          activo
                            ? 'border-blue-500 bg-blue-50 text-blue-700'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200'
                        }`}
                      >
                        <span className="text-sm font-bold">{srv.name}</span>
                        <span className="text-xs font-black">
                          {formatearDinero(srv.price, moneda)} · {srv.duration} min
                        </span>
                      </button>
                    );
                  })}
                </div>
              )
            ) : estudio.plan !== 'PRO' ? (
              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Esta opción se habilita únicamente para salones con suscripción PRO.
              </div>
            ) : consultaProductos.isLoading ? (
              <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Cargando productos del salón...
              </div>
            ) : productosCatalogo.length === 0 ? (
              <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                No hay productos activos para agregar.
              </div>
            ) : (
              <div className="mb-4 space-y-3">
                <div className="max-h-52 space-y-2 overflow-y-auto">
                  {productosCatalogo.map((producto) => {
                    const activo = productoAdicionalSeleccionado === producto.id;
                    return (
                      <button
                        key={producto.id}
                        type="button"
                        onClick={() => setProductoAdicionalSeleccionado(producto.id)}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
                          activo
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-200'
                        }`}
                      >
                        <span>
                          <span className="block text-sm font-bold">{producto.nombre}</span>
                          <span className="text-[11px] text-slate-500">{producto.categoria}</span>
                        </span>
                        <span className="text-xs font-black">
                          {formatearDinero(producto.precio, moneda)}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <label className="block">
                  <span className="mb-1 block text-[11px] font-black uppercase tracking-wide text-slate-500">
                    Cantidad
                  </span>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={cantidadProductoAdicional}
                    onChange={(evento) =>
                      setCantidadProductoAdicional(
                        Math.min(20, Math.max(1, Number(evento.target.value) || 1)),
                      )
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={cerrarModalAdicional}
                className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 transition-colors hover:bg-slate-200"
              >
                Cerrar
              </button>
              <button
                type="button"
                disabled={
                  tabAdicional === 'servicio'
                    ? !servicioAdicionalSeleccionado || agregandoAdicional
                    : !productoAdicionalSeleccionado || agregandoProducto || estudio.plan !== 'PRO'
                }
                onClick={() => {
                  if (!modalAdicional) return;

                  if (tabAdicional === 'servicio') {
                    const srv = serviciosCatalogo.find(
                      (servicio) => servicio.name === servicioAdicionalSeleccionado,
                    );
                    if (!srv) return;

                    agregarAdicional({
                      reservaId: modalAdicional,
                      servicio: {
                        nombre: srv.name,
                        duracion: srv.duration,
                        precio: srv.price,
                      },
                    });
                    return;
                  }

                  agregarProductoExtra({
                    reservaId: modalAdicional,
                    productoId: productoAdicionalSeleccionado,
                    cantidad: cantidadProductoAdicional,
                  });
                }}
                className="flex-1 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {tabAdicional === 'servicio'
                  ? agregandoAdicional
                    ? 'Agregando...'
                    : 'Agregar servicio'
                  : agregandoProducto
                    ? 'Agregando...'
                    : 'Agregar producto'}
              </button>
            </div>
          </div>
        </div>
      )}

      <DialogoConfirmacion
        abierto={confirmacion?.tipo === 'completar'}
        mensaje="¿Marcar la cita como completada?"
        descripcion="Se registrará el cierre exitoso del servicio y la cita quedará finalizada con todos sus detalles guardados."
        variante="advertencia"
        textoConfirmar="Finalizar cita"
        cargando={actualizando}
        onConfirmar={confirmarAccion}
        onCancelar={() => {
          setMensajeErrorCancelacion(null);
          setConfirmacion(null);
        }}
      />
    </section>
  );
}
