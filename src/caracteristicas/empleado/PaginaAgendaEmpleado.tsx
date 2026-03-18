import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Phone, Clock, CheckCircle, AlertCircle } from 'lucide-react';
import { NavegacionEmpleado } from '../../componentes/diseno/NavegacionEmpleado';
import {
  obtenerMiAgenda,
  actualizarEstadoReservaEmpleado,
  obtenerMiPerfilEmpleado,
} from '../../servicios/servicioEmpleados';
import type { ReservaEmpleado } from '../../tipos';

const DIAS_SEMANA = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
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

function formatearFecha(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const fecha = new Date(y, m - 1, d);
  return `${DIAS_SEMANA[fecha.getDay()]} ${d} de ${MESES[m - 1]}`;
}

function calcularHoraFin(horaInicio: string, duracionMinutos: number): string {
  const [h, min] = horaInicio.split(':').map(Number);
  const totalMin = h * 60 + min + duracionMinutos;
  const hFin = Math.floor(totalMin / 60) % 24;
  const mFin = totalMin % 60;
  return `${String(hFin).padStart(2, '0')}:${String(mFin).padStart(2, '0')}`;
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

function hoy(): string {
  const ahora = new Date();
  const y = ahora.getFullYear();
  const m = String(ahora.getMonth() + 1).padStart(2, '0');
  const d = String(ahora.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function sumarDias(iso: string, dias: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const fecha = new Date(y, m - 1, d + dias);
  const yN = fecha.getFullYear();
  const mN = String(fecha.getMonth() + 1).padStart(2, '0');
  const dN = String(fecha.getDate()).padStart(2, '0');
  return `${yN}-${mN}-${dN}`;
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
        className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
      >
        <AlertCircle className="w-3 h-3" aria-hidden="true" />
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
        className="flex items-center gap-1 px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs font-bold rounded-lg transition-colors disabled:opacity-50"
      >
        <CheckCircle className="w-3 h-3" aria-hidden="true" />
        Completar
      </button>
    );
  }
  return null;
}

export function PaginaAgendaEmpleado() {
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string>(hoy);
  const clienteConsulta = useQueryClient();

  const consultaAgenda = useQuery({
    queryKey: ['mi-agenda', fechaSeleccionada],
    queryFn: () => obtenerMiAgenda(fechaSeleccionada),
    staleTime: 1000 * 60,
  });

  const consultaPerfil = useQuery({
    queryKey: ['mi-perfil-empleado'],
    queryFn: obtenerMiPerfilEmpleado,
    staleTime: 1000 * 60 * 5,
  });

  const mutacionEstado = useMutation({
    mutationFn: ({ id, estado }: { id: string; estado: 'confirmed' | 'completed' }) =>
      actualizarEstadoReservaEmpleado(id, estado),
    onSuccess: () => {
      void clienteConsulta.invalidateQueries({ queryKey: ['mi-agenda', fechaSeleccionada] });
    },
  });

  const retrocederDia = () => setFechaSeleccionada((f) => sumarDias(f, -1));
  const avanzarDia = () => setFechaSeleccionada((f) => sumarDias(f, 1));
  const irAHoy = () => setFechaSeleccionada(hoy());

  const esFechaHoy = fechaSeleccionada === hoy();
  const reservas = consultaAgenda.data ?? [];
  const perfil = consultaPerfil.data;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      <NavegacionEmpleado />

      <main className="max-w-3xl mx-auto px-4 py-6">
        {/* Navegación de fecha */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={retrocederDia}
            aria-label="Día anterior"
            className="p-2 rounded-xl hover:bg-white hover:shadow-sm transition-all text-slate-600"
          >
            <ChevronLeft className="w-5 h-5" aria-hidden="true" />
          </button>

          <div className="text-center">
            <h1 className="text-lg font-black text-slate-900 capitalize">
              {formatearFecha(fechaSeleccionada)}
            </h1>
            {!esFechaHoy && (
              <button
                onClick={irAHoy}
                className="text-xs text-pink-600 font-bold hover:underline mt-0.5"
              >
                Ir a hoy
              </button>
            )}
            {esFechaHoy && <p className="text-xs text-pink-600 font-bold mt-0.5">Hoy</p>}
          </div>

          <button
            onClick={avanzarDia}
            aria-label="Día siguiente"
            className="p-2 rounded-xl hover:bg-white hover:shadow-sm transition-all text-slate-600"
          >
            <ChevronRight className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Horario del día */}
        {perfil && (perfil.horaInicio || perfil.horaFin) && (
          <div className="bg-white rounded-2xl p-4 mb-4 shadow-sm border border-slate-100">
            <p className="text-xs font-black text-slate-500 uppercase tracking-wide mb-2">
              Mi horario
            </p>
            <div className="flex items-center gap-4 text-sm text-slate-700">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-pink-500" aria-hidden="true" />
                <span className="font-semibold">
                  {perfil.horaInicio ?? '—'} – {perfil.horaFin ?? '—'}
                </span>
              </div>
              {perfil.descansoInicio && perfil.descansoFin && (
                <span className="text-xs text-slate-400">
                  Descanso: {perfil.descansoInicio}–{perfil.descansoFin}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Lista de citas */}
        {consultaAgenda.isLoading && (
          <div className="space-y-3" aria-busy="true" aria-label="Cargando citas">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl p-4 shadow-sm animate-pulse h-24" />
            ))}
          </div>
        )}

        {consultaAgenda.isError && (
          <div className="bg-red-50 text-red-700 rounded-2xl p-4 text-sm font-medium text-center">
            No se pudo cargar la agenda. Intenta de nuevo.
          </div>
        )}

        {!consultaAgenda.isLoading && !consultaAgenda.isError && reservas.length === 0 && (
          <div className="bg-white rounded-2xl p-10 shadow-sm text-center">
            <p className="text-4xl mb-3">🌸</p>
            <p className="font-black text-slate-800 text-lg">Sin citas para este día</p>
            <p className="text-slate-500 text-sm mt-1">¡Disfruta tu tiempo libre!</p>
          </div>
        )}

        {!consultaAgenda.isLoading && reservas.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-black text-slate-500 uppercase tracking-wide">
              {reservas.length} {reservas.length === 1 ? 'cita' : 'citas'}
            </p>
            {reservas.map((reserva) => {
              const badge = badgePorEstado(reserva.estado);
              const horaFin = calcularHoraFin(reserva.horaInicio, reserva.duracion);
              const actualizando =
                mutacionEstado.isPending && mutacionEstado.variables?.id === reserva.id;
              const serviciosMostrados = reserva.serviciosDetalle ?? reserva.servicios;

              return (
                <div
                  key={reserva.id}
                  className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100"
                >
                  {/* Cabecera: hora + estado */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-slate-400" aria-hidden="true" />
                      <span className="font-black text-slate-900 text-sm">
                        {reserva.horaInicio} – {horaFin}
                      </span>
                    </div>
                    <span
                      className={`text-[10px] font-black px-2 py-1 rounded-full ${badge.clases}`}
                    >
                      {badge.etiqueta}
                    </span>
                  </div>

                  {/* Cliente */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <p className="font-bold text-slate-800 text-sm">{reserva.nombreCliente}</p>
                      <a
                        href={`tel:${reserva.telefonoCliente}`}
                        className="flex items-center gap-1 text-xs text-slate-500 hover:text-pink-600 transition-colors mt-0.5"
                      >
                        <Phone className="w-3 h-3" aria-hidden="true" />
                        {reserva.telefonoCliente}
                      </a>
                    </div>
                    <BotonCambioEstado
                      reserva={reserva}
                      onActualizar={(id, estado) => mutacionEstado.mutate({ id, estado })}
                      actualizando={actualizando}
                    />
                  </div>

                  {/* Servicios */}
                  <div className="flex flex-wrap gap-1">
                    {serviciosMostrados.map((s, i) => (
                      <span
                        key={i}
                        className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full"
                      >
                        {s.name}
                      </span>
                    ))}
                  </div>

                  {/* Precio */}
                  <p className="text-right text-xs font-black text-pink-600 mt-2">
                    ${reserva.precioTotal.toLocaleString('es-MX')}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
