import { useEffect, useMemo, useState } from 'react';
import { ShieldAlert, MessageCircle, LogOut } from 'lucide-react';

const WHATSAPP_MEXICO = '525564134151';
const WHATSAPP_COLOMBIA = '573006934216';
const TIEMPO_SALIDA_AUTOMATICA_SEGUNDOS = 60;

interface PropsModalSuspension {
  nombreSalon: string;
  pais: string;
  onSalir: () => void | Promise<void>;
}

export function ModalSuspension({ nombreSalon, pais, onSalir }: PropsModalSuspension) {
  const [segundosRestantes, setSegundosRestantes] = useState(TIEMPO_SALIDA_AUTOMATICA_SEGUNDOS);
  const numeroWhatsApp = pais === 'Colombia' ? WHATSAPP_COLOMBIA : WHATSAPP_MEXICO;
  const telefonoVisible = pais === 'Colombia' ? '+57 300 6934216' : '+52 55 6413 4151';
  const enlaceWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(`Hola, mi salón "${nombreSalon}" fue suspendido por falta de pago. Necesito ayuda para renovar la suscripción y reactivar la cuenta.`)}`;
  const tiempoVisual = useMemo(
    () => `00:${String(segundosRestantes).padStart(2, '0')}`,
    [segundosRestantes],
  );

  useEffect(() => {
    const temporizadorSalida = window.setTimeout(() => {
      void onSalir();
    }, TIEMPO_SALIDA_AUTOMATICA_SEGUNDOS * 1000);

    const temporizadorCuentaRegresiva = window.setInterval(() => {
      setSegundosRestantes((valorActual) => (valorActual > 0 ? valorActual - 1 : 0));
    }, 1000);

    return () => {
      window.clearTimeout(temporizadorSalida);
      window.clearInterval(temporizadorCuentaRegresiva);
    };
  }, [onSalir]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-suspension"
      className="fixed inset-0 z-100 flex items-center justify-center p-4 bg-slate-900/95 backdrop-blur-sm"
    >
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center">
        <div className="bg-red-100 p-5 rounded-full inline-flex mb-6">
          <ShieldAlert className="w-10 h-10 text-red-600" aria-hidden="true" />
        </div>

        <h2 id="titulo-suspension" className="text-2xl font-black text-slate-900 uppercase">
          Suscripción suspendida
        </h2>

        <p className="text-slate-600 mt-4 text-sm leading-relaxed">
          Tu usuario fue suspendido por falta de pago en <strong>{nombreSalon}</strong>. Comunícate
          con soporte para renovar la suscripción y reactivar tu acceso. Si no cierras sesión
          manualmente, volverás al inicio en {tiempoVisual}.
        </p>

        <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
          Soporte {pais === 'Colombia' ? 'Colombia' : 'México'}: {telefonoVisible}
        </p>

        <div className="mt-8 space-y-3">
          <a
            href={enlaceWhatsApp}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-green-500 px-4 py-4 text-sm font-black text-white hover:bg-green-600 transition-colors"
          >
            <MessageCircle className="w-5 h-5" aria-hidden="true" />
            Abrir WhatsApp
          </a>

          <button
            type="button"
            onClick={() => {
              void onSalir();
            }}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-4 text-sm font-black text-slate-700 transition-colors hover:bg-slate-50"
          >
            <LogOut className="w-5 h-5" aria-hidden="true" />
            Salir del sistema
          </button>
        </div>

        <p className="text-[11px] text-slate-400 font-bold mt-6">
          Cuando el pago sea confirmado, el sistema reactivará la cuenta automáticamente.
        </p>
      </div>
    </div>
  );
}
