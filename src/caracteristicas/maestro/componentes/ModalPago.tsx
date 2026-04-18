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
  const moneda = estudio.monedaSuscripcion ?? obtenerMonedaPorPais(estudio.country);
  const monto = estudio.precioRenovacion ?? estudio.precioSuscripcionActual ?? 0;
  const precioActual = estudio.precioSuscripcionActual ?? monto;
  const precioCambiaEnRenovacion = monto !== precioActual;
  const fechaBase = estudio.paidUntil || estudio.subscriptionStart;
  const estaVencido = Boolean(fechaBase) && fechaBase < new Date().toISOString().slice(0, 10);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-pago-titulo"
      className="fixed inset-0 z-70 flex items-center justify-center bg-black/80 p-3 backdrop-blur-xl sm:p-4"
    >
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-white p-4 text-center shadow-2xl sm:max-h-[92vh] sm:rounded-[2.5rem] sm:p-6 md:p-8">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <DollarSign className="w-8 h-8" />
        </div>
        <h2
          id="modal-pago-titulo"
          className="text-2xl font-black italic uppercase tracking-tighter mb-2"
        >
          Abonar Pago
        </h2>
        <p className="mb-6 text-slate-500 font-bold sm:mb-8">
          Salón: <span className="text-pink-600 uppercase">{estudio.name}</span>
        </p>
        <div className="mb-5 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-left sm:mb-6 sm:rounded-4xl sm:p-5">
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
          {precioCambiaEnRenovacion && estudio.fechaAplicacionPrecioProximo && (
            <p className="mt-3 text-sm font-bold text-emerald-700">
              El próximo período aplicará {formatearDinero(monto, moneda)} desde{' '}
              {formatearFechaHumana(estudio.fechaAplicacionPrecioProximo)}.
            </p>
          )}
        </div>

        <div className="mb-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-left sm:mb-8 sm:rounded-4xl sm:p-5">
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
          disabled={monto <= 0}
          className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 py-3.5 text-sm font-black text-white shadow-sm transition-all hover:scale-[1.02] hover:bg-black sm:py-4"
        >
          Registrar {formatearDinero(monto, moneda)} y sumar 1 mes
        </button>
        <p className="mb-6 text-xs text-slate-500 sm:mb-8">
          Vigencia actual:{' '}
          {estudio.paidUntil ? formatearFechaHumana(estudio.paidUntil) : 'Sin vigencia registrada'}
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
