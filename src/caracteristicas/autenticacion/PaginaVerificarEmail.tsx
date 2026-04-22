import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MailCheck, ShieldCheck } from 'lucide-react';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';
import { verificarEmailCliente } from '../../servicios/servicioRegistro';

export function PaginaVerificarEmail() {
  usarTituloPagina('Verificar correo');
  const [parametros] = useSearchParams();
  const token = parametros.get('token');

  const [estado, setEstado] = useState<'informativo' | 'cargando' | 'exito' | 'error'>(
    token ? 'cargando' : 'informativo',
  );
  const [mensaje, setMensaje] = useState(
    token
      ? 'Estamos validando este enlace de confirmación.'
      : 'La verificación por código fue retirada. Las cuentas de cliente ahora quedan activas al registrarse.',
  );

  useEffect(() => {
    if (!token) return;

    setEstado('cargando');
    void verificarEmailCliente({ token })
      .then((resultado) => {
        setEstado('exito');
        setMensaje(resultado.mensaje);
      })
      .catch((error) => {
        setEstado('error');
        setMensaje(error instanceof Error ? error.message : 'No pudimos validar este enlace.');
      });
  }, [token]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5efe6] px-6 py-10">
      <div className="w-full max-w-md rounded-4xl border border-[#e4d8c8] bg-[#fffdf9] p-8 text-center shadow-[0_24px_80px_rgba(71,55,36,0.12)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#f3eadf] text-slate-900">
          {estado === 'exito' ? (
            <ShieldCheck className="h-8 w-8" aria-hidden="true" />
          ) : (
            <MailCheck className="h-8 w-8" aria-hidden="true" />
          )}
        </div>

        <h1 className="mt-6 text-3xl font-semibold text-slate-950">
          {estado === 'cargando'
            ? 'Verificando enlace'
            : estado === 'exito'
              ? 'Correo confirmado'
              : estado === 'error'
                ? 'No se pudo verificar'
                : 'Acceso actualizado'}
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">{mensaje}</p>

        <div className="mt-8 flex flex-col gap-3">
          <Link
            to="/iniciar-sesion"
            className="inline-flex items-center justify-center rounded-2xl bg-[#161616] px-5 py-3 text-sm font-semibold text-white"
          >
            Ir a iniciar sesión
          </Link>
          <Link
            to="/registro/cliente"
            className="inline-flex items-center justify-center rounded-2xl border border-[#dacbb8] px-5 py-3 text-sm font-semibold text-slate-700"
          >
            Crear cuenta de cliente
          </Link>
        </div>
      </div>
    </main>
  );
}
