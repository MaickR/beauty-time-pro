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
}

export function CalendarioEstadoSalon({
  estudio,
  fechaSeleccionada,
  alCambiarFecha,
  fechasConCitas = [],
  mostrarCitas = true,
  etiquetaCitas = 'Citas',
  titulo = 'Calendario',
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
    <div className="bg-white rounded-[3rem] p-6 md:p-8 border border-slate-200 shadow-sm">
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => cambiarMes(-1)}
          aria-label="Mes anterior"
          className="p-2 hover:bg-slate-100 rounded-full"
        >
          <ChevronLeft className="w-5 h-5" />
        </button>
        <h3 className="text-xl font-black italic uppercase tracking-tighter text-center">
          {titulo}
          <span className="mt-1 block text-sm not-italic font-bold tracking-wide text-slate-500">
            {fechaSeleccionada.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
          </span>
        </h3>
        <button
          onClick={() => cambiarMes(1)}
          aria-label="Mes siguiente"
          className="p-2 hover:bg-slate-100 rounded-full"
        >
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      <div className="grid grid-cols-7 mb-4 text-center text-[10px] font-black text-slate-400 uppercase">
        {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((dia, indice) => (
          <div key={`${dia}-${indice}`}>{dia}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5 md:gap-2">
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
                className={`w-full h-full rounded-2xl font-black text-xs md:text-sm transition-all relative flex flex-col items-center justify-center ${clasesBase}`}
                aria-label={estadoDia.fecha}
                aria-pressed={seleccionado}
              >
                {dia}
                {!seleccionado && (tieneCitas || estadoDia.esCierre || estadoDia.tieneHorarioModificado) && (
                  <span className="absolute bottom-1 flex items-center gap-1">
                    {tieneCitas && <span className="h-1.5 w-1.5 rounded-full bg-pink-500" />}
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

      <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-[10px] font-black uppercase tracking-wide text-slate-500">
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