import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { Download, SearchX } from 'lucide-react';
import { obtenerVentasVendedor } from '../../../servicios/servicioVendedor';
import { formatearDinero } from '../../../utils/formato';

export function TabVentasVendedor() {
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');

  const { data: ventas, isLoading } = useQuery({
    queryKey: ['vendedor', 'ventas', fechaDesde, fechaHasta],
    queryFn: () =>
      obtenerVentasVendedor({
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
      }),
    staleTime: 1000 * 60,
  });

  const totalCobrado = useMemo(
    () => (ventas ?? []).reduce((acumulado, venta) => acumulado + venta.monto, 0),
    [ventas],
  );

  const moneda = ventas?.[0]?.moneda === 'COP' ? 'COP' : 'MXN';

  const exportarExcel = () => {
    if (!ventas || ventas.length === 0) return;
    const filas = ventas.map((venta) => ({
      Salon: venta.salonNombre,
      Fecha: venta.fecha,
      Plan: venta.plan,
      Pais: venta.pais,
      Concepto: venta.concepto,
      Monto: venta.monto / 100,
      Moneda: venta.moneda,
      Referencia: venta.referencia ?? '',
    }));

    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Ventas');
    XLSX.writeFile(libro, `ventas-vendedor-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">
            Historial de ventas
          </p>
          <h2 className="mt-2 text-3xl font-black text-slate-900">
            Revisa lo cobrado desde tus salones aprobados.
          </h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="text-sm font-semibold text-slate-600">
            Desde
            <input
              type="date"
              value={fechaDesde}
              onChange={(evento) => setFechaDesde(evento.target.value)}
              className="mt-1 block rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <label className="text-sm font-semibold text-slate-600">
            Hasta
            <input
              type="date"
              value={fechaHasta}
              onChange={(evento) => setFechaHasta(evento.target.value)}
              className="mt-1 block rounded-2xl border border-slate-300 px-3 py-2 text-sm text-slate-900"
            />
          </label>
          <button
            type="button"
            onClick={exportarExcel}
            disabled={!ventas || ventas.length === 0}
            className="inline-flex items-center gap-2 self-end rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800 disabled:opacity-50"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            Exportar Excel
          </button>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
        <article className="rounded-4xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-white/60">
            Total filtrado
          </p>
          <p className="mt-3 text-4xl font-black">{formatearDinero(totalCobrado, moneda)}</p>
          <p className="mt-3 text-sm text-white/70">
            {ventas?.length ?? 0} ventas encontradas para el rango seleccionado.
          </p>
        </article>

        <article className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-pink-600" />
            </div>
          ) : !ventas || ventas.length === 0 ? (
            <div className="py-16 text-center">
              <SearchX className="mx-auto h-12 w-12 text-slate-300" aria-hidden="true" />
              <p className="mt-4 font-medium text-slate-500">
                No se encontraron ventas para los filtros seleccionados.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-180 text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="px-3 py-3 font-bold">Salón</th>
                    <th className="px-3 py-3 font-bold">Fecha</th>
                    <th className="px-3 py-3 font-bold">Plan</th>
                    <th className="px-3 py-3 font-bold">Concepto</th>
                    <th className="px-3 py-3 font-bold text-right">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {ventas.map((venta) => (
                    <tr key={venta.id} className="border-b border-slate-100 last:border-b-0">
                      <td className="px-3 py-4">
                        <p className="font-bold text-slate-900">{venta.salonNombre}</p>
                        <p className="text-xs text-slate-500">{venta.pais}</p>
                      </td>
                      <td className="px-3 py-4 text-slate-600">{venta.fecha}</td>
                      <td className="px-3 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${venta.plan === 'PRO' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
                        >
                          {venta.plan}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-slate-600">
                        <p>{venta.concepto}</p>
                        {venta.referencia && (
                          <p className="text-xs text-slate-400">{venta.referencia}</p>
                        )}
                      </td>
                      <td className="px-3 py-4 text-right font-bold text-slate-900">
                        {formatearDinero(venta.monto, venta.moneda === 'COP' ? 'COP' : 'MXN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
