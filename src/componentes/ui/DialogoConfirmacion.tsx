import { AlertTriangle } from 'lucide-react';

interface PropsDialogoConfirmacion {
  abierto: boolean;
  mensaje: string;
  descripcion?: string;
  etiquetaCampo?: string;
  placeholderCampo?: string;
  valorCampo?: string;
  onCambiarCampo?: (valor: string) => void;
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
  etiquetaCampo,
  placeholderCampo,
  valorCampo,
  onCambiarCampo,
  textoCancelar = 'Cancelar',
  textoConfirmar = 'Confirmar',
  variante = 'advertencia',
  cargando = false,
  onConfirmar,
  onCancelar,
}: PropsDialogoConfirmacion) {
  if (!abierto) return null;

  const colorIcono = variante === 'peligro' ? 'text-[#991b1b]' : 'text-[#143c32]';
  const colorBoton =
    variante === 'peligro'
      ? 'bg-[#991b1b] hover:bg-[#7f1d1d] text-white border-[#991b1b]'
      : 'bg-[#143c32] hover:bg-[#0a2823] text-white border-[#143c32]';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialogo-titulo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onKeyDown={(e) => e.key === 'Escape' && onCancelar()}
    >
      <div className="w-full max-w-sm rounded-2xl border border-[#c9c1bb] bg-white p-6 shadow-xl">
        <div className="flex flex-col items-center text-center gap-4">
          <div className={`rounded-full bg-[#fef2f2] p-3.5 ${colorIcono}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 id="dialogo-titulo" className="text-lg font-bold text-black">
            {mensaje}
          </h2>
          {descripcion && <p className="text-sm text-[#5f5854] leading-relaxed">{descripcion}</p>}
          {onCambiarCampo && (
            <label className="w-full text-left">
              {etiquetaCampo && (
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[#5f5854]">
                  {etiquetaCampo}
                </span>
              )}
              <input
                value={valorCampo ?? ''}
                onChange={(evento) => onCambiarCampo(evento.target.value)}
                placeholder={placeholderCampo}
                className="w-full rounded-lg border border-[#c9c1bb] bg-white px-3.5 py-2.5 text-sm font-medium text-black outline-none transition focus:border-[#c6968c] focus:ring-2 focus:ring-[#f4e9e5]"
              />
            </label>
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancelar}
            className="flex-1 rounded-lg border border-[#c9c1bb] bg-white py-2.5 text-sm font-semibold text-[#5f5854] transition-colors hover:bg-[#f4efec]"
          >
            {textoCancelar}
          </button>
          <button
            onClick={onConfirmar}
            disabled={cargando}
            aria-busy={cargando}
            className={`flex-1 rounded-lg border py-2.5 text-sm font-bold transition-colors disabled:opacity-50 ${colorBoton}`}
          >
            {cargando ? 'Procesando...' : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
