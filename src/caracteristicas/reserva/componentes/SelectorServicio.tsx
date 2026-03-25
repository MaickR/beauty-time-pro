import { Clock } from 'lucide-react';
import { formatearDinero } from '../../../utils/formato';
import type { Estudio, Servicio, Moneda } from '../../../tipos';

interface PropsSelectorServicio {
  estudio: Estudio;
  personalSeleccionado?: string;
  serviciosSeleccionados: Servicio[];
  moneda: Moneda;
  onAlternar: (servicio: Servicio) => void;
}

export function SelectorServicio({
  estudio,
  personalSeleccionado,
  serviciosSeleccionados,
  moneda,
  onAlternar,
}: PropsSelectorServicio) {
  const miembro = personalSeleccionado
    ? estudio.staff?.find((s) => s.id === personalSeleccionado)
    : undefined;
  // Si hay especialista pre-seleccionado filtra por sus especialidades; si no, muestra todos
  const serviciosDisponibles = miembro
    ? estudio.selectedServices.filter((s) => miembro.specialties.includes(s.name))
    : estudio.selectedServices;
  const totalPrecio = serviciosSeleccionados.reduce((acc, s) => acc + (s.price ?? 0), 0);
  const totalDuracion = serviciosSeleccionados.reduce((acc, s) => acc + s.duration, 0);
  const salonSinServicios = estudio.selectedServices.length === 0;

  return (
    <section className="bg-slate-50 rounded-[3rem] p-8 md:p-10 border border-slate-200 shadow-sm">
      <h3 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter mb-8 text-slate-800 flex items-center gap-3">
        <span className="bg-pink-100 text-pink-600 w-8 h-8 rounded-full flex items-center justify-center text-sm">
          1
        </span>
        Servicios
      </h3>
      {miembro && (
        <p className="text-xs font-bold text-slate-500 uppercase mb-4">
          Servicios que realiza <strong>{miembro.name}</strong>:
        </p>
      )}

      {serviciosDisponibles.length === 0 ? (
        <p className="text-slate-400 italic font-bold">
          {salonSinServicios
            ? 'Este salon aun no tiene servicios habilitados para reserva.'
            : 'El especialista no tiene tratamientos habilitados en este momento.'}
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {serviciosDisponibles.map((servicio, i) => {
            const seleccionado = !!serviciosSeleccionados.find((x) => x.name === servicio.name);
            return (
              <button
                key={i}
                onClick={() => onAlternar(servicio)}
                className={`text-left p-5 rounded-2xl border transition-all flex justify-between items-center gap-4 ${seleccionado ? 'bg-pink-600 border-pink-600 text-white shadow-lg scale-[1.01]' : 'bg-white border-slate-200 hover:border-pink-300'}`}
              >
                <div className="flex flex-col">
                  <span
                    className={`font-black text-sm uppercase ${seleccionado ? 'text-white' : 'text-slate-800'}`}
                  >
                    {seleccionado && '✓ '}
                    {servicio.name}
                  </span>
                  <span
                    className={`text-[10px] font-bold mt-1 flex items-center gap-1 ${seleccionado ? 'text-pink-200' : 'text-slate-400'}`}
                  >
                    <Clock className="w-3 h-3" /> {servicio.duration} MINUTOS
                  </span>
                </div>
                {servicio.price > 0 && (
                  <span
                    className={`font-black text-lg shrink-0 ${seleccionado ? 'text-white' : 'text-green-600'}`}
                  >
                    {formatearDinero(servicio.price, moneda)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {serviciosSeleccionados.length > 0 && (
        <div className="mt-8 bg-slate-900 text-white p-6 rounded-3xl flex justify-between items-center shadow-xl">
          <div>
            <p className="text-[10px] font-black text-pink-400 uppercase tracking-widest mb-1">
              Total a Pagar en Sucursal
            </p>
            <p className="text-3xl font-black text-green-400">
              {formatearDinero(totalPrecio, moneda)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Tiempo Estimado
            </p>
            <p className="text-xl font-black">{totalDuracion} min</p>
          </div>
        </div>
      )}
    </section>
  );
}
