import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Eye, Search } from 'lucide-react';
import { obtenerDirectorio } from '../../../servicios/servicioAdmin';
import { EsqueletoTarjeta } from '../../../componentes/ui/Esqueleto';
import { ModalDetalleSalon } from './ModalDetalleSalon';

const LIMITE = 10;
const RETRASO_BUSQUEDA = 300;

export function DirectorioAcceso() {
  const [busqueda, setBusqueda] = useState('');
  const [busquedaDiferida, setBusquedaDiferida] = useState('');
  const [pagina, setPagina] = useState(1);
  const [salonSeleccionado, setSalonSeleccionado] = useState<string | null>(null);
  const temporizadorRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (temporizadorRef.current) clearTimeout(temporizadorRef.current);
    temporizadorRef.current = setTimeout(() => {
      setBusquedaDiferida(busqueda);
      setPagina(1);
    }, RETRASO_BUSQUEDA);
    return () => {
      if (temporizadorRef.current) clearTimeout(temporizadorRef.current);
    };
  }, [busqueda]);

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'directorio', busquedaDiferida, pagina],
    queryFn: () =>
      obtenerDirectorio({
        buscar: busquedaDiferida || undefined,
        pagina,
        limite: LIMITE,
      }),
    staleTime: 15_000,
  });

  const manejarBusqueda = (valor: string) => {
    setBusqueda(valor);
  };

  return (
    <section aria-labelledby="titulo-directorio-acceso">
      <h2 id="titulo-directorio-acceso" className="text-2xl font-black text-slate-900 mb-5">
        Directorio de acceso
      </h2>

      {/* Buscador */}
      <div className="mb-4 relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={busqueda}
          onChange={(e) => manejarBusqueda(e.target.value)}
          placeholder="Search by name or owner..."
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium outline-none focus:ring-2 focus:ring-pink-500"
        />
      </div>

      {/* Tabla */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <EsqueletoTarjeta key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="text-left py-3 px-4 text-xs font-black text-slate-400 uppercase">
                    Nombre
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-black text-slate-400 uppercase">
                    Dueño
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-black text-slate-400 uppercase hidden md:table-cell">
                    Correo
                  </th>
                  <th className="text-left py-3 px-4 text-xs font-black text-slate-400 uppercase hidden sm:table-cell">
                    País
                  </th>
                  <th className="text-center py-3 px-4 text-xs font-black text-slate-400 uppercase w-20">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {data?.datos.map((salon) => (
                  <tr
                    key={salon.id}
                    className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                  >
                    <td className="py-3 px-4 font-bold text-slate-900">{salon.nombre}</td>
                    <td className="py-3 px-4 text-slate-600">{salon.dueno}</td>
                    <td className="py-3 px-4 text-slate-500 hidden md:table-cell">
                      {salon.correo ?? '—'}
                    </td>
                    <td className="py-3 px-4 text-slate-500 hidden sm:table-cell">{salon.pais}</td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => setSalonSeleccionado(salon.id)}
                        className="p-2 rounded-lg hover:bg-pink-50 text-slate-400 hover:text-pink-600 transition-colors"
                        aria-label={`Ver detalle de ${salon.nombre}`}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {(!data?.datos || data.datos.length === 0) && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-bold">
                      No se encontraron salones
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {data && data.totalPaginas > 1 && (
            <div className="flex items-center justify-between mt-4">
              <p className="text-xs font-bold text-slate-500">
                {data.total} salones — Página {pagina} de {data.totalPaginas}
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
                  onClick={() => setPagina((p) => (p < data.totalPaginas ? p + 1 : p))}
                  disabled={pagina >= data.totalPaginas}
                  className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold disabled:opacity-40"
                >
                  Siguiente
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Modal de detalle */}
      {salonSeleccionado && (
        <ModalDetalleSalon
          salonId={salonSeleccionado}
          onCerrar={() => setSalonSeleccionado(null)}
        />
      )}
    </section>
  );
}
