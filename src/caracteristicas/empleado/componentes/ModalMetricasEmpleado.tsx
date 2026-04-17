import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Search, X } from 'lucide-react';
import type { Moneda, ReservaEmpleado } from '../../../tipos';
import { convertirCentavosAMoneda } from '../../../utils/formato';
import type { PeriodoMetricaEmpleado } from '../utils/panelEmpleado';

type DireccionOrden = 'asc' | 'desc';
type CampoOrden = 'fecha' | 'hora' | 'cliente' | 'servicio' | 'duracion' | 'precio' | 'estado';

interface PropsModalMetricasEmpleado {
  abierto: boolean;
  onCerrar: () => void;
  periodo: PeriodoMetricaEmpleado;
  reservas: ReservaEmpleado[];
  moneda: Moneda;
}

function obtenerTituloPeriodo(periodo: PeriodoMetricaEmpleado): string {
  switch (periodo) {
    case 'hoy':
      return 'Citas de hoy';
    case 'semana':
      return 'Citas de la semana';
    case 'mes':
      return 'Citas del mes';
  }
}

function formatearMonto(montoCentavos: number, moneda: Moneda): string {
  const locale = moneda === 'COP' ? 'es-CO' : 'es-MX';
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: moneda,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(convertirCentavosAMoneda(montoCentavos));
}

function obtenerEtiquetaEstado(estado: ReservaEmpleado['estado']): string {
  switch (estado) {
    case 'pending':
    case 'confirmed':
      return 'Confirmada';
    case 'working':
      return 'En proceso';
    case 'completed':
      return 'Finalizada';
    case 'cancelled':
      return 'Cancelada';
    case 'no_show':
      return 'No asistió';
  }
}

function obtenerClaseEstado(estado: ReservaEmpleado['estado']): string {
  switch (estado) {
    case 'pending':
    case 'confirmed':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'working':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'completed':
      return 'bg-slate-100 text-slate-700 border-slate-200';
    case 'cancelled':
      return 'bg-rose-50 text-rose-700 border-rose-200';
    case 'no_show':
      return 'bg-orange-50 text-orange-700 border-orange-200';
  }
}

function obtenerServiciosTexto(reserva: ReservaEmpleado): string {
  return (reserva.serviciosDetalle ?? reserva.servicios).map((servicio) => servicio.name).join(', ');
}

function BotonOrden({
  etiqueta,
  activo,
  direccion,
  onClick,
  alinearDerecha = false,
}: {
  etiqueta: string;
  activo: boolean;
  direccion: DireccionOrden;
  onClick: () => void;
  alinearDerecha?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 ${alinearDerecha ? 'justify-end w-full' : ''}`}
    >
      <span>{etiqueta}</span>
      {activo ? (
        direccion === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
      ) : (
        <span className="text-[11px]">↕</span>
      )}
    </button>
  );
}

export function ModalMetricasEmpleado({
  abierto,
  onCerrar,
  periodo,
  reservas,
  moneda,
}: PropsModalMetricasEmpleado) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | ReservaEmpleado['estado']>('todos');
  const [filtroServicio, setFiltroServicio] = useState('todos');
  const [campoOrden, setCampoOrden] = useState<CampoOrden>('fecha');
  const [direccionOrden, setDireccionOrden] = useState<DireccionOrden>('asc');
  const busquedaDiferida = useDeferredValue(busqueda);

  useEffect(() => {
    if (!abierto) {
      return;
    }

    setBusqueda('');
    setFiltroEstado('todos');
    setFiltroServicio('todos');
    setCampoOrden('fecha');
    setDireccionOrden('asc');
  }, [abierto, periodo]);

  const serviciosDisponibles = useMemo(
    () =>
      Array.from(
        new Set(
          reservas.flatMap((reserva) =>
            (reserva.serviciosDetalle ?? reserva.servicios).map((servicio) => servicio.name),
          ),
        ),
      ).sort((a, b) => a.localeCompare(b, 'es')),
    [reservas],
  );

  const reservasFiltradas = useMemo(() => {
    const termino = busquedaDiferida.trim().toLowerCase();

    return [...reservas]
      .filter((reserva) => {
        if (filtroEstado !== 'todos' && reserva.estado !== filtroEstado) {
          return false;
        }

        if (filtroServicio !== 'todos' && !obtenerServiciosTexto(reserva).includes(filtroServicio)) {
          return false;
        }

        if (!termino) {
          return true;
        }

        return [
          reserva.nombreCliente,
          reserva.telefonoCliente,
          obtenerServiciosTexto(reserva),
          reserva.horaInicio,
          reserva.fecha,
          obtenerEtiquetaEstado(reserva.estado),
        ]
          .join(' ')
          .toLowerCase()
          .includes(termino);
      })
      .sort((reservaA, reservaB) => {
        const factor = direccionOrden === 'asc' ? 1 : -1;

        switch (campoOrden) {
          case 'hora':
            return factor * reservaA.horaInicio.localeCompare(reservaB.horaInicio);
          case 'cliente':
            return factor * reservaA.nombreCliente.localeCompare(reservaB.nombreCliente, 'es');
          case 'servicio':
            return factor * obtenerServiciosTexto(reservaA).localeCompare(obtenerServiciosTexto(reservaB), 'es');
          case 'duracion':
            return factor * (reservaA.duracion - reservaB.duracion);
          case 'precio':
            return factor * (reservaA.precioTotal - reservaB.precioTotal);
          case 'estado':
            return factor * obtenerEtiquetaEstado(reservaA.estado).localeCompare(obtenerEtiquetaEstado(reservaB.estado), 'es');
          case 'fecha':
          default:
            return (
              factor * reservaA.fecha.localeCompare(reservaB.fecha) ||
              factor * reservaA.horaInicio.localeCompare(reservaB.horaInicio)
            );
        }
      });
  }, [busquedaDiferida, campoOrden, direccionOrden, filtroEstado, filtroServicio, reservas]);

  const totalEstimado = useMemo(
    () => reservasFiltradas.reduce((acumulado, reserva) => acumulado + reserva.precioTotal, 0),
    [reservasFiltradas],
  );

  const alternarOrden = (campo: CampoOrden) => {
    if (campoOrden === campo) {
      setDireccionOrden((actual) => (actual === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setCampoOrden(campo);
    setDireccionOrden(campo === 'fecha' ? 'desc' : 'asc');
  };

  if (!abierto) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-60 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-metricas-empleado"
      onClick={onCerrar}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-4xl bg-white shadow-2xl"
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 md:px-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-pink-600">
              Métrica dinámica
            </p>
            <h2 id="titulo-modal-metricas-empleado" className="mt-1 text-xl font-black text-slate-900 md:text-2xl">
              {obtenerTituloPeriodo(periodo)}
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              {reservasFiltradas.length} cita(s) visibles. Valor estimado {formatearMonto(totalEstimado, moneda)}.
            </p>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar métricas"
            className="rounded-2xl border border-slate-200 p-2 text-slate-500 transition hover:bg-slate-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="border-b border-slate-100 px-5 py-4 md:px-6">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_220px]">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="Buscar por cliente, teléfono o servicio"
                className="w-full rounded-2xl border border-slate-200 py-3 pl-10 pr-4 text-sm font-medium text-slate-800 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
              />
            </label>

            <select
              value={filtroEstado}
              onChange={(evento) => setFiltroEstado(evento.target.value as 'todos' | ReservaEmpleado['estado'])}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
            >
              <option value="todos">Todos los estados</option>
              <option value="confirmed">Confirmadas</option>
              <option value="working">En proceso</option>
              <option value="completed">Finalizadas</option>
              <option value="no_show">No asistió</option>
              <option value="cancelled">Canceladas</option>
            </select>

            <select
              value={filtroServicio}
              onChange={(evento) => setFiltroServicio(evento.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 outline-none transition focus:border-pink-300 focus:ring-2 focus:ring-pink-200"
            >
              <option value="todos">Todos los servicios</option>
              {serviciosDisponibles.map((servicio) => (
                <option key={servicio} value={servicio}>
                  {servicio}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex-1 overflow-auto px-5 py-4 md:px-6">
          <div className="overflow-x-auto">
            <table className="w-full min-w-215 text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  <th className="px-2 py-3">
                    <BotonOrden etiqueta="Fecha" activo={campoOrden === 'fecha'} direccion={direccionOrden} onClick={() => alternarOrden('fecha')} />
                  </th>
                  <th className="px-2 py-3">
                    <BotonOrden etiqueta="Hora" activo={campoOrden === 'hora'} direccion={direccionOrden} onClick={() => alternarOrden('hora')} />
                  </th>
                  <th className="px-2 py-3">
                    <BotonOrden etiqueta="Cliente" activo={campoOrden === 'cliente'} direccion={direccionOrden} onClick={() => alternarOrden('cliente')} />
                  </th>
                  <th className="px-2 py-3">
                    <BotonOrden etiqueta="Servicios" activo={campoOrden === 'servicio'} direccion={direccionOrden} onClick={() => alternarOrden('servicio')} />
                  </th>
                  <th className="px-2 py-3">
                    <BotonOrden etiqueta="Duración" activo={campoOrden === 'duracion'} direccion={direccionOrden} onClick={() => alternarOrden('duracion')} />
                  </th>
                  <th className="px-2 py-3 text-right">
                    <BotonOrden etiqueta="Valor" activo={campoOrden === 'precio'} direccion={direccionOrden} onClick={() => alternarOrden('precio')} alinearDerecha />
                  </th>
                  <th className="px-2 py-3">
                    <BotonOrden etiqueta="Estado" activo={campoOrden === 'estado'} direccion={direccionOrden} onClick={() => alternarOrden('estado')} />
                  </th>
                </tr>
              </thead>
              <tbody>
                {reservasFiltradas.map((reserva) => (
                  <tr key={reserva.id} className="border-b border-slate-100 align-top hover:bg-slate-50">
                    <td className="px-2 py-3 font-semibold text-slate-800">{reserva.fecha}</td>
                    <td className="px-2 py-3 font-semibold text-indigo-600">{reserva.horaInicio}</td>
                    <td className="px-2 py-3">
                      <p className="font-black text-slate-900">{reserva.nombreCliente}</p>
                      <p className="text-xs text-slate-500">{reserva.telefonoCliente}</p>
                    </td>
                    <td className="px-2 py-3 text-slate-700">{obtenerServiciosTexto(reserva)}</td>
                    <td className="px-2 py-3 text-slate-600">{reserva.duracion} min</td>
                    <td className="px-2 py-3 text-right font-black text-emerald-600">{formatearMonto(reserva.precioTotal, moneda)}</td>
                    <td className="px-2 py-3">
                      <span className={`inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${obtenerClaseEstado(reserva.estado)}`}>
                        {obtenerEtiquetaEstado(reserva.estado)}
                      </span>
                    </td>
                  </tr>
                ))}
                {reservasFiltradas.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-2 py-12 text-center text-sm font-bold text-slate-400">
                      No hay citas que coincidan con los filtros actuales.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}