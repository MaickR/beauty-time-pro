import { Search } from 'lucide-react';
import { Link } from 'react-router-dom';

export function Pagina404() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 p-8">
      <div className="max-w-md w-full text-center bg-white rounded-[3rem] p-10 shadow-xl border border-slate-200">
        <div className="flex justify-center mb-6">
          <div className="bg-pink-50 p-4 rounded-full">
            <Search className="w-10 h-10 text-pink-500" aria-hidden="true" />
          </div>
        </div>
        <p className="text-7xl font-black text-slate-200 mb-2">404</p>
        <h1 className="text-2xl font-black italic uppercase tracking-tighter text-slate-900 mb-4">
          Página no encontrada
        </h1>
        <p className="text-slate-500 font-medium mb-8">
          La página que buscas no existe o fue movida a otra dirección.
        </p>
        <Link
          to="/"
          className="inline-block bg-slate-900 text-white font-black px-8 py-4 rounded-2xl uppercase tracking-widest hover:bg-black transition-colors"
        >
          Ir al inicio
        </Link>
      </div>
    </div>
  );
}
