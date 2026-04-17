import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Estudio } from '../../tipos';
import { obtenerFechaLocalISO } from '../../utils/formato';
import { obtenerEstadoCalendarioAgenda } from '../../caracteristicas/estudio/utils/estadoCalendarioAgenda';
import { DialogoConfirmacion } from './DialogoConfirmacion';

interface PropsCalendarioEstadoSalon {
  estudio: Estudio;
  fechaSeleccionada: Date;
  alCambiarFecha: (fecha: Date) => void;
  fechasConCitas?: string[];
  mostrarCitas?: boolean;
  etiquetaCitas?: string;
  titulo?: string;
  variante?: 'regular' | 'compacta';
}

export function CalendarioEstadoSalon({
  estudio,
  fechaSeleccionada,
  alCambiarFecha,
  fechasConCitas = [],
  mostrarCitas = true,
  etiquetaCitas = 'Citas',
  titulo = 'Calendario',
  variante = 'regular',
}: PropsCalendarioEstadoSalon) {
  const [detalleCalendario, setDetalleCalendario] = useState<{
    mensaje: string;
    descripcion: string;
  } | null>(null);

  const primerDia = new Date(
    fechaSeleccionada.getFullYear(),
    fechaSeleccionada.getMonth(),
    1,
  ).getDay();
  const diasEnMes = new Date(
    fechaSeleccionada.getFullYear(),
    fechaSeleccionada.getMonth() + 1,
    0,
  ).getDate();
  const diasCalendario = Array.from({ length: 42 }, (_, indice) => {
    const dia = indice - primerDia + 1;
    return dia > 0 && dia <= diasEnMes ? dia : null;
  });
  const fechaSeleccionadaIso = obtenerFechaLocalISO(fechaSeleccionada);
  const fechasConCitasSet = useMemo(() => new Set(fechasConCitas), [fechasConCitas]);
  const esCompacta = variante === 'compacta';

  const cambiarMes = (offset: number) => {
    alCambiarFecha(
      new Date(fechaSeleccionada.getFullYear(), fechaSeleccionada.getMonth() + offset, 1),
    );
  };

  const manejarSeleccionFecha = (fecha: Date) => {
    alCambiarFecha(fecha);

    const estadoDia = obtenerEstadoCalendarioAgenda({ fecha, estudio });
    if ((estadoDia.esCierre || estadoDia.tieneHorarioModificado) && estadoDia.descripcionDetalle) {
      setDetalleCalendario({
        mensaje: estadoDia.tituloDetalle ?? 'Información del día',
        descripcion: estadoDia.descripcionDetalle,
      });
      return;
    }

    setDetalleCalendario(null);
  };

  return (
    <div
      className={`border border-slate-200 bg-white shadow-sm ${
        esCompacta
          ? 'mx-auto w-full max-w-[48rem] rounded-[2.5rem] p-4 sm:p-5 lg:p-6'
          : 'rounded-[3rem] p-6 md:p-8'
      }`}
    >
      <div className={`flex items-center justify-between ${esCompacta ? 'mb-5' : 'mb-8'}`}>
        <button
          onClick={() => cambiarMes(-1)}
          aria-label="Mes anterior"
          className={`rounded-full transition hover:bg-slate-100 ${esCompacta ? 'p-1.5 sm:p-2' : 'p-2'}`}
        >
          <ChevronLeft className={esCompacta ? 'h-4 w-4 sm:h-5 sm:w-5' : 'h-5 w-5'} />
        </button>
        <h3
          className={`text-center font-black italic uppercase tracking-tighter ${
            esCompacta ? 'text-lg sm:text-xl' : 'text-xl'
          }`}
        >
          {titulo}
          <span
            className={`mt-1 block not-italic font-bold tracking-wide text-slate-500 ${
              esCompacta ? 'text-xs sm:text-sm' : 'text-sm'
            }`}
          >
            {fechaSeleccionada.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
          </span>
        </h3>
        <button
          onClick={() => cambiarMes(1)}
          aria-label="Mes siguiente"
          className={`rounded-full transition hover:bg-slate-100 ${esCompacta ? 'p-1.5 sm:p-2' : 'p-2'}`}
        >
          <ChevronRight className={esCompacta ? 'h-4 w-4 sm:h-5 sm:w-5' : 'h-5 w-5'} />
        </button>
      </div>

      <div
        className={`grid grid-cols-7 text-center font-black uppercase text-slate-400 ${
          esCompacta ? 'mb-3 text-[9px] sm:text-[10px]' : 'mb-4 text-[10px]'
        }`}
      >
        {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((dia, indice) => (
          <div key={`${dia}-${indice}`}>{dia}</div>
        ))}
      </div>

      <div className={`grid grid-cols-7 ${esCompacta ? 'gap-1 sm:gap-1.5' : 'gap-1.5 md:gap-2'}`}>
        {diasCalendario.map((dia, indice) => {
          if (!dia) {
            return <div key={`vacio-${indice}`} />;
          }

          const fecha = new Date(
            fechaSeleccionada.getFullYear(),
            fechaSeleccionada.getMonth(),
            dia,
          );
          const estadoDia = obtenerEstadoCalendarioAgenda({ fecha, estudio });
          const seleccionado = estadoDia.fecha === fechaSeleccionadaIso;
          const tieneCitas = mostrarCitas && fechasConCitasSet.has(estadoDia.fecha);

          const clasesBase = seleccionado
            ? 'bg-slate-900 text-white shadow-lg scale-110 z-10'
            : estadoDia.esCierre
              ? 'bg-orange-50 text-orange-600 border border-orange-200 hover:bg-orange-100'
              : estadoDia.tieneHorarioModificado
                ? 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
                : tieneCitas
                  ? 'bg-pink-50 text-pink-700 border border-pink-200 hover:bg-pink-100'
                  : 'text-slate-600 hover:bg-slate-100 border border-transparent';

          return (
            <div key={estadoDia.fecha} className="aspect-square flex items-center justify-center">
              <button
                onClick={() => manejarSeleccionFecha(fecha)}
                className={`relative flex h-full w-full flex-col items-center justify-center font-black transition-all ${
                  esCompacta
                    ? 'rounded-[1.15rem] text-[11px] sm:text-xs lg:text-sm'
                    : 'rounded-2xl text-xs md:text-sm'
                } ${clasesBase}`}
                aria-label={estadoDia.fecha}
                aria-pressed={seleccionado}
              >
                {dia}
                {!seleccionado &&
                  (tieneCitas || estadoDia.esCierre || estadoDia.tieneHorarioModificado) && (
                    <span
                      className={`absolute flex items-center gap-1 ${esCompacta ? 'bottom-0.5' : 'bottom-1'}`}
                    >
                      {tieneCitas && (
                        <span
                          className={`${esCompacta ? 'h-1.5 w-1.5' : 'h-1.5 w-1.5'} rounded-full bg-pink-500`}
                        />
                      )}
                      {estadoDia.esCierre && (
                        <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                      )}
                      {estadoDia.tieneHorarioModificado && (
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                      )}
                    </span>
                  )}
              </button>
            </div>
          );
        })}
      </div>

      <div
        className={`flex flex-wrap items-center justify-center gap-4 font-black uppercase tracking-wide text-slate-500 ${
          esCompacta ? 'mt-4 text-[9px] sm:text-[10px]' : 'mt-5 text-[10px]'
        }`}
      >
        {mostrarCitas && (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-pink-500" /> {etiquetaCitas}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-orange-500" /> Cierres
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-blue-500" /> Horario modificado
        </span>
      </div>

      <DialogoConfirmacion
        abierto={Boolean(detalleCalendario)}
        mensaje={detalleCalendario?.mensaje ?? 'Información del día'}
        descripcion={detalleCalendario?.descripcion}
        textoCancelar="Cerrar"
        textoConfirmar="Entendido"
        onCancelar={() => setDetalleCalendario(null)}
        onConfirmar={() => setDetalleCalendario(null)}
      />
    </div>
  );
}
