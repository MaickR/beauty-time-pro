import { useState } from 'react';
import { Store, List, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { DialogoConfirmacion } from '../../../componentes/ui/DialogoConfirmacion';
import { eliminarEstudio } from '../../../servicios/servicioEstudios';
import { obtenerEstadoSuscripcion } from '../../../utils/formato';
import { usarContextoApp } from '../../../contextos/ContextoApp';
import type { Estudio, Reserva } from '../../../tipos';

interface PropsDirectorioEstudios {
  estudios: Estudio[];
  reservas: Reserva[];
  onEditar: (estudio: Estudio) => void;
  onVerReservas: (estudio: Estudio) => void;
  onAbrirPago: (estudio: Estudio) => void;
}

export function DirectorioEstudios({
  estudios,
  reservas,
  onEditar,
  onVerReservas,
  onAbrirPago,
}: PropsDirectorioEstudios) {
  const [idEliminar, setIdEliminar] = useState<string | null>(null);
  const { recargar } = usarContextoApp();

  const { mutate: borrarEstudio, isPending: eliminando } = useMutation({
    mutationFn: (id: string) => eliminarEstudio(id),
    onSuccess: () => { setIdEliminar(null); recargar(); },
  });

  const manejarEliminar = () => {
    if (!idEliminar) return;
    borrarEstudio(idEliminar);
  };

  if (estudios.length === 0) {
    return (
      <p className="text-center py-16 text-slate-400 font-bold italic">
        No hay studios registrados. Da de alta el primero.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {estudios.map((s) => {
          const sub = obtenerEstadoSuscripcion(s);
          const totalCitas = reservas.filter((b) => b.studioId === s.id).length;
          return (
            <div
              key={s.id}
              className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative group flex flex-col justify-between"
            >
              <div>
                <div className="absolute top-6 right-6 flex gap-2">
                  <button
                    onClick={() => onVerReservas(s)}
                    className="p-2 bg-blue-50 text-blue-500 rounded-full hover:bg-blue-100 transition-all"
                    title="Ver Citas del Studio"
                    aria-label="Ver citas del studio"
                  >
                    <List className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => onEditar(s)}
                    className="p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-800 transition-all"
                    title="Editar"
                    aria-label="Editar studio"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                  <button
                    onClick={() => setIdEliminar(s.id)}
                    className="p-2 bg-red-50 rounded-full text-red-400 hover:text-red-600 transition-all"
                    title="Eliminar"
                    aria-label="Eliminar studio"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
                <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-pink-600 mb-6">
                  <Store />
                </div>
                <h3 className="text-xl font-black text-slate-900 truncate uppercase italic">{s.name}</h3>
                <p className="text-sm text-slate-500 font-bold mb-4">{s.owner}</p>
                {sub && (
                  <div
                    className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest mb-4 ${
                      sub.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-700'
                        : sub.status === 'WARNING'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                    }`}
                  >
                    <CheckCircle2 className="w-3 h-3" /> Vence: {sub.dueDateStr}
                  </div>
                )}
              </div>
              <div className="space-y-3 pt-6 border-t border-slate-50">
                <div className="flex justify-between text-[9px] font-black uppercase text-slate-400">
                  <span>País / Moneda:</span>
                  <span className="text-slate-900">{s.country ?? 'Mexico'}</span>
                </div>
                <div className="flex justify-between text-[9px] font-black uppercase text-slate-400">
                  <span>Personal:</span>
                  <span className="text-slate-900">{s.staff?.length ?? 0} Especialistas</span>
                </div>
                <div className="flex justify-between text-[9px] font-black uppercase text-slate-400">
                  <span>Citas Agendadas:</span>
                  <span className="text-pink-600 font-bold">{totalCitas} totales</span>
                </div>
                <button
                  onClick={() => onAbrirPago(s)}
                  className="w-full mt-2 py-2 bg-slate-900 text-white text-[10px] font-black uppercase rounded-xl hover:bg-black transition-all"
                >
                  Registrar Pago
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <DialogoConfirmacion
        abierto={idEliminar !== null}
        mensaje="¿Borrar studio?"
        descripcion="Esta acción eliminará el studio permanentemente y no se puede deshacer."
        textoConfirmar="Sí, eliminar"
        variante="peligro"
        cargando={eliminando}
        onConfirmar={manejarEliminar}
        onCancelar={() => setIdEliminar(null)}
      />
    </>
  );
}
