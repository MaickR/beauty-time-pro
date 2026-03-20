import { useMemo, useState } from 'react';
import { useNavigate, Link, useSearchParams, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, KeyRound, Lock, Scissors } from 'lucide-react';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';

const esquema = z
  .object({
    acceso: z.string().trim().min(3, 'Ingresa tu clave de acceso o correo electrónico'),
    contrasena: z.string().optional(),
  })
  .superRefine((datos, contexto) => {
    const esCorreo = datos.acceso.includes('@');

    if (!esCorreo) {
      return;
    }

    if (!z.string().email().safeParse(datos.acceso).success) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['acceso'],
        message: 'Ingresa un correo electrónico válido',
      });
    }

    if (!datos.contrasena?.trim()) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contrasena'],
        message: 'La contraseña es requerida',
      });
    }
  });

type CamposFormulario = z.infer<typeof esquema>;

export function PaginaInicioSesion() {
  usarTituloPagina('Iniciar sesión');
  const [parametros] = useSearchParams();
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [codigoBloqueo, setCodigoBloqueo] = useState<string | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState<string | null>(null);
  const codigoBloqueoUrl = parametros.get('codigo');
  const mensajeBloqueoUrl =
    parametros.get('registro') === 'ok' ? '' : (parametros.get('mensaje') ?? '');
  const mensajeInfo =
    !parametros.get('codigo') && !parametros.get('registro')
      ? (parametros.get('mensaje') ?? '')
      : '';
  const codigoBloqueoActivo = codigoBloqueo ?? codigoBloqueoUrl;
  const mensajeRegistro =
    parametros.get('registro') === 'ok'
      ? (parametros.get('mensaje') ?? 'Cuenta creada correctamente. Ya puedes iniciar sesión.')
      : '';
  const { iniciarSesion, iniciarSesionConClave } = usarTiendaAuth();
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const rutaDesde = (ubicacion.state as { desde?: string } | null)?.desde;

  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CamposFormulario>({
    resolver: zodResolver(esquema),
    defaultValues: { acceso: '', contrasena: '' },
  });

  const accesoActual = watch('acceso') ?? '';
  const esCorreo = useMemo(() => accesoActual.includes('@'), [accesoActual]);

  const alEnviar = async (datos: CamposFormulario) => {
    setCodigoBloqueo(null);
    setMotivoRechazo(null);

    const accesoEsCorreo = datos.acceso.includes('@');

    const resultado = accesoEsCorreo
      ? await iniciarSesion(datos.acceso.trim(), datos.contrasena?.trim() ?? '')
      : await iniciarSesionConClave(datos.acceso.trim());

    if (!resultado.exito) {
      if (resultado.codigo) {
        setCodigoBloqueo(resultado.codigo);
        setMotivoRechazo(resultado.motivo ?? null);
      } else {
        setError('root', {
          message: resultado.mensaje ?? 'Credenciales incorrectas. Verifica tus datos.',
        });
      }
      return;
    }

    const destino = accesoEsCorreo ? (rutaDesde ?? resultado.ruta ?? '/') : (resultado.ruta ?? '/');
    navegar(destino);
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
            Gestiona tu salón
            <br />
            con precisión.
          </h1>
          <ul className="space-y-4" aria-label="Características de la plataforma">
            {[
              {
                titulo: 'Agenda inteligente',
                desc: 'Reservas en tiempo real con recordatorios automáticos.',
              },
              {
                titulo: 'Panel financiero',
                desc: 'Visualiza ingresos, servicios populares y tendencias.',
              },
              {
                titulo: 'Multi-sucursal',
                desc: 'Administra todos tus salones desde un solo lugar.',
              },
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

        <p className="text-white/50 text-sm">
          © {new Date().getFullYear()} Beauty Time Pro · Hecho para México y Colombia
        </p>
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

          <h2 className="text-3xl font-black text-slate-900 mb-1">Acceso Beauty Time Pro</h2>
          <p className="text-slate-500 text-sm mb-8">
            Escribe la clave del salón o el correo del panel administrativo
          </p>

          <form onSubmit={handleSubmit(alEnviar)} noValidate className="space-y-5">
            <div>
              <label htmlFor="acceso" className="block text-sm font-semibold text-slate-700 mb-1.5">
                Clave de acceso o correo electrónico
              </label>
              <div className="relative">
                <KeyRound
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4"
                  aria-hidden="true"
                />
                <input
                  id="acceso"
                  type="text"
                  autoComplete="username"
                  className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-900 text-sm outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                  placeholder="Ej. MIKELOVCLI2026 o hola@salon.com"
                  aria-describedby={errors.acceso ? 'error-acceso' : 'ayuda-acceso'}
                  aria-invalid={!!errors.acceso}
                  {...register('acceso')}
                />
              </div>
              <p id="ayuda-acceso" className="mt-1 text-xs text-slate-500">
                Si escribes un correo se pedirá contraseña. Si escribes una clave válida entrarás
                directo a reservar.
              </p>
              {errors.acceso && (
                <p id="error-acceso" role="alert" className="mt-1 text-xs text-red-500 font-medium">
                  {errors.acceso.message}
                </p>
              )}
            </div>

            {esCorreo && (
              <div>
                <label
                  htmlFor="contrasena"
                  className="block text-sm font-semibold text-slate-700 mb-1.5"
                >
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
                    {mostrarContrasena ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {errors.contrasena && (
                  <p
                    id="error-contrasena"
                    role="alert"
                    className="mt-1 text-xs text-red-500 font-medium"
                  >
                    {errors.contrasena.message}
                  </p>
                )}
              </div>
            )}

            {esCorreo && (
              <div className="flex items-center justify-end">
                <Link
                  to="/recuperar-contrasena"
                  className="text-sm text-pink-600 font-semibold hover:text-pink-700 transition-colors"
                >
                  ¿Olvidaste tu contraseña?
                </Link>
              </div>
            )}

            {/* Error global */}
            {errors.root && (
              <div role="alert" className="bg-red-50 border border-red-200 rounded-xl p-3">
                <p className="text-sm text-red-600 font-medium">{errors.root.message}</p>
              </div>
            )}

            {/* Banners de bloqueo por código 403 */}
            {mensajeRegistro && (
              <div
                role="status"
                className="bg-green-50 border border-green-200 rounded-xl p-4 space-y-1"
              >
                <p className="text-sm font-semibold text-green-800">Registro completado</p>
                <p className="text-xs text-green-700">{mensajeRegistro}</p>
              </div>
            )}
            {mensajeInfo && (
              <div
                role="status"
                className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-1"
              >
                <p className="text-sm font-semibold text-blue-800">Información</p>
                <p className="text-xs text-blue-700">{mensajeInfo}</p>
              </div>
            )}
            {codigoBloqueoActivo === 'PENDIENTE_APROBACION' && (
              <div
                role="alert"
                className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-1"
              >
                <p className="text-sm font-semibold text-blue-800">Solicitud en revisión</p>
                <p className="text-xs text-blue-700">
                  Tu salón está siendo evaluado por nuestro equipo. Te avisaremos por correo en un
                  plazo de 24 a 48 horas.
                </p>
              </div>
            )}
            {codigoBloqueoActivo === 'SOLICITUD_RECHAZADA' && (
              <div
                role="alert"
                className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1"
              >
                <p className="text-sm font-semibold text-red-800">Solicitud rechazada</p>
                {motivoRechazo && <p className="text-xs text-red-700">Motivo: {motivoRechazo}</p>}
                <p className="text-xs text-red-600">
                  Si crees que es un error, contáctanos a soporte.
                </p>
              </div>
            )}
            {codigoBloqueoActivo === 'CUENTA_SUSPENDIDA' && (
              <div
                role="alert"
                className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1"
              >
                <p className="text-sm font-semibold text-red-800">Cuenta suspendida</p>
                <p className="text-xs text-red-700">
                  {mensajeBloqueoUrl || 'Tu cuenta ha sido suspendida.'}
                </p>
              </div>
            )}
            {codigoBloqueoActivo === 'SALON_SUSPENDIDO' && (
              <div
                role="alert"
                className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1"
              >
                <p className="text-sm font-semibold text-amber-800">Salón suspendido</p>
                <p className="text-xs text-amber-700">
                  {mensajeBloqueoUrl || 'Tu salón está suspendido.'}
                </p>
              </div>
            )}
            {codigoBloqueoActivo === 'ACCESO_REVOCADO' && (
              <div
                role="alert"
                className="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-1"
              >
                <p className="text-sm font-semibold text-amber-800">Acceso revocado</p>
                <p className="text-xs text-amber-700">
                  {mensajeBloqueoUrl || 'Tu acceso fue revocado por el dueño del salón.'}
                </p>
              </div>
            )}
            {codigoBloqueoActivo === 'CUENTA_DESACTIVADA' && (
              <div
                role="alert"
                className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-1"
              >
                <p className="text-sm font-semibold text-red-800">Cuenta desactivada</p>
                <p className="text-xs text-red-700">
                  {mensajeBloqueoUrl || 'Tu cuenta ha sido desactivada.'}
                </p>
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
                  Validando acceso...
                </span>
              ) : esCorreo ? (
                'Entrar al panel'
              ) : (
                'Ir a reservar'
              )}
            </button>
          </form>

          <div className="text-center mt-6 space-y-2">
            <p className="text-sm text-gray-500">¿Aún no tienes cuenta de administración?</p>
            <Link
              to="/registro/salon"
              className="text-sm font-medium text-pink-600 hover:underline"
            >
              Registrar mi salón
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
