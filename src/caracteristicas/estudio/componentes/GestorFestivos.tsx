import { useState } from 'react';
import { Calendar, XCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { SelectorFecha } from '../../../componentes/ui/SelectorFecha';
import { actualizarFestivos } from '../../../servicios/servicioEstudios';
import { usarContextoApp } from '../../../contextos/ContextoApp';
import type { Estudio } from '../../../tipos';

interface PropsGestorFestivos {
  estudio: Estudio;
}

export function GestorFestivos({ estudio }: PropsGestorFestivos) {
  const [nuevaFecha, setNuevaFecha] = useState('');
  const { recargar } = usarContextoApp();

  const { mutate: guardarFestivos, isPending } = useMutation({
    mutationFn: (festivos: string[]) => actualizarFestivos(estudio.id, festivos),
    onSuccess: recargar,
  });

  const agregarFestivo = () => {
    if (!nuevaFecha) return;
    const actualizados = [...(estudio.holidays ?? []), nuevaFecha];
    guardarFestivos(actualizados);
    setNuevaFecha('');
  };

  const eliminarFestivo = (fecha: string) => {
    const actualizados = (estudio.holidays ?? []).filter((d) => d !== fecha);
    guardarFestivos(actualizados);
  };

  return (
    <div className="bg-white rounded-[3rem] p-6 md:p-8 border border-slate-200 shadow-sm">
      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-pink-600" /> Días de descanso
      </h3>
      <p className="text-[10px] text-slate-400 font-bold mb-6">
        Fechas en las que el salón no presta atención ni acepta reservas.
      </p>

      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        <div className="flex-1">
          <SelectorFecha
            etiqueta="Fecha a bloquear"
            valor={nuevaFecha}
            min={new Date().toISOString().split('T')[0]}
            alCambiar={setNuevaFecha}
          />
        </div>
        <button
          onClick={agregarFestivo}
          disabled={isPending}
          className="bg-slate-900 text-white px-6 py-3 rounded-xl text-xs font-black uppercase hover:bg-black transition-all disabled:opacity-60"
        >
          {isPending ? 'Guardando...' : 'Bloquear'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(estudio.holidays ?? []).sort().map((h) => (
          <div
            key={h}
            className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-[10px] font-black flex items-center gap-2"
          >
            {h}
            <button
              onClick={() => eliminarFestivo(h)}
              aria-label={`Eliminar ${h}`}
              className="hover:text-red-900"
            >
              <XCircle className="w-3 h-3" />
            </button>
          </div>
        ))}
        {!estudio.holidays?.length && (
          <p className="text-xs text-slate-400 italic font-bold">No hay días bloqueados.</p>
        )}
      </div>
    </div>
  );
}
