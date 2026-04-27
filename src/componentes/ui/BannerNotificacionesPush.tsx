interface PropsBannerNotificacionesPush {
  visible: boolean;
  activando?: boolean;
  mensaje: string;
  onActivar: () => void | Promise<void>;
  onDescartar: () => void;
}

export function BannerNotificacionesPush({
  visible,
  activando = false,
  mensaje,
  onActivar,
  onDescartar,
}: PropsBannerNotificacionesPush) {
  if (!visible) return null;

  return (
    <div className="bg-pink-50 border-b border-pink-200 px-4 py-2 flex flex-col gap-2 text-sm md:flex-row md:items-center md:justify-between">
      <span className="font-medium text-slate-700">{mensaje}</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void onActivar()}
          disabled={activando}
          className="btn-primary disabled:opacity-60"
        >
          {activando ? 'Activando...' : 'Activar'}
        </button>
        <button type="button" onClick={onDescartar} className="btn-ghost">
          Ahora no
        </button>
      </div>
    </div>
  );
}
