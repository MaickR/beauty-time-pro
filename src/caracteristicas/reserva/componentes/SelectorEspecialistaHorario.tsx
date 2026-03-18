import { useEffect, useState } from 'react';
import { Clock, User, RefreshCw } from 'lucide-react';
import { obtenerDisponibilidadCompleta } from '../../../servicios/servicioClienteApp';
import { URL_BASE } from '../../../lib/clienteHTTP';
import type { DisponibilidadEspecialista, Servicio } from '../../../tipos';

interface PropsSelectorEspecialistaHorario {
  salonId: string;
  fecha: string;
  totalDuracion: number;
  serviciosSeleccionados: Servicio[];
  personalSeleccionado: string;
  horaSeleccionada: string;
  onSeleccionar: (personalId: string, hora: string) => void;
}

export function SelectorEspecialistaHorario({
  salonId,
  fecha,
  totalDuracion,
  serviciosSeleccionados,
  personalSeleccionado,
  horaSeleccionada,
  onSeleccionar,
}: PropsSelectorEspecialistaHorario) {
  const [especialistas, setEspecialistas] = useState<DisponibilidadEspecialista[]>([]);
  const [cargando, setCargando] = useState(false);
  const [alternativo, setAlternativo] = useState<DisponibilidadEspecialista | null>(null);
  const [bannerDescartado, setBannerDescartado] = useState(false);

  useEffect(() => {
    if (!salonId || !fecha || totalDuracion <= 0) {
      setEspecialistas([]);
      return;
    }
    let cancelado = false;
    setCargando(true);
    void obtenerDisponibilidadCompleta(salonId, fecha, totalDuracion)
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
  }, [salonId, fecha, totalDuracion]);

  // Calcular alternativo cuando cambia la selección
  useEffect(() => {
    setAlternativo(null);
    setBannerDescartado(false);
    if (!personalSeleccionado || !horaSeleccionada || serviciosSeleccionados.length === 0) return;

    const nombresServicios = serviciosSeleccionados.map((s) => s.name.toLowerCase());
    const especialistaActual = especialistas.find((e) => e.id === personalSeleccionado);
    if (!especialistaActual) return;

    const alternativoEncontrado = especialistas.find((e) => {
      if (e.id === personalSeleccionado) return false;
      if (!e.slotsLibres.includes(horaSeleccionada)) return false;
      // Verificar que tenga al menos una especialidad común con los servicios seleccionados
      return e.especialidades.some((esp) =>
        nombresServicios.some(
          (nombre) => nombre.includes(esp.toLowerCase()) || esp.toLowerCase().includes(nombre),
        ),
      );
    });

    setAlternativo(alternativoEncontrado ?? null);
  }, [personalSeleccionado, horaSeleccionada, especialistas, serviciosSeleccionados]);

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
      <div className="bg-slate-50 border border-slate-200 rounded-3xl p-8 text-center">
        <Clock className="w-8 h-8 text-slate-400 mx-auto mb-3" />
        <p className="text-sm font-black text-slate-600 uppercase tracking-widest">
          Sin disponibilidad
        </p>
        <p className="text-xs text-slate-400 mt-2">
          Ningún especialista tiene horario disponible este día. Elige otra fecha.
        </p>
      </div>
    );
  }

  const especialistaSeleccionado = especialistas.find((e) => e.id === personalSeleccionado);

  return (
    <div className="space-y-4">
      {/* Banner de especialista alternativo */}
      {alternativo && !bannerDescartado && especialistaSeleccionado && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1 text-sm text-amber-800">
            <span className="font-black">¿Sabías que </span>
            <span className="font-black text-amber-900">{alternativo.nombre}</span>
            <span className="font-bold"> también está disponible a esta hora y hace </span>
            <span className="font-black">{alternativo.especialidades[0] ?? 'el servicio'}?</span>
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => {
                onSeleccionar(alternativo.id, horaSeleccionada);
                setBannerDescartado(true);
              }}
              className="px-4 py-2 bg-amber-600 text-white text-xs font-black rounded-xl hover:bg-amber-700 transition-colors"
            >
              Cambiar a {alternativo.nombre.split(' ')[0]}
            </button>
            <button
              type="button"
              onClick={() => setBannerDescartado(true)}
              className="px-4 py-2 bg-white border border-amber-200 text-amber-700 text-xs font-black rounded-xl hover:bg-amber-50 transition-colors"
            >
              Mantener mi selección
            </button>
          </div>
        </div>
      )}

      {/* Tarjetas de especialistas */}
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
              {/* Cabecera especialista */}
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
                    {esp.especialidades.slice(0, 4).map((e) => (
                      <span
                        key={e}
                        className="text-[9px] font-black bg-slate-100 text-slate-500 px-2 py-0.5 rounded-lg uppercase"
                      >
                        {e}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Slots disponibles */}
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
                        onClick={() => {
                          onSeleccionar(esp.id, hora);
                          setBannerDescartado(false);
                        }}
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
    </div>
  );
}
