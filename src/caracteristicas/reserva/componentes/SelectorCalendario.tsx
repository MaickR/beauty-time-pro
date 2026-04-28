import { ChevronLeft, ChevronRight } from 'lucide-react';
import { obtenerFechaLocalISO } from '../../../utils/formato';
import type { Estudio } from '../../../tipos';
import { obtenerEstadoCalendarioAgenda } from '../../estudio/utils/estadoCalendarioAgenda';

interface PropsSelectorCalendario {
  estudio: Estudio;
  fechaSeleccionada: Date;
  totalDuracion: number;
  onCambiarFecha: (d: Date) => void;
  permitirPasado?: boolean;
  mostrarDuracion?: boolean;
  titulo?: string;
  indicadorPaso?: string;
  etiquetaDuracion?: string;
  fechasMarcadas?: string[];
  etiquetaMarcador?: string;
}

function formatearDuracion(minutos: number): string {
  if (minutos < 60) return `${minutos} min`;
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return m > 0 ? `${h}h ${m}min` : `${h}h`;
}

export function SelectorCalendario({
  estudio,
  fechaSeleccionada,
  totalDuracion,
  onCambiarFecha,
  permitirPasado = false,
  mostrarDuracion = true,
  titulo = 'Dia y especialista',
  indicadorPaso = '2',
  etiquetaDuracion = 'Duracion estimada',
  fechasMarcadas = [],
  etiquetaMarcador = 'Citas',
}: PropsSelectorCalendario) {
  const cambiarMes = (offset: number) => {
    const siguiente = new Date(
      fechaSeleccionada.getFullYear(),
      fechaSeleccionada.getMonth() + offset,
      1,
    );
    if (siguiente.getFullYear() <= 2030) onCambiarFecha(siguiente);
  };

  const primerDia = new Date(
    fechaSeleccionada.getFullYear(),
    fechaSeleccionada.getMonth(),
    1,
  ).getDay();
  const diasEnMes = new Date(
    fechaSeleccionada.getFullYear(),
    fechaSeleccionada.getMonth() + 1,
    0,
  ).getDate();
  const diasCalendario = Array.from({ length: 42 }, (_, i) => {
    const d = i - primerDia + 1;
    return d > 0 && d <= diasEnMes ? d : null;
  });
  const fechaSelStr = obtenerFechaLocalISO(fechaSeleccionada);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const fechasMarcadasSet = new Set(fechasMarcadas);

  return (
    <section className="mx-auto w-full max-w-xl overflow-hidden rounded-[2.5rem] border border-slate-200 bg-white shadow-lg">
      <div className="border-b border-slate-100 bg-slate-50 px-4 py-5 text-center md:px-8 md:py-7">
        <h3 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-slate-800 flex items-center justify-center gap-3">
          <span className="bg-pink-100 text-pink-600 w-8 h-8 rounded-full flex items-center justify-center text-sm">
            {indicadorPaso}
          </span>
          {titulo}
        </h3>
        {mostrarDuracion && (
          <p className="mt-3 inline-block rounded-xl border border-slate-200 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-500 shadow-sm">
            {etiquetaDuracion}:{' '}
            <span className="text-pink-600 text-sm">{formatearDuracion(totalDuracion)}</span>
          </p>
        )}
      </div>

      <div className="px-3 py-4 md:px-6 md:py-6">
        <div className="mb-5 flex flex-wrap items-center justify-center gap-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
          {fechasMarcadas.length > 0 && (
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-full bg-pink-500 inline-block" /> {etiquetaMarcador}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-pink-500 inline-block" /> Con disponibilidad
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-slate-300 inline-block" /> Sin disponibilidad
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-red-500 inline-block" /> Cierre
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Horario modificado
          </span>
        </div>

        <div className="mb-5 flex items-center justify-between gap-3 md:mb-6">
          <button
            onClick={() => cambiarMes(-1)}
            aria-label="Mes anterior"
            className="rounded-full bg-slate-50 p-2.5 transition-colors hover:bg-slate-100 md:p-3"
          >
            <ChevronLeft className="h-5 w-5 text-slate-600 md:h-6 md:w-6" />
          </button>
          <h4 className="text-center text-base font-black uppercase tracking-[0.16em] text-slate-800 md:text-xl">
            {fechaSeleccionada.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
          </h4>
          <button
            onClick={() => cambiarMes(1)}
            aria-label="Mes siguiente"
            className="rounded-full bg-slate-50 p-2.5 transition-colors hover:bg-slate-100 md:p-3"
          >
            <ChevronRight className="h-5 w-5 text-slate-600 md:h-6 md:w-6" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1.5 md:gap-2.5">
          {['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'].map((d, i) => (
            <div
              key={i}
              className="mb-1 text-center text-[10px] font-black uppercase tracking-widest text-slate-400 md:text-xs"
            >
              {d}
            </div>
          ))}
          {diasCalendario.map((dia, i) => {
            if (!dia) return <div key={i} />;
            const dateObj = new Date(
              fechaSeleccionada.getFullYear(),
              fechaSeleccionada.getMonth(),
              dia,
            );
            const dateStr = obtenerFechaLocalISO(dateObj);
            const seleccionado = dateStr === fechaSelStr;
            const estadoDia = obtenerEstadoCalendarioAgenda({ fecha: dateObj, estudio });
            const esPasado = dateObj < hoy;
            const esCierre = estadoDia.esCierre;
            const horarioModificado = estadoDia.tieneHorarioModificado;
            const deshabilitado = esCierre || (!permitirPasado && esPasado);
            const tieneMarcador = fechasMarcadasSet.has(dateStr);
            return (
              <div key={i} className="flex items-center justify-center">
                <button
                  disabled={deshabilitado}
                  onClick={() => onCambiarFecha(dateObj)}
                  aria-label={dateStr}
                  aria-pressed={seleccionado}
                  className={`flex aspect-square min-h-[3rem] w-full flex-col items-center justify-center rounded-2xl border-2 px-1 text-sm font-black transition-all md:min-h-[4.25rem] md:text-lg ${
                    deshabilitado
                      ? 'opacity-40 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400'
                      : seleccionado
                        ? 'z-10 scale-[1.03] bg-slate-900 border-slate-900 text-white shadow-xl'
                        : esPasado
                          ? 'bg-white border-slate-200 text-slate-500 hover:border-pink-300 hover:bg-pink-50'
                          : 'bg-pink-50 border-pink-200 text-pink-700 hover:border-pink-400 hover:bg-pink-100'
                  }`}
                >
                  <span>{dia}</span>
                  {!seleccionado && (tieneMarcador || esCierre || horarioModificado) && (
                    <span className="mt-1 flex items-center gap-1">
                      {tieneMarcador && <span className="h-1.5 w-1.5 rounded-full bg-pink-500" />}
                      {esCierre && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                      {horarioModificado && (
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      )}
                    </span>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
