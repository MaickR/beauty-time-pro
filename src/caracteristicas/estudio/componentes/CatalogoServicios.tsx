import { Clock, DollarSign } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { formatearDinero } from '../../../utils/formato';
import { actualizarPreciosServicios } from '../../../servicios/servicioEstudios';
import type { Estudio, Moneda } from '../../../tipos';

interface PropsCatalogoServicios {
  estudio: Estudio;
}

export function CatalogoServicios({ estudio }: PropsCatalogoServicios) {
  const moneda: Moneda = estudio.country === 'Colombia' ? 'COP' : 'MXN';

  const { mutate: guardarPrecios } = useMutation({
    mutationFn: (serviciosActualizados: typeof estudio.selectedServices) =>
      actualizarPreciosServicios(estudio.id, serviciosActualizados),
  });

  const actualizarPrecio = (nombreServicio: string, nuevoPrecio: string) => {
    const serviciosActualizados = estudio.selectedServices.map((s) =>
      s.name === nombreServicio ? { ...s, price: parseInt(nuevoPrecio) || 0 } : s,
    );
    guardarPrecios(serviciosActualizados);
  };

  return (
    <div className="bg-white rounded-[3rem] p-6 md:p-8 border border-slate-200 shadow-sm">
      <div className="mb-6">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-1">
          <DollarSign className="w-4 h-4 text-pink-600" /> Catálogo de Servicios
        </h3>
        <p className="text-xs text-slate-500 font-bold">Ajusta los precios de tus servicios en cualquier momento. Los cambios se reflejarán inmediatamente para los clientes.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {estudio.selectedServices.map((s, i) => (
          <div key={i} className="flex flex-col justify-between bg-slate-50 p-5 rounded-2xl border border-slate-100 hover:border-pink-200 transition-all group">
            <div className="mb-4">
              <span className="font-black text-sm text-slate-800 uppercase block">{s.name}</span>
              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3" /> Duración: {s.duration} min
              </span>
            </div>
            <div className="flex items-center gap-2 bg-white p-3 rounded-xl border border-slate-200 group-hover:border-green-300 transition-all">
              <span className="text-[10px] font-black text-green-600 uppercase">{moneda}</span>
              <input
                type="number"
                min="0"
                defaultValue={s.price ?? 0}
                onBlur={(e) => actualizarPrecio(s.name, e.target.value)}
                className="flex-1 text-sm font-black text-slate-800 outline-none bg-transparent text-right"
                aria-label={`Precio de ${s.name}`}
              />
            </div>
            <p className="text-[9px] text-slate-400 font-bold mt-2 text-right">{formatearDinero(s.price ?? 0, moneda)}</p>
          </div>
        ))}
        {estudio.selectedServices.length === 0 && (
          <p className="col-span-full text-center text-slate-400 italic font-bold py-8">No hay servicios configurados.</p>
        )}
      </div>
    </div>
  );
}
