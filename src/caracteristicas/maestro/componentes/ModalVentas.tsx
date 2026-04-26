import { useQuery } from '@tanstack/react-query';
import { X, ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import { obtenerVentasMetrica } from '../../../servicios/servicioAdmin';
import type { VentasPais } from '../../../servicios/servicioAdmin';
import { EsqueletoTarjeta } from '../../../componentes/ui/Esqueleto';
import { BanderaPais } from '../../../componentes/ui/BanderaPais';

interface PropsModalVentas {
  onCerrar: () => void;
}

interface PaisResumen {
  nombre: string;
  datos: VentasPais;
}

export function ModalVentas({ onCerrar }: PropsModalVentas) {
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'metricas', 'ventas'],
    queryFn: obtenerVentasMetrica,
    staleTime: 30_000,
  });

  const [expandidos, setExpandidos] = useState<Record<string, boolean>>({});

  const alternarExpandido = (pais: string) => {
    setExpandidos((prev) => ({ ...prev, [pais]: !prev[pais] }));
  };

  const formatearMoneda = (centavos: number, moneda: string) => {
    const valor = centavos / 100;
    return valor.toLocaleString('es-MX', {
      style: 'currency',
      currency: moneda,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const formatearSinSimbolo = (centavos: number) => {
    const valor = centavos / 100;
    return valor.toLocaleString('es-MX', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  };

  const paises: PaisResumen[] = data
    ? [
        { nombre: 'México', datos: data.datos.mexico },
        { nombre: 'Colombia', datos: data.datos.colombia },
      ]
    : [];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-ventas-titulo"
      className="fixed inset-0 z-200 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm p-4"
      onKeyDown={(e) => e.key === 'Escape' && onCerrar()}
    >
      <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between px-4 py-3 sm:px-6 sm:py-4 border-b border-slate-200">
          <h2
            id="modal-ventas-titulo"
            className="text-base sm:text-lg font-black text-slate-900 uppercase tracking-wide"
          >
            Ventas
          </h2>
          <button
            onClick={onCerrar}
            className="p-2 rounded-full hover:bg-slate-100"
            aria-label="Cerrar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-auto px-4 py-4 sm:px-6 sm:py-6 space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <EsqueletoTarjeta key={i} className="h-32 rounded-2xl" />
              ))}
            </div>
          ) : data ? (
            <>
              {/* Totales globales */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="bg-linear-to-br from-emerald-50 via-white to-rose-50 rounded-2xl p-4 text-center border border-emerald-200">
                  <p className="text-xs font-black text-emerald-700 uppercase mb-1">México · MXN</p>
                  <p className="text-xl sm:text-2xl font-black text-emerald-800">
                    {formatearSinSimbolo(data.datos.mexico.total)}
                  </p>
                </div>
                <div className="bg-linear-to-br from-rose-50 via-white to-slate-100 rounded-2xl p-4 text-center border border-rose-200">
                  <p className="text-xs font-black text-slate-700 uppercase mb-1">Colombia · COP</p>
                  <p className="text-xl sm:text-2xl font-black text-slate-900">
                    {formatearSinSimbolo(data.datos.colombia.total)}
                  </p>
                </div>
              </div>

              {/* Resumen por país - limpio y directo */}
              <div className="space-y-3 mt-6">
                {paises.map(({ nombre, datos: paisData }) => {
                  const expandido = expandidos[nombre] ?? false;
                  const { moneda, desglose } = paisData;
                  return (
                    <div
                      key={nombre}
                      className="border rounded-2xl overflow-hidden border-slate-200"
                    >
                      <button
                        onClick={() => alternarExpandido(nombre)}
                        className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <BanderaPais pais={nombre === 'México' ? 'Mexico' : 'Colombia'} />
                          <span className="font-black text-slate-900">{nombre}</span>
                        </div>
                        <div className="flex items-center gap-2 sm:gap-3">
                          <span className="text-xs sm:text-sm font-black text-slate-900 text-right">
                            PRO = {desglose.pro.salones} · STD = {desglose.standard.salones}
                          </span>
                          {expandido ? (
                            <ChevronDown className="w-4 h-4 text-slate-400" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-slate-400" />
                          )}
                        </div>
                      </button>
                      {expandido && (
                        <div className="border-t border-slate-100 bg-slate-50 px-4 py-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-slate-600">PRO</span>
                            <div className="text-right text-xs sm:text-sm">
                              <span className="text-sm font-bold text-slate-700">
                                {desglose.pro.salones} salones
                              </span>
                              <span className="mx-2 text-slate-300">·</span>
                              <span className="text-sm font-black text-slate-900">
                                {formatearMoneda(desglose.pro.monto, moneda)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-bold text-slate-600">Estándar</span>
                            <div className="text-right text-xs sm:text-sm">
                              <span className="text-sm font-bold text-slate-700">
                                {desglose.standard.salones} salones
                              </span>
                              <span className="mx-2 text-slate-300">·</span>
                              <span className="text-sm font-black text-slate-900">
                                {formatearMoneda(desglose.standard.monto, moneda)}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <p className="text-center text-slate-400 font-bold py-8">
              No hay datos de ventas disponibles
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
