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

  const colorIcono =
    variante === 'peligro' ? 'text-[var(--c-danger-text)]' : 'text-[var(--c-primary-dark)]';
  const claseBotonConfirmar = variante === 'peligro' ? 'btn-danger' : 'btn-primary';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dialogo-titulo"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onKeyDown={(e) => e.key === 'Escape' && onCancelar()}
    >
      <div className="w-full max-w-sm rounded-2xl border border-(--c-border-strong) bg-(--c-white) p-6 shadow-xl">
        <div className="flex flex-col items-center text-center gap-4">
          <div className={`rounded-full bg-(--c-danger-bg) p-3.5 ${colorIcono}`}>
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h2 id="dialogo-titulo" className="text-lg font-bold text-(--c-text)">
            {mensaje}
          </h2>
          {descripcion && (
            <p className="text-sm text-(--c-text-secondary) leading-relaxed">{descripcion}</p>
          )}
          {onCambiarCampo && (
            <label className="w-full text-left">
              {etiquetaCampo && (
                <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-(--c-text-secondary)">
                  {etiquetaCampo}
                </span>
              )}
              <input
                value={valorCampo ?? ''}
                onChange={(evento) => onCambiarCampo(evento.target.value)}
                placeholder={placeholderCampo}
                className="w-full rounded-lg border border-(--c-border-strong) bg-(--c-white) px-3.5 py-2.5 text-sm font-medium text-(--c-text) outline-none transition focus:border-(--c-primary) focus:ring-2 focus:ring-(--c-primary-50)"
              />
            </label>
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onCancelar} className="btn-ghost flex-1">
            {textoCancelar}
          </button>
          <button
            onClick={onConfirmar}
            disabled={cargando}
            aria-busy={cargando}
            className={`${claseBotonConfirmar} flex-1 disabled:opacity-50`}
          >
            {cargando ? 'Procesando...' : textoConfirmar}
          </button>
        </div>
      </div>
    </div>
  );
}
