import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  Clock3,
  Copy,
  ExternalLink,
  Eye,
  Link2,
  MapPin,
  MessageCircle,
  Palette,
  Phone,
  Plus,
  Scissors,
  StickyNote,
  X,
} from 'lucide-react';
import { env } from '../../lib/env';
import { NavegacionEmpleado } from '../../componentes/diseno/NavegacionEmpleado';
import { PanelNotificaciones } from '../estudio/componentes/PanelNotificaciones';
import { ModalSuspension } from '../estudio/componentes/ModalSuspension';
import { usarNotificacionesEstudio } from '../estudio/hooks/usarNotificacionesEstudio';
import { SelectorCalendario } from '../reserva/componentes/SelectorCalendario';
import {
  actualizarEstadoReservaEmpleado,
  obtenerMiAgenda,
  obtenerMiAgendaMes,
  obtenerMiPerfilEmpleado,
  obtenerMisMetricas,
} from '../../servicios/servicioEmpleados';
import { usarToast } from '../../componentes/ui/ProveedorToast';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';
import {
  convertirCentavosAMoneda,
  formatearFechaHumana,
  obtenerMonedaPorPais,
} from '../../utils/formato';
import { agregarServicioAReserva } from '../../servicios/servicioReservas';
import type {
  DetalleServicioReserva,
  Estudio,
  Moneda,
  PerfilEmpleado,
  ReservaEmpleado,
  Servicio,
} from '../../tipos';

const LIMITE_RESERVAS_POR_PAGINA = 5;

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

function hoy(): string {
  const ahora = new Date();
  const y = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, '0');
  const d = String(ahora.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function obtenerFechaDesdeIso(fechaIso: string): Date {
  const [anio, mes, dia] = fechaIso.split('-').map(Number);
  return new Date(anio, (mes ?? 1) - 1, dia ?? 1);
}

function obtenerFechaIsoLocal(fecha: Date): string {
  const anio = fecha.getFullYear();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

function formatearFechaCabecera(fechaIso: string): string {
  return obtenerFechaDesdeIso(fechaIso).toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function obtenerSaludo(): string {
  const hora = new Date().getHours();
  if (hora < 12) return 'Buenos días';
  if (hora < 19) return 'Buenas tardes';
  return 'Buenas noches';
}

function calcularHoraFin(horaInicio: string, duracionMinutos: number): string {
  const [hora, minuto] = horaInicio.split(':').map(Number);
  const totalMinutos = (hora ?? 0) * 60 + (minuto ?? 0) + duracionMinutos;
  const horaFinal = Math.floor(totalMinutos / 60) % 24;
  const minutoFinal = totalMinutos % 60;
  return `${String(horaFinal).padStart(2, '0')}:${String(minutoFinal).padStart(2, '0')}`;
}

function formatearMontoSinDecimales(montoCentavos: number, moneda: Moneda): string {
  const locale = moneda === 'COP' ? 'es-CO' : 'es-MX';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(convertirCentavosAMoneda(montoCentavos || 0));
}

function construirEstudioCalendario(perfil: PerfilEmpleado): Estudio {
  const pais = perfil.estudio.pais === 'Colombia' ? 'Colombia' : 'Mexico';

  return {
    id: perfil.estudio.id,
    slug: perfil.estudio.slug ?? perfil.estudio.claveCliente,
    name: perfil.estudio.nombre,
    owner: perfil.estudio.nombre,
    phone: perfil.estudio.telefono,
    country: pais,
    plan: 'STANDARD',
    branches: perfil.estudio.direccion ? [perfil.estudio.direccion] : ['Principal'],
    assignedKey: perfil.estudio.claveCliente,
    clientKey: perfil.estudio.claveCliente,
    subscriptionStart: '',
    paidUntil: '',
    holidays: perfil.estudio.festivos,
    schedule: perfil.estudio.horario,
    selectedServices: perfil.estudio.servicios,
    customServices: [],
    staff: [
      {
        id: perfil.id,
        name: perfil.nombre,
        avatarUrl: perfil.avatarUrl ?? null,
        specialties: perfil.especialidades,
        active: perfil.activo,
        shiftStart: perfil.horaInicio,
        shiftEnd: perfil.horaFin,
        breakStart: perfil.descansoInicio,
        breakEnd: perfil.descansoFin,
        workingDays: perfil.diasTrabajo,
      },
    ],
    colorPrimario: perfil.estudio.colorPrimario,
    logoUrl: perfil.estudio.logoUrl,
    direccion: perfil.estudio.direccion,
    emailContacto: perfil.estudio.emailContacto ?? null,
    estado: perfil.estudio.estado,
    createdAt: '',
    updatedAt: '',
  };
}

type BadgeEstado = { etiqueta: string; fondo: string; texto: string; borde: string };

function badgePorEstado(estado: ReservaEmpleado['estado']): BadgeEstado {
  const mapa: Record<ReservaEmpleado['estado'], BadgeEstado> = {
    pending: {
      etiqueta: 'Pendiente',
      fondo: 'bg-amber-100',
      texto: 'text-amber-700',
      borde: 'border-amber-200',
    },
    confirmed: {
      etiqueta: 'Confirmada',
      fondo: 'bg-emerald-100',
      texto: 'text-emerald-700',
      borde: 'border-emerald-200',
    },
    completed: {
      etiqueta: 'Completada',
      fondo: 'bg-slate-200',
      texto: 'text-slate-700',
      borde: 'border-slate-300',
    },
    cancelled: {
      etiqueta: 'Cancelada',
      fondo: 'bg-rose-100',
      texto: 'text-rose-700',
      borde: 'border-rose-200',
    },
    no_show: {
      etiqueta: 'No se presentó',
      fondo: 'bg-orange-100',
      texto: 'text-orange-700',
      borde: 'border-orange-200',
    },
  };

  return mapa[estado];
}

function obtenerServiciosDetalle(reserva: ReservaEmpleado): DetalleServicioReserva[] {
  if (reserva.serviciosDetalle && reserva.serviciosDetalle.length > 0) {
    return reserva.serviciosDetalle;
  }

  return reserva.servicios.map((servicio, indice) => ({
    ...servicio,
    status: reserva.estado,
    order: indice,
  }));
}

interface PropsBotonEstado {
  reserva: ReservaEmpleado;
  actualizando: boolean;
  yaTermino: boolean;
  onActualizar: (id: string, estado: 'confirmed' | 'completed' | 'no_show') => void;
}

function BotonCambioEstado({ reserva, actualizando, yaTermino, onActualizar }: PropsBotonEstado) {
  if (reserva.estado === 'pending') {
    return (
      <button
        type="button"
        onClick={() => onActualizar(reserva.id, 'confirmed')}
        disabled={actualizando}
        className="rounded-2xl bg-blue-600 px-3 py-2 text-xs font-black text-white transition hover:bg-blue-700 disabled:opacity-50"
      >
        Confirmar
      </button>
    );
  }

  if (reserva.estado === 'confirmed') {
    return (
      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        <button
          type="button"
          onClick={() => onActualizar(reserva.id, 'completed')}
          disabled={actualizando}
          className="rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-black text-white transition hover:bg-emerald-700 disabled:opacity-50"
        >
          Completar
        </button>
        {yaTermino && (
          <button
            type="button"
            onClick={() => onActualizar(reserva.id, 'no_show')}
            disabled={actualizando}
            className="rounded-2xl bg-orange-500 px-3 py-2 text-xs font-black text-white transition hover:bg-orange-600 disabled:opacity-50"
          >
            No se presentó
          </button>
        )}
      </div>
    );
  }

  return null;
}

interface PropsPaginadorLista {
  paginaActual: number;
  totalPaginas: number;
  onCambiar: (pagina: number) => void;
}

function PaginadorLista({ paginaActual, totalPaginas, onCambiar }: PropsPaginadorLista) {
  if (totalPaginas <= 1) return null;

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <button
        type="button"
        disabled={paginaActual === 1}
        onClick={() => onCambiar(Math.max(1, paginaActual - 1))}
        className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:opacity-40"
      >
        Anterior
      </button>
      <span className="text-xs font-black uppercase tracking-wide text-slate-500">
        Página {paginaActual} de {totalPaginas}
      </span>
      <button
        type="button"
        disabled={paginaActual === totalPaginas}
        onClick={() => onCambiar(Math.min(totalPaginas, paginaActual + 1))}
        className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition hover:bg-slate-100 disabled:opacity-40"
      >
        Siguiente
      </button>
    </div>
  );
}

interface PropsTarjetaReservaEmpleado {
  reserva: ReservaEmpleado;
  moneda: Moneda;
  mostrarDetalleCompleto: boolean;
  actualizando: boolean;
  onAbrirDetalle: (reserva: ReservaEmpleado) => void;
  onAbrirExtra: (reservaId: string) => void;
  onActualizarEstado: (id: string, estado: 'confirmed' | 'completed' | 'no_show') => void;
}

function TarjetaReservaEmpleado({
  reserva,
  moneda,
  mostrarDetalleCompleto,
  actualizando,
  onAbrirDetalle,
  onAbrirExtra,
  onActualizarEstado,
}: PropsTarjetaReservaEmpleado) {
  const badge = badgePorEstado(reserva.estado);
  const horaFin = calcularHoraFin(reserva.horaInicio, reserva.duracion);
  const serviciosDetalle = obtenerServiciosDetalle(reserva);
  const estaCompletada = reserva.estado === 'completed';
  const estaFinalizada = ['completed', 'cancelled', 'no_show'].includes(reserva.estado);
  const ahora = new Date();
  const [anio, mes, dia] = reserva.fecha.split('-').map(Number);
  const [hora, minuto] = reserva.horaInicio.split(':').map(Number);
  const finCita = new Date(
    anio,
    (mes ?? 1) - 1,
    dia ?? 1,
    hora ?? 0,
    (minuto ?? 0) + reserva.duracion,
  );
  const yaTermino = ahora >= finCita;

  return (
    <article
      className={`relative overflow-hidden rounded-4xl border p-5 shadow-sm transition ${
        estaCompletada
          ? 'border-emerald-200 bg-emerald-50/60'
          : reserva.estado === 'cancelled'
            ? 'border-rose-200 bg-rose-50/60'
            : reserva.estado === 'no_show'
              ? 'border-orange-200 bg-orange-50/70'
              : 'border-slate-200 bg-white'
      }`}
    >
      {estaCompletada && (
        <span className="absolute right-5 top-0 rounded-b-2xl bg-emerald-600 px-3 py-1 text-[10px] font-black uppercase tracking-[0.24em] text-white">
          Completada
        </span>
      )}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="w-full rounded-3xl bg-slate-950 px-4 py-3 text-white shadow-sm sm:w-26">
              <p className="text-xl font-black leading-none">{reserva.horaInicio}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-300">
                {horaFin}
              </p>
            </div>

            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-black text-slate-900">{reserva.nombreCliente}</h3>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${badge.fondo} ${badge.texto} ${badge.borde}`}
                >
                  {badge.etiqueta}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-500">
                <a
                  href={`tel:${reserva.telefonoCliente}`}
                  className="inline-flex items-center gap-2 transition hover:text-pink-600"
                >
                  <Phone className="h-4 w-4 text-pink-500" aria-hidden="true" />
                  {reserva.telefonoCliente}
                </a>
                {reserva.sucursal && (
                  <span className="inline-flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-slate-400" aria-hidden="true" />
                    {reserva.sucursal}
                  </span>
                )}
                <span className="inline-flex items-center gap-2">
                  <Clock3 className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  {reserva.duracion} min
                </span>
              </div>

              <div className="flex flex-wrap gap-2">
                {serviciosDetalle.map((servicio) => (
                  <span
                    key={`${reserva.id}-${servicio.order}-${servicio.name}`}
                    className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700"
                  >
                    <Scissors className="h-3 w-3 text-pink-500" aria-hidden="true" />
                    {servicio.name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {mostrarDetalleCompleto && (
            <div className="space-y-3 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl bg-white p-4 shadow-sm">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                    Servicios del día
                  </p>
                  <div className="mt-3 space-y-2">
                    {serviciosDetalle.map((servicio) => (
                      <div
                        key={`${reserva.id}-detalle-${servicio.order}-${servicio.name}`}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 px-3 py-2"
                      >
                        <div>
                          <p className="text-sm font-black text-slate-800">{servicio.name}</p>
                          <p className="text-xs text-slate-500">{servicio.duration} min</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-slate-900">
                            {formatearMontoSinDecimales(servicio.price, moneda)}
                          </p>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            {
                              badgePorEstado(
                                (servicio.status as ReservaEmpleado['estado']) || reserva.estado,
                              ).etiqueta
                            }
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  {(reserva.marcaTinte || reserva.tonalidad) && (
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                      <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                        <Palette className="h-3.5 w-3.5 text-pink-500" aria-hidden="true" />
                        Color y tono
                      </p>
                      <p className="mt-2 text-sm font-bold text-slate-800">
                        {[reserva.marcaTinte, reserva.tonalidad].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  )}

                  {reserva.observaciones && (
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                      <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                        <StickyNote className="h-3.5 w-3.5 text-amber-500" aria-hidden="true" />
                        Observaciones
                      </p>
                      <p className="mt-2 text-sm text-slate-700">{reserva.observaciones}</p>
                    </div>
                  )}

                  {reserva.notasMenorEdad && (
                    <div className="rounded-2xl bg-white p-4 shadow-sm">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                        Nota adicional
                      </p>
                      <p className="mt-2 text-sm text-slate-700">{reserva.notasMenorEdad}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex w-full flex-col gap-3 lg:w-55 lg:items-end">
          <div className="text-left lg:text-right">
            <p className="text-2xl font-black text-slate-900">
              {formatearMontoSinDecimales(reserva.precioTotal, moneda)}
            </p>
            <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
              Total de la cita
            </p>
          </div>

          <div className="flex flex-wrap gap-2 lg:justify-end">
            <button
              type="button"
              onClick={() => onAbrirDetalle(reserva)}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-100"
            >
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              Detalle
            </button>
            {!estaFinalizada && (
              <button
                type="button"
                onClick={() => onAbrirExtra(reserva.id)}
                className="inline-flex items-center gap-2 rounded-2xl border border-pink-200 bg-pink-50 px-3 py-2 text-xs font-black text-pink-700 transition hover:bg-pink-100"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                Extra
              </button>
            )}
          </div>

          {!estaFinalizada && (
            <BotonCambioEstado
              reserva={reserva}
              actualizando={actualizando}
              yaTermino={yaTermino}
              onActualizar={onActualizarEstado}
            />
          )}
        </div>
      </div>
    </article>
  );
}

interface PropsModalDetalleReservaEmpleado {
  reserva: ReservaEmpleado;
  moneda: Moneda;
  onCerrar: () => void;
}

function ModalDetalleReservaEmpleado({
  reserva,
  moneda,
  onCerrar,
}: PropsModalDetalleReservaEmpleado) {
  const badge = badgePorEstado(reserva.estado);
  const serviciosDetalle = obtenerServiciosDetalle(reserva);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-detalle-reserva-empleado"
      onClick={onCerrar}
    >
      <div
        className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-4xl bg-white p-6 shadow-2xl"
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-pink-600">
              Detalle de cita
            </p>
            <h2
              id="titulo-detalle-reserva-empleado"
              className="mt-1 text-2xl font-black text-slate-900"
            >
              {reserva.nombreCliente}
            </h2>
            <p className="mt-2 text-sm text-slate-500">{formatearFechaCabecera(reserva.fecha)}</p>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100"
            aria-label="Cerrar detalle"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
              Estado
            </p>
            <span
              className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-black uppercase tracking-wide ${badge.fondo} ${badge.texto}`}
            >
              {badge.etiqueta}
            </span>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
              Horario
            </p>
            <p className="mt-3 text-lg font-black text-slate-900">
              {reserva.horaInicio} - {calcularHoraFin(reserva.horaInicio, reserva.duracion)}
            </p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
              Total
            </p>
            <p className="mt-3 text-lg font-black text-slate-900">
              {formatearMontoSinDecimales(reserva.precioTotal, moneda)}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.75rem] border border-slate-200 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
              Cliente y contacto
            </p>
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <p className="font-black text-slate-900">{reserva.nombreCliente}</p>
              <a
                href={`tel:${reserva.telefonoCliente}`}
                className="inline-flex items-center gap-2 text-pink-600"
              >
                <Phone className="h-4 w-4" aria-hidden="true" />
                {reserva.telefonoCliente}
              </a>
              {reserva.sucursal && (
                <p className="inline-flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-400" aria-hidden="true" />
                  {reserva.sucursal}
                </p>
              )}
              {reserva.creadoEn && (
                <p className="text-slate-500">Creada: {formatearFechaHumana(reserva.creadoEn)}</p>
              )}
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-slate-200 p-5">
            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
              Resumen técnico
            </p>
            <div className="mt-4 space-y-3 text-sm text-slate-700">
              <p>
                <span className="font-black text-slate-900">Duración total:</span>{' '}
                {reserva.duracion} min
              </p>
              {(reserva.marcaTinte || reserva.tonalidad) && (
                <p>
                  <span className="font-black text-slate-900">Color:</span>{' '}
                  {[reserva.marcaTinte, reserva.tonalidad].filter(Boolean).join(' · ')}
                </p>
              )}
              {reserva.observaciones && (
                <p>
                  <span className="font-black text-slate-900">Observaciones:</span>{' '}
                  {reserva.observaciones}
                </p>
              )}
              {reserva.notasMenorEdad && (
                <p>
                  <span className="font-black text-slate-900">Nota adicional:</span>{' '}
                  {reserva.notasMenorEdad}
                </p>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 rounded-[1.75rem] border border-slate-200 p-5">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
            Servicios de la cita
          </p>
          <div className="mt-4 space-y-3">
            {serviciosDetalle.map((servicio) => (
              <div
                key={`${reserva.id}-modal-${servicio.order}-${servicio.name}`}
                className="flex flex-col gap-2 rounded-2xl border border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <p className="font-black text-slate-900">{servicio.name}</p>
                  <p className="text-sm text-slate-500">{servicio.duration} min</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-slate-600">
                    {
                      badgePorEstado(
                        (servicio.status as ReservaEmpleado['estado']) || reserva.estado,
                      ).etiqueta
                    }
                  </span>
                  <span className="font-black text-slate-900">
                    {formatearMontoSinDecimales(servicio.price, moneda)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function PaginaAgendaEmpleado() {
  const fechaHoy = hoy();
  const [fechaSeleccionada, setFechaSeleccionada] = useState(fechaHoy);
  const [paginaReservas, setPaginaReservas] = useState(1);
  const [modalAdicional, setModalAdicional] = useState<string | null>(null);
  const [servicioAdicionalSeleccionado, setServicioAdicionalSeleccionado] = useState('');
  const [detalleReserva, setDetalleReserva] = useState<ReservaEmpleado | null>(null);
  const clienteConsulta = useQueryClient();
  const { mostrarToast } = usarToast();
  const { estudioActual } = usarTiendaAuth();
  const { notificaciones, marcarLeida } = usarNotificacionesEstudio(estudioActual ?? undefined);
  const mesSeleccionado = fechaSeleccionada.slice(0, 7);

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
      await clienteConsulta.invalidateQueries({ queryKey: ['mis-metricas'] });
      mostrarToast({ mensaje: 'La cita se actualizó correctamente', variante: 'exito' });
    },
    onError: (error: Error) => {
      mostrarToast({ mensaje: error.message, variante: 'error' });
    },
  });

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
      mostrarToast({ mensaje: 'Servicio extra agregado correctamente', variante: 'exito' });
    },
    onError: (error: Error) => {
      mostrarToast({ mensaje: error.message, variante: 'error' });
    },
  });

  useEffect(() => {
    setPaginaReservas(1);
  }, [fechaSeleccionada]);

  const perfil = consultaPerfil.data;
  const estudioCalendario = perfil ? construirEstudioCalendario(perfil) : null;
  const moneda = obtenerMonedaPorPais(perfil?.estudio?.pais);
  const fechaEsPasada = fechaSeleccionada < fechaHoy;
  const reservasDia = useMemo(() => {
    const base = consultaAgenda.data ?? [];

    return [...base]
      .filter((reserva) => (fechaEsPasada ? true : reserva.estado !== 'cancelled'))
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  }, [consultaAgenda.data, fechaEsPasada]);
  const fechasMarcadas = useMemo(
    () => Array.from(new Set((consultaAgendaMes.data ?? []).map((reserva) => reserva.fecha))),
    [consultaAgendaMes.data],
  );
  const totalPaginas = Math.max(1, Math.ceil(reservasDia.length / LIMITE_RESERVAS_POR_PAGINA));
  const indiceInicio =
    reservasDia.length === 0 ? 0 : (paginaReservas - 1) * LIMITE_RESERVAS_POR_PAGINA + 1;
  const indiceFin = Math.min(paginaReservas * LIMITE_RESERVAS_POR_PAGINA, reservasDia.length);
  const reservasPaginadas = reservasDia.slice(
    (paginaReservas - 1) * LIMITE_RESERVAS_POR_PAGINA,
    paginaReservas * LIMITE_RESERVAS_POR_PAGINA,
  );
  const horarioInicio = perfil?.horaInicio ?? perfil?.estudio.horarioApertura ?? '—';
  const horarioFin = perfil?.horaFin ?? perfil?.estudio.horarioCierre ?? '—';
  const metricas = consultaMetricas.data;
  const nombreEmpleado = perfil?.nombre?.trim() || 'Especialista';
  const identificadorReserva = perfil?.estudio?.slug || perfil?.estudio?.claveCliente;
  const linkReservas = identificadorReserva
    ? `${obtenerOrigenReservas()}/reservar/${identificadorReserva}`
    : null;
  const catalogoServicios: Servicio[] = perfil?.estudio?.servicios ?? [];
  const fechaCalendario = obtenerFechaDesdeIso(fechaSeleccionada);

  const copiarLink = () => {
    if (!linkReservas) return;
    navigator.clipboard
      .writeText(linkReservas)
      .then(() => mostrarToast({ mensaje: 'Enlace copiado al portapapeles', variante: 'exito' }));
  };

  const compartirWhatsApp = () => {
    if (!linkReservas) return;
    const mensajeWA = encodeURIComponent(
      `Hola. Te comparto el link de reservas de ${perfil?.estudio?.nombre ?? 'nuestro salón'}: ${linkReservas}`,
    );
    window.open(`https://wa.me/?text=${mensajeWA}`, '_blank', 'noopener');
  };

  const abrirLinkReservas = () => {
    if (!identificadorReserva) return;
    window.open(`/reservar/${identificadorReserva}`, '_blank', 'noopener');
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      <NavegacionEmpleado />

      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">
        <section className="overflow-hidden rounded-[2.75rem] bg-linear-to-br from-slate-950 via-slate-900 to-pink-700 text-white shadow-xl">
          <div className="grid gap-6 p-6 md:p-8 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-pink-200">
                Panel del empleado
              </p>
              <h1 className="mt-2 text-3xl font-black tracking-tight md:text-4xl">
                {obtenerSaludo()}, {nombreEmpleado}
              </h1>
              <p className="mt-3 max-w-2xl text-sm font-medium text-slate-200 md:text-base">
                Tu agenda ahora sigue la misma estructura operativa del salón para que revises el
                día, completes citas y consultes historial sin perder contexto.
              </p>
            </div>

            <div className="rounded-4xl border border-white/15 bg-white/10 p-5 backdrop-blur-sm">
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-pink-100">
                Jornada actual
              </p>
              <p className="mt-3 text-2xl font-black text-white">
                {horarioInicio} - {horarioFin}
              </p>
              <p className="mt-2 text-sm text-slate-200">{perfil?.estudio.nombre ?? 'Tu salón'}</p>
              <p className="mt-1 text-xs font-bold uppercase tracking-wide text-pink-100">
                {fechaEsPasada
                  ? 'Historial del día seleccionado'
                  : 'Agenda activa del día seleccionado'}
              </p>
            </div>
          </div>

          <div className="grid gap-3 border-t border-white/10 bg-slate-950/30 p-4 md:grid-cols-3 md:p-6">
            {[
              { icono: CalendarDays, etiqueta: 'Hoy', valor: metricas?.citasHoy ?? 0 },
              { icono: CalendarRange, etiqueta: 'Semana', valor: metricas?.citasSemana ?? 0 },
              { icono: CalendarCheck, etiqueta: 'Mes', valor: metricas?.citasMes ?? 0 },
            ].map((kpi) => (
              <div
                key={kpi.etiqueta}
                className="rounded-[1.75rem] border border-white/10 bg-white/10 p-4 backdrop-blur-sm"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                    <kpi.icono className="h-5 w-5 text-pink-100" aria-hidden="true" />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] text-pink-100">
                      {kpi.etiqueta}
                    </p>
                    <p className="text-2xl font-black text-white">{kpi.valor}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section>
            {estudioCalendario ? (
              <SelectorCalendario
                estudio={estudioCalendario}
                fechaSeleccionada={fechaCalendario}
                totalDuracion={0}
                onCambiarFecha={(fecha) => setFechaSeleccionada(obtenerFechaIsoLocal(fecha))}
                permitirPasado
                mostrarDuracion={false}
                titulo="Calendario de citas"
                indicadorPaso="E"
                fechasMarcadas={fechasMarcadas}
                etiquetaMarcador="Citas"
              />
            ) : (
              <div
                className="h-80 animate-pulse rounded-[3rem] bg-white shadow-sm"
                aria-busy="true"
              />
            )}
          </section>

          <aside className="space-y-4">
            {linkReservas && (
              <div className="rounded-4xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-pink-500" aria-hidden="true" />
                  <h2 className="text-sm font-black uppercase tracking-wide text-slate-700">
                    Link de reservas del salón
                  </h2>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-mono text-slate-600">
                  {linkReservas}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={copiarLink}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-200"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    Copiar
                  </button>
                  <button
                    type="button"
                    onClick={abrirLinkReservas}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-100"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    Abrir
                  </button>
                  <button
                    type="button"
                    onClick={compartirWhatsApp}
                    className="inline-flex items-center justify-center gap-2 rounded-2xl bg-green-500 py-2 text-xs font-black text-white transition hover:bg-green-600"
                  >
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                    WhatsApp
                  </button>
                </div>
              </div>
            )}

            <div className="rounded-4xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                    Día seleccionado
                  </p>
                  <h2 className="mt-2 text-xl font-black capitalize text-slate-900">
                    {formatearFechaCabecera(fechaSeleccionada)}
                  </h2>
                </div>
                <PanelNotificaciones
                  notificaciones={notificaciones}
                  pais={perfil?.estudio?.pais === 'Colombia' ? 'Colombia' : 'Mexico'}
                  onMarcarLeida={marcarLeida}
                />
              </div>

              <div className="mt-4 rounded-3xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Vista activa
                </p>
                <p className="mt-2 text-sm font-black text-slate-900">
                  {fechaEsPasada ? 'Historial con detalle completo' : 'Agenda compacta y operativa'}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {reservasDia.length > 0
                    ? `Tienes ${reservasDia.length} cita(s) registrada(s) para esta fecha.`
                    : 'No hay citas registradas para esta fecha.'}
                </p>
              </div>
            </div>
          </aside>
        </div>

        <section className="space-y-4 rounded-[2.5rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.24em] text-pink-600">
                {fechaEsPasada ? 'Historial del día' : 'Agenda del día'}
              </p>
              <h2 className="mt-2 text-2xl font-black capitalize text-slate-900">
                {formatearFechaCabecera(fechaSeleccionada)}
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                {reservasDia.length > 0
                  ? `Mostrando ${indiceInicio}-${indiceFin} de ${reservasDia.length} cita(s).`
                  : fechaEsPasada
                    ? 'Selecciona otra fecha para revisar más historial.'
                    : 'Cuando entren reservas activas aparecerán aquí.'}
              </p>
            </div>

            {consultaAgenda.isFetching && (
              <span className="text-xs font-black uppercase tracking-wide text-slate-400">
                Actualizando...
              </span>
            )}
          </div>

          {consultaAgenda.isLoading && (
            <div className="space-y-3" aria-busy="true" aria-label="Cargando citas del empleado">
              {[...Array(3)].map((_, indice) => (
                <div key={indice} className="h-36 animate-pulse rounded-4xl bg-slate-100" />
              ))}
            </div>
          )}

          {consultaAgenda.isError && (
            <div className="rounded-4xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
              No se pudo cargar la agenda del empleado. Intenta nuevamente.
            </div>
          )}

          {!consultaAgenda.isLoading && !consultaAgenda.isError && reservasDia.length === 0 && (
            <div className="rounded-4xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
              <p className="text-lg font-black text-slate-800">
                {fechaEsPasada
                  ? 'Sin citas en el historial de esta fecha'
                  : 'Sin citas para este día'}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {fechaEsPasada
                  ? 'El calendario te permitirá volver a cualquier día con citas marcadas.'
                  : 'Selecciona otra fecha o comparte el link de reservas para generar nuevas citas.'}
              </p>
            </div>
          )}

          {!consultaAgenda.isLoading && reservasDia.length > 0 && (
            <>
              <div className="space-y-3">
                {reservasPaginadas.map((reserva) => {
                  const actualizando =
                    mutacionEstado.isPending && mutacionEstado.variables?.id === reserva.id;

                  return (
                    <TarjetaReservaEmpleado
                      key={reserva.id}
                      reserva={reserva}
                      moneda={moneda}
                      mostrarDetalleCompleto={fechaEsPasada}
                      actualizando={actualizando}
                      onAbrirDetalle={setDetalleReserva}
                      onAbrirExtra={setModalAdicional}
                      onActualizarEstado={(id, estado) => mutacionEstado.mutate({ id, estado })}
                    />
                  );
                })}
              </div>

              <PaginadorLista
                paginaActual={paginaReservas}
                totalPaginas={totalPaginas}
                onCambiar={setPaginaReservas}
              />
            </>
          )}
        </section>
      </main>

      {perfil?.estudio?.estado === 'suspendido' && (
        <ModalSuspension
          nombreSalon={perfil.estudio.nombre}
          pais={perfil.estudio.pais ?? 'Mexico'}
        />
      )}

      {detalleReserva && (
        <ModalDetalleReservaEmpleado
          reserva={detalleReserva}
          moneda={moneda}
          onCerrar={() => setDetalleReserva(null)}
        />
      )}

      {modalAdicional && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-modal-adicional-empleado"
          onClick={() => {
            setModalAdicional(null);
            setServicioAdicionalSeleccionado('');
          }}
        >
          <div
            className="w-full max-w-md rounded-4xl bg-white p-6 shadow-2xl"
            onClick={(evento) => evento.stopPropagation()}
          >
            <h3 id="titulo-modal-adicional-empleado" className="text-lg font-black text-slate-900">
              Agregar servicio adicional
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Selecciona un servicio del catálogo del salón para añadirlo a la cita actual.
            </p>

            {catalogoServicios.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">
                No hay servicios disponibles en el catálogo.
              </p>
            ) : (
              <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
                {catalogoServicios.map((servicio) => {
                  const seleccionado = servicioAdicionalSeleccionado === servicio.name;
                  return (
                    <button
                      key={servicio.name}
                      type="button"
                      onClick={() =>
                        setServicioAdicionalSeleccionado(seleccionado ? '' : servicio.name)
                      }
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                        seleccionado
                          ? 'border-pink-300 bg-pink-50 text-pink-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-pink-200'
                      }`}
                    >
                      <div>
                        <p className="text-sm font-black">{servicio.name}</p>
                        <p className="text-xs text-slate-500">{servicio.duration} min</p>
                      </div>
                      <span className="text-sm font-black">
                        {formatearMontoSinDecimales(servicio.price, moneda)}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setModalAdicional(null);
                  setServicioAdicionalSeleccionado('');
                }}
                className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!servicioAdicionalSeleccionado || mutacionAdicional.isPending}
                onClick={() => {
                  const servicio = catalogoServicios.find(
                    (item) => item.name === servicioAdicionalSeleccionado,
                  );
                  if (!servicio || !modalAdicional) return;

                  const duracion = Math.max(5, Math.round(Number(servicio.duration) || 0));
                  const precio = Math.max(0, Math.round(Number(servicio.price) || 0));

                  mutacionAdicional.mutate({
                    reservaId: modalAdicional,
                    servicio: {
                      nombre: servicio.name,
                      duracion,
                      precio,
                      categoria: servicio.category,
                    },
                  });
                }}
                className="flex-1 rounded-2xl bg-pink-600 py-3 text-sm font-black text-white transition hover:bg-pink-700 disabled:opacity-50"
              >
                {mutacionAdicional.isPending ? 'Agregando...' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
