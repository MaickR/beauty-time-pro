import { Link, useSearchParams } from 'react-router-dom';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';

const MOTIVOS: Record<string, { titulo: string; mensaje: string; submensaje: string }> = {
  verificacion: {
    titulo: 'Â¡Listo!',
    mensaje: 'Tu cuenta fue creada correctamente.',
    submensaje: 'Ya puedes iniciar sesiÃ³n con tu correo y contraseÃ±a.',
  },
};

const MOTIVO_POR_DEFECTO = {
  titulo: 'Â¡Correo enviado!',
  mensaje: 'Te hemos enviado un correo electrÃ³nico.',
  submensaje: 'Revisa tu bandeja de entrada y sigue las instrucciones.',
};

export function PaginaEmailEnviado() {
  usarTituloPagina('Correo enviado â€” Beauty Time Pro');
  const [params] = useSearchParams();
  const motivo = params.get('motivo') ?? '';
  const mensaje = params.get('mensaje');
  const enlace = params.get('enlace');
  const contenido = MOTIVOS[motivo] ?? MOTIVO_POR_DEFECTO;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-linear-to-br from-pink-50 to-slate-100 p-6">
      <div className="max-w-md w-full text-center bg-white rounded-3xl shadow-sm border border-slate-100 px-10 py-14">
        <div className="flex justify-center mb-6">
          <span
            className="text-6xl"
            style={{ display: 'inline-block', animation: 'sobrevolar 1.4s ease-in-out infinite' }}
            role="img"
            aria-label="Sobre de correo"
          >
            âœ‰ï¸
          </span>
        </div>
        <style>{`
          @keyframes sobrevolar {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-8px); }
          }
        `}</style>

        <h1 className="text-3xl font-black text-slate-900 mb-3">{contenido.titulo}</h1>
        <p className="text-lg font-semibold text-slate-700 mb-2">{mensaje ?? contenido.mensaje}</p>
        <p className="text-slate-400 text-sm mb-8">{contenido.submensaje}</p>

        {enlace && (
          <a
            href={enlace}
            className="mb-4 inline-block text-sm font-bold text-blue-600 underline hover:text-blue-700"
          >
            Abrir enlace de verificaciÃ³n
          </a>
        )}

        <Link
          to="/iniciar-sesion"
          className="inline-block w-full bg-linear-to-r from-[#C6968C] to-[#78736E] text-white font-bold py-3.5 rounded-2xl hover:shadow-lg hover:scale-[1.01] transition-all"
        >
          Ir a iniciar sesiÃ³n
        </Link>
      </div>
    </div>
  );
}
