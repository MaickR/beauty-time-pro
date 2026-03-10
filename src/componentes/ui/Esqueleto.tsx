interface PropsEsqueleto {
  className?: string;
}

interface PropsEsqueletoLista {
  cantidad?: number;
}

interface PropsEsqueletoGrilla {
  cantidad?: number;
}

export function EsqueletoTarjeta({ className }: PropsEsqueleto) {
  return (
    <div
      className={`animate-pulse bg-slate-200 rounded-[2rem] ${className ?? 'h-32'}`}
      aria-busy="true"
      aria-label="Cargando"
    />
  );
}

export function EsqueletoLista({ cantidad = 6 }: PropsEsqueletoLista) {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Cargando lista">
      {Array.from({ length: cantidad }).map((_, i) => (
        <EsqueletoTarjeta key={i} />
      ))}
    </div>
  );
}

export function EsqueletoGrilla({ cantidad = 12 }: PropsEsqueletoGrilla) {
  return (
    <div
      className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3"
      aria-busy="true"
      aria-label="Cargando grilla"
    >
      {Array.from({ length: cantidad }).map((_, i) => (
        <EsqueletoTarjeta key={i} className="h-14" />
      ))}
    </div>
  );
}
