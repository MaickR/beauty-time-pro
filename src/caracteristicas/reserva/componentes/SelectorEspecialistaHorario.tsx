import { useEffect, useState } from 'react';
import { Clock, RefreshCw, User } from 'lucide-react';
import { obtenerDisponibilidadCompleta } from '../../../servicios/servicioClienteApp';
import { URL_BASE } from '../../../lib/clienteHTTP';
import type { DisponibilidadEspecialista, Servicio } from '../../../tipos';

interface PropsSelectorEspecialistaHorario {
  salonId: string;
  sucursalSeleccionada: string;
  fecha: string;
  totalDuracion: number;
  serviciosSeleccionados: Servicio[];
  personalSeleccionado: string;
  horaSeleccionada: string;
  onSeleccionar: (personalId: string, hora: string) => void;
}

export function SelectorEspecialistaHorario({
  salonId,
  sucursalSeleccionada,
  fecha,
  totalDuracion,
  serviciosSeleccionados,
  personalSeleccionado,
  horaSeleccionada,
  onSeleccionar,
}: PropsSelectorEspecialistaHorario) {
  const [especialistas, setEspecialistas] = useState<DisponibilidadEspecialista[]>([]);
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!salonId || !fecha || totalDuracion <= 0 || serviciosSeleccionados.length === 0) {
      setEspecialistas([]);
      return;
    }

    let cancelado = false;
    setCargando(true);
    void obtenerDisponibilidadCompleta(salonId, fecha, totalDuracion, {
      sucursal: sucursalSeleccionada,
      servicios: serviciosSeleccionados.map((servicio) => servicio.name),
    })
      .then((lista) => {
        if (!cancelado) setEspecialistas(lista);
      })
      .catch(() => {
        if (!cancelado) setEspecialistas([]);
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });
    return () => {
      cancelado = true;
    };
  }, [fecha, salonId, serviciosSeleccionados, sucursalSeleccionada, totalDuracion]);

  if (cargando) {
    return (
      <div className="flex items-center justify-center py-10 gap-3 text-slate-400">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <span className="text-sm font-bold">Buscando disponibilidad…</span>
      </div>
    );
  }

  if (especialistas.length === 0) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-8 text-center">
        <Clock className="w-8 h-8 text-slate-400 mx-auto mb-3" />
        <p className="text-sm font-black text-slate-600 uppercase tracking-widest">
          Sin disponibilidad
        </p>
        <p className="text-xs text-slate-400 mt-2">
          Ningún especialista disponible cubre la duración total de los servicios elegidos en esta
          fecha.
        </p>
      </div>
    );
  }

  return (
    <section className="space-y-4" aria-labelledby="titulo-especialistas-disponibles">
      <div>
        <h3 id="titulo-especialistas-disponibles" className="text-lg font-black text-slate-900">
          Especialistas disponibles
        </h3>
        <p className="mt-1 text-sm text-slate-500">
          Se muestran solo horarios que respetan duración total, turnos, descansos y reservas
          activas.
        </p>
      </div>
      <div className="space-y-4">
        {especialistas.map((esp) => {
          const esteSeleccionado = esp.id === personalSeleccionado;
          return (
            <div
              key={esp.id}
              className={`rounded-2xl border-2 p-5 transition-all ${
                esteSeleccionado
                  ? 'border-pink-500 bg-pink-50'
                  : 'border-slate-200 bg-white hover:border-pink-200'
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                {esp.foto ? (
                  <img
                    src={`${URL_BASE}${esp.foto}`}
                    alt={esp.nombre}
                    className="w-12 h-12 rounded-full object-cover border-2 border-slate-200"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-slate-200 flex items-center justify-center">
                    <User className="w-6 h-6 text-slate-500" aria-hidden="true" />
                  </div>
                )}
                <div>
                  <p className="font-black text-slate-900 text-base">{esp.nombre}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {esp.especialidades.slice(0, 4).map((especialidad) => (
                      <span
                        key={especialidad}
                        className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg uppercase"
                      >
                        {especialidad}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {esp.slotsLibres.length === 0 ? (
                <p className="text-xs text-slate-400 italic font-bold">
                  Agenda llena para este día.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {esp.slotsLibres.map((hora) => {
                    const seleccionado = esteSeleccionado && hora === horaSeleccionada;
                    return (
                      <button
                        key={hora}
                        type="button"
                        onClick={() => onSeleccionar(esp.id, hora)}
                        aria-pressed={seleccionado}
                        className={`px-3 py-2 rounded-xl text-sm font-black border transition-all ${
                          seleccionado
                            ? 'bg-pink-600 border-pink-600 text-white shadow-lg scale-105'
                            : 'bg-white border-green-200 text-green-700 hover:border-green-400 hover:bg-green-50'
                        }`}
                      >
                        {hora}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
