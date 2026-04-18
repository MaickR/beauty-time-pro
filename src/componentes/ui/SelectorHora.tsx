import { useId } from 'react';

interface PropsSelectorHora {
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  id?: string;
  nombre?: string;
  error?: string;
  claseContenedor?: string;
  claseSelect?: string;
  ocultarEtiqueta?: boolean;
}

export const FRANJAS_HORARIAS = Array.from({ length: 48 }, (_, indice) => {
  const horas = Math.floor(indice / 2)
    .toString()
    .padStart(2, '0');
  const minutos = ((indice % 2) * 30).toString().padStart(2, '0');
  return `${horas}:${minutos}`;
});

export function SelectorHora({
  etiqueta,
  valor,
  alCambiar,
  id,
  nombre,
  error,
  claseContenedor,
  claseSelect,
  ocultarEtiqueta = false,
}: PropsSelectorHora) {
  const idInterno = useId();
  const idSeguro = id ?? `selector-hora-${idInterno}`;
  const nombreSeguro = nombre ?? idSeguro;

  return (
    <div className={claseContenedor}>
      {!ocultarEtiqueta && (
        <label htmlFor={idSeguro} className="mb-1 block text-sm font-semibold text-slate-700">
          {etiqueta}
        </label>
      )}
      <select
        id={idSeguro}
        name={nombreSeguro}
        value={valor}
        onChange={(evento) => alCambiar(evento.target.value)}
        aria-invalid={Boolean(error)}
        className={
          claseSelect ??
          'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-all focus:ring-2 focus:ring-pink-500'
        }
      >
        {FRANJAS_HORARIAS.map((hora) => (
          <option key={hora} value={hora}>
            {hora}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
