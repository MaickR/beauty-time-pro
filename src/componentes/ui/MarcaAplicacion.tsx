interface PropsIconoMarcaAplicacion {
  tamano?: 'sm' | 'md' | 'lg' | 'hero';
  className?: string;
  alt?: string;
}

interface PropsMarcaAplicacion {
  tamano?: 'sm' | 'md' | 'lg';
  variante?: 'clara' | 'oscura';
  texto?: string;
  subtitulo?: string;
  className?: string;
}

const CLASES_ICONO = {
  sm: 'h-9 w-9 rounded-xl',
  md: 'h-12 w-12 rounded-2xl',
  lg: 'h-14 w-14 rounded-[1.35rem]',
  hero: 'h-16 w-16 rounded-[1.55rem]',
} as const;

const CLASES_TITULO = {
  sm: 'text-sm font-black leading-tight',
  md: 'text-lg font-black leading-tight',
  lg: 'text-xl font-black leading-tight',
} as const;

const CLASES_SUBTITULO = {
  sm: 'text-[10px] leading-tight',
  md: 'text-sm leading-tight',
  lg: 'text-sm leading-tight',
} as const;

export function IconoMarcaAplicacion({
  tamano = 'md',
  className = '',
  alt = 'Beauty Time Pro',
}: PropsIconoMarcaAplicacion) {
  return (
    <span
      className={`relative shrink-0 overflow-hidden border border-white/15 bg-white/90 shadow-[0_16px_40px_rgba(15,23,42,0.12)] ${CLASES_ICONO[tamano]} ${className}`}
      aria-hidden={alt === ''}
    >
      <img
        src="/Logo-App.svg"
        alt={alt}
        className="h-full w-full object-cover object-left"
        decoding="async"
        loading="eager"
      />
    </span>
  );
}

export function MarcaAplicacion({
  tamano = 'md',
  variante = 'clara',
  texto = 'Beauty Time Pro',
  subtitulo,
  className = '',
}: PropsMarcaAplicacion) {
  const colorTitulo = variante === 'oscura' ? 'text-white' : 'text-slate-900';
  const colorSubtitulo = variante === 'oscura' ? 'text-white/68' : 'text-slate-600';
  const etiquetaMarca = subtitulo ? subtitulo : texto;

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <IconoMarcaAplicacion tamano={tamano} alt="" />
      <div className="min-w-0">
        <p className={`${CLASES_TITULO[tamano]} ${colorTitulo}`}>{texto}</p>
        {subtitulo ? (
          <p className={`${CLASES_SUBTITULO[tamano]} ${colorSubtitulo}`}>{etiquetaMarca}</p>
        ) : null}
      </div>
    </div>
  );
}
