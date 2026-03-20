import { useMemo, useState } from 'react';
import { Store, List, Pencil, Trash2, CheckCircle2, ArrowUpDown } from 'lucide-react';
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
  const [campoOrden, setCampoOrden] = useState<'createdAt' | 'name' | 'country'>('createdAt');
  const [direccionOrden, setDireccionOrden] = useState<'asc' | 'desc'>('desc');
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

  const estudiosOrdenados = useMemo(() => {
    const copia = [...estudios];
    copia.sort((a, b) => {
      let comparacion = 0;

      if (campoOrden === 'createdAt') {
        comparacion = new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      }

      if (campoOrden === 'name') {
        comparacion = a.name.localeCompare(b.name, 'es', { sensitivity: 'base' });
      }

      if (campoOrden === 'country') {
        comparacion = a.country.localeCompare(b.country, 'es', { sensitivity: 'base' });
      }

      return direccionOrden === 'asc' ? comparacion : comparacion * -1;
    });
    return copia;
  }, [campoOrden, direccionOrden, estudios]);

  if (estudios.length === 0) {
    return (
      <p className="text-center py-16 text-slate-400 font-bold italic">
        No hay salones registrados. Crea el primero.
      </p>
    );
  }

  return (
    <>
      <div className="mb-6 flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            Ordenar salones
          </p>
          <p className="mt-1 text-sm font-medium text-slate-500">
            Orden aplicado en frontend sobre los salones ya cargados.
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <select
            value={campoOrden}
            onChange={(e) => setCampoOrden(e.target.value as 'createdAt' | 'name' | 'country')}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:ring-2 focus:ring-pink-500 sm:w-auto"
            aria-label="Ordenar salones por"
          >
            <option value="createdAt">Fecha de creación</option>
            <option value="name">Nombre</option>
            <option value="country">País</option>
          </select>
          <button
            type="button"
            onClick={() => setDireccionOrden((valor) => (valor === 'asc' ? 'desc' : 'asc'))}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black text-slate-700 transition-colors hover:bg-slate-100"
            aria-label="Cambiar dirección de orden"
          >
            <ArrowUpDown className="h-4 w-4" />
            {direccionOrden === 'asc' ? 'Ascendente' : 'Descendente'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {estudiosOrdenados.map((s) => {
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
