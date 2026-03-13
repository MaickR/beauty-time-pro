import { useState, useEffect, useRef } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { solicitarCancelacion } from '../../../servicios/servicioSuscripcion';

interface PropsModalSolicitudCancelacion {
  abierto: boolean;
  estudioId: string;
  fechaVencimiento: string;
  alCerrar: () => void;
  alConfirmar: () => void;
}

export function ModalSolicitudCancelacion({
  abierto,
  estudioId,
  fechaVencimiento,
  alCerrar,
  alConfirmar,
}: PropsModalSolicitudCancelacion) {
  const [motivo, setMotivo] = useState('');
  const clienteConsulta = useQueryClient();
  const { mostrarToast } = usarToast();
  const botonCancelarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (abierto) {
      setMotivo('');
      botonCancelarRef.current?.focus();
    }
  }, [abierto]);

  useEffect(() => {
    const manejarEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') alCerrar();
    };
    if (abierto) document.addEventListener('keydown', manejarEscape);
    return () => document.removeEventListener('keydown', manejarEscape);
  }, [abierto, alCerrar]);

  const mutation = useMutation({
    mutationFn: () => solicitarCancelacion(estudioId, motivo.trim() || undefined),
    onSuccess: () => {
      mostrarToast({ mensaje: 'Solicitud de cancelación enviada', variante: 'exito' });
      void clienteConsulta.invalidateQueries({ queryKey: ['contexto', 'app'] });
      alConfirmar();
    },
    onError: (err: Error) => mostrarToast({ mensaje: err.message, variante: 'error' }),
  });

  if (!abierto) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-cancelacion-titulo"
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onKeyDown={(e) => e.key === 'Escape' && alCerrar()}
    >
      <div className="bg-white rounded-4xl p-8 max-w-md w-full shadow-2xl flex flex-col gap-5">
        <div className="flex flex-col items-center text-center gap-3">
          <div className="p-4 rounded-full bg-red-100 text-red-600">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2
            id="modal-cancelacion-titulo"
            className="text-lg font-black text-slate-900 uppercase tracking-tight"
          >
            ¿Cancelar suscripción?
          </h2>
          <p className="text-sm text-slate-600 font-medium leading-relaxed">
            Tu salón permanecerá activo hasta el <strong>{fechaVencimiento}</strong>. Una vez
            aprobada la cancelación, ya no podrás recibir reservas.
          </p>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm text-amber-800 font-medium">
          Esta acción enviará una solicitud al administrador. Puedes retirarla antes de que sea
          procesada.
        </div>

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor="motivo-cancelacion"
            className="text-xs font-black text-slate-600 uppercase tracking-wider"
          >
            Motivo (opcional)
          </label>
          <textarea
            id="motivo-cancelacion"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value.slice(0, 300))}
            placeholder="¿Por qué deseas cancelar tu suscripción?"
            rows={3}
            aria-describedby="motivo-limite"
            className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
          <p id="motivo-limite" className="text-right text-xs text-slate-400">
            {motivo.length}/300
          </p>
        </div>

        <div className="flex gap-3">
          <button
            ref={botonCancelarRef}
            onClick={alCerrar}
            className="flex-1 py-3 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase text-xs hover:bg-slate-200 transition-colors"
          >
            No, mantener
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            aria-busy={mutation.isPending}
            className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl uppercase text-xs transition-colors disabled:opacity-60"
          >
            {mutation.isPending ? 'Enviando...' : 'Sí, solicitar cancelación'}
          </button>
        </div>
      </div>
    </div>
  );
}
