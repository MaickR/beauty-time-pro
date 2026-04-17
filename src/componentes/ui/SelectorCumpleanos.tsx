import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays } from 'lucide-react';
import { DayPicker } from 'react-day-picker';
import { es } from 'date-fns/locale';
import {
  formatearCumpleanos,
  obtenerCumpleanosIso,
  obtenerFechaCumpleanos,
} from '../../lib/registroCliente';

interface PropsSelectorCumpleanos {
  valor: string;
  alCambiar: (valor: string) => void;
  placeholder?: string;
  className?: string;
}

export function SelectorCumpleanos({
  valor,
  alCambiar,
  placeholder = 'Selecciona cumpleaños',
  className = '',
}: PropsSelectorCumpleanos) {
  const [abierto, setAbierto] = useState(false);
  const contenedorRef = useRef<HTMLDivElement | null>(null);
  const anioActual = new Date().getFullYear();
  const inicioAnio = useMemo(() => new Date(anioActual, 0, 1), [anioActual]);
  const finAnio = useMemo(() => new Date(anioActual, 11, 31), [anioActual]);
  const fechaSeleccionada = useMemo(() => obtenerFechaCumpleanos(valor), [valor]);
  const [mesVisible, setMesVisible] = useState<Date>(fechaSeleccionada ?? inicioAnio);

  useEffect(() => {
    if (!fechaSeleccionada) {
      return;
    }
    setMesVisible(fechaSeleccionada);
  }, [fechaSeleccionada]);

  useEffect(() => {
    if (!abierto) {
      return;
    }

    const manejarClickExterno = (evento: MouseEvent) => {
      if (!contenedorRef.current?.contains(evento.target as Node)) {
        setAbierto(false);
      }
    };

    document.addEventListener('mousedown', manejarClickExterno);
    return () => document.removeEventListener('mousedown', manejarClickExterno);
  }, [abierto]);

  return (
    <div ref={contenedorRef} className={`relative ${className}`.trim()}>
      <button
        type="button"
        onClick={() => setAbierto((actual) => !actual)}
        className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 text-left text-sm font-bold text-slate-800 outline-none transition focus:border-pink-400"
        aria-haspopup="dialog"
        aria-expanded={abierto}
      >
        <span className={valor ? 'text-slate-800' : 'text-slate-400'}>
          {valor ? formatearCumpleanos(valor) : placeholder}
        </span>
        <CalendarDays className="h-4 w-4 text-slate-400" aria-hidden="true" />
      </button>

      {abierto ? (
        <div className="selector-fecha-popover absolute left-0 top-[calc(100%+0.5rem)] z-50 rounded-3xl border border-slate-200 bg-white p-4 shadow-2xl shadow-slate-900/10">
          <DayPicker
            mode="single"
            month={mesVisible}
            onMonthChange={setMesVisible}
            selected={fechaSeleccionada}
            onSelect={(fecha) => {
              if (!fecha) {
                return;
              }
              alCambiar(obtenerCumpleanosIso(fecha));
              setAbierto(false);
            }}
            startMonth={inicioAnio}
            endMonth={finAnio}
            locale={es}
          />
        </div>
      ) : null}
    </div>
  );
}