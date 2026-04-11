import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, Clock, Gift } from 'lucide-react';
import { formatearDineroEntero } from '../../../utils/formato';
import type { Moneda } from '../../../tipos';

interface PropsConfirmacionReserva {
  nombreCliente: string;
  descripcionRecompensa?: string | null;
  salon: string;
  sucursal: string;
  especialista: string;
  servicios: string[];
  duracion: number;
  total: number;
  fecha: string;
  hora: string;
  moneda: Moneda;
  onCerrar: () => void;
}

export function ConfirmacionReserva({
  nombreCliente,
  descripcionRecompensa,
  salon,
  sucursal,
  especialista,
  servicios,
  duracion,
  total,
  fecha,
  hora,
  moneda,
  onCerrar,
}: PropsConfirmacionReserva) {
  useEffect(() => {
    if (!descripcionRecompensa) return;
    void confetti({
      particleCount: 180,
      spread: 90,
      origin: { y: 0.65 },
    });
  }, [descripcionRecompensa]);

  return (
    <div
      className="fixed inset-0 bg-slate-900/90 backdrop-blur-sm z-100 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="tituloConfirmacion"
    >
      <div className="bg-white rounded-[3rem] p-6 md:p-8 max-w-2xl w-full max-h-[92vh] overflow-y-auto text-center shadow-2xl">
        <div className="w-24 h-24 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
          <CheckCircle2 className="w-12 h-12" />
        </div>
        <h2
          id="tituloConfirmacion"
          className="text-3xl font-black italic uppercase tracking-tighter mb-4 text-slate-800"
        >
          ¡Cita Confirmada!
        </h2>
        <p className="text-base md:text-lg font-medium text-slate-600 mb-6">
          Muchas gracias por tu preferencia,{' '}
          <strong className="text-pink-600 uppercase">{nombreCliente}</strong>. Tu especialista te
          estará esperando.
        </p>

        <div className="mb-6 rounded-3xl border border-slate-200 bg-slate-50 p-5 text-left">
          <h4 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">
            Resumen de la cita
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Salón</p>
              <p className="text-sm font-bold text-slate-900">{salon}</p>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Sede</p>
              <p className="text-sm font-bold text-slate-900">{sucursal || 'Principal'}</p>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Fecha</p>
              <p className="text-sm font-bold text-slate-900">
                {fecha} · {hora}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                Especialista
              </p>
              <p className="text-sm font-bold text-slate-900">{especialista || 'Por asignar'}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                Servicios
              </p>
              <p className="text-sm font-bold text-slate-900">{servicios.join(', ')}</p>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                Duración aprox.
              </p>
              <p className="text-sm font-bold text-slate-900">{duracion} min</p>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Total</p>
              <p className="text-sm font-bold text-slate-900">
                {formatearDineroEntero(total, moneda)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-sky-50 border border-sky-200 rounded-3xl p-6 mb-8 text-left shadow-sm">
          <div className="flex items-start gap-4">
            <div className="bg-sky-100 p-2 rounded-xl text-sky-600 shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-black text-sky-800 uppercase text-xs tracking-widest mb-1">
                Pago en el salón
              </h4>
              <p className="text-sky-900 text-sm font-medium leading-relaxed">
                El pago de tu servicio se realiza directamente en el salón el día de tu cita. Esta
                confirmación no genera cobro en línea.
              </p>
            </div>
          </div>
        </div>

        {descripcionRecompensa && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-3xl p-6 mb-8 text-left shadow-sm">
            <div className="flex items-start gap-4">
              <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600 shrink-0">
                <Gift className="w-6 h-6" />
              </div>
              <div>
                <h4 className="font-black text-emerald-800 uppercase text-xs tracking-widest mb-1">
                  Recompensa Ganada
                </h4>
                <p className="text-emerald-900 text-sm font-medium leading-relaxed">
                  🎉 ¡Felicidades {nombreCliente}! Has ganado una recompensa:{' '}
                  <strong>{descripcionRecompensa}</strong>.
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="bg-orange-50 border border-orange-200 rounded-3xl p-6 mb-8 text-left shadow-sm">
          <div className="flex items-start gap-4">
            <div className="bg-orange-100 p-2 rounded-xl text-orange-600 shrink-0">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <h4 className="font-black text-orange-800 uppercase text-xs tracking-widest mb-1">
                Aviso Importante
              </h4>
              <p className="text-orange-900 text-sm font-medium leading-relaxed">
                Tu reservación cuenta con una tolerancia máxima de <strong>15 minutos</strong>. Si
                no te presentas en ese tiempo, tu lugar será asignado a otro cliente para no afectar
                la agenda.
              </p>
            </div>
          </div>
        </div>

        <button
          onClick={onCerrar}
          className="w-full bg-slate-900 text-white font-black py-4 rounded-4xl hover:bg-black transition-all uppercase tracking-widest text-sm shadow-xl active:scale-95"
        >
          {descripcionRecompensa ? 'Confirmar cita' : 'Cerrar'}
        </button>
      </div>
    </div>
  );
}
