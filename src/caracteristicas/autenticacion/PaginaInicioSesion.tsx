import { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Lock, Mail, Scissors } from 'lucide-react';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';

function esCorreo(valor: string) {
  return z.string().email().safeParse(valor.trim()).success;
}

const esquema = z
  .object({
    modoAcceso: z.enum(['interno', 'cliente']),
    identificador: z.string().trim().min(1, 'Ingresa tu correo'),
    contrasena: z.string().trim().min(1, 'Ingresa tu contraseña'),
  })
  .superRefine((datos, contexto) => {
    const valor = datos.identificador.trim();
    if (!esCorreo(valor)) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['identificador'],
        message:
          datos.modoAcceso === 'cliente'
            ? 'El cliente debe ingresar un correo válido'
            : 'Ingresa un correo válido para acceso interno',
      });
    }
  });

type CamposFormulario = z.infer<typeof esquema>;

function obtenerMensajeCodigo(
  codigo: string | null,
  mensajeBloqueo: string,
  motivo: string | null,
) {
  if (codigo === 'EMAIL_NO_VERIFICADO') {
    return {
      titulo: 'Verificación de correo requerida',
      descripcion:
        'Completa la verificación con el último código enviado a tu correo antes de iniciar sesión.',
      tono: 'amber' as const,
    };
  }

  if (codigo === 'PENDIENTE_APROBACION') {
    return {
      titulo: 'Solicitud en revisión',
      descripcion:
        'La solicitud de tu salón sigue en revisión. Te avisaremos por correo cuando haya una respuesta.',
      tono: 'blue' as const,
    };
  }

  if (codigo === 'SOLICITUD_RECHAZADA') {
    return {
      titulo: 'Solicitud rechazada',
      descripcion: motivo
        ? `Motivo: ${motivo}`
        : 'Tu solicitud fue rechazada. Contacta soporte si necesitas una revisión.',
      tono: 'red' as const,
    };
  }

  if (codigo === 'CUENTA_SUSPENDIDA' || codigo === 'SALON_SUSPENDIDO') {
    return {
      titulo: 'Acceso no disponible',
      descripcion: mensajeBloqueo || 'Esta cuenta no puede iniciar sesión en este momento.',
      tono: 'amber' as const,
    };
  }

  if (codigo === 'ACCESO_REVOCADO' || codigo === 'CUENTA_DESACTIVADA') {
    return {
      titulo: 'Acceso retirado',
      descripcion: mensajeBloqueo || 'Tu acceso ya no está activo.',
      tono: 'red' as const,
    };
  }

  return null;
}

function clasesAviso(tono: 'amber' | 'red' | 'blue') {
  if (tono === 'red') {
    return 'border-red-200 bg-red-50 text-red-800';
  }
  if (tono === 'blue') {
    return 'border-sky-200 bg-sky-50 text-sky-800';
  }
  return 'border-amber-200 bg-amber-50 text-amber-900';
}

export function PaginaInicioSesion() {
  usarTituloPagina('Iniciar sesión');
  const [parametros] = useSearchParams();
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [codigoBloqueo, setCodigoBloqueo] = useState<string | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState<string | null>(null);
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const { iniciarSesion } = usarTiendaAuth();
  const rutaDesde = (ubicacion.state as { desde?: string } | null)?.desde;

  const mensajeBloqueoUrl = parametros.get('mensaje') ?? '';
  const codigoBloqueoActivo = codigoBloqueo ?? parametros.get('codigo');
  const avisoBloqueo = obtenerMensajeCodigo(codigoBloqueoActivo, mensajeBloqueoUrl, motivoRechazo);
  const mensajeRegistro =
    parametros.get('registro') === 'ok'
      ? (parametros.get('mensaje') ?? 'Tu cuenta ya está lista. Inicia sesión para continuar.')
      : '';

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CamposFormulario>({
    resolver: zodResolver(esquema),
    defaultValues: { modoAcceso: 'interno', identificador: '', contrasena: '' },
  });

  const modoAcceso = watch('modoAcceso') ?? 'interno';

  const alEnviar = async (datos: CamposFormulario) => {
    setCodigoBloqueo(null);
    setMotivoRechazo(null);

    const resultado = await iniciarSesion(
      datos.identificador.trim().toLowerCase(),
      datos.contrasena.trim(),
    );

    if (!resultado.exito) {
      if (resultado.codigo) {
        setCodigoBloqueo(resultado.codigo);
        setMotivoRechazo(resultado.motivo ?? null);
      }

      setError('root', {
        message: resultado.mensaje ?? 'No pudimos iniciar sesión con esas credenciales.',
      });
      return;
    }

    navegar(rutaDesde ?? resultado.ruta ?? '/');
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#170d15] text-slate-950">
      <div className="absolute inset-0">
        <img
          src="/login-btp.svg"
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(20,10,18,0.82)_0%,rgba(20,10,18,0.54)_38%,rgba(97,24,55,0.46)_100%)]" />
      </div>

      <div className="relative flex min-h-screen items-center justify-center px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
        <section className="w-full max-w-md rounded-4xl border border-white/15 bg-[rgba(255,248,243,0.9)] p-6 shadow-[0_30px_100px_rgba(12,5,10,0.45)] backdrop-blur-xl sm:p-8">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#5d1637] text-white shadow-lg shadow-[#5d1637]/30">
              <Scissors className="h-5 w-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.32em] text-[#8f5a4d]">Beauty Time Pro</p>
              <p className="text-sm text-slate-600">Acceso al sistema</p>
            </div>
          </div>

          <div className="mb-7">
            <h1 className="text-3xl font-semibold tracking-tight text-[#24111f] sm:text-[2rem]">
              Iniciar sesión
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Acceso directo al sistema. El rol se detecta automáticamente según tus credenciales.
            </p>
          </div>

          {mensajeRegistro ? (
            <div className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50/95 px-4 py-3 text-sm text-emerald-800">
              {mensajeRegistro}
            </div>
          ) : null}

          {avisoBloqueo ? (
            <div className={`mb-4 rounded-2xl border px-4 py-3 ${clasesAviso(avisoBloqueo.tono)}`}>
              <p className="text-sm font-semibold">{avisoBloqueo.titulo}</p>
              <p className="mt-1 text-sm leading-6 opacity-90">{avisoBloqueo.descripcion}</p>
            </div>
          ) : null}

          {errors.root ? (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50/95 px-4 py-3 text-sm text-red-700">
              {errors.root.message}
            </div>
          ) : null}

          <div className="mb-5 grid grid-cols-2 gap-2 rounded-2xl border border-[#ddc9bc] bg-white/80 p-1.5">
            <button
              type="button"
              onClick={() => setValue('modoAcceso', 'interno')}
              className={`rounded-xl px-3 py-2 text-xs font-bold transition ${modoAcceso === 'interno' ? 'bg-[#5d1637] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Acceso interno
            </button>
            <button
              type="button"
              onClick={() => setValue('modoAcceso', 'cliente')}
              className={`rounded-xl px-3 py-2 text-xs font-bold transition ${modoAcceso === 'cliente' ? 'bg-[#5d1637] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              Cliente
            </button>
          </div>

          <form onSubmit={handleSubmit(alEnviar)} noValidate className="space-y-5">
            <input type="hidden" {...register('modoAcceso')} />
            <div>
              <label
                htmlFor="identificador"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                {modoAcceso === 'cliente' ? 'Correo del cliente' : 'Correo de acceso'}
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Mail className="h-4 w-4" />
                </span>
                <input
                  id="identificador"
                  type="email"
                  autoComplete="username"
                  placeholder={
                    modoAcceso === 'cliente' ? 'cliente@correo.com' : 'usuario@salon.com'
                  }
                  className="w-full rounded-2xl border border-[#d8c4ba] bg-white/92 px-10 py-3.5 text-sm text-slate-900 outline-none transition focus:border-[#7d2147] focus:ring-2 focus:ring-[#f2d7c5]"
                  aria-invalid={Boolean(errors.identificador)}
                  {...register('identificador')}
                />
              </div>
              {errors.identificador ? (
                <p className="mt-1.5 text-xs text-red-600">{errors.identificador.message}</p>
              ) : null}
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label htmlFor="contrasena" className="block text-sm font-medium text-slate-700">
                  Contraseña
                </label>
                <Link
                  to="/recuperar-contrasena"
                  className="text-xs font-medium text-[#7d2147] underline decoration-[#d7b69d] underline-offset-4 hover:text-[#51152f]"
                >
                  Olvidé mi contraseña
                </Link>
              </div>
              <div className="relative">
                <Lock
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                  aria-hidden="true"
                />
                <input
                  id="contrasena"
                  type={mostrarContrasena ? 'text' : 'password'}
                  autoComplete="current-password"
                  className="w-full rounded-2xl border border-[#d8c4ba] bg-white/92 px-10 py-3.5 pr-12 text-sm text-slate-900 outline-none transition focus:border-[#7d2147] focus:ring-2 focus:ring-[#f2d7c5]"
                  aria-invalid={Boolean(errors.contrasena)}
                  {...register('contrasena')}
                />
                <button
                  type="button"
                  onClick={() => setMostrarContrasena((valor) => !valor)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                  aria-label={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {mostrarContrasena ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.contrasena ? (
                <p className="mt-1.5 text-xs text-red-600">{errors.contrasena.message}</p>
              ) : null}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="w-full rounded-2xl bg-[linear-gradient(135deg,#6d1d43_0%,#c74674_100%)] px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#6d1d43]/25 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Validando acceso...' : 'Entrar al sistema'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-slate-600">¿Eres cliente nuevo?</p>
            <Link
              to="/registro/cliente"
              className="mt-2 inline-flex text-sm font-semibold text-[#5d1637] underline decoration-[#d7b69d] underline-offset-4"
            >
              Crear cuenta de cliente
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
