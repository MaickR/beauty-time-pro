import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';
import { verificarEmailCliente } from '../../servicios/servicioRegistro';

export function PaginaVerificarEmail() {
  usarTituloPagina('Verificar correo — Beauty Time Pro');
  const [parametros] = useSearchParams();
  const [estado, setEstado] = useState<'cargando' | 'exito' | 'error'>('cargando');
  const [mensaje, setMensaje] = useState('Estamos validando tu enlace.');

  useEffect(() => {
    const token = parametros.get('token');
    if (!token) {
      setEstado('error');
      setMensaje('El enlace de verificación es inválido.');
      return;
    }

    void verificarEmailCliente(token)
      .then((resultado) => {
        setEstado('exito');
        setMensaje(resultado.mensaje);
      })
      .catch((error) => {
        setEstado('error');
        setMensaje(error instanceof Error ? error.message : 'No se pudo verificar el correo.');
      });
  }, [parametros]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-linear-to-br from-pink-50 to-slate-100 p-6">
      <div className="max-w-md w-full text-center bg-white rounded-3xl shadow-sm border border-slate-100 px-10 py-14">
        <div className="flex justify-center mb-6">
          <span className="text-6xl" role="img" aria-label="Estado de verificación">
            {estado === 'cargando' ? '⏳' : estado === 'exito' ? '✅' : '⚠️'}
          </span>
        </div>
        <h1 className="text-3xl font-black text-slate-900 mb-3">
          {estado === 'cargando'
            ? 'Verificando correo'
            : estado === 'exito'
              ? 'Correo verificado'
              : 'No se pudo verificar'}
        </h1>
        <p className="text-slate-500 mb-8">{mensaje}</p>
        <Link
          to="/iniciar-sesion"
          className="inline-block w-full bg-linear-to-r from-[#C2185B] to-[#E91E8C] text-white font-bold py-3.5 rounded-2xl hover:shadow-lg hover:scale-[1.01] transition-all"
        >
          Ir a iniciar sesión
        </Link>
      </div>
    </div>
  );
}
