interface PropsBanderaPais {
  pais: string;
  className?: string;
}

export function BanderaPais({ pais, className = '' }: PropsBanderaPais) {
  if (pais === 'Mexico' || pais === 'México') {
    return (
      <span
        role="img"
        aria-label="Bandera de Mexico"
        className={`relative inline-flex h-4.5 w-7 overflow-hidden rounded-sm border border-slate-200 ${className}`}
      >
        <span className="h-full w-1/3 bg-[#006847]" />
        <span className="relative h-full w-1/3 bg-white">
          <span className="absolute left-1/2 top-1/2 h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#9C6B30]" />
        </span>
        <span className="h-full w-1/3 bg-[#CE1126]" />
      </span>
    );
  }

  if (pais === 'Colombia') {
    return (
      <span
        role="img"
        aria-label="Bandera de Colombia"
        className={`inline-flex h-4.5 w-7 flex-col overflow-hidden rounded-sm border border-slate-200 ${className}`}
      >
        <span className="h-1/2 w-full bg-[#FCD116]" />
        <span className="h-1/4 w-full bg-[#003893]" />
        <span className="h-1/4 w-full bg-[#CE1126]" />
      </span>
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-4.5 w-7 items-center justify-center rounded-sm border border-slate-200 bg-slate-100 text-[9px] font-black text-slate-500 ${className}`}
    >
      --
    </span>
  );
}
