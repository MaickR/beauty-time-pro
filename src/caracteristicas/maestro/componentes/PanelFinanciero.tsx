import { CheckCircle2, AlertTriangle, DollarSign, WalletCards, CalendarClock } from 'lucide-react';
import {
  formatearDinero,
  formatearFechaHumana,
  formatearPaisMoneda,
  obtenerEstadoSuscripcion,
} from '../../../utils/formato';
import type { Estudio, Pago } from '../../../tipos';

interface PropsPanelFinanciero {
  estudios: Estudio[];
  pagos: Pago[];
  onAbrirPago: (estudio: Estudio) => void;
}

export function PanelFinanciero({ estudios, pagos, onAbrirPago }: PropsPanelFinanciero) {
  let pagados = 0;
  let porVencer = 0;
  let pendientes = 0;
  let totalMXN = 0;
  let totalCOP = 0;

  const ultimoPagoPorSalon = new Map<string, Pago>();

  pagos.forEach((pago) => {
    const pagoExistente = ultimoPagoPorSalon.get(pago.studioId);
    if (!pagoExistente || pago.date > pagoExistente.date) {
      ultimoPagoPorSalon.set(pago.studioId, pago);
    }
  });

  estudios.forEach((s) => {
    const sub = obtenerEstadoSuscripcion(s);
    if (sub?.status === 'OVERDUE') pendientes++;
    else if (sub?.status === 'WARNING') porVencer++;
    else if (sub) pagados++;
  });
  pagos.forEach((p) => {
    if (p.currency === 'MXN') totalMXN += p.amount;
    if (p.currency === 'COP') totalCOP += p.amount;
  });

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-6">
        <div className="bg-slate-900 p-8 rounded-4xl text-white">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" /> Studios Pagados
          </p>
          <p className="text-4xl font-black">{pagados}</p>
        </div>
        <div className="bg-white border border-slate-200 p-8 rounded-4xl">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" /> Studios Pendientes
          </p>
          <p className="text-4xl font-black text-red-600">{pendientes}</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 p-8 rounded-4xl">
          <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-2 flex items-center gap-2">
            <CalendarClock className="w-4 h-4" /> Por vencer
          </p>
          <p className="text-3xl font-black text-amber-700">{porVencer}</p>
        </div>
        <div className="bg-green-50 border border-green-200 p-8 rounded-4xl">
          <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-2">
            Ingresos México
          </p>
          <p className="text-3xl font-black text-green-700">{formatearDinero(totalMXN, 'MXN')}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 p-8 rounded-4xl">
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">
            Ingresos Colombia
          </p>
          <p className="text-3xl font-black text-blue-700">{formatearDinero(totalCOP, 'COP')}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_2fr] gap-6">
        <section className="rounded-4xl border border-slate-200 bg-white p-7 shadow-sm">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
            Regla de renovación
          </p>
          <h2 className="mt-3 text-2xl font-black text-slate-900">
            Cada pago suma 1 mes en la moneda correcta del país
          </h2>
          <div className="mt-5 space-y-3 text-sm text-slate-600">
            <p>
              Si el salón sigue activo, el mes nuevo se agrega sobre su fecha de vencimiento actual.
            </p>
            <p>
              Si el salón ya venció, el sistema reanuda desde hoy para que no queden meses
              “perdidos” en el pasado.
            </p>
            <p>
              La moneda ya no se elige manualmente: México registra en MXN y Colombia registra en
              COP.
            </p>
          </div>
        </section>

        <section className="rounded-4xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
              <WalletCards className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">
                Últimos pagos
              </p>
              <h2 className="text-xl font-black text-slate-900">Transparencia operativa</h2>
            </div>
          </div>
          <div className="mt-5 space-y-4">
            {pagos.slice(0, 3).map((pago) => (
              <article
                key={pago.id}
                className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-black text-slate-900 uppercase">{pago.studioName}</p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {formatearPaisMoneda(pago.country)}
                    </p>
                  </div>
                  <p className="text-sm font-black text-emerald-600">
                    {formatearDinero(pago.amount, pago.currency)}
                  </p>
                </div>
                <div className="mt-3 grid gap-1 text-xs text-slate-500">
                  <p>
                    Registrado el {formatearFechaHumana(pago.date)} por{' '}
                    {pago.registradoPorNombre ?? pago.registradoPorEmail ?? 'Administrador maestro'}
                  </p>
                  {pago.nuevaFechaVencimiento && (
                    <p>
                      Vigencia actualizada hasta {formatearFechaHumana(pago.nuevaFechaVencimiento)}
                      {pago.fechaBaseRenovacion
                        ? ` desde ${formatearFechaHumana(pago.fechaBaseRenovacion)}`
                        : ''}
                      .
                    </p>
                  )}
                </div>
              </article>
            ))}
            {pagos.length === 0 && (
              <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-6 text-sm font-semibold text-slate-400">
                Aún no hay pagos registrados.
              </p>
            )}
          </div>
        </section>
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase">Studio</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase">
                Estado y Vencimiento
              </th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase">
                Último pago
              </th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase text-right">
                Acción de Cobro
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {estudios.map((s) => {
              const sub = obtenerEstadoSuscripcion(s);
              const ultimoPago = ultimoPagoPorSalon.get(s.id);
              const reglaCobro =
                sub?.status === 'OVERDUE'
                  ? 'El próximo pago reactivará 1 mes desde hoy.'
                  : 'El próximo pago sumará 1 mes sobre la vigencia actual.';

              return (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-8 py-6">
                    <p className="font-black text-slate-900 uppercase">{s.name}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                      {formatearPaisMoneda(s.country)}
                    </p>
                  </td>
                  <td className="px-8 py-6">
                    {sub ? (
                      <div>
                        <span
                          className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                            sub.status === 'ACTIVE'
                              ? 'bg-green-100 text-green-700'
                              : sub.status === 'WARNING'
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {sub.status === 'OVERDUE'
                            ? 'VENCIDO'
                            : sub.status === 'WARNING'
                              ? 'PRÓXIMO A VENCER'
                              : 'AL CORRIENTE'}
                        </span>
                        <p className="text-[10px] font-bold text-slate-500 mt-2">
                          Próx. Corte: {sub.dueDateStr}
                        </p>
                        <p className="text-xs text-slate-500 mt-2">{reglaCobro}</p>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">No configurado</span>
                    )}
                  </td>
                  <td className="px-8 py-6">
                    {ultimoPago ? (
                      <div>
                        <p className="text-sm font-black text-slate-900">
                          {formatearDinero(ultimoPago.amount, ultimoPago.currency)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatearFechaHumana(ultimoPago.date)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {ultimoPago.registradoPorNombre ??
                            ultimoPago.registradoPorEmail ??
                            'Administrador maestro'}
                        </p>
                      </div>
                    ) : (
                      <p className="text-xs italic text-slate-400">Sin pagos todavía</p>
                    )}
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button
                      onClick={() => onAbrirPago(s)}
                      className="bg-slate-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-black transition-all shadow-md active:scale-95 flex items-center gap-2 ml-auto"
                    >
                      <DollarSign className="w-3 h-3" /> Registrar pago y sumar 1 mes
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {estudios.length === 0 && (
          <p className="text-center py-10 text-slate-400 font-bold italic">
            No hay studios registrados.
          </p>
        )}
      </div>
    </div>
  );
}
