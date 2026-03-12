import { useState } from 'react';
import { Store, List, Pencil, Trash2, CheckCircle2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { DialogoConfirmacion } from '../../../componentes/ui/DialogoConfirmacion';
import { Tooltip } from '../../../componentes/ui/Tooltip';
import { eliminarEstudio } from '../../../servicios/servicioEstudios';
import { formatearPaisMoneda, obtenerEstadoSuscripcion } from '../../../utils/formato';
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
    onSuccess: () => {
      setIdEliminar(null);
      recargar();
    },
  });

  const manejarEliminar = () => {
    if (!idEliminar) return;
    borrarEstudio(idEliminar);
  };

  if (estudios.length === 0) {
    return (
      <p className="text-center py-16 text-slate-400 font-bold italic">
        No hay salones registrados. Crea el primero.
      </p>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {estudios.map((s) => {
          const sub = obtenerEstadoSuscripcion(s);
          const totalCitas = reservas.filter((b) => b.studioId === s.id).length;
          const personalActivo = s.staff?.filter((persona) => persona.active).length ?? 0;
          const personalTotal = s.staff?.length ?? 0;

          return (
            <div
              key={s.id}
              className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-sm relative group flex flex-col justify-between"
            >
              <div>
                <div className="absolute top-6 right-6 flex gap-2">
                  <Tooltip texto="Ver detalle del salón">
                    <button
                      onClick={() => onVerReservas(s)}
                      className="no-imprimir p-2 bg-blue-50 text-blue-500 rounded-full hover:bg-blue-100 transition-all"
                      title="Ver detalle del salón"
                      aria-label="Ver detalle del salón"
                    >
                      <List className="w-5 h-5" />
                    </button>
                  </Tooltip>
                  <Tooltip texto="Editar salón">
                    <button
                      onClick={() => onEditar(s)}
                      className="no-imprimir p-2 bg-slate-50 rounded-full text-slate-400 hover:text-slate-800 transition-all"
                      title="Editar salón"
                      aria-label="Editar salón"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                  </Tooltip>
                  <Tooltip texto="Eliminar salón">
                    <button
                      onClick={() => setIdEliminar(s.id)}
                      className="no-imprimir p-2 bg-red-50 rounded-full text-red-400 hover:text-red-600 transition-all"
                      title="Eliminar salón"
                      aria-label="Eliminar salón"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </Tooltip>
                </div>
                <Tooltip texto="Identidad del salón">
                  <div
                    className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center text-pink-600 mb-6"
                    title="Identidad del salón"
                  >
                    <Store />
                  </div>
                </Tooltip>
                <h3 className="text-xl font-black text-slate-900 truncate uppercase italic">
                  {s.name}
                </h3>
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
                  <span className="text-slate-900">{formatearPaisMoneda(s.country)}</span>
                </div>
                <div className="flex justify-between text-[9px] font-black uppercase text-slate-400">
                  <span>Personal:</span>
                  <span className="text-slate-900">
                    {personalActivo} activos / {personalTotal} registrados
                  </span>
                </div>
                <div className="flex justify-between gap-3 text-[9px] font-black uppercase text-slate-400">
                  <Tooltip texto="Identificador único del salón en el sistema. Solo para soporte técnico.">
                    <span className="cursor-help">ID interno:</span>
                  </Tooltip>
                  <span className="text-slate-900 text-right">{s.assignedKey}</span>
                </div>
                <div className="flex justify-between text-[9px] font-black uppercase text-slate-400">
                  <span>Citas Agendadas:</span>
                  <span className="text-pink-600 font-bold">{totalCitas} totales</span>
                </div>
                <Tooltip texto="Registrar pago del salón">
                  <button
                    onClick={() => onAbrirPago(s)}
                    className="no-imprimir w-full mt-2 py-2 bg-slate-900 text-white text-[10px] font-black uppercase rounded-xl hover:bg-black transition-all"
                    title="Registrar pago del salón"
                  >
                    Registrar pago y renovar
                  </button>
                </Tooltip>
              </div>
            </div>
          );
        })}
      </div>

      <DialogoConfirmacion
        abierto={idEliminar !== null}
        mensaje="¿Borrar salón?"
        descripcion="Esta acción eliminará el salón permanentemente y no se puede deshacer."
        textoConfirmar="Sí, eliminar"
        variante="peligro"
        cargando={eliminando}
        onConfirmar={manejarEliminar}
        onCancelar={() => setIdEliminar(null)}
      />
    </>
  );
}
