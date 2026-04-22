import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Lock, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import { confirmarResetAPI } from '../../servicios/servicioAuth';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';
import { MarcaAplicacion } from '../../componentes/ui/MarcaAplicacion';

const esquema = z
  .object({
    contrasenaNueva: z
      .string()
      .min(8, 'MÃ­nimo 8 caracteres')
      .regex(/[A-Z]/, 'Debe incluir al menos una letra mayÃºscula')
      .regex(/[0-9]/, 'Debe incluir al menos un nÃºmero'),
    confirmarContrasena: z.string().min(1, 'Confirma tu contraseÃ±a'),
  })
  .refine((d) => d.contrasenaNueva === d.confirmarContrasena, {
    message: 'Las contraseÃ±as no coinciden',
    path: ['confirmarContrasena'],
  });

type CamposFormulario = z.infer<typeof esquema>;

export function PaginaResetContrasena() {
  usarTituloPagina('Nueva contraseÃ±a');
  const [busqueda] = useSearchParams();
  const navegar = useNavigate();
  const token = busqueda.get('token') ?? '';
  const [exitoso, setExitoso] = useState(false);
  const [mostrarNueva, setMostrarNueva] = useState(false);
  const [mostrarConfirmar, setMostrarConfirmar] = useState(false);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CamposFormulario>({ resolver: zodResolver(esquema) });

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-100 p-8 text-center">
          <AlertCircle className="w-14 h-14 text-amber-400 mx-auto mb-4" aria-hidden="true" />
          <h1 className="text-xl font-black text-slate-900 mb-2">Enlace invÃ¡lido</h1>
          <p className="text-slate-500 text-sm mb-6">
            Este enlace de recuperaciÃ³n es invÃ¡lido o ha expirado. Solicita uno nuevo.
          </p>
          <Link
            to="/recuperar-contrasena"
            className="inline-flex items-center gap-2 text-sm font-semibold text-pink-600 hover:text-pink-700 transition-colors"
          >
            Solicitar nuevo enlace
          </Link>
        </div>
      </div>
    );
  }

  const alEnviar = async (datos: CamposFormulario) => {
    try {
      await confirmarResetAPI(token, datos.contrasenaNueva);
      setExitoso(true);
    } catch (error) {
      const mensaje =
        error instanceof Error
          ? error.message
          : 'El enlace es invÃ¡lido o ha expirado. Solicita uno nuevo.';
      setError('root', { message: mensaje });
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="w-full max-w-md">
        <MarcaAplicacion className="mb-8 justify-center" />

        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-8">
          {exitoso ? (
            <div className="text-center py-4">
              <CheckCircle className="w-14 h-14 text-green-500 mx-auto mb-4" aria-hidden="true" />
              <h1 className="text-2xl font-black text-slate-900 mb-2">ContraseÃ±a actualizada</h1>
              <p className="text-slate-500 text-sm mb-6">
                Tu contraseÃ±a fue restablecida correctamente. Ya puedes iniciar sesiÃ³n.
              </p>
              <button
                onClick={() => navegar('/iniciar-sesion')}
                className="inline-flex items-center gap-2 text-sm font-semibold text-white bg-linear-to-r from-[#143C32] to-[#C6968C] px-6 py-3 rounded-xl hover:from-[#0A2823] hover:to-[#143C32] transition-all"
              >
                Ir a iniciar sesiÃ³n
              </button>
            </div>
          ) : (
            <>
              <Link
                to="/recuperar-contrasena"
                className="inline-flex items-center gap-1 text-sm text-slate-400 hover:text-slate-600 transition-colors mb-6"
                aria-label="Regresar a recuperar contraseÃ±a"
              >
                <ArrowLeft className="w-4 h-4" aria-hidden="true" />
                Regresar
              </Link>

              <h1 className="text-2xl font-black text-slate-900 mb-1">Nueva contraseÃ±a</h1>
              <p className="text-slate-500 text-sm mb-6">
                Elige una contraseÃ±a segura con al menos 8 caracteres, una mayÃºscula y un nÃºmero.
              </p>

              <form onSubmit={handleSubmit(alEnviar)} noValidate className="space-y-4">
                {/* Nueva contraseÃ±a */}
                <div>
                  <label
                    htmlFor="contrasena-nueva"
                    className="block text-sm font-semibold text-slate-700 mb-1.5"
                  >
                    Nueva contraseÃ±a
                  </label>
                  <div className="relative">
                    <Lock
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4"
                      aria-hidden="true"
                    />
                    <input
                      id="contrasena-nueva"
                      type={mostrarNueva ? 'text' : 'password'}
                      autoComplete="new-password"
                      className="w-full pl-10 pr-11 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                      aria-describedby={errors.contrasenaNueva ? 'error-nueva' : undefined}
                      aria-invalid={!!errors.contrasenaNueva}
                      {...register('contrasenaNueva')}
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarNueva((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label={mostrarNueva ? 'Ocultar contraseÃ±a' : 'Mostrar contraseÃ±a'}
                    >
                      {mostrarNueva ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {errors.contrasenaNueva && (
                    <p
                      id="error-nueva"
                      role="alert"
                      className="mt-1 text-xs text-red-500 font-medium"
                    >
                      {errors.contrasenaNueva.message}
                    </p>
                  )}
                </div>

                {/* Confirmar contraseÃ±a */}
                <div>
                  <label
                    htmlFor="confirmar-contrasena"
                    className="block text-sm font-semibold text-slate-700 mb-1.5"
                  >
                    Confirmar contraseÃ±a
                  </label>
                  <div className="relative">
                    <Lock
                      className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4"
                      aria-hidden="true"
                    />
                    <input
                      id="confirmar-contrasena"
                      type={mostrarConfirmar ? 'text' : 'password'}
                      autoComplete="new-password"
                      className="w-full pl-10 pr-11 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                      aria-describedby={errors.confirmarContrasena ? 'error-confirmar' : undefined}
                      aria-invalid={!!errors.confirmarContrasena}
                      {...register('confirmarContrasena')}
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarConfirmar((v) => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                      aria-label={mostrarConfirmar ? 'Ocultar contraseÃ±a' : 'Mostrar contraseÃ±a'}
                    >
                      {mostrarConfirmar ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  {errors.confirmarContrasena && (
                    <p
                      id="error-confirmar"
                      role="alert"
                      className="mt-1 text-xs text-red-500 font-medium"
                    >
                      {errors.confirmarContrasena.message}
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
                      Guardando...
                    </span>
                  ) : (
                    'Establecer nueva contraseÃ±a'
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
