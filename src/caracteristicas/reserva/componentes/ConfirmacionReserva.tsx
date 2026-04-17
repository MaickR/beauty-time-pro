import { useEffect } from 'react';
import confetti from 'canvas-confetti';
import { CheckCircle2, Clock, Gift } from 'lucide-react';
import { formatearDineroEntero } from '../../../utils/formato';
import type { Moneda } from '../../../tipos';

function formatearFechaHoraReserva(fecha: string, hora: string): string {
  if (!fecha || !hora) return '';

  const [ano, mes, dia] = fecha.split('-').map(Number);
  const [horas, minutos] = hora.split(':').map(Number);
  const fechaHora = new Date(ano ?? 0, (mes ?? 1) - 1, dia ?? 1, horas ?? 0, minutos ?? 0);

  const fechaFormateada = new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(fechaHora);

  const horaFormateada = new Intl.DateTimeFormat('es-MX', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(fechaHora)
    .replace(/\s?a\.?\s?m\.?/i, 'am')
    .replace(/\s?p\.?\s?m\.?/i, 'pm')
    .replace(/\s+/g, '');

  return `${fechaFormateada} a las ${horaFormateada}`;
}

interface PropsConfirmacionReserva {
  nombreCliente: string;
  descripcionRecompensa?: string | null;
  salon: string;
  especialista: string;
  servicios: string[];
  productos: Array<{ nombre: string; cantidad: number }>;
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
  especialista,
  servicios,
  productos,
  duracion,
  total,
  fecha,
  hora,
  moneda,
  onCerrar,
}: PropsConfirmacionReserva) {
  const fechaHora = formatearFechaHoraReserva(fecha, hora);

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
      <div className="w-full max-w-xl rounded-[2.5rem] bg-white p-5 text-center shadow-2xl md:p-7">
        <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-green-100 text-green-500 shadow-inner md:h-24 md:w-24">
          <CheckCircle2 className="h-10 w-10 md:h-12 md:w-12" />
        </div>
        <h2
          id="tituloConfirmacion"
          className="mb-3 text-2xl font-black italic uppercase tracking-tighter text-slate-800 md:text-3xl"
        >
          ¡Cita Confirmada!
        </h2>
        <p className="mb-5 text-sm font-medium text-slate-600 md:text-base">
          Muchas gracias por tu preferencia,{' '}
          <strong className="text-pink-600 uppercase">{nombreCliente}</strong>. Tu especialista te
          estará esperando.
        </p>

        <div className="mb-5 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-left md:p-5">
          <h4 className="mb-3 text-xs font-black uppercase tracking-widest text-slate-500">
            Resumen de la cita
          </h4>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Salón</p>
              <p className="text-sm font-bold text-slate-900">{salon}</p>
            </div>
            <div>
              <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">Fecha y hora</p>
              <p className="text-sm font-bold text-slate-900">{fechaHora || 'Por confirmar'}</p>
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
            {productos.length > 0 && (
              <div className="sm:col-span-2">
                <p className="text-[11px] font-black uppercase tracking-wide text-slate-400">
                  Productos
                </p>
                <p className="text-sm font-bold text-slate-900">
                  {productos.map((producto) => `${producto.nombre} x${producto.cantidad}`).join(', ')}
                </p>
              </div>
            )}
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

        <div className="mb-5 rounded-3xl border border-sky-200 bg-sky-50 p-4 text-left shadow-sm">
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-xl bg-sky-100 p-2 text-sky-600">
              <Clock className="h-5 w-5" />
            </div>
            <div className="space-y-2 text-sm text-sky-900">
              <p className="font-semibold">
                El pago de tu servicio se realiza directamente en el salón el día de tu cita.
              </p>
              <p className="font-medium">
                Tu reservación cuenta con una tolerancia máxima de <strong>15 minutos</strong>.
              </p>
            </div>
          </div>
        </div>

        {descripcionRecompensa && (
          <div className="mb-5 rounded-3xl border border-emerald-200 bg-emerald-50 p-4 text-left shadow-sm">
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-xl bg-emerald-100 p-2 text-emerald-600">
                <Gift className="h-5 w-5" />
              </div>
              <div>
                <h4 className="mb-1 text-xs font-black uppercase tracking-widest text-emerald-800">
                  Recompensa Ganada
                </h4>
                <p className="text-sm font-medium leading-relaxed text-emerald-900">
                  ¡Felicidades {nombreCliente}! Has ganado una recompensa:{' '}
                  <strong>{descripcionRecompensa}</strong>.
                </p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={onCerrar}
          className="w-full bg-slate-900 text-white font-black py-4 rounded-4xl hover:bg-black transition-all uppercase tracking-widest text-sm shadow-xl active:scale-95"
        >
          Ir al inicio de sesión
        </button>
      </div>
    </div>
  );
}
