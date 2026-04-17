import { Clock } from 'lucide-react';
import { formatearDineroEntero } from '../../../utils/formato';
import type { Estudio, Servicio, Moneda } from '../../../tipos';

interface PropsSelectorServicio {
  estudio: Estudio;
  personalSeleccionado?: string;
  sucursalSeleccionada: string;
  requiereSucursal: boolean;
  serviciosSeleccionados: Servicio[];
  moneda: Moneda;
  onAlternar: (servicio: Servicio) => void;
  indicadorPaso?: string;
}

export function SelectorServicio({
  estudio,
  personalSeleccionado,
  sucursalSeleccionada,
  requiereSucursal,
  serviciosSeleccionados,
  moneda,
  onAlternar,
  indicadorPaso = '2',
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

  if (requiereSucursal && !sucursalSeleccionada) {
    return (
      <section className="rounded-[2.5rem] border border-slate-200 bg-slate-50 p-6 md:p-8 shadow-sm">
        <h3 className="mb-4 flex items-center gap-3 text-lg font-black uppercase tracking-tight text-slate-800 md:text-xl">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-pink-100 text-sm text-pink-600">
            {indicadorPaso}
          </span>
          Servicios
        </h3>
        <p className="text-sm font-bold text-slate-500">
          Selecciona primero el salón para continuar con el catálogo de servicios.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-[2.5rem] border border-slate-200 bg-slate-50 p-6 md:p-8 shadow-sm">
      <h3 className="mb-6 flex items-center gap-3 text-lg font-black uppercase tracking-tight text-slate-800 md:text-xl">
        <span className="bg-pink-100 text-pink-600 w-8 h-8 rounded-full flex items-center justify-center text-sm">
          {indicadorPaso}
        </span>
        Servicios
      </h3>
      {sucursalSeleccionada ? (
        <p className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
          Salón actual: {sucursalSeleccionada}
        </p>
      ) : null}
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
                    {formatearDineroEntero(servicio.price, moneda)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {serviciosSeleccionados.length > 0 && (
        <div className="mt-6 flex items-center justify-between rounded-3xl bg-slate-900 p-5 text-white shadow-xl">
          <div>
            <p className="text-[10px] font-black text-pink-400 uppercase tracking-widest mb-1">
              Total estimado
            </p>
            <p className="text-2xl font-black text-green-400 md:text-3xl">
              {formatearDineroEntero(totalPrecio, moneda)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">
              Tiempo estimado
            </p>
            <p className="text-lg font-black md:text-xl">{Math.round(totalDuracion)} min</p>
          </div>
        </div>
      )}
    </section>
  );
}
