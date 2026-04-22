import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, KeyRound, Lock, Mail, Copy, Check } from 'lucide-react';
import { consumirAvisoInicioSesion, usarTiendaAuth } from '../../tienda/tiendaAuth';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';
import { MarcaAplicacion } from '../../componentes/ui/MarcaAplicacion';

function esCorreo(valor: string) {
  return z.string().email().safeParse(valor.trim()).success;
}

function esTelefono(valor: string) {
  return /^[+()\-\s\d]{7,20}$/.test(valor.trim());
}

function esPosibleClaveSalon(valor: string) {
  const normalizado = valor.trim().toUpperCase();
  return (
    /^CLI[0-9A-F]{20}$/.test(normalizado) ||
    /^ADM[0-9A-F]{20}$/.test(normalizado) ||
    /^DUE[0-9A-F]{20}$/.test(normalizado) ||
    /^[A-Z][A-Z0-9]{1,29}[0-9]{2}$/.test(normalizado)
  );
}

const esquema = z
  .object({
    identificador: z.string().trim().min(1, 'Ingresa tu correo, teléfono o clave de salón'),
    contrasena: z.string().trim().optional(),
  })
  .superRefine((datos, contexto) => {
    const valor = datos.identificador.trim();
    if (valor.length === 0 || esPosibleClaveSalon(valor)) {
      return;
    }

    if (!esCorreo(valor) && !esTelefono(valor)) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['identificador'],
        message: 'Ingresa un correo o teléfono válido',
      });
    }

    if (!datos.contrasena?.trim()) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contrasena'],
        message: 'Ingresa tu contraseña',
      });
    }
  });

type CamposFormulario = z.infer<typeof esquema>;

interface EstadoRutaInicioSesion {
  desde?: string;
  demo?: {
    identificador: string;
    contrasena: string;
    autoIniciar?: boolean;
    titulo?: string;
    mensaje?: string;
  };
}

function obtenerMensajeCodigo(
  codigo: string | null,
  mensajeBloqueo: string,
  motivo: string | null,
) {
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
  const [contrasenaCopiada, setContrasenaCopiada] = useState(false);
  const [codigoBloqueo, setCodigoBloqueo] = useState<string | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState<string | null>(null);
  const [avisoTransitorio] = useState(() => consumirAvisoInicioSesion());
  const [requiereIdentificador, setRequiereIdentificador] = useState(false);
  const [mostrarRegistroCliente, setMostrarRegistroCliente] = useState(false);
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const { iniciarSesion, iniciarSesionConClave } = usarTiendaAuth();
  const estadoRuta = (ubicacion.state as EstadoRutaInicioSesion | null) ?? null;
  const accesoDemo = estadoRuta?.demo ?? null;
  const rutaDesde = estadoRuta?.desde;
  const intentoAccesoDemo = useRef(false);

  const mensajeBloqueoUrl = avisoTransitorio?.mensaje ?? parametros.get('mensaje') ?? '';
  const codigoBloqueoActivo = codigoBloqueo ?? avisoTransitorio?.codigo ?? parametros.get('codigo');
  const avisoBloqueo = obtenerMensajeCodigo(codigoBloqueoActivo, mensajeBloqueoUrl, motivoRechazo);
  const mensajeRegistro =
    avisoTransitorio?.tono === 'emerald'
      ? avisoTransitorio.mensaje
      : parametros.get('registro') === 'ok'
        ? (parametros.get('mensaje') ?? 'Tu cuenta ya está lista. Inicia sesión para continuar.')
        : '';
  const avisoInformativo =
    !avisoBloqueo && !mensajeRegistro && avisoTransitorio?.mensaje && !avisoTransitorio.codigo
      ? {
          titulo: avisoTransitorio.titulo ?? 'Información de acceso',
          descripcion: avisoTransitorio.mensaje,
          tono: (avisoTransitorio.tono === 'red'
            ? 'red'
            : avisoTransitorio.tono === 'amber'
              ? 'amber'
              : 'blue') as 'amber' | 'red' | 'blue',
        }
      : !avisoBloqueo && !mensajeRegistro && accesoDemo
        ? {
            titulo: accesoDemo.titulo ?? 'Acceso de demostración listo',
            descripcion:
              accesoDemo.mensaje ??
              'Cargamos las credenciales de demostración por ti. Esta acción cambia la sesión actual al rol demo seleccionado.',
            tono: 'blue' as const,
          }
        : null;

  const {
    register,
    handleSubmit,
    clearErrors,
    setError,
    setValue,
    getValues,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CamposFormulario>({
    resolver: zodResolver(esquema),
    defaultValues: {
      identificador: accesoDemo?.identificador ?? '',
      contrasena: accesoDemo?.contrasena ?? '',
    },
  });

  const identificadorActual = watch('identificador') ?? '';
  const accesoPorClave = esPosibleClaveSalon(identificadorActual);

  const alEnviar = async (datos: CamposFormulario) => {
    setCodigoBloqueo(null);
    setMotivoRechazo(null);
    setMostrarRegistroCliente(false);

    const identificador = datos.identificador.trim();
    const contrasena = datos.contrasena?.trim() ?? '';

    if (esPosibleClaveSalon(identificador)) {
      const resultadoClave = await iniciarSesionConClave(identificador.toUpperCase());

      if (!resultadoClave.exito) {
        if (resultadoClave.codigo) {
          setCodigoBloqueo(resultadoClave.codigo);
          setMotivoRechazo(resultadoClave.motivo ?? null);
        }

        setError('root', {
          message: resultadoClave.mensaje ?? 'No pudimos resolver esa clave de acceso.',
        });
        return;
      }

      navegar(resultadoClave.ruta ?? '/');
      return;
    }

    if (requiereIdentificador) {
      if (!identificador) {
        setError('identificador', {
          message: 'Ingresa tu correo para continuar con este acceso.',
        });
        return;
      }

      if (!esCorreo(identificador)) {
        setError('identificador', {
          message: 'Cuando hay varias cuentas, debes ingresar tu correo electrónico.',
        });
        return;
      }
    }

    const resultado = await iniciarSesion(identificador || null, contrasena);

    if (!resultado.exito) {
      if (resultado.codigo === 'IDENTIFICADOR_REQUERIDO') {
        setRequiereIdentificador(true);
        setError('identificador', {
          message:
            'Encontramos varias cuentas con esa contraseña. Ingresa tu correo para continuar.',
        });
        return;
      }

      if (resultado.codigo === 'EMAIL_NO_REGISTRADO') {
        setRequiereIdentificador(true);
        setMostrarRegistroCliente(true);
        setError('identificador', {
          message: resultado.mensaje ?? 'Ese correo no está registrado.',
        });
        return;
      }

      if (resultado.codigo) {
        setCodigoBloqueo(resultado.codigo);
        setMotivoRechazo(resultado.motivo ?? null);
      }

      setError('root', {
        message: resultado.mensaje ?? 'No pudimos iniciar sesión con esas credenciales.',
      });
      return;
    }

    setRequiereIdentificador(false);
    const rutaDestino =
      resultado.ruta === '/vendedor' ? '/vendedor' : (rutaDesde ?? resultado.ruta ?? '/');
    navegar(rutaDestino);
  };

  useEffect(() => {
    if (!accesoDemo) return;

    setRequiereIdentificador(false);
    setMostrarRegistroCliente(false);
    clearErrors();

    setValue('identificador', accesoDemo.identificador);
    setValue('contrasena', accesoDemo.contrasena);

    if (accesoDemo.autoIniciar && !intentoAccesoDemo.current) {
      intentoAccesoDemo.current = true;
      void alEnviar({
        identificador: accesoDemo.identificador,
        contrasena: accesoDemo.contrasena,
      });
    }
  }, [accesoDemo, clearErrors, setValue]);

  const copiarContrasena = async () => {
    const contrasena = getValues('contrasena')?.trim();
    if (!contrasena) return;

    try {
      await navigator.clipboard.writeText(contrasena);
      setContrasenaCopiada(true);
      window.setTimeout(() => setContrasenaCopiada(false), 1500);
    } catch {
      // Silenciar fallo de portapapeles
    }
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
          <MarcaAplicacion subtitulo="Acceso al sistema" className="mb-8" />

          <div className="mb-7">
            <h1 className="text-3xl font-semibold tracking-tight text-[#24111f] sm:text-[2rem]">
              Iniciar sesión
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Escribe un solo dato de acceso y nosotros detectamos el tipo de cuenta.
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

          {avisoInformativo ? (
            <div
              className={`mb-4 rounded-2xl border px-4 py-3 ${clasesAviso(avisoInformativo.tono)}`}
            >
              <p className="text-sm font-semibold">{avisoInformativo.titulo}</p>
              <p className="mt-1 text-sm leading-6 opacity-90">{avisoInformativo.descripcion}</p>
            </div>
          ) : null}

          {errors.root ? (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50/95 px-4 py-3 text-sm text-red-700">
              {errors.root.message}
            </div>
          ) : null}

          <section className="rounded-[1.75rem] border border-white/70 bg-white/55 p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] backdrop-blur-sm">
            <div className="mb-5 flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f6e5dc] text-[#7d2147] shadow-sm">
                {accesoPorClave ? (
                  <KeyRound className="h-4.5 w-4.5" aria-hidden="true" />
                ) : (
                  <Mail className="h-4.5 w-4.5" aria-hidden="true" />
                )}
              </div>
              <div>
                <h2 className="text-base font-semibold text-[#24111f]">Acceso inteligente</h2>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  Escribe correo, teléfono o clave del salón. Detectamos el tipo de acceso en
                  automático.
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmit(alEnviar)} noValidate className="space-y-5">
              <div>
                <label
                  htmlFor="identificador"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  {requiereIdentificador
                    ? 'Correo electrónico'
                    : 'Correo, teléfono o clave de salón'}
                </label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                    {accesoPorClave ? (
                      <KeyRound className="h-4 w-4" />
                    ) : (
                      <Mail className="h-4 w-4" />
                    )}
                  </span>
                  <input
                    id="identificador"
                    type="text"
                    autoComplete="username"
                    placeholder={
                      requiereIdentificador
                        ? 'usuario@salon.com'
                        : 'usuario@salon.com, 5512345678 o CLI123...'
                    }
                    autoCapitalize={accesoPorClave ? 'characters' : 'off'}
                    autoCorrect="off"
                    spellCheck={false}
                    className="w-full rounded-2xl border border-[#d8c4ba] bg-white/92 px-10 py-3.5 text-sm text-slate-900 outline-none transition focus:border-[#7d2147] focus:ring-2 focus:ring-[#f2d7c5]"
                    aria-invalid={Boolean(errors.identificador)}
                    {...register('identificador')}
                  />
                </div>
                <p className="mt-1.5 text-xs text-slate-500">
                  {requiereIdentificador
                    ? 'Usa el correo exacto de la cuenta que quieres abrir.'
                    : accesoPorClave
                      ? 'Detectamos una clave de salón. Entrarás sin contraseña.'
                      : 'Con correo o teléfono, te pediremos contraseña para validar tu cuenta.'}
                </p>
                {errors.identificador ? (
                  <p className="mt-1.5 text-xs text-red-600">{errors.identificador.message}</p>
                ) : null}
              </div>

              {!accesoPorClave ? (
                <div>
                  <div className="mb-1.5 flex items-center justify-between">
                    <label
                      htmlFor="contrasena"
                      className="block text-sm font-medium text-slate-700"
                    >
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
                      className="w-full rounded-2xl border border-[#d8c4ba] bg-white/92 px-10 py-3.5 pr-22 text-sm text-slate-900 outline-none transition focus:border-[#7d2147] focus:ring-2 focus:ring-[#f2d7c5]"
                      aria-invalid={Boolean(errors.contrasena)}
                      {...register('contrasena')}
                    />
                    <button
                      type="button"
                      onClick={() => void copiarContrasena()}
                      className="absolute right-10 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                      aria-label="Copiar contraseña"
                    >
                      {contrasenaCopiada ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMostrarContrasena((valor) => !valor)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700"
                      aria-label={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {mostrarContrasena ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                  {errors.contrasena ? (
                    <p className="mt-1.5 text-xs text-red-600">{errors.contrasena.message}</p>
                  ) : null}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className="w-full rounded-2xl bg-[linear-gradient(135deg,#6d1d43_0%,#c74674_100%)] px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-[#6d1d43]/25 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting
                  ? 'Validando acceso...'
                  : accesoPorClave
                    ? 'Entrar con clave'
                    : requiereIdentificador
                      ? 'Continuar con correo'
                      : 'Entrar al sistema'}
              </button>
            </form>
          </section>

          {mostrarRegistroCliente ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50/95 px-4 py-3 text-sm text-amber-900">
              <p className="font-semibold">Ese correo no está registrado en Beauty Time Pro.</p>
              <p className="mt-1 leading-6">
                Si eres cliente nuevo, crea tu cuenta para poder reservar y administrar tus citas.
              </p>
            </div>
          ) : null}

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
