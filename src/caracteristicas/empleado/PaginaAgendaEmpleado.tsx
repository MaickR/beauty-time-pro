import { useCallback, useEffect, useMemo, useState } from 'react';
import QRCode from 'qrcode';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  CalendarCheck,
  CalendarPlus,
  CalendarDays,
  CalendarRange,
  Copy,
  Download,
  ExternalLink,
  Eye,
  History,
  Link2,
  MapPin,
  MessageCircle,
  Package2,
  Palette,
  Phone,
  Plus,
  Scissors,
  Search,
  StickyNote,
  X,
} from 'lucide-react';
import { env } from '../../lib/env';
import { NavegacionEmpleado } from '../../componentes/diseno/NavegacionEmpleado';
import { BotonIconoAccion } from '../../componentes/ui/BotonIconoAccion';
import { CalendarioEstadoSalon } from '../../componentes/ui/CalendarioEstadoSalon';
import { ModalSuspension } from '../estudio/componentes/ModalSuspension';
import { ModalCrearReservaManual } from '../estudio/componentes/ModalCrearReservaManual';
import {
  actualizarEstadoReservaEmpleado,
  obtenerMiAgenda,
  obtenerMiAgendaMes,
  obtenerMiPerfilEmpleado,
  obtenerMisMetricas,
} from '../../servicios/servicioEmpleados';
import { usarToast } from '../../componentes/ui/ProveedorToast';
import {
  convertirCentavosAMoneda,
  formatearFechaHumana,
  obtenerMonedaPorPais,
} from '../../utils/formato';
import { normalizarFechaReservaAgenda } from '../estudio/utils/estadoCalendarioAgenda';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';
import { agregarProductoAReserva, agregarServicioAReserva } from '../../servicios/servicioReservas';
import { obtenerProductos } from '../../servicios/servicioProductos';
import { ModalMetricasEmpleado } from './componentes/ModalMetricasEmpleado';
import {
  combinarReservasEmpleado,
  filtrarReservasDesdeAlta,
  limitarFechaSeleccionEmpleado,
  obtenerFechaAltaEmpleado,
  obtenerMesAnterior,
  obtenerMesSiguiente,
  obtenerReservasHistorialEmpleado,
  obtenerReservasPeriodoEmpleado,
  type ModoHistorialEmpleado,
  type PeriodoMetricaEmpleado,
} from './utils/panelEmpleado';
import type {
  DetalleServicioReserva,
  Estudio,
  Moneda,
  PerfilEmpleado,
  ReservaEmpleado,
  Servicio,
} from '../../tipos';

const LIMITE_RESERVAS_POR_PAGINA = 4;

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
    plan: perfil.estudio.plan,
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
        commissionBasePercentage: perfil.porcentajeComisionBase ?? 0,
        serviceCommissionPercentages: perfil.comisionServicios ?? {},
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

const BARRA_ESTADO_RESERVA_EMPLEADO: Record<ReservaEmpleado['estado'], string> = {
  pending: 'bg-emerald-500',
  confirmed: 'bg-emerald-500',
  working: 'bg-sky-500',
  completed: 'bg-slate-300',
  cancelled: 'bg-rose-400',
  no_show: 'bg-orange-400',
};

const METODOS_PAGO_EMPLEADO = [
  { valor: 'cash', etiqueta: 'Efectivo' },
  { valor: 'card', etiqueta: 'Tarjeta' },
  { valor: 'bank_transfer', etiqueta: 'Transferencia bancaria' },
  { valor: 'digital_transfer', etiqueta: 'Transferencia digital' },
] as const;

function badgePorEstado(estado: ReservaEmpleado['estado']): BadgeEstado {
  const mapa: Record<ReservaEmpleado['estado'], BadgeEstado> = {
    pending: {
      etiqueta: 'Confirmada',
      fondo: 'bg-emerald-100',
      texto: 'text-emerald-700',
      borde: 'border-emerald-200',
    },
    confirmed: {
      etiqueta: 'Confirmada',
      fondo: 'bg-emerald-100',
      texto: 'text-emerald-700',
      borde: 'border-emerald-200',
    },
    working: {
      etiqueta: 'Trabajando',
      fondo: 'bg-sky-100',
      texto: 'text-sky-700',
      borde: 'border-sky-200',
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

function formatearMetodoPagoEmpleado(metodo?: string | null): string {
  return (
    METODOS_PAGO_EMPLEADO.find((item) => item.valor === metodo)?.etiqueta ??
    'A confirmar en el salón'
  );
}

function AvatarClienteEmpleado({ nombre }: { nombre: string }) {
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

function MetaDatoEmpleado({
  etiqueta,
  valor,
  acento = false,
}: {
  etiqueta: string;
  valor: string;
  acento?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border px-3 py-2.5 shadow-sm ${
        acento ? 'border-pink-100 bg-pink-50/80' : 'border-slate-200 bg-slate-50'
      }`}
    >
      <p className="text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
        {etiqueta}
      </p>
      <p
        className={`mt-1 text-[13px] font-semibold leading-tight ${acento ? 'text-pink-700' : 'text-slate-900'}`}
      >
        {valor}
      </p>
    </div>
  );
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

function obtenerProductosAdicionalesReserva(reserva: ReservaEmpleado) {
  return reserva.productosAdicionales ?? [];
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
  onActualizarEstado: (
    id: string,
    estado: 'confirmed' | 'working' | 'completed' | 'no_show',
  ) => void;
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
  const productosAdicionales = obtenerProductosAdicionalesReserva(reserva);
  const estaCompletada = reserva.estado === 'completed';
  const estaFinalizada = ['completed', 'cancelled', 'no_show'].includes(reserva.estado);
  const barraEstado = BARRA_ESTADO_RESERVA_EMPLEADO[reserva.estado];
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
      className={[
        'overflow-hidden rounded-2xl border transition-all',
        estaCompletada
          ? 'border-slate-200 bg-slate-50 opacity-75'
          : reserva.estado === 'cancelled' || reserva.estado === 'no_show'
            ? 'border-red-100 bg-red-50/40 opacity-70'
            : reserva.estado === 'working'
              ? 'border-sky-100 bg-sky-50/30 hover:border-sky-200 hover:shadow-sm'
              : 'border-slate-100 bg-white hover:border-pink-200 hover:shadow-sm',
      ].join(' ')}
    >
      <div className={`h-0.75 w-full ${barraEstado}`} />

      <div className="space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="font-serif text-2xl font-normal leading-none tracking-tight text-slate-900">
              {reserva.horaInicio}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">hasta las {horaFin}</p>
            <p className="mt-1 text-[11px] font-black uppercase tracking-wide text-slate-500">
              {formatearFechaHumana(normalizarFechaReservaAgenda(reserva.fecha))}
            </p>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${badge.fondo} ${badge.texto}`}
          >
            <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${barraEstado}`} />
            {badge.etiqueta}
          </span>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-3">
          <p className="mb-2 text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
            Cliente
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <AvatarClienteEmpleado nombre={reserva.nombreCliente} />
              <p className="truncate text-sm font-semibold leading-tight text-slate-900">
                {reserva.nombreCliente}
              </p>
            </div>
            <a
              href={`tel:${reserva.telefonoCliente}`}
              className="flex items-center gap-1.5 text-[11.5px] font-medium text-slate-500 transition hover:text-pink-600 sm:justify-end"
            >
              <Phone className="h-3 w-3 shrink-0 text-pink-400" aria-hidden="true" />
              {reserva.telefonoCliente}
            </a>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3">
          <p className="mb-2 flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-wide text-slate-400">
            <Scissors className="h-3 w-3" aria-hidden="true" /> Servicios
          </p>
          <div className="space-y-2">
            {serviciosDetalle.map((servicio) => (
              <div
                key={`${reserva.id}-${servicio.order}-${servicio.name}`}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[12.5px] text-slate-700 shadow-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium text-slate-800">{servicio.name}</span>
                  <span className="text-[11px] font-black text-slate-500">
                    {servicio.duration} min
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {productosAdicionales.length > 0 && (
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-3 py-3">
            <p className="mb-2 flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-wide text-emerald-700">
              <Package2 className="h-3.5 w-3.5" aria-hidden="true" /> Productos
            </p>
            <div className="space-y-2">
              {productosAdicionales.map((producto) => (
                <div
                  key={`${reserva.id}-${producto.id}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-emerald-100 bg-white px-3 py-2 text-[12px] text-slate-700 shadow-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-slate-900">{producto.nombre}</p>
                    <p className="text-[11px] text-slate-500">
                      {producto.cantidad} ×{' '}
                      {formatearMontoSinDecimales(producto.precioUnitario, moneda)}
                    </p>
                  </div>
                  <span className="text-[11px] font-black text-emerald-700">
                    {formatearMontoSinDecimales(producto.total, moneda)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <MetaDatoEmpleado etiqueta="Sucursal" valor={reserva.sucursal || 'Principal'} />
          <MetaDatoEmpleado etiqueta="Duración" valor={`${reserva.duracion} min`} />
          <MetaDatoEmpleado
            etiqueta="Método de pago"
            valor={formatearMetodoPagoEmpleado(reserva.metodoPago)}
          />
          <MetaDatoEmpleado
            etiqueta="Total"
            valor={formatearMontoSinDecimales(reserva.precioTotal, moneda)}
            acento
          />
        </div>

        {(reserva.marcaTinte || reserva.tonalidad) && (
          <div className="flex items-start gap-2 rounded-xl border border-pink-100 bg-pink-50 px-3 py-2">
            <Palette className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pink-400" aria-hidden="true" />
            <div>
              <p className="text-[9.5px] font-semibold uppercase tracking-wide text-pink-600">
                Color / tono
              </p>
              <p className="mt-0.5 text-[12px] font-medium text-pink-900">
                {[reserva.marcaTinte, reserva.tonalidad].filter(Boolean).join(' · ')}
              </p>
            </div>
          </div>
        )}

        {reserva.observaciones && (
          <div className="rounded-xl border border-amber-100 bg-amber-50 px-3 py-3">
            <p className="mb-2 flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-wide text-amber-700">
              <StickyNote className="h-3.5 w-3.5" aria-hidden="true" /> Registro de notas
            </p>
            <p className="text-[12px] text-amber-900">{reserva.observaciones}</p>
          </div>
        )}

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
                {productosAdicionales.length > 0 && (
                  <div className="rounded-2xl bg-white p-4 shadow-sm">
                    <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                      <Package2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                      Productos de la cita
                    </p>
                    <div className="mt-3 space-y-2">
                      {productosAdicionales.map((producto) => (
                        <div
                          key={`${reserva.id}-producto-${producto.id}`}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 px-3 py-2"
                        >
                          <div>
                            <p className="text-sm font-black text-slate-800">{producto.nombre}</p>
                            <p className="text-xs text-slate-500">
                              {producto.cantidad} x{' '}
                              {formatearMontoSinDecimales(producto.precioUnitario, moneda)}
                            </p>
                          </div>
                          <p className="text-sm font-black text-emerald-700">
                            {formatearMontoSinDecimales(producto.total, moneda)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

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

        <div className="grid grid-cols-1 gap-2 pt-0.5 sm:grid-cols-2 xl:grid-cols-4">
          <button
            type="button"
            onClick={() => onAbrirDetalle(reserva)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-700 transition-colors hover:bg-slate-100"
          >
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            Detalle
          </button>
          {!estaFinalizada && (
            <button
              type="button"
              onClick={() => onAbrirExtra(reserva.id)}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-blue-700 transition-colors hover:bg-blue-100"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Extra
            </button>
          )}

          {!estaFinalizada && reserva.estado === 'confirmed' && (
            <button
              type="button"
              onClick={() => onActualizarEstado(reserva.id, 'working')}
              disabled={actualizando}
              className="inline-flex items-center justify-center rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-sky-800 transition-colors hover:bg-sky-100 disabled:opacity-60"
            >
              Iniciar
            </button>
          )}

          {!estaFinalizada && reserva.estado === 'working' && (
            <button
              type="button"
              onClick={() => onActualizarEstado(reserva.id, 'completed')}
              disabled={actualizando}
              className="inline-flex items-center justify-center rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-green-800 transition-colors hover:bg-green-100 disabled:opacity-60"
            >
              Finalizar
            </button>
          )}

          {!estaFinalizada && reserva.estado === 'confirmed' && yaTermino && (
            <button
              type="button"
              onClick={() => onActualizarEstado(reserva.id, 'no_show')}
              disabled={actualizando}
              className="inline-flex items-center justify-center rounded-xl border border-orange-200 bg-orange-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-orange-700 transition-colors hover:bg-orange-100 disabled:opacity-60"
            >
              No show
            </button>
          )}

          {actualizando && (
            <div className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500 sm:col-span-2 xl:col-span-1">
              Actualizando...
            </div>
          )}
        </div>

        {!estaFinalizada && reserva.estado === 'pending' && (
          <div className="pt-0.5">
            <button
              type="button"
              onClick={() => onActualizarEstado(reserva.id, 'confirmed')}
              disabled={actualizando}
              className="inline-flex w-full items-center justify-center rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-60 sm:w-auto"
            >
              Confirmar cita
            </button>
          </div>
        )}
      </div>
    </article>
  );
}

interface PropsModalDetalleReservaEmpleado {
  reserva: ReservaEmpleado;
  moneda: Moneda;
  onCerrar: () => void;
}

interface PropsTarjetaIndicadorMetricaEmpleado {
  etiqueta: string;
  valor: number;
  descripcion: string;
  icono: typeof CalendarDays;
  onClick: () => void;
}

function ModalDetalleReservaEmpleado({
  reserva,
  moneda,
  onCerrar,
}: PropsModalDetalleReservaEmpleado) {
  const badge = badgePorEstado(reserva.estado);
  const serviciosDetalle = obtenerServiciosDetalle(reserva);
  const productosAdicionales = obtenerProductosAdicionalesReserva(reserva);

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

        {productosAdicionales.length > 0 && (
          <div className="mt-5 rounded-[1.75rem] border border-slate-200 p-5">
            <p className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
              <Package2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
              Productos adicionales
            </p>
            <div className="mt-4 space-y-3">
              {productosAdicionales.map((producto) => (
                <div
                  key={`${reserva.id}-modal-producto-${producto.id}`}
                  className="flex flex-col gap-2 rounded-2xl border border-slate-100 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-black text-slate-900">{producto.nombre}</p>
                    <p className="text-sm text-slate-500">
                      {producto.cantidad} x{' '}
                      {formatearMontoSinDecimales(producto.precioUnitario, moneda)}
                    </p>
                  </div>
                  <span className="font-black text-emerald-700">
                    {formatearMontoSinDecimales(producto.total, moneda)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function TarjetaIndicadorMetricaEmpleado({
  etiqueta,
  valor,
  descripcion,
  icono: Icono,
  onClick,
}: PropsTarjetaIndicadorMetricaEmpleado) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-[1.75rem] border border-white/10 bg-white/10 p-4 text-left backdrop-blur-sm transition hover:border-pink-200/30 hover:bg-white/15"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
          <Icono className="h-5 w-5 text-pink-100" aria-hidden="true" />
        </div>
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-pink-100">
            {etiqueta}
          </p>
          <p className="text-2xl font-black text-white">{valor}</p>
        </div>
      </div>
      <p className="mt-3 text-xs font-medium text-slate-200">{descripcion}</p>
    </button>
  );
}

export function PaginaAgendaEmpleado() {
  const fechaHoy = hoy();
  const [fechaSeleccionada, setFechaSeleccionada] = useState(fechaHoy);
  const [paginaReservas, setPaginaReservas] = useState(1);
  const [paginaHistorial, setPaginaHistorial] = useState(1);
  const [modalAdicional, setModalAdicional] = useState<string | null>(null);
  const [tabAdicional, setTabAdicional] = useState<'servicio' | 'producto'>('servicio');
  const [servicioAdicionalSeleccionado, setServicioAdicionalSeleccionado] = useState('');
  const [productoAdicionalSeleccionado, setProductoAdicionalSeleccionado] = useState('');
  const [cantidadProductoAdicional, setCantidadProductoAdicional] = useState(1);
  const [detalleReserva, setDetalleReserva] = useState<ReservaEmpleado | null>(null);
  const [vistaActiva, setVistaActiva] = useState<'agenda' | 'historial'>('agenda');
  const [modoHistorial, setModoHistorial] = useState<ModoHistorialEmpleado>('dia');
  const [busquedaReservas, setBusquedaReservas] = useState('');
  const [filtroEstadoReservas, setFiltroEstadoReservas] = useState<
    'todos' | ReservaEmpleado['estado']
  >('todos');
  const [filtroServicioReservas, setFiltroServicioReservas] = useState('todos');
  const [ordenReservas, setOrdenReservas] = useState<'tempranas' | 'tardias'>('tempranas');
  const [mostrarModalCrearCita, setMostrarModalCrearCita] = useState(false);
  const [modalMetricaActiva, setModalMetricaActiva] = useState<PeriodoMetricaEmpleado | null>(null);
  const [qrReserva, setQrReserva] = useState<string | null>(null);
  const clienteConsulta = useQueryClient();
  const { mostrarToast } = usarToast();
  const { usuario, iniciando, cerrarSesion } = usarTiendaAuth();
  const puedeConsultarAgenda = !iniciando && usuario?.rol === 'empleado';
  const mesSeleccionado = fechaSeleccionada.slice(0, 7);
  const mesAnteriorSeleccionado = obtenerMesAnterior(mesSeleccionado);
  const mesSiguienteSeleccionado = obtenerMesSiguiente(mesSeleccionado);
  const mesActual = fechaHoy.slice(0, 7);
  const mesActualAnterior = obtenerMesAnterior(mesActual);
  const mesActualSiguiente = obtenerMesSiguiente(mesActual);

  const manejarSalidaPorSuspension = useCallback(async () => {
    const mensajeSuspension =
      'Tu salon esta suspendido por falta de pago. Contacta soporte para reactivar tu acceso.';
    await cerrarSesion();
    window.location.replace(
      `/iniciar-sesion?codigo=SALON_SUSPENDIDO&mensaje=${encodeURIComponent(mensajeSuspension)}`,
    );
  }, [cerrarSesion]);

  const consultaAgenda = useQuery({
    queryKey: ['mi-agenda', fechaSeleccionada],
    queryFn: () => obtenerMiAgenda(fechaSeleccionada),
    enabled: puedeConsultarAgenda,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: () => (document.visibilityState === 'visible' ? 15_000 : false),
  });

  const consultaAgendaMes = useQuery({
    queryKey: ['mi-agenda-mes', mesSeleccionado],
    queryFn: () => obtenerMiAgendaMes(mesSeleccionado),
    enabled: puedeConsultarAgenda,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: () => (document.visibilityState === 'visible' ? 20_000 : false),
  });

  const consultaAgendaMesAnterior = useQuery({
    queryKey: ['mi-agenda-mes', mesAnteriorSeleccionado],
    queryFn: () => obtenerMiAgendaMes(mesAnteriorSeleccionado),
    enabled: puedeConsultarAgenda && vistaActiva === 'historial',
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const consultaAgendaMesSiguiente = useQuery({
    queryKey: ['mi-agenda-mes', mesSiguienteSeleccionado],
    queryFn: () => obtenerMiAgendaMes(mesSiguienteSeleccionado),
    enabled: puedeConsultarAgenda && vistaActiva === 'historial',
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const consultaAgendaMesMetrica = useQuery({
    queryKey: ['mi-agenda-mes', mesActual],
    queryFn: () => obtenerMiAgendaMes(mesActual),
    enabled: puedeConsultarAgenda && modalMetricaActiva !== null,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const consultaAgendaMesMetricaAnterior = useQuery({
    queryKey: ['mi-agenda-mes', mesActualAnterior],
    queryFn: () => obtenerMiAgendaMes(mesActualAnterior),
    enabled: puedeConsultarAgenda && modalMetricaActiva === 'semana',
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const consultaAgendaMesMetricaSiguiente = useQuery({
    queryKey: ['mi-agenda-mes', mesActualSiguiente],
    queryFn: () => obtenerMiAgendaMes(mesActualSiguiente),
    enabled: puedeConsultarAgenda && modalMetricaActiva === 'semana',
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const consultaPerfil = useQuery({
    queryKey: ['mi-perfil-empleado'],
    queryFn: obtenerMiPerfilEmpleado,
    enabled: puedeConsultarAgenda,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });

  const consultaMetricas = useQuery({
    queryKey: ['mis-metricas'],
    queryFn: obtenerMisMetricas,
    enabled: puedeConsultarAgenda,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    refetchInterval: () => (document.visibilityState === 'visible' ? 20_000 : false),
  });

  const mutacionEstado = useMutation({
    mutationFn: ({
      id,
      estado,
    }: {
      id: string;
      estado: 'confirmed' | 'working' | 'completed' | 'no_show';
    }) => actualizarEstadoReservaEmpleado(id, estado),
    onSuccess: async (_, variables) => {
      const aplicarActualizacionEstado = (reservas: ReservaEmpleado[] | undefined) =>
        (reservas ?? []).map((reserva) => {
          if (reserva.id !== variables.id) return reserva;

          const detallesActuales =
            reserva.serviciosDetalle && reserva.serviciosDetalle.length > 0
              ? [...reserva.serviciosDetalle]
              : reserva.servicios.map((servicio, indice) => ({
                  ...servicio,
                  status: reserva.estado,
                  order: indice,
                  motivo: null,
                }));

          return {
            ...reserva,
            estado: variables.estado,
            serviciosDetalle: detallesActuales.map((servicio) => {
              if (['cancelled', 'no_show'].includes(servicio.status)) return servicio;
              return { ...servicio, status: variables.estado };
            }),
          };
        });

      clienteConsulta.setQueryData<ReservaEmpleado[]>(
        ['mi-agenda', fechaSeleccionada],
        aplicarActualizacionEstado,
      );
      clienteConsulta.setQueryData<ReservaEmpleado[]>(
        ['mi-agenda-mes', mesSeleccionado],
        aplicarActualizacionEstado,
      );

      await clienteConsulta.invalidateQueries({ queryKey: ['mi-agenda'] });
      await clienteConsulta.invalidateQueries({ queryKey: ['mi-agenda-mes'] });
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
    onSuccess: async (_, variables) => {
      const aplicarActualizacionLocal = (reservas: ReservaEmpleado[] | undefined) =>
        (reservas ?? []).map((reserva) => {
          if (reserva.id !== variables.reservaId) return reserva;

          const estadoServicio = reserva.estado === 'working' ? 'working' : 'confirmed';
          const detallesActuales =
            reserva.serviciosDetalle && reserva.serviciosDetalle.length > 0
              ? [...reserva.serviciosDetalle]
              : reserva.servicios.map((servicio, indice) => ({
                  ...servicio,
                  status: estadoServicio,
                  order: indice,
                  motivo: null,
                }));
          const ordenNuevo = detallesActuales.length;

          return {
            ...reserva,
            servicios: [
              ...reserva.servicios,
              {
                name: variables.servicio.nombre,
                duration: variables.servicio.duracion,
                price: variables.servicio.precio,
                ...(variables.servicio.categoria ? { category: variables.servicio.categoria } : {}),
              },
            ],
            serviciosDetalle: [
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
            duracion: reserva.duracion + variables.servicio.duracion,
            precioTotal: reserva.precioTotal + variables.servicio.precio,
          };
        });

      clienteConsulta.setQueryData<ReservaEmpleado[]>(
        ['mi-agenda', fechaSeleccionada],
        aplicarActualizacionLocal,
      );
      clienteConsulta.setQueryData<ReservaEmpleado[]>(
        ['mi-agenda-mes', mesSeleccionado],
        aplicarActualizacionLocal,
      );

      cerrarModalAdicional();
      await clienteConsulta.invalidateQueries({ queryKey: ['mi-agenda'] });
      await clienteConsulta.invalidateQueries({ queryKey: ['mi-agenda-mes'] });
      await clienteConsulta.invalidateQueries({ queryKey: ['mis-metricas'] });
      mostrarToast({ mensaje: 'Servicio extra agregado correctamente', variante: 'exito' });
    },
    onError: (error: Error) => {
      mostrarToast({ mensaje: error.message, variante: 'error' });
    },
  });

  const mutacionProductoAdicional = useMutation({
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
        const aplicarActualizacionLocal = (reservas: ReservaEmpleado[] | undefined) =>
          (reservas ?? []).map((reserva) => {
            if (reserva.id !== variables.reservaId) return reserva;

            const productosActuales = [...obtenerProductosAdicionalesReserva(reserva)];
            const indiceExistente = productosActuales.findIndex(
              (producto) => producto.id === productoSeleccionado.id,
            );

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
                total: productoSeleccionado.precio * variables.cantidad,
              });
            }

            return {
              ...reserva,
              productosAdicionales: productosActuales,
              precioTotal: reserva.precioTotal + productoSeleccionado.precio * variables.cantidad,
            };
          });

        clienteConsulta.setQueryData<ReservaEmpleado[]>(
          ['mi-agenda', fechaSeleccionada],
          aplicarActualizacionLocal,
        );
        clienteConsulta.setQueryData<ReservaEmpleado[]>(
          ['mi-agenda-mes', mesSeleccionado],
          aplicarActualizacionLocal,
        );
      }

      cerrarModalAdicional();
      await clienteConsulta.invalidateQueries({ queryKey: ['mi-agenda'] });
      await clienteConsulta.invalidateQueries({ queryKey: ['mi-agenda-mes'] });
      await clienteConsulta.invalidateQueries({ queryKey: ['mis-metricas'] });
      mostrarToast({ mensaje: 'Producto agregado correctamente a la cita', variante: 'exito' });
    },
    onError: (error: Error) => {
      mostrarToast({ mensaje: error.message, variante: 'error' });
    },
  });

  const perfil = consultaPerfil.data;
  const fechaAltaEmpleado = obtenerFechaAltaEmpleado(perfil?.creadoEn);
  const fechaMinimaAgenda = fechaAltaEmpleado || fechaHoy;
  const estudioCalendario = perfil ? construirEstudioCalendario(perfil) : null;
  const moneda = obtenerMonedaPorPais(perfil?.estudio?.pais);
  const fechaEsPasada = fechaSeleccionada < fechaHoy;
  const horarioInicio = perfil?.horaInicio ?? perfil?.estudio.horarioApertura ?? '—';
  const horarioFin = perfil?.horaFin ?? perfil?.estudio.horarioCierre ?? '—';
  const metricas = consultaMetricas.data;
  const comisionBaseEmpleado =
    perfil?.porcentajeComisionBase ?? metricas?.porcentajeComisionBase ?? 0;
  const comisionHoyFormateada = formatearMontoSinDecimales(metricas?.comisionHoy ?? 0, moneda);
  const comisionSemanaFormateada = formatearMontoSinDecimales(
    metricas?.comisionSemana ?? 0,
    moneda,
  );
  const comisionMesFormateada = formatearMontoSinDecimales(metricas?.comisionMes ?? 0, moneda);
  const nombreEmpleado = perfil?.nombre?.trim() || 'Especialista';
  const identificadorReserva = perfil?.estudio?.slug || perfil?.estudio?.claveCliente;
  const linkReservas = identificadorReserva
    ? `${obtenerOrigenReservas()}/reservar/${identificadorReserva}`
    : null;
  const claveSalon = perfil?.estudio?.claveCliente ?? '';
  const catalogoServicios: Servicio[] = perfil?.estudio?.servicios ?? [];
  const consultaProductos = useQuery({
    queryKey: ['productos-agenda-empleado', perfil?.estudio.id],
    queryFn: () => obtenerProductos(perfil!.estudio.id),
    enabled:
      Boolean(modalAdicional) && perfil?.estudio.plan === 'PRO' && Boolean(perfil?.estudio.id),
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
  const fechaCalendario = obtenerFechaDesdeIso(fechaSeleccionada);

  function cerrarModalAdicional() {
    setModalAdicional(null);
    setTabAdicional('servicio');
    setServicioAdicionalSeleccionado('');
    setProductoAdicionalSeleccionado('');
    setCantidadProductoAdicional(1);
  }

  useEffect(() => {
    setPaginaReservas(1);
    setPaginaHistorial(1);
  }, [
    fechaSeleccionada,
    vistaActiva,
    modoHistorial,
    busquedaReservas,
    filtroEstadoReservas,
    filtroServicioReservas,
    ordenReservas,
  ]);

  useEffect(() => {
    if (!fechaAltaEmpleado) {
      return;
    }

    if (fechaSeleccionada < fechaAltaEmpleado) {
      setFechaSeleccionada(fechaAltaEmpleado);
    }
  }, [fechaAltaEmpleado, fechaSeleccionada]);

  useEffect(() => {
    if (fechaEsPasada) {
      setVistaActiva('historial');
    }
  }, [fechaEsPasada]);

  useEffect(() => {
    if (!linkReservas) {
      setQrReserva(null);
      return;
    }

    let activo = true;
    void QRCode.toDataURL(linkReservas, { width: 320, margin: 1 }).then((url) => {
      if (activo) {
        setQrReserva(url);
      }
    });

    return () => {
      activo = false;
    };
  }, [linkReservas]);

  const reservasAgendaBase = useMemo(() => {
    const base = consultaAgenda.data ?? [];

    return [...base]
      .filter((reserva) => (fechaEsPasada ? true : reserva.estado !== 'cancelled'))
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  }, [consultaAgenda.data, fechaEsPasada]);

  const reservasHistorialBase = useMemo(
    () =>
      combinarReservasEmpleado(
        consultaAgendaMesAnterior.data,
        consultaAgendaMes.data,
        consultaAgendaMesSiguiente.data,
      ),
    [consultaAgendaMes.data, consultaAgendaMesAnterior.data, consultaAgendaMesSiguiente.data],
  );

  const reservasHistorial = useMemo(
    () =>
      obtenerReservasHistorialEmpleado({
        reservas: reservasHistorialBase,
        modo: modoHistorial,
        fechaBase: fechaSeleccionada,
        fechaActual: fechaHoy,
        fechaAltaEmpleado,
      }),
    [fechaAltaEmpleado, fechaHoy, fechaSeleccionada, modoHistorial, reservasHistorialBase],
  );

  const reservasMetricaBase = useMemo(
    () =>
      combinarReservasEmpleado(
        consultaAgendaMesMetricaAnterior.data,
        consultaAgendaMesMetrica.data,
        consultaAgendaMesMetricaSiguiente.data,
      ),
    [
      consultaAgendaMesMetrica.data,
      consultaAgendaMesMetricaAnterior.data,
      consultaAgendaMesMetricaSiguiente.data,
    ],
  );

  const reservasMetrica = useMemo(
    () =>
      modalMetricaActiva
        ? obtenerReservasPeriodoEmpleado({
            reservas: reservasMetricaBase,
            periodo: modalMetricaActiva,
            fechaReferencia: fechaHoy,
            fechaAltaEmpleado,
          })
        : [],
    [fechaAltaEmpleado, fechaHoy, modalMetricaActiva, reservasMetricaBase],
  );

  const fechasMarcadas = useMemo(
    () =>
      Array.from(
        new Set(
          (consultaAgendaMes.data ?? [])
            .filter((reserva) => normalizarFechaReservaAgenda(reserva.fecha) >= fechaMinimaAgenda)
            .filter((reserva) => reserva.estado !== 'cancelled')
            .map((reserva) => normalizarFechaReservaAgenda(reserva.fecha)),
        ),
      ),
    [consultaAgendaMes.data, fechaMinimaAgenda],
  );

  const reservasResumenDiaSeleccionado = useMemo(() => {
    const fuente =
      fechaSeleccionada < fechaHoy
        ? reservasHistorialBase
        : filtrarReservasDesdeAlta(consultaAgenda.data ?? [], fechaAltaEmpleado);

    return [...fuente]
      .filter((reserva) => normalizarFechaReservaAgenda(reserva.fecha) === fechaSeleccionada)
      .sort((a, b) => a.horaInicio.localeCompare(b.horaInicio));
  }, [consultaAgenda.data, fechaAltaEmpleado, fechaHoy, fechaSeleccionada, reservasHistorialBase]);

  const resumenDiaSeleccionado = useMemo(() => {
    if (reservasResumenDiaSeleccionado.length === 0) {
      return null;
    }

    const primeraReserva = reservasResumenDiaSeleccionado[0];
    const ultimaReserva = reservasResumenDiaSeleccionado[reservasResumenDiaSeleccionado.length - 1];

    return {
      cantidad: reservasResumenDiaSeleccionado.length,
      horaInicio: primeraReserva?.horaInicio ?? '—',
      horaFin: ultimaReserva
        ? calcularHoraFin(ultimaReserva.horaInicio, ultimaReserva.duracion)
        : '—',
      total: reservasResumenDiaSeleccionado.reduce(
        (acumulado, reserva) => acumulado + reserva.precioTotal,
        0,
      ),
      estados: Array.from(
        new Set(
          reservasResumenDiaSeleccionado.map((reserva) => badgePorEstado(reserva.estado).etiqueta),
        ),
      ),
      servicios: Array.from(
        new Set(
          reservasResumenDiaSeleccionado.flatMap((reserva) =>
            (reserva.serviciosDetalle ?? reserva.servicios).map((servicio) => servicio.name),
          ),
        ),
      ).slice(0, 3),
      citas: reservasResumenDiaSeleccionado.slice(0, 3),
    };
  }, [reservasResumenDiaSeleccionado]);

  const reservasSeccionBase = vistaActiva === 'historial' ? reservasHistorial : reservasAgendaBase;

  const serviciosDisponiblesSeccion = useMemo(
    () =>
      Array.from(
        new Set(
          reservasSeccionBase.flatMap((reserva) =>
            (reserva.serviciosDetalle ?? reserva.servicios).map((servicio) => servicio.name),
          ),
        ),
      ).sort((a, b) => a.localeCompare(b, 'es')),
    [reservasSeccionBase],
  );

  const terminoBusqueda = busquedaReservas.trim().toLowerCase();

  const reservasSeccion = useMemo(
    () =>
      [...reservasSeccionBase]
        .filter((reserva) => {
          if (filtroEstadoReservas !== 'todos' && reserva.estado !== filtroEstadoReservas) {
            return false;
          }

          if (
            filtroServicioReservas !== 'todos' &&
            !(reserva.serviciosDetalle ?? reserva.servicios)
              .map((servicio) => servicio.name)
              .includes(filtroServicioReservas)
          ) {
            return false;
          }

          if (!terminoBusqueda) {
            return true;
          }

          return [
            reserva.nombreCliente,
            reserva.telefonoCliente,
            reserva.fecha,
            reserva.horaInicio,
            (reserva.serviciosDetalle ?? reserva.servicios)
              .map((servicio) => servicio.name)
              .join(' '),
          ]
            .join(' ')
            .toLowerCase()
            .includes(terminoBusqueda);
        })
        .sort((a, b) =>
          ordenReservas === 'tempranas'
            ? a.fecha.localeCompare(b.fecha) || a.horaInicio.localeCompare(b.horaInicio)
            : b.fecha.localeCompare(a.fecha) || b.horaInicio.localeCompare(a.horaInicio),
        ),
    [
      filtroEstadoReservas,
      filtroServicioReservas,
      ordenReservas,
      reservasSeccionBase,
      terminoBusqueda,
    ],
  );

  const totalPaginas = Math.max(1, Math.ceil(reservasSeccion.length / LIMITE_RESERVAS_POR_PAGINA));
  const paginaActual = vistaActiva === 'historial' ? paginaHistorial : paginaReservas;
  const indiceInicio =
    reservasSeccion.length === 0 ? 0 : (paginaActual - 1) * LIMITE_RESERVAS_POR_PAGINA + 1;
  const indiceFin = Math.min(paginaActual * LIMITE_RESERVAS_POR_PAGINA, reservasSeccion.length);
  const reservasPaginadas = reservasSeccion.slice(
    (paginaActual - 1) * LIMITE_RESERVAS_POR_PAGINA,
    paginaActual * LIMITE_RESERVAS_POR_PAGINA,
  );
  const reservaEnProceso = reservasAgendaBase.find((reserva) => reserva.estado === 'working');
  const cargandoHistorial =
    consultaAgendaMes.isLoading ||
    consultaAgendaMesAnterior.isLoading ||
    consultaAgendaMesSiguiente.isLoading;
  const errorHistorial =
    consultaAgendaMes.isError ||
    consultaAgendaMesAnterior.isError ||
    consultaAgendaMesSiguiente.isError;
  const cargandoVista = vistaActiva === 'historial' ? cargandoHistorial : consultaAgenda.isLoading;
  const errorVista = vistaActiva === 'historial' ? errorHistorial : consultaAgenda.isError;

  const copiarLink = () => {
    if (!linkReservas) return;
    navigator.clipboard
      .writeText(linkReservas)
      .then(() => mostrarToast({ mensaje: 'Enlace copiado al portapapeles', variante: 'exito' }));
  };

  const copiarClaveSalon = () => {
    if (!claveSalon) return;
    navigator.clipboard
      .writeText(claveSalon)
      .then(() => mostrarToast({ mensaje: 'Clave del salón copiada', variante: 'exito' }));
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

  const descargarQr = () => {
    if (!qrReserva || !perfil?.estudio?.nombre) return;
    const enlace = document.createElement('a');
    enlace.href = qrReserva;
    enlace.download = `${perfil.estudio.nombre.replace(/\s+/g, '_').toUpperCase()}_${fechaHoy}.png`;
    enlace.click();
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
                Revisa tu agenda activa, consulta historial por día, semana o mes, crea citas
                manuales cuando el salón lo permita y mantén el flujo operativo con estados claros.
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
              <div className="mt-3 space-y-2 text-xs font-bold uppercase tracking-wide text-pink-100">
                <p>
                  {reservaEnProceso
                    ? 'Tienes un servicio en proceso'
                    : 'Sin servicio en proceso ahora'}
                </p>
                <p>Historial visible desde {formatearFechaHumana(fechaMinimaAgenda)}</p>
                <p>Comisión base configurada: {comisionBaseEmpleado}%</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-t border-white/10 bg-slate-950/30 p-4 md:grid-cols-3 md:p-6">
            <TarjetaIndicadorMetricaEmpleado
              etiqueta="Hoy"
              valor={metricas?.citasHoy ?? 0}
              descripcion={`Comisión estimada: ${comisionHoyFormateada}. Abre el detalle del día con tabla, filtros y ordenación útil para operar mejor.`}
              icono={CalendarDays}
              onClick={() => setModalMetricaActiva('hoy')}
            />
            <TarjetaIndicadorMetricaEmpleado
              etiqueta="Semana"
              valor={metricas?.citasSemana ?? 0}
              descripcion={`Comisión estimada: ${comisionSemanaFormateada}. Consulta tu semana con cliente, servicio, valor y estado.`}
              icono={CalendarRange}
              onClick={() => setModalMetricaActiva('semana')}
            />
            <TarjetaIndicadorMetricaEmpleado
              etiqueta="Mes"
              valor={metricas?.citasMes ?? 0}
              descripcion={`Comisión estimada: ${comisionMesFormateada}. Revisa tu volumen mensual y ordénalo dentro del modal.`}
              icono={CalendarCheck}
              onClick={() => setModalMetricaActiva('mes')}
            />
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
          <div className="space-y-6 xl:min-w-0">
            <section>
              {estudioCalendario ? (
                <CalendarioEstadoSalon
                  estudio={estudioCalendario}
                  fechaSeleccionada={fechaCalendario}
                  alCambiarFecha={(fecha) =>
                    setFechaSeleccionada(
                      limitarFechaSeleccionEmpleado(obtenerFechaIsoLocal(fecha), fechaMinimaAgenda),
                    )
                  }
                  fechasConCitas={fechasMarcadas}
                  mostrarCitas
                  etiquetaCitas="Mis citas"
                  titulo="Calendario de citas"
                  variante="compacta"
                />
              ) : (
                <div
                  className="h-80 animate-pulse rounded-[3rem] bg-white shadow-sm"
                  aria-busy="true"
                />
              )}
            </section>

            <section className="space-y-4 rounded-[2.5rem] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-pink-600">
                      Agenda operativa del empleado
                    </p>
                    <h2 className="mt-2 text-2xl font-black capitalize text-slate-900">
                      {formatearFechaCabecera(fechaSeleccionada)}
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">
                      {reservasSeccion.length > 0
                        ? `Mostrando ${indiceInicio}-${indiceFin} de ${reservasSeccion.length} cita(s).`
                        : vistaActiva === 'historial'
                          ? 'No hay historial visible para este corte.'
                          : 'Cuando entren reservas activas aparecerán aquí.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex rounded-2xl border border-slate-200 bg-slate-50 p-1">
                      <button
                        type="button"
                        onClick={() => setVistaActiva('agenda')}
                        disabled={fechaEsPasada}
                        className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                          vistaActiva === 'agenda'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        } disabled:cursor-not-allowed disabled:opacity-40`}
                      >
                        Agenda del día
                      </button>
                      <button
                        type="button"
                        onClick={() => setVistaActiva('historial')}
                        className={`rounded-xl px-3 py-2 text-xs font-black transition ${
                          vistaActiva === 'historial'
                            ? 'bg-white text-slate-900 shadow-sm'
                            : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Historial
                      </button>
                    </div>

                    {!fechaEsPasada && estudioCalendario && (
                      <button
                        type="button"
                        onClick={() => setMostrarModalCrearCita(true)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-pink-600 px-4 py-2 text-xs font-black text-white transition hover:bg-pink-700"
                      >
                        <CalendarPlus className="h-4 w-4" aria-hidden="true" />
                        Crear cita manual
                      </button>
                    )}
                  </div>
                </div>

                {vistaActiva === 'historial' && (
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { valor: 'dia', etiqueta: 'Historial diario' },
                        { valor: 'semana', etiqueta: 'Historial semanal' },
                        { valor: 'mes', etiqueta: 'Historial mensual' },
                      ] as const
                    ).map((opcion) => (
                      <button
                        key={opcion.valor}
                        type="button"
                        onClick={() => setModoHistorial(opcion.valor)}
                        className={`rounded-2xl px-3 py-2 text-xs font-black transition ${
                          modoHistorial === opcion.valor
                            ? 'bg-slate-900 text-white'
                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                        }`}
                      >
                        {opcion.etiqueta}
                      </button>
                    ))}
                  </div>
                )}

                <div className="grid gap-3 lg:grid-cols-[220px_220px_180px]">
                  <select
                    value={filtroEstadoReservas}
                    onChange={(evento) =>
                      setFiltroEstadoReservas(
                        evento.target.value as 'todos' | ReservaEmpleado['estado'],
                      )
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
                  >
                    <option value="todos">Todos los estados</option>
                    <option value="confirmed">Confirmadas</option>
                    <option value="working">En proceso</option>
                    <option value="completed">Finalizadas</option>
                    <option value="cancelled">Canceladas</option>
                    <option value="no_show">No asistió</option>
                  </select>

                  <select
                    value={filtroServicioReservas}
                    onChange={(evento) => setFiltroServicioReservas(evento.target.value)}
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
                  >
                    <option value="todos">Todos los servicios</option>
                    {serviciosDisponiblesSeccion.map((servicio) => (
                      <option key={servicio} value={servicio}>
                        {servicio}
                      </option>
                    ))}
                  </select>

                  <select
                    value={ordenReservas}
                    onChange={(evento) =>
                      setOrdenReservas(evento.target.value as 'tempranas' | 'tardias')
                    }
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
                  >
                    <option value="tempranas">Orden: ascendente</option>
                    <option value="tardias">Orden: descendente</option>
                  </select>
                </div>

                <label className="relative block">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={busquedaReservas}
                    onChange={(evento) => setBusquedaReservas(evento.target.value)}
                    placeholder="Buscar por cliente, teléfono o servicio"
                    className="w-full rounded-2xl border border-slate-200 py-3 pl-10 pr-4 text-sm font-medium text-slate-700 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
                  />
                </label>

                {vistaActiva === 'agenda' && consultaAgenda.isFetching && (
                  <span className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Actualizando...
                  </span>
                )}

                {vistaActiva === 'historial' && cargandoHistorial && (
                  <span className="text-xs font-black uppercase tracking-wide text-slate-400">
                    Actualizando historial...
                  </span>
                )}
              </div>

              {cargandoVista && (
                <div
                  className="space-y-3"
                  aria-busy="true"
                  aria-label="Cargando citas del empleado"
                >
                  {[...Array(3)].map((_, indice) => (
                    <div key={indice} className="h-36 animate-pulse rounded-4xl bg-slate-100" />
                  ))}
                </div>
              )}

              {errorVista && (
                <div className="rounded-4xl border border-rose-200 bg-rose-50 p-4 text-sm font-medium text-rose-700">
                  No se pudo cargar la información del empleado. Intenta nuevamente.
                </div>
              )}

              {!cargandoVista && !errorVista && reservasSeccion.length === 0 && (
                <div className="rounded-4xl border border-dashed border-slate-200 bg-slate-50 p-10 text-center">
                  <p className="text-lg font-black text-slate-800">
                    {vistaActiva === 'historial'
                      ? 'Sin historial para el corte seleccionado'
                      : 'Sin citas para este día'}
                  </p>
                  <p className="mt-2 text-sm text-slate-500">
                    {vistaActiva === 'historial'
                      ? 'Cambia entre día, semana o mes para revisar otros agendamientos previos dentro de tu rango permitido.'
                      : 'Selecciona otra fecha o crea una cita manual si estás atendiendo una reserva directa del cliente.'}
                  </p>
                </div>
              )}

              {!cargandoVista && !errorVista && reservasSeccion.length > 0 && (
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
                          mostrarDetalleCompleto={vistaActiva === 'historial'}
                          actualizando={actualizando}
                          onAbrirDetalle={setDetalleReserva}
                          onAbrirExtra={setModalAdicional}
                          onActualizarEstado={(id, estado) => mutacionEstado.mutate({ id, estado })}
                        />
                      );
                    })}
                  </div>

                  <PaginadorLista
                    paginaActual={paginaActual}
                    totalPaginas={totalPaginas}
                    onCambiar={vistaActiva === 'historial' ? setPaginaHistorial : setPaginaReservas}
                  />
                </>
              )}
            </section>
          </div>

          <aside className="space-y-4">
            {linkReservas && (
              <div className="rounded-4xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="mb-3 flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-pink-500" aria-hidden="true" />
                  <h2 className="text-sm font-black uppercase tracking-wide text-slate-700">
                    Link de reservas del salón
                  </h2>
                </div>
                <p className="mb-3 text-xs text-slate-500">
                  Usa el mismo acceso operativo del salón con acciones rápidas y QR listo para
                  compartir al cliente.
                </p>
                {claveSalon && (
                  <div className="mb-3 rounded-3xl border border-emerald-200 bg-emerald-50 px-4 py-3">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-700">
                          Clave pública verificada
                        </p>
                        <p className="mt-2 font-mono text-sm font-black text-emerald-900">
                          {claveSalon}
                        </p>
                        <p className="mt-2 text-xs text-emerald-800">
                          Comparte esta clave con el cliente si necesita entrar manualmente al flujo
                          de reserva.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={copiarClaveSalon}
                        className="inline-flex items-center gap-2 rounded-2xl border border-emerald-200 bg-white px-3 py-2 text-xs font-black text-emerald-700 transition hover:bg-emerald-100"
                      >
                        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                        Copiar clave
                      </button>
                    </div>
                  </div>
                )}
                <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-mono text-slate-600">
                  {linkReservas}
                </div>
                {qrReserva && (
                  <div className="mt-3 flex flex-col gap-3 rounded-3xl border border-slate-100 bg-slate-50 p-3 sm:flex-row sm:items-center">
                    <img
                      src={qrReserva}
                      alt="QR del enlace de reservas del salón"
                      className="h-20 w-20 rounded-2xl bg-white p-2"
                    />
                    <p className="text-xs font-medium text-slate-500">
                      Escanéalo o descárgalo para enviarlo rápido desde mostrador, chat o WhatsApp.
                    </p>
                  </div>
                )}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <BotonIconoAccion
                    descripcion="Copiar enlace de reservas"
                    icono={<Copy className="h-4 w-4" aria-hidden="true" />}
                    onClick={copiarLink}
                  />
                  <BotonIconoAccion
                    descripcion="Abrir link de reservas"
                    icono={<ExternalLink className="h-4 w-4" aria-hidden="true" />}
                    onClick={abrirLinkReservas}
                  />
                  <BotonIconoAccion
                    descripcion="Enviar link por WhatsApp"
                    icono={<MessageCircle className="h-4 w-4" aria-hidden="true" />}
                    onClick={compartirWhatsApp}
                    tono="exito"
                  />
                  <BotonIconoAccion
                    descripcion="Descargar código QR"
                    icono={<Download className="h-4 w-4" aria-hidden="true" />}
                    onClick={descargarQr}
                    disabled={!qrReserva}
                    className="bg-slate-900 text-white hover:border-slate-900 hover:bg-black hover:text-white"
                  />
                  <p className="min-w-full text-[11px] font-medium text-slate-500 sm:min-w-0 sm:flex-1">
                    Toca o enfoca cada icono para ver la acción antes de ejecutarla.
                  </p>
                </div>
              </div>
            )}

            <div className="rounded-4xl border border-slate-200 bg-white p-5 shadow-sm">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                  Día seleccionado
                </p>
                <h2 className="mt-2 text-xl font-black capitalize text-slate-900">
                  {formatearFechaCabecera(fechaSeleccionada)}
                </h2>
              </div>

              <div className="mt-4 rounded-3xl bg-slate-50 p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Vista activa
                </p>
                <p className="mt-2 text-sm font-black text-slate-900">
                  {vistaActiva === 'historial'
                    ? 'Historial diario, semanal o mensual'
                    : 'Agenda compacta, operativa y accionable'}
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  {fechaSeleccionada === fechaMinimaAgenda
                    ? `Tu perfil empezó a operar desde ${formatearFechaHumana(fechaMinimaAgenda)}.`
                    : 'Muévete en el calendario y revisa solo las citas que te pertenecen.'}
                </p>
              </div>

              <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  Resumen del día
                </p>
                {resumenDiaSeleccionado ? (
                  <div className="mt-3 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <MetaDatoEmpleado
                        etiqueta="Citas"
                        valor={`${resumenDiaSeleccionado.cantidad} agendada(s)`}
                      />
                      <MetaDatoEmpleado
                        etiqueta="Ventana"
                        valor={`${resumenDiaSeleccionado.horaInicio} - ${resumenDiaSeleccionado.horaFin}`}
                      />
                      <MetaDatoEmpleado
                        etiqueta="Total estimado"
                        valor={formatearMontoSinDecimales(resumenDiaSeleccionado.total, moneda)}
                        acento
                      />
                      <MetaDatoEmpleado
                        etiqueta="Estados"
                        valor={resumenDiaSeleccionado.estados.join(', ')}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {resumenDiaSeleccionado.servicios.map((servicio) => (
                        <span
                          key={`${fechaSeleccionada}-${servicio}`}
                          className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-700"
                        >
                          <Scissors className="h-3 w-3 text-pink-500" aria-hidden="true" />
                          {servicio}
                        </span>
                      ))}
                    </div>

                    <div className="space-y-2">
                      {resumenDiaSeleccionado.citas.map((reserva) => (
                        <div
                          key={`${reserva.id}-resumen-dia`}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2"
                        >
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-slate-900">
                              {reserva.nombreCliente}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {(reserva.serviciosDetalle ?? reserva.servicios)
                                .map((servicio) => servicio.name)
                                .join(' · ')}
                            </p>
                          </div>
                          <span className="shrink-0 text-xs font-black text-slate-600">
                            {reserva.horaInicio}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">
                    No tienes citas asignadas para esta fecha.
                  </p>
                )}
              </div>
            </div>

            <div className="rounded-4xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <History className="h-4 w-4 text-indigo-500" aria-hidden="true" />
                <h2 className="text-sm font-black uppercase tracking-wide text-slate-700">
                  Alertas del salón
                </h2>
              </div>
              <p className="text-sm text-slate-600">
                La campana superior te notificará nuevas citas asignadas, cambios de horario o
                cierre y actualizaciones relevantes de la operación.
              </p>
              <p className="mt-3 text-xs font-medium text-slate-500">
                Si necesitas modificar tus datos o credenciales, solicítalo al administrador del
                salón desde el canal interno definido por tu negocio.
              </p>
            </div>
          </aside>
        </div>
      </main>

      {perfil?.estudio?.estado === 'suspendido' && (
        <ModalSuspension
          nombreSalon={perfil.estudio.nombre}
          pais={perfil.estudio.pais ?? 'Mexico'}
          onSalir={manejarSalidaPorSuspension}
        />
      )}

      {detalleReserva && (
        <ModalDetalleReservaEmpleado
          reserva={detalleReserva}
          moneda={moneda}
          onCerrar={() => setDetalleReserva(null)}
        />
      )}

      {estudioCalendario && (
        <ModalCrearReservaManual
          abierto={mostrarModalCrearCita}
          estudio={estudioCalendario}
          fechaVista={fechaCalendario}
          onCerrar={() => setMostrarModalCrearCita(false)}
          onReservaCreada={async () => {
            await clienteConsulta.invalidateQueries({ queryKey: ['mi-agenda'] });
            await clienteConsulta.invalidateQueries({ queryKey: ['mi-agenda-mes'] });
            await clienteConsulta.invalidateQueries({ queryKey: ['mis-metricas'] });
          }}
        />
      )}

      <ModalMetricasEmpleado
        abierto={modalMetricaActiva !== null}
        onCerrar={() => setModalMetricaActiva(null)}
        periodo={modalMetricaActiva ?? 'hoy'}
        reservas={filtrarReservasDesdeAlta(reservasMetrica, fechaAltaEmpleado)}
        moneda={moneda}
      />

      {modalAdicional && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-modal-adicional-empleado"
          onClick={cerrarModalAdicional}
        >
          <div
            className="w-full max-w-xl rounded-4xl bg-white p-6 shadow-2xl"
            onClick={(evento) => evento.stopPropagation()}
          >
            <h3 id="titulo-modal-adicional-empleado" className="text-lg font-black text-slate-900">
              Agregar extra a la cita
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Selecciona un servicio o, si el salón tiene plan PRO, un producto activo del catálogo.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setTabAdicional('servicio')}
                className={`rounded-xl px-3 py-2 text-xs font-black uppercase transition ${
                  tabAdicional === 'servicio'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500'
                }`}
              >
                Servicio
              </button>
              <button
                type="button"
                disabled={perfil?.estudio.plan !== 'PRO'}
                onClick={() => setTabAdicional('producto')}
                className={`rounded-xl px-3 py-2 text-xs font-black uppercase transition ${
                  tabAdicional === 'producto'
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500'
                } disabled:cursor-not-allowed disabled:opacity-50`}
              >
                Producto {perfil?.estudio.plan !== 'PRO' ? '· PRO' : ''}
              </button>
            </div>

            {tabAdicional === 'servicio' ? (
              catalogoServicios.length === 0 ? (
                <p className="mt-4 text-sm text-slate-500">
                  No hay servicios disponibles en el catálogo.
                </p>
              ) : (
                <div className="mt-4 max-h-64 space-y-2 overflow-y-auto">
                  {catalogoServicios.map((servicio, indiceServicio) => {
                    const seleccionado = servicioAdicionalSeleccionado === servicio.name;
                    return (
                      <button
                        key={`${servicio.name}-${indiceServicio}`}
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
              )
            ) : perfil?.estudio.plan !== 'PRO' ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Los productos adicionales en agenda se habilitan solo para salones con plan PRO.
              </div>
            ) : consultaProductos.isLoading ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                Cargando productos del salón...
              </div>
            ) : productosCatalogo.length === 0 ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                No hay productos activos para agregar.
              </div>
            ) : (
              <div className="mt-4 space-y-3">
                <div className="max-h-56 space-y-2 overflow-y-auto">
                  {productosCatalogo.map((producto) => {
                    const seleccionado = productoAdicionalSeleccionado === producto.id;
                    return (
                      <button
                        key={producto.id}
                        type="button"
                        onClick={() => setProductoAdicionalSeleccionado(producto.id)}
                        className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                          seleccionado
                            ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-emerald-200'
                        }`}
                      >
                        <div>
                          <p className="text-sm font-black">{producto.nombre}</p>
                          <p className="text-xs text-slate-500">{producto.categoria}</p>
                        </div>
                        <span className="text-sm font-black">
                          {formatearMontoSinDecimales(producto.precio, moneda)}
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
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:border-emerald-300 focus:ring-2 focus:ring-emerald-100"
                  />
                </label>
              </div>
            )}

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={cerrarModalAdicional}
                className="flex-1 rounded-2xl border border-slate-200 py-3 text-sm font-black text-slate-600 transition hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={
                  tabAdicional === 'servicio'
                    ? !servicioAdicionalSeleccionado || mutacionAdicional.isPending
                    : !productoAdicionalSeleccionado ||
                      mutacionProductoAdicional.isPending ||
                      perfil?.estudio.plan !== 'PRO'
                }
                onClick={() => {
                  if (!modalAdicional) return;

                  if (tabAdicional === 'servicio') {
                    const servicio = catalogoServicios.find(
                      (item) => item.name === servicioAdicionalSeleccionado,
                    );
                    if (!servicio) return;

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
                    return;
                  }

                  mutacionProductoAdicional.mutate({
                    reservaId: modalAdicional,
                    productoId: productoAdicionalSeleccionado,
                    cantidad: cantidadProductoAdicional,
                  });
                }}
                className="flex-1 rounded-2xl bg-pink-600 py-3 text-sm font-black text-white transition hover:bg-pink-700 disabled:opacity-50"
              >
                {tabAdicional === 'servicio'
                  ? mutacionAdicional.isPending
                    ? 'Agregando...'
                    : 'Agregar servicio'
                  : mutacionProductoAdicional.isPending
                    ? 'Agregando...'
                    : 'Agregar producto'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
