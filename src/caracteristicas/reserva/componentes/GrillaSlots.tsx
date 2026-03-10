import { Clock, AlertTriangle, Coffee } from 'lucide-react';
import type { SlotTiempo } from '../../../tipos';

interface PropsGrillaSlots {
  slots: SlotTiempo[];
  horaSeleccionada: string;
  esFestivo: boolean;
  estaCerrado: boolean;
  nombreDia: string;
  totalDuracion: number;
  onSeleccionar: (hora: string) => void;
}

export function GrillaSlots({ slots, horaSeleccionada, esFestivo, estaCerrado, nombreDia, totalDuracion, onSeleccionar }: PropsGrillaSlots) {
  const slotsDisponibles = slots.filter((s) => s.status === 'AVAILABLE').length;

  if (esFestivo) {
    return (
      <div className="p-8 bg-red-50 border-t border-red-100 text-center">
        <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-3" />
        <p className="text-sm font-black text-red-800 uppercase tracking-widest">Día Festivo / Inhábil</p>
        <p className="text-xs text-red-600 mt-2">El Studio permanecerá cerrado este día.</p>
      </div>
    );
  }

  if (estaCerrado) {
    return (
      <div className="p-8 bg-slate-100 border-t border-slate-200 text-center">
        <Clock className="w-8 h-8 text-slate-400 mx-auto mb-3" />
        <p className="text-sm font-black text-slate-600 uppercase tracking-widest">Día de Descanso</p>
        <p className="text-xs text-slate-500 mt-2">El Studio no labora los días {nombreDia}.</p>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 bg-slate-50 border-t border-slate-100">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
        <h4 className="text-sm font-black uppercase text-slate-800 flex items-center gap-2 tracking-widest">
          <Clock className="w-5 h-5 text-pink-600" /> Horarios Disponibles
        </h4>
        <div className="flex flex-wrap items-center gap-2 text-[10px] font-black uppercase tracking-widest bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200">
          <span className="flex items-center gap-1 text-green-600"><div className="w-2 h-2 bg-green-500 rounded-full" /> Libre</span>
          <span className="flex items-center gap-1 text-red-500"><div className="w-2 h-2 bg-red-500 rounded-full" /> Ocupado</span>
          <span className="flex items-center gap-1 text-yellow-600 ml-2"><Coffee className="w-3 h-3" /> Comida</span>
        </div>
      </div>

      {slots.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 md:gap-4 max-h-80 overflow-y-auto pr-2">
          {slots.map((slot) => (
            <button
              key={slot.time}
              disabled={slot.status !== 'AVAILABLE'}
              onClick={() => onSeleccionar(slot.time)}
              className={`py-4 md:py-5 rounded-2xl font-black text-sm md:text-base transition-all border-2 shadow-sm flex justify-center items-center gap-2
                ${slot.status === 'AVAILABLE' ? (horaSeleccionada === slot.time ? 'bg-green-600 border-green-500 text-white scale-105 shadow-xl' : 'bg-white border-green-200 text-green-700 hover:bg-green-50 hover:border-green-400') : ''}
                ${slot.status === 'OCCUPIED' ? 'bg-red-50 border-red-200 text-red-400 cursor-not-allowed opacity-80 line-through' : ''}
                ${slot.status === 'BREAK_TIME' ? 'bg-yellow-50 border-yellow-200 text-yellow-600 cursor-not-allowed' : ''}
                ${slot.status === 'TOO_SHORT' ? 'bg-slate-50 border-slate-200 text-slate-300 cursor-not-allowed opacity-50' : ''}
              `}
            >
              {slot.status === 'AVAILABLE' && <span className="w-2 h-2 rounded-full bg-green-500" />}
              {slot.status === 'OCCUPIED' && <span className="w-2 h-2 rounded-full bg-red-500" />}
              {slot.status === 'BREAK_TIME' && <Coffee className="w-4 h-4" />}
              {slot.time}
            </button>
          ))}
        </div>
      ) : (
        <p className="text-center py-10 text-sm text-slate-500 font-bold uppercase tracking-widest bg-white rounded-3xl border border-slate-200">El especialista no trabaja en este horario.</p>
      )}

      {slots.length > 0 && slotsDisponibles === 0 && (
        <div className="mt-6 bg-red-50 border-2 border-red-200 p-5 rounded-2xl flex items-start gap-4">
          <AlertTriangle className="w-8 h-8 text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-black text-red-800 uppercase tracking-widest mb-1">Agenda Llena / Tiempo Insuficiente</p>
            <p className="text-xs text-red-700 font-bold leading-relaxed">
              El tiempo requerido ({totalDuracion} min) excede la disponibilidad actual. Por favor, selecciona otro día.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
