import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, KeyRound, Lock, Mail, UserRound } from 'lucide-react';
import { consumirAvisoInicioSesion, usarTiendaAuth } from '../../tienda/tiendaAuth';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';

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
    acceso: z.string().trim().min(1, 'Ingresa tu clave, correo o telefono'),
    contrasena: z.string().trim().optional(),
  })
  .superRefine((datos, contexto) => {
    const acceso = datos.acceso.trim();

    if (!acceso || esPosibleClaveSalon(acceso)) {
      return;
    }

    if (!esTelefono(acceso) && !esCorreo(acceso)) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['acceso'],
        message: 'Ingresa un correo, telefono o clave valida',
      });
    }

    if (!datos.contrasena?.trim()) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['contrasena'],
        message: 'Ingresa tu contrasena',
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
      titulo: 'Solicitud en revision',
      descripcion:
        'La solicitud de tu salon sigue en revision. Te avisaremos por correo cuando haya una respuesta.',
      tono: 'blue' as const,
    };
  }

  if (codigo === 'SOLICITUD_RECHAZADA') {
    return {
      titulo: 'Solicitud rechazada',
      descripcion: motivo
        ? `Motivo: ${motivo}`
        : 'Tu solicitud fue rechazada. Contacta soporte si necesitas una revision.',
      tono: 'red' as const,
    };
  }

  if (codigo === 'CUENTA_SUSPENDIDA' || codigo === 'SALON_SUSPENDIDO') {
    return {
      titulo: 'Acceso no disponible',
      descripcion: mensajeBloqueo || 'Esta cuenta no puede iniciar sesion en este momento.',
      tono: 'amber' as const,
    };
  }

  if (codigo === 'ACCESO_REVOCADO' || codigo === 'CUENTA_DESACTIVADA') {
    return {
      titulo: 'Acceso retirado',
      descripcion: mensajeBloqueo || 'Tu acceso ya no esta activo.',
      tono: 'red' as const,
    };
  }

  return null;
}

function clasesAviso(tono: 'amber' | 'red' | 'blue') {
  if (tono === 'red') {
    return 'border-red-300/35 bg-red-500/12 text-red-100';
  }
  if (tono === 'blue') {
    return 'border-sky-300/35 bg-sky-500/12 text-sky-100';
  }
  return 'border-amber-300/35 bg-amber-500/12 text-amber-100';
}

export function PaginaInicioSesion() {
  usarTituloPagina('Iniciar sesion');

  const [parametros] = useSearchParams();
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [codigoBloqueo, setCodigoBloqueo] = useState<string | null>(null);
  const [motivoRechazo, setMotivoRechazo] = useState<string | null>(null);
  const [avisoTransitorio] = useState(() => consumirAvisoInicioSesion());
  const [requiereIdentificador, setRequiereIdentificador] = useState(false);

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
        ? (parametros.get('mensaje') ?? 'Tu cuenta ya esta lista. Inicia sesion para continuar.')
        : '';

  const avisoInformativo =
    !avisoBloqueo && !mensajeRegistro && avisoTransitorio?.mensaje && !avisoTransitorio.codigo
      ? {
          titulo: avisoTransitorio.titulo ?? 'Informacion de acceso',
          descripcion: avisoTransitorio.mensaje,
          tono: (avisoTransitorio.tono === 'red'
            ? 'red'
            : avisoTransitorio.tono === 'amber'
              ? 'amber'
              : 'blue') as 'amber' | 'red' | 'blue',
        }
      : !avisoBloqueo && !mensajeRegistro && accesoDemo
        ? {
            titulo: accesoDemo.titulo ?? 'Acceso de demostracion listo',
            descripcion:
              accesoDemo.mensaje ??
              'Cargamos las credenciales de demostracion por ti. Esta accion cambia la sesion actual al rol demo seleccionado.',
            tono: 'blue' as const,
          }
        : null;

  const {
    register,
    handleSubmit,
    clearErrors,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CamposFormulario>({
    resolver: zodResolver(esquema),
    defaultValues: {
      acceso: accesoDemo?.identificador ?? '',
      contrasena: accesoDemo?.contrasena ?? '',
    },
  });

  const accesoActual = watch('acceso') ?? '';
  const accesoLimpio = accesoActual.trim();
  const accesoPorClave = esPosibleClaveSalon(accesoLimpio);
  const accesoPorTelefono = !accesoPorClave && esTelefono(accesoLimpio);
  const accesoPorCorreo = !accesoPorClave && esCorreo(accesoLimpio);
  const mostrarCredencialesSecundarias =
    !accesoPorClave && (accesoLimpio.length > 0 || requiereIdentificador);

  const mensajeAyudaAcceso = requiereIdentificador
    ? 'Para continuar, ingresa el correo exacto asociado a tu cuenta.'
    : accesoPorClave
      ? 'Clave detectada. Puedes entrar de inmediato con ese acceso.'
      : accesoPorTelefono
        ? 'Acceso de cliente detectado por telefono. Solo necesitaremos tu contrasena.'
        : accesoPorCorreo
          ? 'Si tu cuenta requiere acceso administrativo o de salon, continua con tu contrasena.'
          : 'Escribe tu acceso y el sistema mostrara solo lo necesario para continuar.';

  useEffect(() => {
    const overflowHtmlAnterior = document.documentElement.style.overflow;
    const overflowBodyAnterior = document.body.style.overflow;
    const overscrollAnterior = document.body.style.overscrollBehavior;

    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
    document.body.style.overscrollBehavior = 'none';

    return () => {
      document.documentElement.style.overflow = overflowHtmlAnterior;
      document.body.style.overflow = overflowBodyAnterior;
      document.body.style.overscrollBehavior = overscrollAnterior;
    };
  }, []);

  const alEnviar = async (datos: CamposFormulario) => {
    setCodigoBloqueo(null);
    setMotivoRechazo(null);

    const acceso = datos.acceso.trim();
    const contrasena = datos.contrasena?.trim() ?? '';

    if (esPosibleClaveSalon(acceso)) {
      const resultadoClave = await iniciarSesionConClave(acceso.toUpperCase());

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

    if (requiereIdentificador && !esCorreo(acceso)) {
      setError('acceso', {
        message: 'Cuando hay varias cuentas, debes ingresar tu correo electronico.',
      });
      return;
    }

    const resultado = await iniciarSesion(acceso || null, contrasena);

    if (!resultado.exito) {
      if (resultado.codigo === 'IDENTIFICADOR_REQUERIDO') {
        setRequiereIdentificador(true);

        if (!esCorreo(acceso)) {
          setValue('acceso', '', {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: false,
          });
        }

        setError('acceso', {
          message:
            'Encontramos varias cuentas con esa contrasena. Ingresa tu correo para continuar.',
        });
        return;
      }

      if (resultado.codigo === 'EMAIL_NO_REGISTRADO') {
        setRequiereIdentificador(true);
        setError('root', {
          message:
            resultado.mensaje ??
            'Ese acceso no esta registrado. Debes solicitar la activacion o recuperacion directamente al administrador maestro.',
        });
        return;
      }

      if (resultado.codigo) {
        setCodigoBloqueo(resultado.codigo);
        setMotivoRechazo(resultado.motivo ?? null);
      }

      setError('root', {
        message: resultado.mensaje ?? 'No pudimos iniciar sesion con esas credenciales.',
      });
      return;
    }

    setRequiereIdentificador(false);
    const rutaDestino =
      resultado.ruta === '/vendedor' ? '/vendedor' : (rutaDesde ?? resultado.ruta ?? '/');
    navegar(rutaDestino);
  };

  useEffect(() => {
    if (!accesoDemo) {
      return;
    }

    setRequiereIdentificador(false);
    clearErrors();

    setValue('acceso', accesoDemo.identificador);
    setValue('contrasena', accesoDemo.contrasena);

    if (accesoDemo.autoIniciar && !intentoAccesoDemo.current) {
      intentoAccesoDemo.current = true;
      void alEnviar({
        acceso: accesoDemo.identificador,
        contrasena: accesoDemo.contrasena,
      });
    }
  }, [accesoDemo, clearErrors, setValue]);

  return (
    <main
      className="relative h-[100svh] min-h-screen overflow-hidden bg-[#0A2823] text-white"
      style={{ fontFamily: 'Arial, sans-serif' }}
    >
      <div className="absolute inset-0">
        <img
          src="/ref-2.png"
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover object-left md:object-center"
        />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_78%_36%,rgba(198,150,140,0.18)_0%,rgba(198,150,140,0.06)_28%,rgba(9,9,9,0)_52%),linear-gradient(112deg,rgba(8,8,8,0.56)_0%,rgba(18,18,18,0.18)_44%,rgba(6,6,6,0.62)_100%)]" />
      </div>

      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'linear-gradient(90deg, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.04) 32%, rgba(0,0,0,0.42) 100%)',
        }}
      />

      <div className="relative z-10 mx-auto flex h-full w-full max-w-[1600px] items-center justify-center px-3 py-3 sm:px-5 md:px-8 lg:justify-end lg:px-14">
        <section className="w-full max-w-[520px] rounded-[22px] border border-[#C6968C]/18 bg-[linear-gradient(180deg,rgba(20,60,50,0.42)_0%,rgba(10,40,35,0.52)_100%)] p-4 shadow-[0_35px_120px_rgba(3,6,8,0.55)] backdrop-blur-[10px] sm:rounded-[28px] sm:p-5 md:p-6 lg:mr-1 lg:w-[min(42vw,520px)] lg:max-w-none">
          <img
            src="/btp-login.png"
            alt="Beauty app"
            className="mx-auto mb-4 w-[168px] sm:mb-5 sm:w-[220px] md:w-[280px]"
          />

          {mensajeRegistro ? (
            <div
              className="mb-4 rounded-2xl border border-emerald-300/30 bg-emerald-500/12 px-4 py-3 text-sm text-emerald-100"
              role="status"
              aria-live="polite"
            >
              {mensajeRegistro}
            </div>
          ) : null}

          {avisoBloqueo ? (
            <div
              className={`mb-4 rounded-2xl border px-4 py-3 ${clasesAviso(avisoBloqueo.tono)}`}
              role="alert"
              aria-live="assertive"
            >
              <p className="text-sm font-semibold">{avisoBloqueo.titulo}</p>
              <p className="mt-1 text-sm leading-6 opacity-90">{avisoBloqueo.descripcion}</p>
            </div>
          ) : null}

          {avisoInformativo ? (
            <div
              className={`mb-4 rounded-2xl border px-4 py-3 ${clasesAviso(avisoInformativo.tono)}`}
              role="status"
              aria-live="polite"
            >
              <p className="text-sm font-semibold">{avisoInformativo.titulo}</p>
              <p className="mt-1 text-sm leading-6 opacity-90">{avisoInformativo.descripcion}</p>
            </div>
          ) : null}

          {errors.root ? (
            <div
              className="mb-4 rounded-2xl border border-red-300/30 bg-red-500/12 px-4 py-3 text-sm text-red-100"
              role="alert"
              aria-live="assertive"
            >
              {errors.root.message}
            </div>
          ) : null}

          <form
            onSubmit={handleSubmit(alEnviar)}
            noValidate
            className="mx-auto max-w-[430px] space-y-3.5 md:space-y-4"
          >
            <div>
              <label
                htmlFor="acceso"
                className="mb-2 block text-[1.02rem] font-medium text-white/92 sm:text-[1.05rem]"
              >
                {requiereIdentificador ? 'Correo electronico' : 'Clave de acceso'}
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[#C6968C]/92">
                  {accesoPorClave ? <KeyRound className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
                </span>
                <input
                  id="acceso"
                  type="text"
                  autoComplete={requiereIdentificador ? 'email' : 'username'}
                  autoCapitalize={accesoPorClave ? 'characters' : 'off'}
                  autoCorrect="off"
                  spellCheck={false}
                  enterKeyHint="go"
                  placeholder={
                    requiereIdentificador
                      ? 'Ingresa tu correo electronico'
                      : 'Ingresa tu clave de acceso o correo'
                  }
                  className="w-full rounded-[20px] border border-[#78736E]/48 bg-black/8 px-12 py-3 text-[0.96rem] text-white placeholder:text-[#cfc7c4]/58 outline-none transition focus:border-[#C6968C] focus:bg-white/[0.04] focus:ring-2 focus:ring-[#C6968C]/22 sm:py-3.5 sm:text-base"
                  aria-invalid={Boolean(errors.acceso)}
                  aria-describedby="ayuda-acceso"
                  {...register('acceso')}
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#C6968C]/92">
                  {requiereIdentificador || accesoPorCorreo ? (
                    <Mail className="h-5 w-5" />
                  ) : accesoPorClave ? (
                    <Eye className="h-5 w-5" />
                  ) : (
                    <Mail className="h-5 w-5" />
                  )}
                </span>
              </div>
              {errors.acceso ? (
                <p className="mt-1.5 text-xs text-red-200">{errors.acceso.message}</p>
              ) : (
                <p
                  id="ayuda-acceso"
                  className="mt-1.5 text-[11px] leading-5 text-[#ddd5d0]/72 sm:text-xs"
                >
                  {mensajeAyudaAcceso}
                </p>
              )}
            </div>

            <div
              aria-hidden={!mostrarCredencialesSecundarias}
              className={`grid transition-all duration-500 ease-out ${
                mostrarCredencialesSecundarias
                  ? 'visible grid-rows-[1fr] translate-y-0 opacity-100'
                  : 'pointer-events-none invisible grid-rows-[0fr] -translate-y-2 opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <div className="mb-3 mt-1 flex items-center gap-3 text-white/72">
                  <span className="h-px flex-1 bg-white/22" />
                  <span className="text-sm text-[#e4dcd8]/86">continua</span>
                  <span className="h-px flex-1 bg-white/22" />
                </div>

                <div>
                  <label
                    htmlFor="contrasena"
                    className="mb-2 block text-base font-medium text-white/90"
                  >
                    Contraseña
                  </label>
                  <div className="relative">
                    <Lock
                      className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#C6968C]/92"
                      aria-hidden="true"
                    />
                    <input
                      id="contrasena"
                      type={mostrarContrasena ? 'text' : 'password'}
                      autoComplete="current-password"
                      enterKeyHint="go"
                      placeholder="Contraseña"
                      className="w-full rounded-[20px] border border-[#78736E]/48 bg-black/8 px-12 py-3 pr-12 text-[0.96rem] text-white placeholder:text-[#cfc7c4]/58 outline-none transition focus:border-[#C6968C] focus:bg-white/[0.04] focus:ring-2 focus:ring-[#C6968C]/22 sm:py-3.5 sm:text-base"
                      aria-invalid={Boolean(errors.contrasena)}
                      disabled={!mostrarCredencialesSecundarias}
                      {...register('contrasena')}
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarContrasena((valor) => !valor)}
                      className="absolute right-3 top-1/2 min-h-6 min-w-6 -translate-y-1/2 text-[#C6968C]/92 transition hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
                      aria-label={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                      disabled={!mostrarCredencialesSecundarias}
                    >
                      {mostrarContrasena ? (
                        <EyeOff className="h-5 w-5" />
                      ) : (
                        <Eye className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                  {errors.contrasena ? (
                    <p className="mt-1.5 text-xs text-red-200">{errors.contrasena.message}</p>
                  ) : null}
                </div>

                <div className="mt-3 flex items-center justify-start gap-2 text-sm text-white/82">
                  <label className="inline-flex items-center gap-2 text-white/90">
                    <input
                      type="checkbox"
                      className="h-5 w-5 rounded border border-[#78736E]/70 bg-transparent text-[#143C32] accent-[#C6968C]"
                      disabled={!mostrarCredencialesSecundarias}
                    />
                    <span>Recordarme</span>
                  </label>
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="group relative mx-auto mt-4 flex w-full max-w-[320px] items-center justify-center rounded-full border-2 border-white/90 bg-[linear-gradient(135deg,#143C32_0%,#0A2823_100%)] px-6 py-2.5 text-lg font-bold uppercase tracking-[0.08em] text-white shadow-[0_16px_34px_rgba(0,0,0,0.32)] transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C6968C]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#102326] disabled:cursor-not-allowed disabled:opacity-60 sm:text-[1.15rem]"
            >
              <span className="text-[1.22rem] leading-none sm:text-[1.45rem]">
                {isSubmitting ? '...' : 'LOGIN'}
              </span>
              <span className="absolute right-[6px] flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#143C32] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] sm:h-11 sm:w-11">
                <UserRound className="h-5 w-5 sm:h-6 sm:w-6" />
              </span>
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
