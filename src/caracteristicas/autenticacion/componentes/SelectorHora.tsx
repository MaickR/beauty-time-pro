interface PropsSelectorHora {
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  id?: string;
  nombre?: string;
  error?: string;
}

export const FRANJAS_HORARIAS = Array.from({ length: 33 }, (_, indice) => {
  const totalMinutos = 360 + indice * 30;
  const horas = Math.floor(totalMinutos / 60)
    .toString()
    .padStart(2, '0');
  const minutos = (totalMinutos % 60).toString().padStart(2, '0');
  return `${horas}:${minutos}`;
});

export function SelectorHora({ etiqueta, valor, alCambiar, id, nombre, error }: PropsSelectorHora) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-semibold text-slate-700">
        {etiqueta}
      </label>
      <select
        id={id}
        name={nombre}
        value={valor}
        onChange={(evento) => alCambiar(evento.target.value)}
        aria-invalid={Boolean(error)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-pink-500"
      >
        {FRANJAS_HORARIAS.map((hora) => (
          <option key={hora} value={hora}>
            {hora}
          </option>
        ))}
      </select>
      {error && (
        <p role="alert" className="mt-1 text-xs text-red-500">
          {error}
        </p>
      )}
    </div>
  );
}
