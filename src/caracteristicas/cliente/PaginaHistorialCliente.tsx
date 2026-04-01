import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Calendar, Clock, User, ChevronDown, ChevronUp, X, Ban, RefreshCw } from 'lucide-react';
import {
  obtenerMiPerfil,
  cancelarMiReserva,
  reagendarMiReserva,
} from '../../servicios/servicioClienteApp';
import { NavegacionCliente } from '../../componentes/diseno/NavegacionCliente';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';
import { formatearDinero } from '../../utils/formato';
import type { ReservaCliente } from '../../tipos';

const ESTADOS_RESERVA: Record<string, { etiqueta: string; color: string }> = {
  pending: { etiqueta: 'Pending', color: 'bg-amber-100 text-amber-700' },
  confirmed: { etiqueta: 'Confirmed', color: 'bg-green-100 text-green-700' },
  completed: { etiqueta: 'Completed', color: 'bg-slate-100 text-slate-600' },
  cancelled: { etiqueta: 'Cancelled', color: 'bg-red-100 text-red-700' },
};

const REGISTROS_POR_PAGINA = 10;

function obtenerServiciosNombre(reserva: ReservaCliente): string {
  if (reserva.serviciosDetalle && reserva.serviciosDetalle.length > 0) {
    return reserva.serviciosDetalle.map((s) => s.name).join(', ');
  }
  if (reserva.servicios.length > 0) {
    return reserva.servicios.map((s) => s.name).join(', ');
  }
  return '—';
}

export function PaginaHistorialCliente() {
  usarTituloPagina('My Bookings — Beauty Time Pro');
  const [pagina, setPagina] = useState(1);
  const [filtroEstado, setFiltroEstado] = useState<string>('todos');
  const [expandidos, setExpandidos] = useState<Set<string>>(new Set());
  const [cancelarReserva, setCancelarReserva] = useState<ReservaCliente | null>(null);
  const [reagendarReserva, setReagendarReserva] = useState<ReservaCliente | null>(null);
  const [nuevaFecha, setNuevaFecha] = useState('');
  const [nuevaHora, setNuevaHora] = useState('');

  const clienteConsulta = useQueryClient();

  const { data: perfil, isLoading } = useQuery({
    queryKey: ['mi-perfil'],
    queryFn: obtenerMiPerfil,
    staleTime: 1000 * 60 * 2,
  });

  const moneda = (perfil?.pais === 'Colombia' ? 'COP' : 'MXN') as 'MXN' | 'COP';

  const reservas = perfil?.reservas ?? [];
  const reservasFiltradas =
    filtroEstado === 'todos' ? reservas : reservas.filter((r) => r.estado === filtroEstado);

  const totalPaginas = Math.max(1, Math.ceil(reservasFiltradas.length / REGISTROS_POR_PAGINA));
  const paginadas = reservasFiltradas.slice(
    (pagina - 1) * REGISTROS_POR_PAGINA,
    pagina * REGISTROS_POR_PAGINA,
  );

  const alternarExpandido = (id: string) => {
    setExpandidos((prev) => {
      const siguiente = new Set(prev);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });
  };

  const esCancelable = (r: ReservaCliente) => ['pending', 'confirmed'].includes(r.estado);

  const esReagendable = (r: ReservaCliente) =>
    ['pending', 'confirmed'].includes(r.estado) && !r.reagendada;

  const mutacionCancelar = useMutation({
    mutationFn: (id: string) => cancelarMiReserva(id),
    onSuccess: () => {
      clienteConsulta.invalidateQueries({ queryKey: ['mi-perfil'] });
      setCancelarReserva(null);
    },
  });

  const mutacionReagendar = useMutation({
    mutationFn: ({ id, fecha, horaInicio }: { id: string; fecha: string; horaInicio: string }) =>
      reagendarMiReserva(id, { fecha, horaInicio }),
    onSuccess: () => {
      clienteConsulta.invalidateQueries({ queryKey: ['mi-perfil'] });
      setReagendarReserva(null);
      setNuevaFecha('');
      setNuevaHora('');
    },
  });

  const hoyISO = new Date().toISOString().split('T')[0] ?? '';

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <NavegacionCliente />
        <div className="flex items-center justify-center py-32">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-pink-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-8">
      <NavegacionCliente />

      <main className="max-w-4xl mx-auto px-4 md:px-8 py-8">
        <h1 className="text-2xl font-black text-slate-900 mb-6">My Bookings</h1>

        {/* Filtros */}
        <div className="flex flex-wrap gap-2 mb-6">
          {[
            { valor: 'todos', etiqueta: 'All' },
            { valor: 'pending', etiqueta: 'Pending' },
            { valor: 'confirmed', etiqueta: 'Confirmed' },
            { valor: 'completed', etiqueta: 'Completed' },
            { valor: 'cancelled', etiqueta: 'Cancelled' },
          ].map(({ valor, etiqueta }) => (
            <button
              key={valor}
              onClick={() => {
                setFiltroEstado(valor);
                setPagina(1);
              }}
              className={`px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
                filtroEstado === valor
                  ? 'bg-pink-600 text-white'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
              }`}
            >
              {etiqueta}
            </button>
          ))}
        </div>

        {reservasFiltradas.length === 0 ? (
          <div className="text-center py-16">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-4" aria-hidden="true" />
            <p className="text-slate-500 font-medium">No bookings found</p>
          </div>
        ) : (
          <>
            {/* Tabla desktop */}
            <div className="hidden md:block bg-white rounded-2xl border border-slate-100 overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 text-left">
                    <th className="px-4 py-3 font-semibold text-slate-600">Date</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Time</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Salon</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Specialist</th>
                    <th className="px-4 py-3 font-semibold text-slate-600">Services</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-right">Total</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-center">Status</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {paginadas.map((r) => {
                    const estado = ESTADOS_RESERVA[r.estado] ?? ESTADOS_RESERVA.pending;
                    return (
                      <tr key={r.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-900">{r.fecha}</td>
                        <td className="px-4 py-3 text-slate-600">{r.horaInicio}</td>
                        <td className="px-4 py-3 text-slate-700">{r.salon?.nombre ?? '—'}</td>
                        <td className="px-4 py-3 text-slate-600">
                          {r.especialista?.nombre ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-slate-600 max-w-48 truncate">
                          {obtenerServiciosNombre(r)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">
                          {formatearDinero(r.precioTotal, moneda)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${estado.color}`}
                          >
                            {estado.etiqueta}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            {esCancelable(r) && (
                              <button
                                onClick={() => setCancelarReserva(r)}
                                className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition-colors"
                                aria-label="Cancel booking"
                                title="Cancel"
                              >
                                <Ban className="w-4 h-4" />
                              </button>
                            )}
                            {esReagendable(r) && (
                              <button
                                onClick={() => {
                                  setReagendarReserva(r);
                                  setNuevaFecha('');
                                  setNuevaHora('');
                                }}
                                className="p-1.5 rounded-lg text-blue-500 hover:bg-blue-50 transition-colors"
                                aria-label="Reschedule booking"
                                title="Reschedule"
                              >
                                <RefreshCw className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Tarjetas móvil */}
            <div className="md:hidden space-y-3">
              {paginadas.map((r) => {
                const estado = ESTADOS_RESERVA[r.estado] ?? ESTADOS_RESERVA.pending;
                const expandido = expandidos.has(r.id);
                return (
                  <article
                    key={r.id}
                    className="bg-white rounded-2xl border border-slate-100 overflow-hidden"
                  >
                    <button
                      onClick={() => alternarExpandido(r.id)}
                      className="w-full px-4 py-3 flex items-center justify-between text-left"
                      aria-expanded={expandido}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 text-sm">
                          {r.salon?.nombre ?? 'Salon'}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                          <Calendar className="w-3 h-3" aria-hidden="true" />
                          {r.fecha}
                          <Clock className="w-3 h-3 ml-1" aria-hidden="true" />
                          {r.horaInicio}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${estado.color}`}
                        >
                          {estado.etiqueta}
                        </span>
                        {expandido ? (
                          <ChevronUp className="w-4 h-4 text-slate-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>
                    </button>
                    {expandido && (
                      <div className="px-4 pb-4 pt-1 border-t border-slate-50 space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-slate-600">
                          <User className="w-3.5 h-3.5" aria-hidden="true" />
                          <span>{r.especialista?.nombre ?? '—'}</span>
                        </div>
                        <p className="text-slate-600">{obtenerServiciosNombre(r)}</p>
                        <p className="font-bold text-slate-900">
                          {formatearDinero(r.precioTotal, moneda)}
                        </p>
                        {(esCancelable(r) || esReagendable(r)) && (
                          <div className="flex gap-2 pt-1">
                            {esCancelable(r) && (
                              <button
                                onClick={() => setCancelarReserva(r)}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-red-600 bg-red-50 hover:bg-red-100 transition-colors"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                Cancel
                              </button>
                            )}
                            {esReagendable(r) && (
                              <button
                                onClick={() => {
                                  setReagendarReserva(r);
                                  setNuevaFecha('');
                                  setNuevaHora('');
                                }}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-colors"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                Reschedule
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            {/* Paginación */}
            {totalPaginas > 1 && (
              <div className="flex items-center justify-center gap-2 mt-6">
                <button
                  onClick={() => setPagina((p) => Math.max(1, p - 1))}
                  disabled={pagina === 1}
                  className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-500">
                  {pagina} / {totalPaginas}
                </span>
                <button
                  onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                  disabled={pagina === totalPaginas}
                  className="px-3 py-1.5 text-sm font-semibold rounded-lg bg-white border border-slate-200 disabled:opacity-40 hover:bg-slate-50 transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </main>

      {/* Modal cancelar */}
      {cancelarReserva && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-labelledby="titulo-cancelar"
          onClick={() => setCancelarReserva(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="titulo-cancelar" className="text-lg font-bold text-slate-900">
                Cancel Booking
              </h2>
              <button
                onClick={() => setCancelarReserva(null)}
                className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-2">
              Are you sure you want to cancel this booking?
            </p>
            <div className="text-sm text-slate-500 mb-4 space-y-1">
              <p>
                <strong>Salon:</strong> {cancelarReserva.salon?.nombre}
              </p>
              <p>
                <strong>Date:</strong> {cancelarReserva.fecha} at {cancelarReserva.horaInicio}
              </p>
            </div>
            {mutacionCancelar.isError && (
              <p className="text-sm text-red-600 mb-3">
                {(mutacionCancelar.error as Error)?.message ?? 'An error occurred.'}
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setCancelarReserva(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={() => mutacionCancelar.mutate(cancelarReserva.id)}
                disabled={mutacionCancelar.isPending}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
              >
                {mutacionCancelar.isPending ? 'Cancelling...' : 'Cancel Booking'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal reagendar */}
      {reagendarReserva && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-labelledby="titulo-reagendar"
          onClick={() => setReagendarReserva(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="titulo-reagendar" className="text-lg font-bold text-slate-900">
                Reschedule Booking
              </h2>
              <button
                onClick={() => setReagendarReserva(null)}
                className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Choose a new date and time. You can only reschedule once per booking.
            </p>
            <div className="space-y-3 mb-4">
              <div>
                <label
                  htmlFor="nueva-fecha"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  New Date
                </label>
                <input
                  id="nueva-fecha"
                  type="date"
                  min={hoyISO}
                  value={nuevaFecha}
                  onChange={(e) => setNuevaFecha(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>
              <div>
                <label
                  htmlFor="nueva-hora"
                  className="block text-sm font-medium text-slate-700 mb-1"
                >
                  New Time
                </label>
                <input
                  id="nueva-hora"
                  type="time"
                  value={nuevaHora}
                  onChange={(e) => setNuevaHora(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>
            </div>
            {mutacionReagendar.isError && (
              <p className="text-sm text-red-600 mb-3">
                {(mutacionReagendar.error as Error)?.message ?? 'An error occurred.'}
              </p>
            )}
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setReagendarReserva(null)}
                className="px-4 py-2 text-sm font-semibold text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
              >
                Go Back
              </button>
              <button
                onClick={() =>
                  reagendarReserva &&
                  mutacionReagendar.mutate({
                    id: reagendarReserva.id,
                    fecha: nuevaFecha,
                    horaInicio: nuevaHora,
                  })
                }
                disabled={!nuevaFecha || !nuevaHora || mutacionReagendar.isPending}
                className="px-4 py-2 text-sm font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {mutacionReagendar.isPending ? 'Rescheduling...' : 'Confirm Reschedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
