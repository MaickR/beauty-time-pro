import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MailCheck, RotateCcw, ShieldCheck } from 'lucide-react';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';
import {
  ErrorServicioRegistro,
  reenviarCodigoVerificacionCliente,
  verificarEmailCliente,
} from '../../servicios/servicioRegistro';

const esquema = z.object({
  codigo: z
    .string()
    .trim()
    .min(4, 'Ingresa el código de 4 caracteres')
    .max(4, 'Ingresa el código de 4 caracteres'),
});

type CamposFormulario = z.infer<typeof esquema>;

export function PaginaVerificarEmail() {
  usarTituloPagina('Verificar correo');
  const [parametros] = useSearchParams();
  const [estado, setEstado] = useState<'formulario' | 'cargando' | 'exito' | 'error'>('formulario');
  const [mensaje, setMensaje] = useState(
    parametros.get('mensaje') ?? 'Ingresa el código que acabamos de enviar a tu correo.',
  );
  const [segundosRestantes, setSegundosRestantes] = useState(60);
  const [errorReenvio, setErrorReenvio] = useState('');

  const token = parametros.get('token');
  const clienteId = parametros.get('clienteId') ?? '';
  const email = parametros.get('email') ?? '';

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CamposFormulario>({
    resolver: zodResolver(esquema),
    defaultValues: { codigo: '' },
  });

  useEffect(() => {
    if (!token) {
      return;
    }

    setEstado('cargando');
    void verificarEmailCliente({ token })
      .then((resultado) => {
        setEstado('exito');
        setMensaje(resultado.mensaje);
      })
      .catch((error) => {
        setEstado('error');
        setMensaje(error instanceof Error ? error.message : 'No pudimos verificar este correo.');
      });
  }, [token]);

  useEffect(() => {
    if (!token && !clienteId) {
      setEstado('error');
      setMensaje('Esta solicitud de verificación está incompleta. Inicia el registro nuevamente.');
    }
  }, [clienteId, token]);

  useEffect(() => {
    if (token || estado !== 'formulario' || segundosRestantes <= 0) {
      return;
    }

    const temporizador = window.setInterval(() => {
      setSegundosRestantes((valor) => (valor > 0 ? valor - 1 : 0));
    }, 1000);

    return () => window.clearInterval(temporizador);
  }, [estado, segundosRestantes, token]);

  const alVerificarCodigo = async (datos: CamposFormulario) => {
    if (!clienteId) {
      setEstado('error');
      setMensaje('Esta solicitud de verificación está incompleta. Inicia el registro nuevamente.');
      return;
    }

    setErrorReenvio('');

    try {
      const resultado = await verificarEmailCliente({
        clienteId,
        codigo: datos.codigo.trim().toUpperCase(),
      });
      setEstado('exito');
      setMensaje(resultado.mensaje);
    } catch (error) {
      if (error instanceof ErrorServicioRegistro) {
        setEstado('formulario');
        setError('codigo', {
          message: error.campos?.codigo ?? error.message,
        });
        setMensaje(error.message);
        return;
      }

      setEstado('error');
      setMensaje('No pudimos verificar este código.');
    }
  };

  const alReenviar = async () => {
    if (!clienteId || segundosRestantes > 0) {
      return;
    }

    setErrorReenvio('');

    try {
      const resultado = await reenviarCodigoVerificacionCliente(clienteId);
      setMensaje(resultado.mensaje);
      setSegundosRestantes(resultado.reenviarEnSegundos ?? 60);
    } catch (error) {
      if (error instanceof ErrorServicioRegistro) {
        if (error.codigo === 'REENVIO_BLOQUEADO') {
          setSegundosRestantes(error.segundosRestantes ?? 60);
        }
        setErrorReenvio(error.message);
        return;
      }
      setErrorReenvio('No pudimos enviar un nuevo código en este momento.');
    }
  };

  if (token) {
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
              ? 'Verificando correo'
              : estado === 'exito'
                ? 'Correo confirmado'
                : 'Verificación fallida'}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{mensaje}</p>
          <Link
            to="/iniciar-sesion"
            className="mt-8 inline-flex rounded-2xl bg-[#161616] px-5 py-3 text-sm font-semibold text-white"
          >
            Ir a iniciar sesión
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5efe6] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[0.92fr_1.08fr]">
        <section className="rounded-4xl bg-[#1d1b1a] p-8 text-white shadow-2xl shadow-black/20 sm:p-10">
          <p className="text-sm uppercase tracking-[0.3em] text-[#f5cea7]">
            Verificación de correo
          </p>
          <h1 className="mt-4 text-4xl font-semibold leading-tight">
            Usa el código de tu bandeja para activar tu acceso como cliente.
          </h1>
          <p className="mt-5 text-base leading-7 text-white/70">
            Cada reenvío reemplaza de inmediato el código anterior. El código solo funciona para la
            cuenta que acabas de crear.
          </p>
          <div className="mt-8 rounded-3xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs uppercase tracking-[0.28em] text-white/45">Destino</p>
            <p className="mt-2 break-all text-lg font-medium text-white">
              {email || 'Correo oculto'}
            </p>
          </div>
        </section>

        <section className="rounded-4xl border border-[#e4d8c8] bg-[#fffdf9] p-6 shadow-[0_24px_80px_rgba(71,55,36,0.12)] sm:p-8">
          <div className="mb-8">
            <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
              Verifica tu correo
            </h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">{mensaje}</p>
          </div>

          {estado === 'exito' ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm text-emerald-800">
              <p className="font-semibold">Correo verificado</p>
              <p className="mt-1 leading-6">Tu cuenta está lista. Ya puedes iniciar sesión.</p>
            </div>
          ) : null}

          {estado === 'error' ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-700">
              {mensaje}
            </div>
          ) : null}

          {estado !== 'exito' ? (
            <form onSubmit={handleSubmit(alVerificarCodigo)} noValidate className="space-y-5">
              <div>
                <label htmlFor="codigo" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Código de verificación
                </label>
                <input
                  id="codigo"
                  type="text"
                  inputMode="text"
                  autoComplete="one-time-code"
                  maxLength={4}
                  className="w-full rounded-2xl border border-[#dacbb8] bg-white px-4 py-4 text-center text-3xl font-semibold uppercase tracking-[0.45em] text-slate-950 outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-[#f0d7bb]"
                  aria-invalid={Boolean(errors.codigo)}
                  {...register('codigo')}
                />
                {errors.codigo ? (
                  <p className="mt-1.5 text-xs text-red-600">{errors.codigo.message}</p>
                ) : null}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className="w-full rounded-2xl bg-[#161616] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting ? 'Validando código...' : 'Verificar código'}
              </button>
            </form>
          ) : null}

          <div className="mt-6 rounded-2xl border border-[#eadfce] bg-[#f8f3ec] px-4 py-4 text-sm text-slate-600">
            <p className="font-medium text-slate-900">¿Necesitas un nuevo código?</p>
            <p className="mt-1 leading-6">
              Puedes solicitar uno nuevo cada 60 segundos. El código anterior deja de funcionar en
              cuanto se genera uno nuevo.
            </p>
            <button
              type="button"
              onClick={alReenviar}
              disabled={segundosRestantes > 0 || !clienteId}
              className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-slate-900 disabled:cursor-not-allowed disabled:text-slate-400"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              {segundosRestantes > 0 ? `Reenviar en ${segundosRestantes}s` : 'Enviar nuevo código'}
            </button>
            {errorReenvio ? <p className="mt-2 text-xs text-red-600">{errorReenvio}</p> : null}
          </div>

          <p className="mt-6 text-center text-sm text-slate-600">
            ¿Ya verificaste tu correo?{' '}
            <Link
              to="/iniciar-sesion"
              className="font-semibold text-slate-900 underline decoration-[#c7b299] underline-offset-4"
            >
              Ir a iniciar sesión
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}
