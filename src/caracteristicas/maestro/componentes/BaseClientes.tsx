import { useState, useEffect, useCallback } from 'react';
import { Search, Download, ChevronLeft, ChevronRight } from 'lucide-react';
import * as XLSX from 'xlsx';
import { usarContextoApp } from '../../../contextos/ContextoApp';
import {
  obtenerBaseClientesAdmin,
  exportarBaseClientesAdmin,
} from '../../../servicios/servicioAdmin';
import type { ClienteAdmin } from '../../../tipos';

const LIMITE_PAGINA = 10;

const PAISES = ['México', 'Colombia'];

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
  const [busquedaSalon, setBusquedaSalon] = useState('');
  const [pais, setPais] = useState('');
  const [servicioFrecuente, setServicioFrecuente] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => setBuscarDebounced(buscar), 300);
    return () => clearTimeout(timer);
  }, [buscar]);

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
        servicioFrecuente: servicioFrecuente || undefined,
      });
      setClientes(res.clientes);
      setTotal(res.total);
      setTotalPaginas(res.totalPaginas);
    } catch {
      setError('No se pudo cargar la base de clientes.');
    } finally {
      setCargando(false);
    }
  }, [pagina, buscarDebounced, salonId, pais, servicioFrecuente]);

  useEffect(() => {
    void cargarClientes();
  }, [cargarClientes]);

  // Cuando cambian los filtros, volver a pág 1
  useEffect(() => {
    setPagina(1);
  }, [buscarDebounced, salonId, pais, servicioFrecuente]);

  const manejarExportar = async () => {
    setExportando(true);
    try {
      const todos = await exportarBaseClientesAdmin({
        buscar: buscarDebounced || undefined,
        salonId: salonId || undefined,
        pais: pais || undefined,
        servicioFrecuente: servicioFrecuente || undefined,
      });

      const filas = todos.map((c) => ({
        Nombre: c.nombre,
        Contacto: c.telefono,
        Correo: c.correo ?? '',
        Salón: c.nombreEstudio,
        País: c.paisEstudio,
      }));

      const encabezados = Object.keys(
        filas[0] ?? {
          Nombre: '',
          Contacto: '',
          Correo: '',
          Salón: '',
          País: '',
        },
      );
      const datos = [
        ['Base de Clientes — Beauty Time Pro'],
        [
          `Generado: ${new Date().toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}`,
        ],
        [],
        encabezados,
        ...filas.map((fila) =>
          encabezados.map((clave) => (fila as Record<string, unknown>)[clave] ?? ''),
        ),
        [],
        ['Total clientes', todos.length],
      ];

      const hoja = XLSX.utils.aoa_to_sheet(datos);
      hoja['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: encabezados.length - 1 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: encabezados.length - 1 } },
      ];

      const aplicarEstilo = (referencia: string, estilo: Record<string, unknown>) => {
        const celda = hoja[referencia] as Record<string, unknown> | undefined;
        if (!celda) return;
        celda.s = estilo;
      };

      const estiloTitulo = {
        font: { bold: true, sz: 14, color: { rgb: 'FFFFFF' } },
        fill: { patternType: 'solid', fgColor: { rgb: 'F48FB1' } },
        alignment: { horizontal: 'center' },
      };
      const estiloFecha = {
        font: { color: { rgb: '6B7280' }, italic: true },
        fill: { patternType: 'solid', fgColor: { rgb: 'F3F4F6' } },
      };
      const estiloEncabezado = {
        font: { bold: true, color: { rgb: '831843' } },
        fill: { patternType: 'solid', fgColor: { rgb: 'FCE4EC' } },
        border: {
          top: { style: 'thin', color: { rgb: 'E5E7EB' } },
          bottom: { style: 'thin', color: { rgb: 'E5E7EB' } },
          left: { style: 'thin', color: { rgb: 'F3F4F6' } },
          right: { style: 'thin', color: { rgb: 'F3F4F6' } },
        },
      };

      for (let columna = 0; columna < encabezados.length; columna += 1) {
        aplicarEstilo(XLSX.utils.encode_cell({ r: 0, c: columna }), estiloTitulo);
        aplicarEstilo(XLSX.utils.encode_cell({ r: 1, c: columna }), estiloFecha);
        aplicarEstilo(XLSX.utils.encode_cell({ r: 3, c: columna }), estiloEncabezado);
      }

      filas.forEach((_, indice) => {
        const fondo = indice % 2 === 0 ? 'FFFFFF' : 'FAFAFA';
        encabezados.forEach((_, columna) => {
          aplicarEstilo(XLSX.utils.encode_cell({ r: indice + 4, c: columna }), {
            fill: { patternType: 'solid', fgColor: { rgb: fondo } },
            border: {
              left: { style: 'thin', color: { rgb: 'F3F4F6' } },
              right: { style: 'thin', color: { rgb: 'F3F4F6' } },
            },
          });
        });
      });

      encabezados.forEach((_, columna) => {
        aplicarEstilo(XLSX.utils.encode_cell({ r: datos.length - 1, c: columna }), {
          font: { bold: true },
          fill: { patternType: 'solid', fgColor: { rgb: 'FCE7F3' } },
        });
      });

      hoja['!cols'] = encabezados.map((clave) => ({
        wch: Math.max(
          clave.length + 4,
          ...filas.map((fila) => String((fila as Record<string, unknown>)[clave] ?? '').length + 2),
        ),
      }));

      const libro = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(libro, hoja, 'Clientes');

      const fecha = new Date().toLocaleDateString('sv-SE');
      XLSX.writeFile(libro, `clientes-beauty-time-pro-${fecha}.xlsx`);
    } catch {
      setError('No se pudo exportar el archivo.');
    } finally {
      setExportando(false);
    }
  };

  const inicioRango = (pagina - 1) * LIMITE_PAGINA + 1;
  const finRango = Math.min(pagina * LIMITE_PAGINA, total);
  const estudiosFiltrados = estudios.filter((estudio) =>
    estudio.name.toLowerCase().includes(busquedaSalon.trim().toLowerCase()),
  );

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
      <div className="bg-white border border-slate-200 rounded-2xl p-4 mb-6 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
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

        <div className="space-y-2">
          <input
            type="text"
            value={busquedaSalon}
            onChange={(e) => setBusquedaSalon(e.target.value)}
            placeholder="Buscar salón para filtrar..."
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-pink-300"
          />
          <select
            value={salonId}
            onChange={(e) => setSalonId(e.target.value)}
            aria-label="Filtrar por salón"
            className="w-full text-sm border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300"
          >
            <option value="">Todos los salones</option>
            {estudiosFiltrados.slice(0, 40).map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>

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
          placeholder="Filtrar por servicio frecuente..."
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
                    'Contacto',
                    'Correo',
                    'Salón',
                    'País',
                    'Servicio frecuente',
                    'Visitas',
                    'Última visita',
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
                  <tr
                    key={`${c.estudioId}-${c.telefono}-${idx}`}
                    className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                  >
                    <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                      {c.nombre}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.telefono}</td>
                    <td className="px-4 py-3 text-slate-500">{c.correo ?? '—'}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {c.nombreEstudio}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.paisEstudio}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {c.servicioMasFrecuente || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{c.totalVisitas}</td>
                    <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                      {c.ultimaVisita ?? '—'}
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
        <div className="flex flex-col sm:flex-row items-center justify-between mt-4 gap-3 text-sm text-slate-600">
          <span className="font-medium">
            Mostrando {inicioRango}–{finRango} de {total.toLocaleString('es-MX')} clientes
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPagina((p) => Math.max(1, p - 1))}
              disabled={pagina === 1}
              aria-label="Página anterior"
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 py-2 text-xs font-black text-slate-500">
              Página {pagina} de {totalPaginas}
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
