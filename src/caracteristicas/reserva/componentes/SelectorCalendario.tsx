import { ChevronLeft, ChevronRight } from 'lucide-react';
import { obtenerFechaLocalISO } from '../../../utils/formato';
import { DIAS_SEMANA } from '../../../lib/constantes';
import type { Estudio } from '../../../tipos';

interface PropsSelectorCalendario {
  estudio: Estudio;
  fechaSeleccionada: Date;
  totalDuracion: number;
  onCambiarFecha: (d: Date) => void;
}

export function SelectorCalendario({ estudio, fechaSeleccionada, totalDuracion, onCambiarFecha }: PropsSelectorCalendario) {
  const cambiarMes = (offset: number) => {
    const siguiente = new Date(fechaSeleccionada.getFullYear(), fechaSeleccionada.getMonth() + offset, 1);
    if (siguiente.getFullYear() <= 2030) onCambiarFecha(siguiente);
  };

  const primerDia = new Date(fechaSeleccionada.getFullYear(), fechaSeleccionada.getMonth(), 1).getDay();
  const diasEnMes = new Date(fechaSeleccionada.getFullYear(), fechaSeleccionada.getMonth() + 1, 0).getDate();
  const diasCalendario = Array.from({ length: 42 }, (_, i) => { const d = i - primerDia + 1; return d > 0 && d <= diasEnMes ? d : null; });
  const fechaSelStr = obtenerFechaLocalISO(fechaSeleccionada);
  const hoy = new Date(); hoy.setHours(0, 0, 0, 0);

  return (
    <div className="bg-white rounded-[3rem] border border-slate-200 shadow-lg overflow-hidden">
      <div className="bg-slate-50 p-8 md:p-10 border-b border-slate-100 text-center">
        <h3 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter text-slate-800 flex items-center justify-center gap-3">
          <span className="bg-pink-100 text-pink-600 w-8 h-8 rounded-full flex items-center justify-center text-sm">3</span>
          Día y Hora
        </h3>
        <p className="text-[10px] font-black text-slate-500 uppercase mt-4 tracking-widest bg-white inline-block px-4 py-2 rounded-xl shadow-sm border border-slate-200">
          Duración Estimada: <span className="text-pink-600 text-sm">{totalDuracion} min</span>
        </p>
      </div>

      <div className="p-6 md:p-10">
        <div className="flex items-center justify-between mb-8">
          <button onClick={() => cambiarMes(-1)} aria-label="Mes anterior" className="p-3 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors"><ChevronLeft className="w-6 h-6 text-slate-600" /></button>
          <h4 className="font-black uppercase tracking-widest text-lg md:text-xl text-slate-800">{fechaSeleccionada.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}</h4>
          <button onClick={() => cambiarMes(1)} aria-label="Mes siguiente" className="p-3 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors"><ChevronRight className="w-6 h-6 text-slate-600" /></button>
        </div>

        <div className="grid grid-cols-7 gap-2 md:gap-3">
          {['DOM', 'LUN', 'MAR', 'MIE', 'JUE', 'VIE', 'SAB'].map((d, i) => (
            <div key={i} className="text-center text-[10px] md:text-xs font-black text-slate-400 uppercase tracking-widest mb-2">{d}</div>
          ))}
          {diasCalendario.map((dia, i) => {
            if (!dia) return <div key={i} />;
            const dateObj = new Date(fechaSeleccionada.getFullYear(), fechaSeleccionada.getMonth(), dia);
            const dateStr = obtenerFechaLocalISO(dateObj);
            const seleccionado = dateStr === fechaSelStr;
            const esFestivo = estudio.holidays?.includes(dateStr);
            const estaAbierto = !!estudio.schedule[DIAS_SEMANA[dateObj.getDay()]]?.isOpen;
            const esPasado = dateObj < hoy;
            const deshabilitado = esFestivo || !estaAbierto || esPasado;
            return (
              <div key={i} className="flex items-center justify-center">
                <button
                  disabled={deshabilitado}
                  onClick={() => onCambiarFecha(dateObj)}
                  aria-label={dateStr}
                  aria-pressed={seleccionado}
                  className={`w-full h-12 md:h-16 rounded-2xl font-black text-lg md:text-xl transition-all flex items-center justify-center border-2 ${deshabilitado ? 'opacity-30 cursor-not-allowed bg-slate-100 border-slate-200 text-slate-400' : seleccionado ? 'bg-slate-900 border-slate-900 text-white shadow-xl scale-110 z-10' : 'bg-white border-slate-100 text-slate-700 hover:border-pink-300 hover:text-pink-600'}`}
                >
                  {dia}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
