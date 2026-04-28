import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, KeyRound, Mail, UserRound } from 'lucide-react';
import { consumirAvisoInicioSesion, usarTiendaAuth } from '../../tienda/tiendaAuth';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';
import { detectarClaveAccesoAPI } from '../../servicios/servicioAuth';
import './PaginaInicioSesion.css';

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

const esquema = z.object({
  acceso: z.string().trim().min(1, 'Ingresa tu clave, correo o telefono'),
  correoAcceso: z.string().trim().optional(),
  contrasena: z.string().trim().optional(),
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
  const [requiereContrasenaSecundaria, setRequiereContrasenaSecundaria] = useState(false);
  const [modoClave, setModoClave] = useState<
    'ninguna' | 'cliente' | 'studio' | 'desconocida' | 'indeterminada' | 'cargando'
  >('ninguna');

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
      correoAcceso: '',
      contrasena: accesoDemo?.contrasena ?? '',
    },
  });

  const accesoActual = watch('acceso') ?? '';
  const accesoLimpio = accesoActual.trim();
  const accesoPorClave = esPosibleClaveSalon(accesoLimpio);
  const accesoPorTelefono = !accesoPorClave && esTelefono(accesoLimpio);
  const accesoPorCorreo = !accesoPorClave && esCorreo(accesoLimpio);
  const accesoPareceContrasenaDirecta =
    !accesoPorClave && !accesoPorCorreo && !accesoPorTelefono && accesoLimpio.length > 0;
  const claveEsCliente = accesoPorClave && modoClave === 'cliente';
  const claveEsStudio = accesoPorClave && modoClave === 'studio';
  const claveDesconocida = accesoPorClave && modoClave === 'desconocida';
  const claveIndeterminada = accesoPorClave && modoClave === 'indeterminada';
  const claveDetectando = accesoPorClave && modoClave === 'cargando';
  const mostrarCredencialesSecundarias =
    claveEsStudio || requiereContrasenaSecundaria || requiereIdentificador;

  const mensajeAyudaAcceso = requiereIdentificador
    ? 'Para continuar, ingresa el correo exacto asociado a tu cuenta.'
    : claveDetectando
      ? 'Validando tipo de clave para mostrarte el acceso correcto...'
      : claveEsCliente
        ? 'Clave cliente detectada. Puedes entrar directo o registrarte si es tu primera vez.'
        : claveEsStudio
          ? 'Clave studio detectada. Continúa con correo y contraseña del salón.'
          : claveIndeterminada
            ? 'No pudimos validar la clave por conexión. Reintenta antes de continuar.'
            : claveDesconocida
              ? 'No encontramos esa clave. Verifica el dato antes de continuar.'
              : accesoPorClave
                ? 'Clave detectada. Puedes entrar de inmediato con ese acceso.'
                : accesoPorTelefono
                  ? 'Telefono de cliente detectado. Si existe una cuenta activa, podras continuar sin mas campos.'
                  : accesoPorCorreo
                    ? 'Si es una cuenta cliente activa podras entrar directo. Si es acceso interno, te pediremos la contrasena.'
                    : accesoPareceContrasenaDirecta
                      ? 'Intentaremos resolver un acceso interno con esa contrasena. Si hace falta, te pediremos el correo.'
                      : 'Escribe tu acceso y el sistema mostrara solo lo necesario para continuar.';

  useEffect(() => {
    if (!accesoPorClave) {
      setModoClave('ninguna');
      setValue('correoAcceso', '', { shouldDirty: false, shouldValidate: false });
      return;
    }

    const clave = accesoLimpio.toUpperCase();
    setModoClave('cargando');

    let activo = true;
    const temporizador = window.setTimeout(() => {
      void detectarClaveAccesoAPI(clave).then((resultadoDeteccion) => {
        if (!activo) return;
        setModoClave(resultadoDeteccion.tipo);
      });
    }, 220);

    return () => {
      activo = false;
      window.clearTimeout(temporizador);
    };
  }, [accesoLimpio, accesoPorClave, setValue]);

  useEffect(() => {
    if (claveEsStudio || requiereIdentificador) {
      return;
    }

    if (accesoPorClave || accesoPorTelefono || accesoLimpio.length === 0) {
      setRequiereContrasenaSecundaria(false);
      setValue('contrasena', '', {
        shouldDirty: false,
        shouldTouch: false,
        shouldValidate: false,
      });
    }
  }, [
    accesoLimpio,
    accesoPorClave,
    accesoPorTelefono,
    claveEsStudio,
    requiereIdentificador,
    setValue,
  ]);

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
    const correoAcceso = datos.correoAcceso?.trim() ?? '';
    const contrasenaFinal = claveEsStudio
      ? contrasena
      : contrasena || (accesoPareceContrasenaDirecta ? acceso : '');

    if (esPosibleClaveSalon(acceso)) {
      if (claveEsStudio || claveDetectando) {
        if (claveDetectando) {
          setError('acceso', {
            message: 'Estamos validando la clave. Intenta nuevamente en un instante.',
          });
          return;
        }

        if (!correoAcceso || !esCorreo(correoAcceso)) {
          setError('correoAcceso', {
            message: 'Ingresa un correo valido para continuar con la clave studio.',
          });
          return;
        }

        if (!contrasena) {
          setError('contrasena', { message: 'Ingresa la contrasena del salon.' });
          return;
        }

        const resultadoStudio = await iniciarSesion(correoAcceso, contrasena);
        if (!resultadoStudio.exito) {
          if (resultadoStudio.codigo) {
            setCodigoBloqueo(resultadoStudio.codigo);
            setMotivoRechazo(resultadoStudio.motivo ?? null);
          }

          setError('root', {
            message: resultadoStudio.mensaje ?? 'No pudimos validar el acceso del salon.',
          });
          return;
        }

        navegar(resultadoStudio.ruta ?? '/');
        return;
      }

      if (claveIndeterminada) {
        setError('acceso', {
          message:
            'No pudimos validar la clave por un problema de conexión. Reintenta en un instante.',
        });
        return;
      }

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

    if (!esCorreo(acceso) && !esTelefono(acceso) && !accesoPareceContrasenaDirecta) {
      setError('acceso', {
        message: 'Ingresa un correo, telefono o clave valida.',
      });
      return;
    }

    if (requiereIdentificador && !esCorreo(acceso)) {
      setError('acceso', {
        message: 'Cuando hay varias cuentas, debes ingresar tu correo electronico.',
      });
      return;
    }

    if (mostrarCredencialesSecundarias && !contrasena) {
      setError('contrasena', {
        message: 'Ingresa tu contrasena.',
      });
      return;
    }

    const identificadorFinal =
      accesoPareceContrasenaDirecta && !requiereIdentificador ? null : acceso || null;
    const resultado = await iniciarSesion(identificadorFinal, contrasenaFinal);

    if (!resultado.exito) {
      if (resultado.codigo === 'IDENTIFICADOR_REQUERIDO') {
        setRequiereIdentificador(true);
        setRequiereContrasenaSecundaria(true);

        if (accesoPareceContrasenaDirecta && !contrasena) {
          setValue('contrasena', acceso, {
            shouldDirty: true,
            shouldTouch: true,
            shouldValidate: false,
          });
        }

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

      if (resultado.codigo === 'CONTRASENA_REQUERIDA') {
        setRequiereContrasenaSecundaria(true);
        setError('contrasena', {
          message: resultado.mensaje ?? 'Confirma tu acceso con tu contrasena.',
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
    setRequiereContrasenaSecundaria(false);
    const rutaDestino =
      resultado.ruta === '/vendedor'
        ? '/vendedor'
        : rutaDesde && !/^\/reservar\//.test(rutaDesde)
          ? rutaDesde
          : (resultado.ruta ?? '/');
    navegar(rutaDestino);
  };

  useEffect(() => {
    if (!accesoDemo) {
      return;
    }

    setRequiereIdentificador(false);
    setRequiereContrasenaSecundaria(true);
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
      className="pagina-inicio-sesion relative h-svh min-h-svh w-full overflow-hidden bg-[#0A2823] text-white md:h-dvh"
      style={{ fontFamily: 'Arial, sans-serif' }}
    >
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="fondo-login fondo-login--blur" />
        <div className="login-background fondo-login fondo-login--principal" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_76%_30%,rgba(198,150,140,0.26)_0%,rgba(198,150,140,0.08)_24%,rgba(9,9,9,0)_48%),linear-gradient(110deg,rgba(7,16,13,0.78)_0%,rgba(9,32,27,0.36)_42%,rgba(5,9,8,0.74)_100%)]" />
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
                {requiereIdentificador ? 'Correo electronico' : 'Acceso universal'}
              </label>
              <div className="relative">
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
                      : 'Ingresa clave, correo o telefono'
                  }
                  className="w-full rounded-[20px] border border-[#78736E]/48 bg-black/8 py-3 pl-5 pr-14 text-[0.96rem] text-white placeholder:text-[#d6c6be]/58 outline-none transition focus:border-[#C6968C] focus:bg-white/4 focus:ring-2 focus:ring-[#C6968C]/22 sm:py-3.5 sm:text-base"
                  aria-invalid={Boolean(errors.acceso)}
                  aria-describedby="ayuda-acceso"
                  {...register('acceso')}
                />
                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[#C6968C]/92">
                  {requiereIdentificador || accesoPorCorreo ? (
                    <Mail className="h-5 w-5" />
                  ) : accesoPorClave ? (
                    <KeyRound className="h-5 w-5" />
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
                  className="mt-1.5 text-[11px] leading-5 text-[#ead8d2]/72 sm:text-xs"
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
                  <span className="text-sm text-[#ead8d2]/86">continua</span>
                  <span className="h-px flex-1 bg-white/22" />
                </div>

                {claveEsStudio ? (
                  <div className="mb-3.5">
                    <label
                      htmlFor="correoAcceso"
                      className="mb-2 block text-base font-medium text-white/90"
                    >
                      Correo del salón
                    </label>
                    <div className="relative">
                      <input
                        id="correoAcceso"
                        type="email"
                        autoComplete="email"
                        enterKeyHint="next"
                        placeholder="Ingresa el correo del salón"
                        className="w-full rounded-[20px] border border-[#78736E]/48 bg-black/8 py-3 pl-5 pr-5 text-[0.96rem] text-white placeholder:text-[#d6c6be]/58 outline-none transition focus:border-[#C6968C] focus:bg-white/4 focus:ring-2 focus:ring-[#C6968C]/22 sm:py-3.5 sm:text-base"
                        aria-invalid={Boolean(errors.correoAcceso)}
                        {...register('correoAcceso')}
                      />
                    </div>
                    {errors.correoAcceso ? (
                      <p className="mt-1.5 text-xs text-red-200">{errors.correoAcceso.message}</p>
                    ) : null}
                  </div>
                ) : null}

                <div>
                  <label
                    htmlFor="contrasena"
                    className="mb-2 block text-base font-medium text-white/90"
                  >
                    Contraseña
                  </label>
                  <div className="relative">
                    <input
                      id="contrasena"
                      type={mostrarContrasena ? 'text' : 'password'}
                      autoComplete="current-password"
                      enterKeyHint="go"
                      placeholder="Contraseña"
                      className="w-full rounded-[20px] border border-[#78736E]/48 bg-black/8 py-3 pl-5 pr-14 text-[0.96rem] text-white placeholder:text-[#d6c6be]/58 outline-none transition focus:border-[#C6968C] focus:bg-white/4 focus:ring-2 focus:ring-[#C6968C]/22 sm:py-3.5 sm:text-base"
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
              className="group relative mx-auto mt-4 flex w-full max-w-[340px] items-center justify-center rounded-full border-2 border-white/90 bg-[linear-gradient(90deg,rgba(18,64,53,0.98)_0%,rgba(14,56,47,0.98)_48%,rgba(18,64,53,0.98)_100%)] px-6 py-2.5 text-lg font-black uppercase tracking-[0.08em] text-white shadow-[0_18px_40px_rgba(0,0,0,0.34)] transition duration-300 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C6968C]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0A2823] disabled:cursor-not-allowed disabled:opacity-60 sm:text-[1.15rem]"
            >
              <span className="text-[1.25rem] leading-none sm:text-[1.45rem]">
                {isSubmitting ? '...' : 'LOGIN'}
              </span>
              <span className="absolute right-[7px] flex h-10 w-10 items-center justify-center rounded-full bg-white text-[#143C32] shadow-[inset_0_0_0_1px_rgba(0,0,0,0.08)] transition group-hover:scale-105 sm:h-11 sm:w-11">
                <UserRound className="h-5 w-5 sm:h-6 sm:w-6" />
              </span>
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
