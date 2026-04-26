import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';
import { guardarAvisoInicioSesion } from '../../tienda/tiendaAuth';

export function PaginaEsperaAprobacion() {
  usarTituloPagina('Solicitud enviada — Beauty Time Pro');
  const navegar = useNavigate();

  useEffect(() => {
    const temporizador = setTimeout(() => {
      guardarAvisoInicioSesion({
        mensaje: 'Your request was sent. We will email you as soon as it is approved.',
        tono: 'blue',
      });
      navegar('/iniciar-sesion');
    }, 3000);
    return () => clearTimeout(temporizador);
  }, [navegar]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-linear-to-br from-pink-50 to-slate-100 p-6">
      <div className="max-w-md w-full text-center bg-white rounded-3xl shadow-sm border border-slate-100 px-10 py-14">
        {/* Ícono animado */}
        <div className="flex justify-center mb-6">
          <span
            className="text-6xl"
            style={{ display: 'inline-block', animation: 'titilar 2s ease-in-out infinite' }}
            role="img"
            aria-label="Reloj de arena"
          >
            ⏳
          </span>
        </div>
        <style>{`
          @keyframes titilar {
            0%, 100% { opacity: 1; transform: scale(1); }
            50% { opacity: 0.6; transform: scale(0.95); }
          }
        `}</style>

        <h1 className="text-3xl font-black text-slate-900 mb-3">¡Solicitud enviada!</h1>
        <p className="text-slate-500 leading-relaxed mb-2">
          Revisaremos los datos de tu salón y te responderemos por correo electrónico en un plazo de{' '}
          <span className="font-semibold text-slate-700">24 a 48 horas</span>.
        </p>
        <p className="text-slate-400 text-sm mb-8">
          Si necesitas hacer cambios en tu solicitud, contáctanos a través de nuestro correo de
          soporte.
        </p>

        <Link
          to="/"
          className="inline-block w-full bg-linear-to-r from-[#C6968C] to-[#78736E] text-white font-bold py-3.5 rounded-2xl hover:shadow-lg hover:scale-[1.01] transition-all"
        >
          Volver al inicio
        </Link>
      </div>
    </div>
  );
}
