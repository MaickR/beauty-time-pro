import { useState } from 'react';
import { ShieldCheck, Lock } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { usarContextoApp } from '../../../contextos/ContextoApp';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { actualizarPinCancelacion } from '../../../servicios/servicioEstudios';

interface PropsFormularioPinCancelacion {
  estudioId: string;
  pinConfigurado: boolean;
}

export function FormularioPinCancelacion({
  estudioId,
  pinConfigurado,
}: PropsFormularioPinCancelacion) {
  const { recargar } = usarContextoApp();
  const { mostrarToast } = usarToast();
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [pin, setPin] = useState('');
  const [confirmacion, setConfirmacion] = useState('');

  const { mutate: guardarPin, isPending } = useMutation({
    mutationFn: () => actualizarPinCancelacion(estudioId, pin, confirmacion),
    onSuccess: async () => {
      mostrarToast({ mensaje: 'PIN de cancelación configurado correctamente', variante: 'exito' });
      setPin('');
      setConfirmacion('');
      setMostrarFormulario(false);
      await recargar();
    },
    onError: (error: Error) => {
      mostrarToast({ mensaje: error.message, variante: 'error' });
    },
  });

  const manejarEnvio = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pin || !confirmacion) return;
    if (pin !== confirmacion) {
      mostrarToast({ mensaje: 'El PIN y la confirmación no coinciden', variante: 'error' });
      return;
    }
    if (!/^\d{4,6}$/.test(pin)) {
      mostrarToast({
        mensaje: 'El PIN debe tener entre 4 y 6 dígitos numéricos',
        variante: 'error',
      });
      return;
    }
    guardarPin();
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8 max-w-lg">
      <div className="flex items-center gap-4 mb-6">
        <div className="bg-slate-100 p-3 rounded-2xl text-slate-600">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div>
          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Seguridad</p>
          <p className="text-xl font-black text-slate-900">PIN de cancelación</p>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 p-4">
        <p className="text-sm font-bold text-amber-800 flex items-start gap-2">
          <span className="shrink-0">⚠️</span>
          <span>
            Este PIN es personal. Sin él no podrás marcar servicios como "No se realizó" ni cancelar
            citas desde la agenda.
          </span>
        </p>
      </div>

      {pinConfigurado && !mostrarFormulario ? (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
              <Lock className="w-4 h-4 text-green-600" />
            </div>
            <span className="text-sm font-black text-green-700">PIN configurado ✓</span>
          </div>
          <button
            type="button"
            onClick={() => setMostrarFormulario(true)}
            className="text-xs font-black text-pink-600 hover:text-pink-700 uppercase tracking-wide"
          >
            Cambiar PIN
          </button>
        </div>
      ) : (
        <form onSubmit={manejarEnvio} className="space-y-4">
          <div>
            <label className="block text-xs font-black text-slate-600 uppercase tracking-wide mb-2">
              Nuevo PIN (4-6 dígitos)
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
            />
          </div>
          <div>
            <label className="block text-xs font-black text-slate-600 uppercase tracking-wide mb-2">
              Confirmar PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={confirmacion}
              onChange={(e) => setConfirmacion(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="••••"
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-900 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
            />
          </div>
          <div className="flex gap-3 pt-2">
            {pinConfigurado && (
              <button
                type="button"
                onClick={() => {
                  setPin('');
                  setConfirmacion('');
                  setMostrarFormulario(false);
                }}
                className="flex-1 py-3 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase text-xs hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
            )}
            <button
              type="submit"
              disabled={isPending || !pin || !confirmacion}
              aria-busy={isPending}
              className="flex-1 py-3 bg-slate-900 text-white font-black rounded-2xl uppercase text-xs hover:bg-black transition-colors disabled:opacity-60"
            >
              {isPending ? 'Guardando...' : 'Guardar PIN'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
