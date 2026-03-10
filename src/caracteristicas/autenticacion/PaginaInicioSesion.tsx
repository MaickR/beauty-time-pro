import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Mail, Lock, Scissors } from 'lucide-react';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';

const esquema = z.object({
  email: z.string().email('Ingresa un correo electrónico válido'),
  contrasena: z.string().min(1, 'La contraseña es requerida'),
  recordarme: z.boolean().optional(),
});

type CamposFormulario = z.infer<typeof esquema>;

const STORAGE_EMAIL = 'beauty_email_recordado';

export function PaginaInicioSesion() {
  usarTituloPagina('Iniciar sesión');
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const { iniciarSesion } = usarTiendaAuth();
  const navegar = useNavigate();

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CamposFormulario>({
    resolver: zodResolver(esquema),
    defaultValues: { recordarme: false },
  });

  useEffect(() => {
    const emailGuardado = localStorage.getItem(STORAGE_EMAIL);
    if (emailGuardado) {
      setValue('email', emailGuardado);
      setValue('recordarme', true);
    }
  }, [setValue]);

  const alEnviar = async (datos: CamposFormulario) => {
    if (datos.recordarme) {
      localStorage.setItem(STORAGE_EMAIL, datos.email);
    } else {
      localStorage.removeItem(STORAGE_EMAIL);
    }

    const resultado = await iniciarSesion(datos.email, datos.contrasena);
    if (!resultado.exito) {
      setError('root', { message: resultado.mensaje ?? 'Credenciales incorrectas. Verifica tus datos.' });
      return;
    }
    navegar(resultado.ruta ?? '/');
  };

  return (
    <div className="min-h-screen flex">
      {/* Panel izquierdo — branding */}
      <div className="hidden lg:flex lg:w-3/5 flex-col justify-between p-12 bg-linear-to-br from-[#880E4F] via-[#C2185B] to-[#F06292]">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-3 rounded-2xl">
            <Scissors className="text-white w-7 h-7" aria-hidden="true" />
          </div>
          <span className="text-white font-black text-xl tracking-tight">Beauty Time Pro</span>
        </div>

        <div className="text-white">
          <h1 className="text-5xl font-black leading-tight mb-6">
            Gestiona tu salón<br />con precisión.
          </h1>
          <ul className="space-y-4" aria-label="Características de la plataforma">
            {[
              { titulo: 'Agenda inteligente', desc: 'Reservas en tiempo real con recordatorios automáticos.' },
              { titulo: 'Panel financiero', desc: 'Visualiza ingresos, servicios populares y tendencias.' },
              { titulo: 'Multi-sucursal', desc: 'Administra todos tus salones desde un solo lugar.' },
            ].map(({ titulo, desc }) => (
              <li key={titulo} className="flex items-start gap-3">
                <span className="mt-1 shrink-0 w-5 h-5 rounded-full bg-white/30 flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-white" />
                </span>
                <div>
                  <p className="font-bold">{titulo}</p>
                  <p className="text-white/70 text-sm">{desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-white/50 text-sm">© {new Date().getFullYear()} Beauty Time Pro · Hecho para México y Colombia</p>
      </div>

      {/* Panel derecho — formulario */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          {/* Logo móvil */}
          <div className="flex lg:hidden items-center gap-2 justify-center mb-8">
            <div className="bg-linear-to-br from-[#880E4F] to-[#F06292] p-2.5 rounded-xl">
              <Scissors className="text-white w-6 h-6" aria-hidden="true" />
            </div>
            <span className="font-black text-lg text-slate-900">Beauty Time Pro</span>
          </div>

          <h2 className="text-3xl font-black text-slate-900 mb-1">Bienvenido</h2>
          <p className="text-slate-500 text-sm mb-8">Ingresa a tu panel de gestión</p>

          <form onSubmit={handleSubmit(alEnviar)} noValidate className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4"
                  aria-hidden="true"
                />
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                  aria-describedby={errors.email ? 'error-email' : undefined}
                  aria-invalid={!!errors.email}
                  {...register('email')}
                />
              </div>
              {errors.email && (
                <p id="error-email" role="alert" className="mt-1 text-xs text-red-500 font-medium">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Contraseña */}
            <div>
              <label htmlFor="contrasena" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Contraseña
              </label>
              <div className="relative">
                <Lock
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4"
                  aria-hidden="true"
                />
                <input
                  id="contrasena"
                  type={mostrarContrasena ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="w-full pl-10 pr-11 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                  aria-describedby={errors.contrasena ? 'error-contrasena' : undefined}
                  aria-invalid={!!errors.contrasena}
                  {...register('contrasena')}
                />
                <button
                  type="button"
                  onClick={() => setMostrarContrasena((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                  aria-label={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {mostrarContrasena ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.contrasena && (
                <p id="error-contrasena" role="alert" className="mt-1 text-xs text-red-500 font-medium">
                  {errors.contrasena.message}
                </p>
              )}
            </div>

            {/* Recordarme + ¿Olvidaste? */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="w-4 h-4 accent-pink-600 rounded"
                  {...register('recordarme')}
                />
                <span className="text-sm text-slate-600">Recordarme</span>
              </label>
              <Link
                to="/recuperar-contrasena"
                className="text-sm text-pink-600 font-semibold hover:text-pink-700 transition-colors"
              >
                ¿Olvidaste tu contraseña?
              </Link>
            </div>

            {/* Error global */}
            {errors.root && (
              <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-sm text-red-600 font-medium">{errors.root.message}</p>
              </div>
            )}

            {/* Botón submit */}
            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="w-full bg-linear-to-r from-[#880E4F] to-[#C2185B] hover:from-[#6D0B3F] hover:to-[#A3153F] text-white font-bold py-3.5 rounded-xl transition-all shadow-lg shadow-pink-500/25 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="flex items-center justify-center gap-2">
                  <span
                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
                    aria-hidden="true"
                  />
                  Verificando...
                </span>
              ) : (
                'Iniciar sesión'
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
