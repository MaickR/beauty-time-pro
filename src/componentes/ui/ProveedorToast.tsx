import { createContext, useContext, useState, type PropsWithChildren } from 'react';

interface ToastActivo {
  id: number;
  mensaje: string;
}

interface ContextoToast {
  mostrarToast: (mensaje: string) => void;
}

const ContextoToastInterno = createContext<ContextoToast | null>(null);

export function ProveedorToast({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<ToastActivo[]>([]);

  const mostrarToast = (mensaje: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((actuales) => [...actuales, { id, mensaje }]);

    window.setTimeout(() => {
      setToasts((actuales) => actuales.filter((toast) => toast.id !== id));
    }, 3500);
  };

  return (
    <ContextoToastInterno.Provider value={{ mostrarToast }}>
      {children}
      <div className="pointer-events-none fixed right-4 top-4 z-[120] flex w-full max-w-sm flex-col gap-3" aria-live="polite" aria-atomic="true">
        {toasts.map((toast) => (
          <div key={toast.id} className="rounded-2xl border border-slate-200 bg-slate-950 px-5 py-4 text-sm font-bold text-white shadow-2xl shadow-slate-950/20">
            {toast.mensaje}
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