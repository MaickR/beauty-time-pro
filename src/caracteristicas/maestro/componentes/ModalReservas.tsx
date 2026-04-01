import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, CalendarDays } from 'lucide-react';
import { obtenerReservasMetrica } from '../../../servicios/servicioAdmin';
import { formatearFechaHumana } from '../../../utils/formato';
import { EsqueletoTarjeta } from '../../../componentes/ui/Esqueleto';

interface PropsModalReservas {
  onCerrar: () => void;
}

const LIMITE = 10;

function obtenerFechaHoy(): string {
  return new Date().toISOString().split('T')[0]!;
}

function obtenerFechaHace30Dias(): string {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() - 30);
  return fecha.toISOString().split('T')[0]!;
}

const ESTADOS_FILTRO = [
  { valor: 'pending', etiqueta: 'Pending' },
  { valor: 'confirmed', etiqueta: 'Confirmed' },
  { valor: 'completed', etiqueta: 'Completed' },
  { valor: 'cancelled', etiqueta: 'Cancelled' },
  { valor: 'rescheduled', etiqueta: 'Rescheduled' },
  { valor: 'no_show', etiqueta: 'No show' },
] as const;

const PAISES_FILTRO = ['Mexico', 'Colombia'] as const;

export function ModalReservas({ onCerrar }: PropsModalReservas) {
  const [fechaInicio, setFechaInicio] = useState(obtenerFechaHace30Dias);
  const [fechaFin, setFechaFin] = useState(obtenerFechaHoy);
  const [estadosFiltro, setEstadosFiltro] = useState<string[]>([]);
  const [paisFiltro, setPaisFiltro] = useState<string[]>([]);
  const [pagina, setPagina] = useState(1);

  const estadoStr = estadosFiltro.length > 0 ? estadosFiltro.join(',') : undefined;
  const paisStr = paisFiltro.length > 0 ? paisFiltro.join(',') : undefined;

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'metricas', 'reservas', fechaInicio, fechaFin, estadoStr, paisStr, pagina],
    queryFn: () =>
      obtenerReservasMetrica({
        fechaInicio,
        fechaFin,
        estado: estadoStr,
        pais: paisStr,
        pagina,
        limite: LIMITE,
      }),
    staleTime: 15_000,
  });

  const alternarFiltro = (lista: string[], valor: string, setter: (v: string[]) => void) => {
    setter(lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]);
    setPagina(1);
  };

  const limpiarPaises = () => {
    setPaisFiltro([]);
    setPagina(1);
  };

  const etiquetaEstado = (estado: string) => {
    switch (estado) {
      case 'cancelled':
        return 'Cancelled';
      case 'completed':
        return 'Completed';
      case 'pending':
        return 'Pending';
      case 'confirmed':
        return 'Confirmed';
      case 'rescheduled':
        return 'Rescheduled';
      case 'no_show':
        return 'No show';
      default:
        return estado;
    }
  };

  const colorEstado = (estado: string) => {
    switch (estado) {
      case 'cancelled':
        return 'bg-red-100 text-red-700';
      case 'completed':
        return 'bg-green-100 text-green-700';
      case 'pending':
        return 'bg-yellow-100 text-yellow-700';
      case 'confirmed':
        return 'bg-blue-100 text-blue-700';
      case 'rescheduled':
        return 'bg-orange-100 text-orange-700';
      case 'no_show':
        return 'bg-slate-200 text-slate-700';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-reservas-titulo"
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onKeyDown={(e) => e.key === 'Escape' && onCerrar()}
    >
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 id="modal-reservas-titulo" className="text-lg font-black text-slate-900 uppercase">
            Reservas
          </h2>
          <button
            onClick={onCerrar}
            className="p-2 rounded-full hover:bg-slate-100"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Controles de fecha y filtros */}
        <div className="px-6 py-4 border-b border-slate-100 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <CalendarDays className="w-4 h-4 text-slate-400" />
            <label className="sr-only" htmlFor="reservas-fecha-desde">
              Desde
            </label>
            <input
              id="reservas-fecha-desde"
              type="date"
              value={fechaInicio}
              onChange={(e) => {
                setFechaInicio(e.target.value);
                setPagina(1);
              }}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-pink-500"
            />
            <span className="text-xs font-bold text-slate-400">a</span>
            <label className="sr-only" htmlFor="reservas-fecha-hasta">
              Hasta
            </label>
            <input
              id="reservas-fecha-hasta"
              type="date"
              value={fechaFin}
              onChange={(e) => {
                setFechaFin(e.target.value);
                setPagina(1);
              }}
              className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-pink-500"
            />
            {data && (
              <span className="ml-auto text-sm font-black text-pink-600">
                {data.totalReservas.toLocaleString('es-MX')} reservas en total
              </span>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-black text-slate-400 uppercase self-center mr-1">
              Estado:
            </span>
            {ESTADOS_FILTRO.map((e) => (
              <button
                key={e.valor}
                onClick={() => alternarFiltro(estadosFiltro, e.valor, setEstadosFiltro)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  estadosFiltro.includes(e.valor)
                    ? 'bg-pink-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {e.etiqueta}
              </button>
            ))}
            <span className="text-xs font-black text-slate-400 uppercase self-center ml-3 mr-1">
              País:
            </span>
            <button
              onClick={limpiarPaises}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                paisFiltro.length === 0
                  ? 'bg-pink-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              All
            </button>
            {PAISES_FILTRO.map((p) => (
              <button
                key={p}
                onClick={() => alternarFiltro(paisFiltro, p, setPaisFiltro)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  paisFiltro.includes(p)
                    ? 'bg-pink-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p}
              </button>
            ))}
          </div>
        </div>

        {/* Tabla */}
        <div className="flex-1 overflow-auto px-6 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <EsqueletoTarjeta key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                    Salón
                  </th>
                  <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                    Fecha
                  </th>
                  <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                    Estado
                  </th>
                  <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                    País
                  </th>
                </tr>
              </thead>
              <tbody>
                {data?.datos.map((r) => (
                  <tr key={r.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-3 px-2 font-bold text-slate-900">{r.salon}</td>
                    <td className="py-3 px-2 text-slate-600">{formatearFechaHumana(r.fecha)}</td>
                    <td className="py-3 px-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${colorEstado(r.estado)}`}
                      >
                        {etiquetaEstado(r.estado)}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-slate-600">{r.pais}</td>
                  </tr>
                ))}
                {(!data?.datos || data.datos.length === 0) && (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-slate-400 font-bold">
                      No se encontraron reservas
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginación */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-slate-200">
          <p className="text-xs font-bold text-slate-500">
            {data?.total ?? 0} filtradas — Página {pagina} de {data?.totalPaginas ?? 1}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={pagina <= 1}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold disabled:opacity-40"
            >
              Anterior
            </button>
            <button
              onClick={() => setPagina((p) => (data && p < data.totalPaginas ? p + 1 : p))}
              disabled={!data || pagina >= data.totalPaginas}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold disabled:opacity-40"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
