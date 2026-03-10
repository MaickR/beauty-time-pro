import type { Estudio } from '../../../tipos';

interface PropsSelectorPersonal {
  estudio: Estudio;
  personalSeleccionado: string;
  onSeleccionar: (id: string) => void;
}

export function SelectorPersonal({ estudio, personalSeleccionado, onSeleccionar }: PropsSelectorPersonal) {
  const personalActivo = estudio.staff?.filter((st) => st.active) ?? [];

  return (
    <section className="bg-slate-900 rounded-[3rem] p-8 md:p-10 text-white shadow-2xl">
      <h3 className="text-xl md:text-2xl font-black italic uppercase mb-8 flex items-center gap-3 text-pink-500">
        <span className="bg-white/10 w-8 h-8 rounded-full flex items-center justify-center text-sm">1</span>
        Elige tu Especialista
      </h3>

      {personalActivo.length === 0 ? (
        <p className="text-center text-red-400 font-bold">No hay especialistas disponibles en este momento.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {personalActivo.map((miembro) => {
            const activo = personalSeleccionado === miembro.id;
            return (
              <div
                key={miembro.id}
                onClick={() => onSeleccionar(miembro.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && onSeleccionar(miembro.id)}
                aria-pressed={activo}
                className={`cursor-pointer p-6 rounded-3xl border-2 transition-all ${activo ? 'bg-pink-600 border-pink-400 shadow-xl shadow-pink-900/50 scale-[1.02]' : 'bg-slate-800 border-slate-700 hover:border-slate-500'}`}
              >
                <h4 className="text-xl font-black uppercase mb-3 text-white">{miembro.name}</h4>
                <div className="flex flex-wrap gap-1.5">
                  {miembro.specialties.map((esp) => (
                    <span
                      key={esp}
                      className={`px-2 py-1 rounded-lg text-[8px] font-black uppercase border ${activo ? 'bg-pink-500 border-pink-400 text-white' : 'bg-slate-900 border-slate-700 text-slate-400'}`}
                    >
                      {esp}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
