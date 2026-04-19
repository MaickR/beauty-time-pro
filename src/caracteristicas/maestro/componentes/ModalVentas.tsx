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
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onKeyDown={(e) => e.key === 'Escape' && onCerrar()}
    >
      <div className="bg-white rounded-3xl w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 id="modal-ventas-titulo" className="text-lg font-black text-slate-900 uppercase">
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

        <div className="flex-1 overflow-auto px-6 py-6 space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 2 }).map((_, i) => (
                <EsqueletoTarjeta key={i} className="h-32 rounded-2xl" />
              ))}
            </div>
          ) : data ? (
            <>
              {/* Totales globales */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-linear-to-br from-green-50 via-white to-red-50 rounded-2xl p-4 text-center border border-green-100">
                  <p className="text-xs font-black text-green-700 uppercase mb-1">México · MXN</p>
                  <p className="text-2xl font-black text-green-800">
                    {formatearSinSimbolo(data.datos.mexico.total)}
                  </p>
                </div>
                <div className="bg-linear-to-br from-yellow-50 via-blue-50 to-red-50 rounded-2xl p-4 text-center border border-yellow-200">
                  <p className="text-xs font-black text-blue-700 uppercase mb-1">Colombia · COP</p>
                  <p className="text-2xl font-black text-blue-800">
                    {formatearSinSimbolo(data.datos.colombia.total)}
                  </p>
                </div>
              </div>

              {/* Detalle por país */}
              <div className="space-y-3 mt-6">
                {paises.map(({ nombre, datos: paisData }, indicePais) => {
                  const expandido = expandidos[nombre] ?? false;
                  const { moneda, desglose } = paisData;
                  const totalSalones = desglose.pro.salones + desglose.standard.salones;
                  const esMexico = nombre === 'México';
                  return (
                    <div
                      key={`${nombre}-${indicePais}`}
                      className={`border rounded-2xl overflow-hidden ${esMexico ? 'border-green-200' : 'border-yellow-200'}`}
                    >
                      <button
                        onClick={() => alternarExpandido(nombre)}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-3">
                          <BanderaPais pais={esMexico ? 'Mexico' : 'Colombia'} />
                          <span className="font-black text-slate-900">{nombre}</span>
                          <span className="text-xs font-bold text-slate-400">
                            {totalSalones} salones
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`text-sm font-black ${esMexico ? 'text-green-700' : 'text-blue-700'}`}
                          >
                            {formatearMoneda(paisData.total, moneda)}
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
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-600">PRO</span>
                            <div className="text-right">
                              <span className="text-sm font-bold text-slate-700">
                                {desglose.pro.salones} salones
                              </span>
                              <span className="mx-2 text-slate-300">·</span>
                              <span className="text-sm font-black text-slate-900">
                                {formatearMoneda(desglose.pro.monto, moneda)}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-bold text-slate-600">Estándar</span>
                            <div className="text-right">
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
