import { DollarSign } from 'lucide-react';
import type { Estudio, Moneda } from '../../../tipos';

interface PropsModalPago {
  estudio: Estudio;
  onConfirmar: (monto: number, moneda: Moneda) => void;
  onCerrar: () => void;
}

export function ModalPago({ estudio, onConfirmar, onCerrar }: PropsModalPago) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-pago-titulo"
      className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[70] flex items-center justify-center p-4"
    >
      <div className="bg-white max-w-md w-full rounded-[3rem] p-8 text-center shadow-2xl">
        <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <DollarSign className="w-8 h-8" />
        </div>
        <h2 id="modal-pago-titulo" className="text-2xl font-black italic uppercase tracking-tighter mb-2">Abonar Pago</h2>
        <p className="text-slate-500 font-bold mb-8">
          Studio: <span className="text-pink-600 uppercase">{estudio.name}</span>
        </p>
        <p className="text-[10px] uppercase font-black text-slate-400 mb-4 tracking-widest">
          Selecciona la tarifa a abonar:
        </p>
        <div className="space-y-4 mb-8">
          <button
            onClick={() => onConfirmar(1000, 'MXN')}
            className="w-full bg-green-50 border-2 border-green-200 text-green-700 font-black py-4 rounded-2xl hover:bg-green-100 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            Abonar $1,000 MXN
          </button>
          <button
            onClick={() => onConfirmar(200000, 'COP')}
            className="w-full bg-blue-50 border-2 border-blue-200 text-blue-700 font-black py-4 rounded-2xl hover:bg-blue-100 hover:scale-[1.02] transition-all flex items-center justify-center gap-2 shadow-sm"
          >
            Abonar $200,000 COP
          </button>
        </div>
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
