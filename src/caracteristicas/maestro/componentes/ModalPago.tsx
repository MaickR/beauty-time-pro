import { DollarSign } from 'lucide-react';
import type { Estudio, Moneda } from '../../../tipos';
import {
  formatearDinero,
  formatearFechaHumana,
  obtenerMonedaPorPais,
} from '../../../utils/formato';

interface PropsModalPago {
  estudio: Estudio;
  onConfirmar: (monto: number, moneda: Moneda) => void;
  onCerrar: () => void;
}

export function ModalPago({ estudio, onConfirmar, onCerrar }: PropsModalPago) {
  const moneda = obtenerMonedaPorPais(estudio.country);
  const monto = moneda === 'COP' ? 200000 : 1000;
  const fechaBase = estudio.paidUntil || estudio.subscriptionStart;
  const estaVencido = Boolean(fechaBase) && fechaBase < new Date().toISOString().slice(0, 10);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-pago-titulo"
      className="fixed inset-0 bg-black/80 backdrop-blur-xl z-70 flex items-center justify-center p-4"
    >
      <div className="bg-white max-w-md w-full rounded-[3rem] p-8 text-center shadow-2xl">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <DollarSign className="w-8 h-8" />
        </div>
        <h2
          id="modal-pago-titulo"
          className="text-2xl font-black italic uppercase tracking-tighter mb-2"
        >
          Abonar Pago
        </h2>
        <p className="text-slate-500 font-bold mb-8">
          Studio: <span className="text-pink-600 uppercase">{estudio.name}</span>
        </p>
        <div className="rounded-4xl border border-slate-200 bg-slate-50 p-5 text-left mb-6">
          <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">
            Moneda asignada
          </p>
          <p className="mt-2 text-lg font-black text-slate-900">
            {estudio.country} · {moneda}
          </p>
          <p className="mt-3 text-sm text-slate-600">
            Esta cuenta solo se registra en {moneda}. La plataforma ya no permite elegir otra moneda
            para evitar cobros inconsistentes.
          </p>
        </div>

        <div className="rounded-4xl border border-emerald-200 bg-emerald-50 p-5 text-left mb-8">
          <p className="text-[10px] uppercase font-black text-emerald-700 tracking-widest">
            Cómo se sumará el mes
          </p>
          <p className="mt-2 text-sm font-semibold text-emerald-900">
            {estaVencido
              ? 'El salón está vencido. Este pago reactivará 1 mes contado desde hoy.'
              : `El salón sigue vigente. Este pago sumará 1 mes sobre ${formatearFechaHumana(fechaBase)}.`}
          </p>
        </div>

        <button
          onClick={() => onConfirmar(monto, moneda)}
          className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl hover:bg-black hover:scale-[1.02] transition-all flex items-center justify-center gap-2 shadow-sm mb-3"
        >
          Registrar {formatearDinero(monto, moneda)} y sumar 1 mes
        </button>
        <p className="text-xs text-slate-500 mb-8">
          Vigencia actual: {formatearFechaHumana(estudio.paidUntil)}
        </p>
        <button
          onClick={onCerrar}
          className="text-slate-400 font-black text-xs uppercase hover:text-slate-600 transition-colors tracking-widest"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
