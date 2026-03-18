import { useState, useEffect, useCallback } from 'react';
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { usarContextoApp } from '../../../contextos/ContextoApp';
import {
  obtenerBaseClientesAdmin,
  exportarBaseClientesAdmin,
} from '../../../servicios/servicioAdmin';
import type { ClienteAdmin } from '../../../tipos';

const LIMITE_PAGINA = 50;

const PAISES = ['México', 'Colombia'];

function formatearDinero(cantidad: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(cantidad);
}

export function BaseClientes() {
  const { estudios } = usarContextoApp();
  const [clientes, setClientes] = useState<ClienteAdmin[]>([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [totalPaginas, setTotalPaginas] = useState(1);
  const [cargando, setCargando] = useState(false);
  const [exportando, setExportando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [buscar, setBuscar] = useState('');
  const [buscarDebounced, setBuscarDebounced] = useState('');
  const [salonId, setSalonId] = useState('');
  const [pais, setPais] = useState('');
  const [servicioFrecuente, setServicioFrecuente] = useState('');
  const [servicioFrecuenteDebounced, setServicioFrecuenteDebounced] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setBuscarDebounced(buscar), 300);
    return () => clearTimeout(timer);
  }, [buscar]);

  useEffect(() => {
    const timer = setTimeout(() => setServicioFrecuenteDebounced(servicioFrecuente), 300);
    return () => clearTimeout(timer);
  }, [servicioFrecuente]);

  const cargarClientes = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await obtenerBaseClientesAdmin({
        pagina,
        limite: LIMITE_PAGINA,
        buscar: buscarDebounced || undefined,
        salonId: salonId || undefined,
        pais: pais || undefined,
        servicioFrecuente: servicioFrecuenteDebounced || undefined,
      });
      setClientes(res.clientes);
      setTotal(res.total);
      setTotalPaginas(res.totalPaginas);
    } catch {
      setError('No se pudo cargar la base de clientes.');
    } finally {
      setCargando(false);
    }
  }, [pagina, buscarDebounced, salonId, pais, servicioFrecuenteDebounced]);

  useEffect(() => {
    void cargarClientes();
  }, [cargarClientes]);

  // Cuando cambian los filtros, volver a pág 1
  useEffect(() => {
    setPagina(1);
  }, [buscarDebounced, salonId, pais, servicioFrecuenteDebounced]);

  const manejarExportar = async () => {
    setExportando(true);
    try {
      const todos = await exportarBaseClientesAdmin({
        buscar: buscarDebounced || undefined,
        salonId: salonId || undefined,
        pais: pais || undefined,
        servicioFrecuente: servicioFrecuenteDebounced || undefined,
      });

      const filas = todos.map((c) => ({
        Nombre: c.nombre,
        Teléfono: c.telefono,
        Correo: c.correo ?? '',
        Salón: c.nombreEstudio,
        País: c.paisEstudio,
        'Servicio frecuente': c.servicioMasFrecuente,
        'Última visita': c.ultimaVisita ?? '',
        'Total visitas': c.totalVisitas,
        'Total gastado': c.totalGastado,
      }));

      const hoja = XLSX.utils.json_to_sheet(filas);

      // Estilo de encabezados — bold + fondo rosa
      const encabezados = Object.keys(filas[0] ?? {});
      encabezados.forEach((_, idx) => {
        const celda = XLSX.utils.encode_cell({ r: 0, c: idx });
        if (!hoja[celda]) return;
        hoja[celda].s = {
          font: { bold: true },
          fill: { patternType: 'solid', fgColor: { rgb: 'F472B6' } },
          alignment: { horizontal: 'center' },
        };
      });

      // Ancho automático de columnas
      const anchos = encabezados.map((k) => ({
        wch:
          Math.max(
            k.length,
            ...todos.map((c) => String((c as unknown as Record<string, unknown>)[k] ?? '').length),
          ) + 2,
      }));
      hoja['!cols'] = anchos;

      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, 'Clientes');

      const fecha = new Date().toISOString().slice(0, 10);
      XLSX.writeFile(libro, `clientes-beauty-time-pro-${fecha}.xlsx`);
    } catch {
      setError('No se pudo exportar el archivo.');
    } finally {
      setExportando(false);
    }
  };

  const inicioRango = (pagina - 1) * LIMITE_PAGINA + 1;
  const finRango = Math.min(pagina * LIMITE_PAGINA, total);

  return (
    <div aria-busy={cargando}>
      <div className="flex flex-col md:flex-row md:items-end gap-4 mb-6">
        <div className="flex-1">
          <h1 className="text-4xl font-black italic uppercase tracking-tighter mb-1">
            Base de Datos
          </h1>
          <p className="text-slate-500 font-medium">
            Clientes registrados en toda la red de salones
          </p>
        </div>
        <button
          onClick={() => void manejarExportar()}
          disabled={exportando || total === 0}
          aria-label="Exportar clientes a Excel"
          className="no-imprimir flex items-center gap-2 bg-pink-600 text-white px-6 py-3 rounded-xl font-black text-sm hover:bg-pink-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          {exportando ? 'Exportando…' : 'Exportar Excel'}
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 flex flex-col md:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Buscar por nombre, teléfono o correo…"
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-pink-300"
          />
        </div>

        <select
          value={salonId}
          onChange={(e) => setSalonId(e.target.value)}
          aria-label="Filtrar por salón"
          className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300"
        >
          <option value="">Todos los salones</option>
          {estudios.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>

        <select
          value={pais}
          onChange={(e) => setPais(e.target.value)}
          aria-label="Filtrar por país"
          className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300"
        >
          <option value="">Todos los países</option>
          {PAISES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>

        <input
          type="text"
          value={servicioFrecuente}
          onChange={(e) => setServicioFrecuente(e.target.value)}
          placeholder="Servicio frecuente…"
          className="text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300"
        />
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 font-medium">
          {error}
        </div>
      )}

      {/* Tabla */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
        {cargando ? (
          <div className="py-16 text-center text-slate-500 font-medium" aria-busy="true">
            Cargando clientes…
          </div>
        ) : clientes.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-slate-500 font-medium">
              No se encontraron clientes con los filtros aplicados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {[
                    'Nombre',
                    'Teléfono',
                    'Correo',
                    'Salón',
                    'País',
                    'Servicio frecuente',
                    'Última visita',
                    'Visitas',
                    'Total gastado',
                  ].map((col) => (
                    <th
                      key={col}
                      className="text-left px-4 py-3 text-xs font-black text-slate-600 uppercase tracking-wide whitespace-nowrap"
                    >
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clientes.map((c, idx) => (
                  <tr key={c.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                      {c.nombre}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.telefono}</td>
                    <td className="px-4 py-3 text-slate-500">{c.correo ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {c.nombreEstudio}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.paisEstudio}</td>
                    <td className="px-4 py-3 text-slate-600">{c.servicioMasFrecuente || '—'}</td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {c.ultimaVisita ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-center font-semibold text-slate-900">
                      {c.totalVisitas}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                      {formatearDinero(c.totalGastado)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Paginación */}
      {!cargando && total > 0 && (
        <div className="flex items-center justify-between mt-4 text-sm text-slate-600">
          <span className="font-medium">
            Mostrando {inicioRango}–{finRango} de {total.toLocaleString('es-MX')} clientes
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={pagina === 1}
              aria-label="Página anterior"
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-4 py-2 rounded-lg border border-slate-200 font-black">
              {pagina} / {totalPaginas}
            </span>
            <button
              onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
              disabled={pagina === totalPaginas}
              aria-label="Página siguiente"
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
