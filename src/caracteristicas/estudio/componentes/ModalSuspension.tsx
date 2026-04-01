import { ShieldAlert, MessageCircle } from 'lucide-react';

const WHATSAPP_MEXICO = '5255641341516';
const WHATSAPP_COLOMBIA = '573006934216';

interface PropsModalSuspension {
  nombreSalon: string;
  pais: string;
}

export function ModalSuspension({ nombreSalon, pais }: PropsModalSuspension) {
  const numeroWhatsApp = pais === 'Colombia' ? WHATSAPP_COLOMBIA : WHATSAPP_MEXICO;
  const enlaceWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(`Hola, mi salón "${nombreSalon}" fue suspendido. Necesito ayuda para reactivar mi cuenta.`)}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-suspension"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/95 backdrop-blur-sm"
    >
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center">
        <div className="bg-red-100 p-5 rounded-full inline-flex mb-6">
          <ShieldAlert className="w-10 h-10 text-red-600" aria-hidden="true" />
        </div>

        <h2 id="titulo-suspension" className="text-2xl font-black text-slate-900 uppercase">
          Account Suspended
        </h2>

        <p className="text-slate-600 mt-4 text-sm leading-relaxed">
          Your subscription for <strong>{nombreSalon}</strong> has been suspended due to a pending
          payment. Please contact us to reactivate your account.
        </p>

        <div className="mt-8 space-y-3">
          <a
            href={enlaceWhatsApp}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-green-500 px-4 py-4 text-sm font-black text-white hover:bg-green-600 transition-colors"
          >
            <MessageCircle className="w-5 h-5" aria-hidden="true" />
            Contact us via WhatsApp
          </a>
        </div>

        <p className="text-[11px] text-slate-400 font-bold mt-6">
          Once your payment is confirmed, your account will be reactivated automatically.
        </p>
      </div>
    </div>
  );
}
