import { useState } from 'react';
import { ListChecks, ChevronDown, ChevronUp } from 'lucide-react';
import { formatearDinero } from '../../../utils/formato';
import type { Reserva, Moneda } from '../../../tipos';

interface PropsProximasReservas {
  reservas: Reserva[];
  moneda: Moneda;
}

export function ProximasReservas({ reservas, moneda }: PropsProximasReservas) {
  const [expandida, setExpandida] = useState<string | null>(null);

  const proximas = [...reservas]
    .filter((b) => b.status !== 'cancelled')
    .sort((a, b) => new Date(`${a.date}T${a.time}`).getTime() - new Date(`${b.date}T${b.time}`).getTime());

  return (
    <section className="bg-slate-900 rounded-[3rem] p-6 md:p-8 text-white shadow-xl">
      <h3 className="text-lg font-black italic uppercase tracking-tighter mb-6 text-pink-400 flex items-center gap-2">
        <ListChecks className="w-5 h-5" /> Próximas Reservaciones Generales
      </h3>

      <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
        {proximas.map((b) => (
          <div
            key={b.id}
            onClick={() => setExpandida(expandida === b.id ? null : b.id)}
            className={`rounded-3xl border transition-all cursor-pointer overflow-hidden ${b.status === 'completed' ? 'bg-green-900/20 border-green-800' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
          >
            <div className="p-5 flex flex-col md:flex-row justify-between md:items-center gap-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-2 py-1 rounded-lg text-[10px] font-black tracking-widest ${b.status === 'completed' ? 'bg-green-600 text-white' : 'bg-pink-500 text-white'}`}>{b.date}</span>
                  <span className={`font-black text-sm ${b.status === 'completed' ? 'text-green-400' : 'text-pink-400'}`}>{b.time}</span>
                </div>
                <p className="font-black text-lg uppercase text-white leading-none mb-1">{b.clientName}</p>
                <p className="text-xs text-slate-400 font-bold">Con <span className="text-slate-300">{b.staffName}</span></p>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs font-black text-green-400">{formatearDinero(b.totalPrice, moneda)}</p>
                  <p className="text-[9px] text-slate-400 font-bold">{b.totalDuration} min</p>
                </div>
                {expandida === b.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>
            </div>

            {expandida === b.id && (
              <div className="px-5 pb-5 pt-0 border-t border-slate-700 space-y-2">
                {b.services.map((s, i) => (
                  <div key={i} className="flex justify-between text-[10px] font-bold text-slate-300">
                    <span>{s.name}</span>
                    <span className="text-green-400">{formatearDinero(s.price, moneda)} · {s.duration}m</span>
                  </div>
                ))}
                <p className="text-[9px] font-black text-slate-500 uppercase mt-2">Tel: {b.clientPhone} · Suc: {b.branch}</p>
              </div>
            )}
          </div>
        ))}
        {proximas.length === 0 && (
          <p className="text-xs text-slate-500 italic font-bold text-center py-4">No hay próximas reservaciones.</p>
        )}
      </div>
    </section>
  );
}
