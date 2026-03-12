import { useEffect, useId, useMemo, useState } from 'react';

interface PropsSelectorFecha {
  etiqueta: string;
  valor: string;
  alCambiar: (valor: string) => void;
  id?: string;
  min?: string;
  max?: string;
  error?: string;
  requerido?: boolean;
  claseContenedor?: string;
  claseSelect?: string;
  ocultarEtiqueta?: boolean;
}

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function parsearFechaISO(valor: string): { dia: string; mes: string; anio: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return { dia: '', mes: '', anio: '' };
  }

  const [anio, mes, dia] = valor.split('-');
  return {
    dia: dia ? String(Number(dia)) : '',
    mes: mes ? String(Number(mes)) : '',
    anio: anio ?? '',
  };
}

function diasEnMes(anio: number, mes: number): number {
  return new Date(anio, mes, 0).getDate();
}

function construirFechaISO(anio: number, mes: number, dia: number): string {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
}

function esFechaValida(anio: number, mes: number, dia: number): boolean {
  const fecha = new Date(anio, mes - 1, dia);
  return fecha.getFullYear() === anio && fecha.getMonth() === mes - 1 && fecha.getDate() === dia;
}

function obtenerLimites(min?: string, max?: string): { minFecha?: Date; maxFecha?: Date } {
  const minFecha = min ? new Date(`${min}T00:00:00`) : undefined;
  const maxFecha = max ? new Date(`${max}T00:00:00`) : undefined;
  return { minFecha, maxFecha };
}

export function SelectorFecha({
  etiqueta,
  valor,
  alCambiar,
  id,
  min,
  max,
  error,
  requerido = false,
  claseContenedor,
  claseSelect,
  ocultarEtiqueta = false,
}: PropsSelectorFecha) {
  const idInterno = useId();
  const idCampo = id ?? `selector-fecha-${idInterno}`;
  const nombreBase = idCampo.replace(/[^a-zA-Z0-9_-]/g, '-');
  const [seleccion, setSeleccion] = useState(() => parsearFechaISO(valor));
  const { minFecha, maxFecha } = useMemo(() => obtenerLimites(min, max), [min, max]);

  useEffect(() => {
    setSeleccion(parsearFechaISO(valor));
  }, [valor]);

  const rangoAnios = useMemo(() => {
    const anioActual = new Date().getFullYear();
    const anioMin = minFecha?.getFullYear() ?? anioActual - 100;
    const anioMax = maxFecha?.getFullYear() ?? anioActual + 10;
    const inicio = Math.min(anioMin, anioMax);
    const fin = Math.max(anioMin, anioMax);

    return Array.from({ length: fin - inicio + 1 }, (_, indice) => String(fin - indice));
  }, [maxFecha, minFecha]);

  const totalDias =
    seleccion.anio && seleccion.mes ? diasEnMes(Number(seleccion.anio), Number(seleccion.mes)) : 31;

  const dias = Array.from({ length: totalDias }, (_, indice) => String(indice + 1));

  const actualizarSeleccion = (campo: 'dia' | 'mes' | 'anio', nuevoValor: string) => {
    const siguiente = { ...seleccion, [campo]: nuevoValor };

    if (siguiente.anio && siguiente.mes && siguiente.dia) {
      const anioNumero = Number(siguiente.anio);
      const mesNumero = Number(siguiente.mes);
      const diaNumero = Number(siguiente.dia);
      const diasMaximos = diasEnMes(anioNumero, mesNumero);

      if (diaNumero > diasMaximos) {
        siguiente.dia = '';
      }
    }

    setSeleccion(siguiente);

    if (!siguiente.dia || !siguiente.mes || !siguiente.anio) {
      alCambiar('');
      return;
    }

    const anioNumero = Number(siguiente.anio);
    const mesNumero = Number(siguiente.mes);
    const diaNumero = Number(siguiente.dia);

    if (!esFechaValida(anioNumero, mesNumero, diaNumero)) {
      alCambiar('');
      return;
    }

    const fechaConstruida = new Date(anioNumero, mesNumero - 1, diaNumero);
    fechaConstruida.setHours(0, 0, 0, 0);

    if ((minFecha && fechaConstruida < minFecha) || (maxFecha && fechaConstruida > maxFecha)) {
      alCambiar('');
      return;
    }

    alCambiar(construirFechaISO(anioNumero, mesNumero, diaNumero));
  };

  return (
    <div className={claseContenedor}>
      {!ocultarEtiqueta && (
        <label htmlFor={idCampo} className="mb-2 block text-sm font-semibold text-slate-700">
          {etiqueta}
        </label>
      )}
      <div className="grid grid-cols-3 gap-2">
        <select
          id={idCampo}
          name={`${nombreBase}-dia`}
          autoComplete="bday-day"
          value={seleccion.dia}
          onChange={(evento) => actualizarSeleccion('dia', evento.target.value)}
          aria-required={requerido}
          aria-invalid={Boolean(error)}
          className={
            claseSelect ??
            'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-all focus:ring-2 focus:ring-pink-500'
          }
        >
          <option value="">Día</option>
          {dias.map((dia) => (
            <option key={dia} value={dia}>
              {dia}
            </option>
          ))}
        </select>
        <select
          id={`${idCampo}-mes`}
          name={`${nombreBase}-mes`}
          autoComplete="bday-month"
          value={seleccion.mes}
          onChange={(evento) => actualizarSeleccion('mes', evento.target.value)}
          aria-invalid={Boolean(error)}
          className={
            claseSelect ??
            'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-all focus:ring-2 focus:ring-pink-500'
          }
        >
          <option value="">Mes</option>
          {MESES.map((mes, indice) => (
            <option key={mes} value={indice + 1}>
              {mes}
            </option>
          ))}
        </select>
        <select
          id={`${idCampo}-anio`}
          name={`${nombreBase}-anio`}
          autoComplete="bday-year"
          value={seleccion.anio}
          onChange={(evento) => actualizarSeleccion('anio', evento.target.value)}
          aria-invalid={Boolean(error)}
          className={
            claseSelect ??
            'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition-all focus:ring-2 focus:ring-pink-500'
          }
        >
          <option value="">Año</option>
          {rangoAnios.map((anio) => (
            <option key={anio} value={anio}>
              {anio}
            </option>
          ))}
        </select>
      </div>
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
