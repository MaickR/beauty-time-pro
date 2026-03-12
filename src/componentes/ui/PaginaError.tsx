import { AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface PropsPaginaError {
  titulo?: string;
  mensaje?: string;
  onReintentar?: () => void;
}

export function PaginaError({
  titulo = 'Algo salió mal',
  mensaje = 'Ocurrió un error inesperado en esta sección. Por favor intenta de nuevo.',
  onReintentar,
}: PropsPaginaError) {
  const navegar = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
      <div className="max-w-md w-full text-center bg-white rounded-[3rem] p-10 shadow-xl border border-slate-200">
        <div className="flex justify-center mb-6">
          <div className="bg-red-50 p-4 rounded-full">
            <AlertTriangle className="w-10 h-10 text-red-500" aria-hidden="true" />
          </div>
        </div>
        <h1 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 mb-4">
          {titulo}
        </h1>
        <p className="text-slate-500 font-medium mb-8">{mensaje}</p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {onReintentar && (
            <button
              onClick={onReintentar}
              className="bg-slate-900 text-white font-black px-8 py-4 rounded-2xl uppercase tracking-widest hover:bg-black transition-colors"
            >
              Intentar de nuevo
            </button>
          )}
          <button
            onClick={() => navegar(-1)}
            className="border border-slate-200 text-slate-700 font-bold px-8 py-4 rounded-2xl hover:bg-slate-100 transition-colors"
          >
            Volver atrás
          </button>
        </div>
      </div>
    </div>
  );
}
