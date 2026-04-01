import { createContext, useContext, useState, type PropsWithChildren } from 'react';
import { generarIdSeguro } from '../../utils/seguridad';

interface ToastActivo {
  id: string;
  mensaje: string;
  variante: 'exito' | 'error' | 'info';
  icono: string;
}

interface OpcionesToast {
  mensaje: string;
  variante?: 'exito' | 'error' | 'info';
  icono?: string;
  duracionMs?: number;
}

interface ContextoToast {
  mostrarToast: (mensaje: string | OpcionesToast) => void;
}

const ContextoToastInterno = createContext<ContextoToast | null>(null);

export function ProveedorToast({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastActivo[]>([]);

  const mostrarToast = (entrada: string | OpcionesToast) => {
    const opciones =
      typeof entrada === 'string'
        ? { mensaje: entrada, variante: 'info' as const, icono: '•', duracionMs: 4000 }
        : {
            mensaje: entrada.mensaje,
            variante: entrada.variante ?? 'info',
            icono:
              entrada.icono ??
              (entrada.variante === 'exito' ? '✓' : entrada.variante === 'error' ? '✗' : '•'),
            duracionMs: entrada.duracionMs ?? 4000,
          };
    const id = generarIdSeguro();
    setToasts((actuales) => [
      ...actuales,
      { id, mensaje: opciones.mensaje, variante: opciones.variante, icono: opciones.icono },
    ]);

    window.setTimeout(() => {
      setToasts((actuales) => actuales.filter((toast) => toast.id !== id));
    }, opciones.duracionMs);
  };

  return (
    <ContextoToastInterno.Provider value={{ mostrarToast }}>
      {children}
      <div
        className="pointer-events-none fixed right-4 top-4 z-[120] flex w-full max-w-sm flex-col gap-3"
        aria-live="polite"
        aria-atomic="true"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`rounded-2xl border px-5 py-4 text-sm font-bold shadow-2xl ${
              toast.variante === 'exito'
                ? 'border-green-200 bg-green-600 text-white shadow-green-600/20'
                : toast.variante === 'error'
                  ? 'border-red-200 bg-red-600 text-white shadow-red-600/20'
                  : 'border-slate-200 bg-slate-950 text-white shadow-slate-950/20'
            }`}
          >
            <div className="flex items-center gap-3">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-white/15 text-base font-black">
                {toast.icono}
              </span>
              <span>{toast.mensaje}</span>
            </div>
          </div>
        ))}
      </div>
    </ContextoToastInterno.Provider>
  );
}

export function usarToast() {
  const contexto = useContext(ContextoToastInterno);

  if (!contexto) {
    throw new Error('usarToast debe usarse dentro de ProveedorToast');
  }

  return contexto;
}
