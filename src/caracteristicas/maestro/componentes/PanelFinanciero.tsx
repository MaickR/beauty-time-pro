import { CheckCircle2, AlertTriangle, DollarSign } from 'lucide-react';
import { obtenerEstadoSuscripcion } from '../../../utils/formato';
import type { Estudio, Pago } from '../../../tipos';

interface PropsPanelFinanciero {
  estudios: Estudio[];
  pagos: Pago[];
  onAbrirPago: (estudio: Estudio) => void;
}

export function PanelFinanciero({ estudios, pagos, onAbrirPago }: PropsPanelFinanciero) {
  let pagados = 0;
  let pendientes = 0;
  let totalMXN = 0;
  let totalCOP = 0;

  estudios.forEach((s) => {
    const sub = obtenerEstadoSuscripcion(s);
    if (sub?.status === 'OVERDUE') pendientes++;
    else if (sub) pagados++;
  });
  pagos.forEach((p) => {
    if (p.currency === 'MXN') totalMXN += p.amount;
    if (p.currency === 'COP') totalCOP += p.amount;
  });

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900 p-8 rounded-[2rem] text-white">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-green-500" /> Studios Pagados
          </p>
          <p className="text-4xl font-black">{pagados}</p>
        </div>
        <div className="bg-white border border-slate-200 p-8 rounded-[2rem]">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-red-500" /> Studios Pendientes
          </p>
          <p className="text-4xl font-black text-red-600">{pendientes}</p>
        </div>
        <div className="bg-green-50 border border-green-200 p-8 rounded-[2rem]">
          <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-2">Ingresos México</p>
          <p className="text-3xl font-black text-green-700">${totalMXN.toLocaleString()} MXN</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 p-8 rounded-[2rem]">
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2">Ingresos Colombia</p>
          <p className="text-3xl font-black text-blue-700">${totalCOP.toLocaleString()} COP</p>
        </div>
      </div>

      <div className="bg-white rounded-[3rem] border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase">Studio</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase">Estado y Vencimiento</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase text-right">
                Acción de Cobro
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {estudios.map((s) => {
              const sub = obtenerEstadoSuscripcion(s);
              return (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-8 py-6">
                    <p className="font-black text-slate-900 uppercase">{s.name}</p>
                    <p className="text-[10px] text-slate-500 font-bold uppercase mt-1">{s.country}</p>
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
                      </div>
                    ) : (
                      <span className="text-xs text-slate-400 italic">No configurado</span>
                    )}
                  </td>
                  <td className="px-8 py-6 text-right">
                    <button
                      onClick={() => onAbrirPago(s)}
                      className="bg-slate-900 text-white px-6 py-3 rounded-xl text-[10px] font-black uppercase hover:bg-black transition-all shadow-md active:scale-95 flex items-center gap-2 ml-auto"
                    >
                      <DollarSign className="w-3 h-3" /> Registrar Pago
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {estudios.length === 0 && (
          <p className="text-center py-10 text-slate-400 font-bold italic">No hay studios registrados.</p>
        )}
      </div>
    </div>
  );
}
