import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Mail, ArrowLeft, CheckCircle } from 'lucide-react';
import { solicitarResetAPI } from '../../servicios/servicioAuth';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';
import { MarcaAplicacion } from '../../componentes/ui/MarcaAplicacion';

const esquema = z.object({
  email: z.string().email('Ingresa un correo electrÃ³nico vÃ¡lido'),
});

type CamposFormulario = z.infer<typeof esquema>;

export function PaginaRecuperarContrasena() {
  usarTituloPagina('Recuperar contraseÃ±a');
  const [enviado, setEnviado] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CamposFormulario>({ resolver: zodResolver(esquema) });

  const alEnviar = async (datos: CamposFormulario) => {
    try {
      await solicitarResetAPI(datos.email);
      setEnviado(true);
    } catch {
      setError('root', { message: 'OcurriÃ³ un error. Intenta nuevamente en unos minutos.' });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md">
        <MarcaAplicacion className="mb-8 justify-center" />

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
          {enviado ? (
            <div className="text-center py-4">
              <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" aria-hidden="true" />
              <h1 className="text-2xl font-black text-slate-900 mb-2">Revisa tu correo</h1>
              <p className="text-slate-500 text-sm mb-6">
                Si el correo existe en nuestra plataforma, recibirÃ¡s instrucciones para restablecer
                tu contraseÃ±a en breve.
              </p>
              <Link
                to="/iniciar-sesion"
                className="inline-flex items-center gap-2 text-sm font-semibold text-pink-600 hover:text-pink-700 transition-colors"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                Volver al inicio de sesiÃ³n
              </Link>
            </div>
          ) : (
            <>
              <Link
                to="/iniciar-sesion"
                className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 transition-colors mb-6"
                aria-label="Regresar al inicio de sesiÃ³n"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                Regresar
              </Link>

              <h1 className="text-2xl font-black text-slate-900 mb-1">
                Â¿Olvidaste tu contraseÃ±a?
              </h1>
              <p className="text-slate-500 text-sm mb-6">
                Ingresa tu correo y te enviaremos instrucciones para restablecerla.
              </p>

              <form onSubmit={handleSubmit(alEnviar)} noValidate className="space-y-4">
                <div>
                  <label
                    htmlFor="email-recuperar"
                    className="block text-sm font-semibold text-slate-700 mb-1.5"
                  >
                    Correo electrÃ³nico
                  </label>
                  <div className="relative">
                    <Mail
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4"
                      aria-hidden="true"
                    />
                    <input
                      id="email-recuperar"
                      type="email"
                      autoComplete="email"
                      className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                      aria-describedby={errors.email ? 'error-email-recuperar' : undefined}
                      aria-invalid={!!errors.email}
                      {...register('email')}
                    />
                  </div>
                  {errors.email && (
                    <p
                      id="error-email-recuperar"
                      role="alert"
                      className="mt-1 text-xs text-red-500 font-medium"
                    >
                      {errors.email.message}
                    </p>
                  )}
                </div>

                {errors.root && (
                  <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-sm text-red-600 font-medium">{errors.root.message}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                  className="w-full bg-linear-to-r from-[#143C32] to-[#C6968C] text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-pink-500/25 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2">
                      <span
                        className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                        aria-hidden="true"
                      />
                      Enviando...
                    </span>
                  ) : (
                    'Enviar instrucciones'
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
