import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import * as XLSX from 'xlsx';
import { CircleDollarSign, Download, SearchX, ShieldAlert, Wallet } from 'lucide-react';
import { obtenerVentasVendedor } from '../../../servicios/servicioVendedor';
import { formatearDinero } from '../../../utils/formato';

export function TabVentasVendedor() {
  const [fechaDesde, setFechaDesde] = useState('');
  const [fechaHasta, setFechaHasta] = useState('');
  const [soloPendientesPago, setSoloPendientesPago] = useState(false);

  const { data: ventas, isLoading } = useQuery({
    queryKey: ['vendedor', 'ventas', fechaDesde, fechaHasta, soloPendientesPago],
    queryFn: () =>
      obtenerVentasVendedor({
        fechaDesde: fechaDesde || undefined,
        fechaHasta: fechaHasta || undefined,
        soloPendientesPago,
      }),
    staleTime: 1000 * 60,
  });

  const totalCobrado = useMemo(
    () => (ventas ?? []).reduce((acumulado, venta) => acumulado + venta.monto, 0),
    [ventas],
  );
  const totalComision = useMemo(
    () => (ventas ?? []).reduce((acumulado, venta) => acumulado + venta.comision, 0),
    [ventas],
  );
  const pendientesPago = useMemo(
    () => (ventas ?? []).filter((venta) => venta.pendientePago).length,
    [ventas],
  );

  const moneda = ventas?.[0]?.moneda === 'COP' ? 'COP' : 'MXN';

  const exportarExcel = () => {
    if (!ventas || ventas.length === 0) return;
    const filas = ventas.map((venta) => ({
      Salon: venta.salonNombre,
      Admin: venta.adminSalonNombre,
      Fecha: venta.fecha,
      Plan: venta.plan,
      TipoSuscripcion: venta.tipoSuscripcion,
      Pais: venta.pais,
      Concepto: venta.concepto,
      ValorSuscripcion: venta.valorSuscripcion / 100,
      Monto: venta.monto / 100,
      Comision: venta.comision / 100,
      FechaVencimiento: venta.fechaVencimiento,
      PendientePago: venta.pendientePago ? 'Sí' : 'No',
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
            Revisa ventas, comisiones y seguimientos pendientes.
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
            onClick={() => setSoloPendientesPago((valor) => !valor)}
            className={`inline-flex items-center gap-2 self-end rounded-full px-4 py-3 text-sm font-bold transition ${soloPendientesPago ? 'bg-amber-100 text-amber-800' : 'border border-slate-300 bg-white text-slate-700 hover:border-slate-400'}`}
          >
            <ShieldAlert className="h-4 w-4" aria-hidden="true" />
            {soloPendientesPago ? 'Mostrando pendientes' : 'Pendientes de pago'}
          </button>
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

      <section className="grid gap-4 md:grid-cols-3">
        <TarjetaResumenVenta
          etiqueta="Ingresos filtrados"
          valor={formatearDinero(totalCobrado, moneda)}
          descripcion={`${ventas?.length ?? 0} ventas visibles`}
          icono={Wallet}
          tono="oscuro"
        />
        <TarjetaResumenVenta
          etiqueta="Comisión filtrada"
          valor={formatearDinero(totalComision, moneda)}
          descripcion="Calculada con tu porcentaje actual"
          icono={CircleDollarSign}
        />
        <TarjetaResumenVenta
          etiqueta="Pendientes de pago"
          valor={String(pendientesPago)}
          descripcion="Salones vencidos dentro del filtro"
          icono={ShieldAlert}
          tono="alerta"
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
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
            <div className="space-y-4 lg:hidden">
              {ventas.map((venta) => (
                <article
                  key={venta.id}
                  className="rounded-3xl border border-slate-200 bg-slate-50 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-black text-slate-900">{venta.salonNombre}</p>
                      <p className="truncate text-sm text-slate-500">{venta.adminSalonNombre}</p>
                    </div>
                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-black ${venta.pendientePago ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}
                    >
                      {venta.pendientePago ? 'Pendiente' : 'Al corriente'}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <DatoVentaMovil etiqueta="Fecha" valor={venta.fecha} />
                    <DatoVentaMovil etiqueta="Vence" valor={venta.fechaVencimiento} />
                    <DatoVentaMovil
                      etiqueta="Plan"
                      valor={`${venta.plan} · ${venta.tipoSuscripcion}`}
                    />
                    <DatoVentaMovil
                      etiqueta="Valor"
                      valor={formatearDinero(
                        venta.valorSuscripcion,
                        venta.moneda === 'COP' ? 'COP' : 'MXN',
                      )}
                    />
                    <DatoVentaMovil
                      etiqueta="Comisión"
                      valor={formatearDinero(
                        venta.comision,
                        venta.moneda === 'COP' ? 'COP' : 'MXN',
                      )}
                    />
                    <DatoVentaMovil etiqueta="País" valor={venta.pais} />
                  </div>
                </article>
              ))}
            </div>
          )}
        </article>

        <article className="hidden rounded-4xl border border-slate-200 bg-white p-6 shadow-sm lg:block">
          {!ventas || ventas.length === 0 ? (
            <div className="py-16 text-center text-sm font-medium text-slate-500">
              No hay filas para mostrar.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[920px] text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-slate-500">
                    <th className="px-3 py-3 font-bold">Salón</th>
                    <th className="px-3 py-3 font-bold">Admin</th>
                    <th className="px-3 py-3 font-bold">Suscripción</th>
                    <th className="px-3 py-3 font-bold">Vence</th>
                    <th className="px-3 py-3 font-bold text-right">Valor</th>
                    <th className="px-3 py-3 font-bold text-right">Comisión</th>
                  </tr>
                </thead>
                <tbody>
                  {ventas.map((venta) => (
                    <tr
                      key={venta.id}
                      className="border-b border-slate-100 align-top last:border-b-0"
                    >
                      <td className="px-3 py-4">
                        <p className="font-bold text-slate-900">{venta.salonNombre}</p>
                        <p className="text-xs text-slate-500">
                          {venta.fecha} · {venta.pais}
                        </p>
                      </td>
                      <td className="px-3 py-4 text-slate-600">
                        <p>{venta.adminSalonNombre}</p>
                        {venta.adminSalonEmail && (
                          <p className="text-xs text-slate-400">{venta.adminSalonEmail}</p>
                        )}
                      </td>
                      <td className="px-3 py-4 text-slate-600">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${venta.plan === 'PRO' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700'}`}
                        >
                          {venta.plan}
                        </span>
                        <p className="mt-2 text-xs uppercase tracking-wide text-slate-400">
                          {venta.tipoSuscripcion}
                        </p>
                      </td>
                      <td className="px-3 py-4">
                        <p className="font-semibold text-slate-900">{venta.fechaVencimiento}</p>
                        <p
                          className={`mt-2 inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${venta.pendientePago ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}
                        >
                          {venta.pendientePago ? 'Pendiente de pago' : 'Al corriente'}
                        </p>
                      </td>
                      <td className="px-3 py-4 text-right font-bold text-slate-900">
                        {formatearDinero(
                          venta.valorSuscripcion,
                          venta.moneda === 'COP' ? 'COP' : 'MXN',
                        )}
                      </td>
                      <td className="px-3 py-4 text-right font-bold text-slate-900">
                        {formatearDinero(venta.comision, venta.moneda === 'COP' ? 'COP' : 'MXN')}
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

function TarjetaResumenVenta({
  etiqueta,
  valor,
  descripcion,
  icono: Icono,
  tono = 'claro',
}: {
  etiqueta: string;
  valor: string;
  descripcion: string;
  icono: typeof Wallet;
  tono?: 'claro' | 'oscuro' | 'alerta';
}) {
  const estilos =
    tono === 'oscuro'
      ? 'bg-slate-950 text-white border-slate-950'
      : tono === 'alerta'
        ? 'bg-amber-50 text-amber-900 border-amber-100'
        : 'bg-white text-slate-900 border-slate-200';

  return (
    <article className={`rounded-4xl border p-6 shadow-sm ${estilos}`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] opacity-70">{etiqueta}</p>
          <p className="mt-3 text-3xl font-black">{valor}</p>
          <p className="mt-2 text-sm opacity-80">{descripcion}</p>
        </div>
        <div className="rounded-3xl bg-black/5 p-3">
          <Icono className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
    </article>
  );
}

function DatoVentaMovil({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="rounded-2xl bg-white px-3 py-2">
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{etiqueta}</p>
      <p className="mt-1 text-sm font-semibold text-slate-900">{valor}</p>
    </div>
  );
}
