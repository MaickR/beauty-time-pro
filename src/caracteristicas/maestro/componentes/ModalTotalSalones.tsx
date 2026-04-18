import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { X, Download, Search } from 'lucide-react';
import * as XLSX from 'xlsx';
import { obtenerTotalSalones } from '../../../servicios/servicioAdmin';
import type { SalonTotalMetrica } from '../../../servicios/servicioAdmin';
import { construirNombreArchivoExportacion } from '../../../utils/archivos';
import { formatearFechaHumana } from '../../../utils/formato';
import { EsqueletoTarjeta } from '../../../componentes/ui/Esqueleto';

interface PropsModalTotalSalones {
  onCerrar: () => void;
}

const LIMITE = 10;

type CampoOrden = 'nombre' | 'fechaCreacion' | 'plan' | 'pais' | 'vendedor';
type DireccionOrden = 'asc' | 'desc';

export function ModalTotalSalones({ onCerrar }: PropsModalTotalSalones) {
  const [buscar, setBuscar] = useState('');
  const [buscarDebounced, setBuscarDebounced] = useState('');
  const [pagina, setPagina] = useState(1);
  const [filtrosplan, setFiltrosPlan] = useState<string[]>([]);
  const [filtrosPais, setFiltrosPais] = useState<string[]>([]);
  const [vendedor, setVendedor] = useState('');
  const [vendedorDebounced, setVendedorDebounced] = useState('');
  const [temporizadorVendedor, setTemporizadorVendedor] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [campoOrden, setCampoOrden] = useState<CampoOrden>('fechaCreacion');
  const [direccionOrden, setDireccionOrden] = useState<DireccionOrden>('desc');
  const [exportando, setExportando] = useState(false);

  // Debounce manual
  const [temporizador, setTemporizador] = useState<ReturnType<typeof setTimeout> | null>(null);
  const manejarBuscar = (valor: string) => {
    setBuscar(valor);
    if (temporizador) clearTimeout(temporizador);
    setTemporizador(
      setTimeout(() => {
        setBuscarDebounced(valor);
        setPagina(1);
      }, 300),
    );
  };

  const manejarVendedor = (valor: string) => {
    setVendedor(valor);
    if (temporizadorVendedor) clearTimeout(temporizadorVendedor);
    setTemporizadorVendedor(
      setTimeout(() => {
        setVendedorDebounced(valor);
        setPagina(1);
      }, 300),
    );
  };

  const planStr = filtrosplan.length > 0 ? filtrosplan.join(',') : undefined;
  const paisStr = filtrosPais.length > 0 ? filtrosPais.join(',') : undefined;

  const ordenarSalones = (salones: SalonTotalMetrica[]) => {
    const copia = [...salones];
    copia.sort((a, b) => {
      let valorA: string;
      let valorB: string;
      switch (campoOrden) {
        case 'nombre':
          valorA = a.nombre.toLowerCase();
          valorB = b.nombre.toLowerCase();
          break;
        case 'fechaCreacion':
          valorA = a.fechaCreacion;
          valorB = b.fechaCreacion;
          break;
        case 'plan':
          valorA = a.plan;
          valorB = b.plan;
          break;
        case 'pais':
          valorA = a.pais;
          valorB = b.pais;
          break;
        case 'vendedor':
          valorA = (a.vendedor ?? '').toLowerCase();
          valorB = (b.vendedor ?? '').toLowerCase();
          break;
        default:
          return 0;
      }
      const resultado = valorA < valorB ? -1 : valorA > valorB ? 1 : 0;
      return direccionOrden === 'asc' ? resultado : -resultado;
    });
    return copia;
  };

  const { data, isLoading } = useQuery({
    queryKey: [
      'admin',
      'metricas',
      'total-salones',
      buscarDebounced,
      planStr,
      paisStr,
      vendedorDebounced,
      pagina,
    ],
    queryFn: () =>
      obtenerTotalSalones({
        buscar: buscarDebounced || undefined,
        plan: planStr,
        pais: paisStr,
        vendedor: vendedorDebounced || undefined,
        pagina,
        limite: LIMITE,
      }),
    staleTime: 15_000,
  });

  const alternarFiltro = (lista: string[], valor: string, setter: (v: string[]) => void) => {
    setter(lista.includes(valor) ? lista.filter((v) => v !== valor) : [...lista, valor]);
    setPagina(1);
  };

  const alternarOrden = (campo: CampoOrden) => {
    if (campoOrden === campo) {
      setDireccionOrden((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setCampoOrden(campo);
      setDireccionOrden('asc');
    }
  };

  const datosOrdenados = useMemo(() => {
    if (!data?.datos) return [];
    return ordenarSalones(data.datos);
  }, [data?.datos, campoOrden, direccionOrden]);

  const indicadorOrden = (campo: CampoOrden) => {
    if (campoOrden !== campo) return '↕';
    return direccionOrden === 'asc' ? '↑' : '↓';
  };

  const exportarExcel = async () => {
    if (exportando) return;
    setExportando(true);

    try {
      const primerLote = await obtenerTotalSalones({
        buscar: buscarDebounced || undefined,
        plan: planStr,
        pais: paisStr,
        vendedor: vendedorDebounced || undefined,
        pagina: 1,
        limite: 100,
      });

      let todosLosSalones = [...primerLote.datos];

      for (let paginaActual = 2; paginaActual <= primerLote.totalPaginas; paginaActual += 1) {
        const respuesta = await obtenerTotalSalones({
          buscar: buscarDebounced || undefined,
          plan: planStr,
          pais: paisStr,
          vendedor: vendedorDebounced || undefined,
          pagina: paginaActual,
          limite: 100,
        });
        todosLosSalones = [...todosLosSalones, ...respuesta.datos];
      }

      const filas = ordenarSalones(todosLosSalones).map((s: SalonTotalMetrica) => ({
        'Nombre del salón': s.nombre,
        'Fecha de creación': formatearFechaHumana(s.fechaCreacion),
        Plan: s.plan,
        País: s.pais,
        Dueño: s.dueno,
        Vendedor: s.vendedor ?? 'N/A',
      }));

      const hoja = XLSX.utils.json_to_sheet(filas);
      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, 'Total Salones');
      XLSX.writeFile(libro, construirNombreArchivoExportacion('total salones'));
    } finally {
      setExportando(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-total-salones-titulo"
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onKeyDown={(e) => e.key === 'Escape' && onCerrar()}
    >
      <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        {/* Encabezado */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2
            id="modal-total-salones-titulo"
            className="text-lg font-black text-slate-900 uppercase"
          >
            Total Salones
          </h2>
          <button
            onClick={onCerrar}
            className="p-2 rounded-full hover:bg-slate-100"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filtros */}
        <div className="px-6 py-4 border-b border-slate-100 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar por nombre del salón o dueño..."
              value={buscar}
              onChange={(e) => manejarBuscar(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-pink-500 outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="text-xs font-black text-slate-400 uppercase self-center mr-1">
              Plan:
            </span>
            {['STANDARD', 'PRO'].map((plan) => (
              <button
                key={plan}
                onClick={() => alternarFiltro(filtrosplan, plan, setFiltrosPlan)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  filtrosplan.includes(plan)
                    ? 'bg-pink-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {plan === 'PRO' ? 'Pro' : 'Estándar'}
              </button>
            ))}
            <span className="text-xs font-black text-slate-400 uppercase self-center ml-3 mr-1">
              País:
            </span>
            {['Mexico', 'Colombia'].map((p) => (
              <button
                key={p}
                onClick={() => alternarFiltro(filtrosPais, p, setFiltrosPais)}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  filtrosPais.includes(p)
                    ? 'bg-pink-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {p === 'Mexico' ? 'México' : p}
              </button>
            ))}
            <span className="text-xs font-black text-slate-400 uppercase self-center ml-3 mr-1">
              Vendedor:
            </span>
            <input
              type="text"
              placeholder="Filtrar por vendedor..."
              value={vendedor}
              onChange={(e) => manejarVendedor(e.target.value)}
              className="px-3 py-1 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-pink-500 outline-none w-40"
            />
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
                  <th
                    className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase cursor-pointer select-none hover:text-slate-600"
                    onClick={() => alternarOrden('nombre')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Nombre del salón {indicadorOrden('nombre')}
                    </span>
                  </th>
                  <th
                    className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase cursor-pointer select-none hover:text-slate-600"
                    onClick={() => alternarOrden('fechaCreacion')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Fecha de creación {indicadorOrden('fechaCreacion')}
                    </span>
                  </th>
                  <th
                    className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase cursor-pointer select-none hover:text-slate-600"
                    onClick={() => alternarOrden('plan')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Plan {indicadorOrden('plan')}
                    </span>
                  </th>
                  <th
                    className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase cursor-pointer select-none hover:text-slate-600"
                    onClick={() => alternarOrden('pais')}
                  >
                    <span className="inline-flex items-center gap-1">
                      País {indicadorOrden('pais')}
                    </span>
                  </th>
                  <th
                    className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase cursor-pointer select-none hover:text-slate-600"
                    onClick={() => alternarOrden('vendedor')}
                  >
                    <span className="inline-flex items-center gap-1">
                      Vendedor {indicadorOrden('vendedor')}
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {datosOrdenados.map((s) => (
                  <tr key={s.id} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-3 px-2 font-bold text-slate-900">{s.nombre}</td>
                    <td className="py-3 px-2 text-slate-600">
                      {formatearFechaHumana(s.fechaCreacion)}
                    </td>
                    <td className="py-3 px-2">
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${s.plan === 'PRO' ? 'bg-purple-100 text-purple-700' : 'bg-slate-100 text-slate-600'}`}
                      >
                        {s.plan}
                      </span>
                    </td>
                    <td className="py-3 px-2 text-slate-600">{s.pais}</td>
                    <td className="py-3 px-2 text-slate-500">{s.vendedor ?? '—'}</td>
                  </tr>
                ))}
                {datosOrdenados.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-bold">
                      No se encontraron salones
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Paginación y exportar */}
        <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs font-bold text-slate-500">
            {data?.total ?? 0} salones en total — Página {pagina} de {data?.totalPaginas ?? 1}
          </p>
          <div className="flex flex-wrap gap-2">
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
            <button
              onClick={exportarExcel}
              disabled={exportando}
              className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5" />
              {exportando ? 'Exportando...' : 'Exportar Excel'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
