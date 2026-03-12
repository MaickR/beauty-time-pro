import { useState } from 'react';
import {
  Calendar,
  CheckSquare,
  XSquare,
  ListChecks,
  CheckCircle2,
  Phone,
  Users,
  Palette,
  Plus,
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

export function AgendaDiaria({
  estudio,
  reservas,
  fechaVista,
  onCrearCitaManual,
}: PropsAgendaDiaria) {
  const { recargar } = usarContextoApp();
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

  return (
    <section className="bg-white rounded-[3rem] border border-slate-200 shadow-sm h-full flex flex-col">
      <div className="p-6 md:p-8 border-b bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 rounded-t-[3rem]">
        <div>
          <h2 className="text-2xl font-black italic uppercase flex items-center gap-3">
            <Calendar className="text-pink-600" /> Agenda Diaria
          </h2>
          <p className="text-xs font-bold text-slate-500 mt-1">
            {fechaVista.toLocaleDateString('es-ES', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>
        <div className="flex items-center gap-3">
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
        </div>
      </div>

      <div className="flex-1 p-4 md:p-6 space-y-6 overflow-y-auto max-h-[800px]">
        {citasDelDia.map((b) => (
          <div
            key={b.id}
            className={`p-5 md:p-6 rounded-[2rem] border-2 shadow-sm flex flex-col md:flex-row items-start gap-6 relative transition-all ${b.status === 'completed' ? 'bg-green-50 border-green-200' : 'bg-white border-slate-100 hover:border-pink-300'}`}
          >
            <div className="absolute top-0 left-0 w-2 h-full bg-pink-500 rounded-l-[2rem]" />
            <div className="flex flex-col items-center justify-center shrink-0 md:pr-6 md:border-r border-slate-200 w-full md:w-auto pb-4 md:pb-0 border-b md:border-b-0">
              <span
                className={`text-4xl font-black tracking-tighter ${b.status === 'completed' ? 'text-green-800' : 'text-slate-900'}`}
              >
                {b.time}
              </span>
              <span className="bg-white/50 text-slate-600 px-3 py-1 rounded-full text-[10px] font-black uppercase mt-2 border border-slate-200">
                {b.totalDuration} MIN
              </span>
            </div>
            <div className="flex-1 w-full">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                <div>
                  <h4
                    className={`text-xl md:text-2xl font-black uppercase leading-none ${b.status === 'completed' ? 'text-green-900' : 'text-slate-800'}`}
                  >
                    {b.clientName}
                  </h4>
                  <p className="text-sm font-mono text-slate-500 mt-2 font-bold flex items-center gap-2">
                    <Phone className="w-4 h-4 text-pink-500" /> {b.clientPhone}
                  </p>
                </div>
                <span className="text-[10px] bg-slate-900 text-white px-3 py-1.5 rounded-xl font-black uppercase inline-flex items-center gap-1 shrink-0">
                  <Users className="w-3 h-3" /> {b.staffName}
                </span>
              </div>
              <div className="mt-5 pt-4 border-t border-slate-200/50">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1">
                  <ListChecks className="w-3 h-3" /> Tratamientos a realizar:
                </p>
                <div className="flex flex-col gap-2">
                  {b.services.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm"
                    >
                      <span className="text-xs font-black uppercase text-slate-700 flex items-center gap-2">
                        <CheckCircle2
                          className={`w-4 h-4 ${b.status === 'completed' ? 'text-green-500' : 'text-pink-500'}`}
                        />{' '}
                        {s.name}
                      </span>
                      <div className="text-right">
                        <span className="text-xs font-black text-green-700 block">
                          {formatearDinero(s.price, moneda)}
                        </span>
                        <span className="opacity-50 text-[9px] font-bold">({s.duration}m)</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex justify-between items-center bg-slate-900 text-white p-4 rounded-xl">
                  <span className="text-[10px] font-black uppercase tracking-widest">
                    Total a Cobrar
                  </span>
                  <span className="text-lg font-black text-green-400">
                    {formatearDinero(b.totalPrice, moneda)}
                  </span>
                </div>
                {(b.colorBrand ?? b.colorNumber) && (
                  <div className="mt-3 bg-pink-50 border border-pink-100 p-3 rounded-xl">
                    <p className="text-[10px] font-black text-pink-700 uppercase flex items-center gap-1">
                      <Palette className="w-3 h-3" /> Info Tinte / Coloración:
                    </p>
                    <p className="text-xs font-bold text-pink-900 mt-1">
                      Marca: {b.colorBrand ?? 'N/D'} | Tono: {b.colorNumber ?? 'N/D'}
                    </p>
                  </div>
                )}
              </div>
            </div>
            <div className="absolute top-4 right-4 flex gap-2">
              {b.status !== 'completed' && (
                <button
                  onClick={() => setConfirmacion({ tipo: 'completar', reservaId: b.id })}
                  aria-label="Completar y cobrar"
                  className="p-3 bg-green-50 text-green-600 hover:text-white hover:bg-green-500 rounded-2xl transition-all shadow-sm"
                >
                  <CheckSquare className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => setConfirmacion({ tipo: 'cancelar', reservaId: b.id })}
                aria-label="Cancelar cita"
                className="p-3 bg-red-50 text-red-400 hover:text-white hover:bg-red-500 rounded-2xl transition-all shadow-sm"
              >
                <XSquare className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
        {citasDelDia.length === 0 && (
          <div className="text-center py-12 text-slate-400 font-bold italic">
            No hay citas en este día.
          </div>
        )}
      </div>

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
