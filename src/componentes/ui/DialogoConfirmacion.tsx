import { AlertTriangle } from 'lucide-react';

interface PropsDialogoConfirmacion {
  abierto: boolean;
  mensaje: string;
  descripcion?: string;
  textoCancelar?: string;
  textoConfirmar?: string;
  variante?: 'peligro' | 'advertencia';
  cargando?: boolean;
  onConfirmar: () => void;
  onCancelar: () => void;
}

export function DialogoConfirmacion({
  abierto,
  mensaje,
  descripcion,
  textoCancelar = 'Cancelar',
  textoConfirmar = 'Confirmar',
  variante = 'advertencia',
  cargando = false,
  onConfirmar,
  onCancelar,
}: PropsDialogoConfirmacion) {
  if (!abierto) return null;

  const colorIcono = variante === 'peligro' ? 'text-red-500' : 'text-yellow-500';
  const colorBoton =
    variante === 'peligro'
      ? 'bg-red-600 hover:bg-red-700 text-white'
      : 'bg-slate-900 hover:bg-black text-white';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialogo-titulo"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onKeyDown={(e) => e.key === 'Escape' && onCancelar()}
    >
      <div className="bg-white rounded-[2rem] p-8 max-w-sm w-full shadow-2xl">
        <div className="flex flex-col items-center text-center gap-4">
          <div className={`p-4 rounded-full bg-slate-100 ${colorIcono}`}>
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 id="dialogo-titulo" className="text-lg font-black text-slate-900 uppercase tracking-tight">
            {mensaje}
          </h2>
          {descripcion && (
            <p className="text-sm text-slate-500 font-medium leading-relaxed">{descripcion}</p>
          )}
        </div>
        <div className="flex gap-3 mt-8">
          <button
            onClick={onCancelar}
            className="flex-1 py-3 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase text-xs hover:bg-slate-200 transition-colors"
          >
            {textoCancelar}
          </button>
          <button
            onClick={onConfirmar}
            disabled={cargando}
            aria-busy={cargando}
            className={`flex-1 py-3 font-black rounded-2xl uppercase text-xs transition-colors disabled:opacity-60 ${colorBoton}`}
          >
            {cargando ? 'Procesando...' : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
