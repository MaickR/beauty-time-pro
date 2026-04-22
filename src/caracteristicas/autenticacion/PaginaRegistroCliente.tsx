import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, EyeOff, Mail, UserRound } from 'lucide-react';
import { MedidorContrasena } from '../../componentes/ui/MedidorContrasena';
import { SelectorCumpleanos } from '../../componentes/ui/SelectorCumpleanos';
import { MarcaAplicacion } from '../../componentes/ui/MarcaAplicacion';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';
import {
  esquemaRegistroCliente,
  limpiarCorreoCliente,
  limpiarTelefonoCliente,
  limpiarTextoSoloLetras,
  MENSAJE_DOMINIO_CLIENTE,
  type CamposRegistroCliente,
} from '../../lib/registroCliente';
import { ErrorServicioRegistro, registrarCliente } from '../../servicios/servicioRegistro';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';
import type { Pais } from '../../tipos';
import { ModalPrivacidad } from './componentes/ModalPrivacidad';
import { ModalTerminos } from './componentes/ModalTerminos';

export function PaginaRegistroCliente() {
  usarTituloPagina('Crear cuenta de cliente');
  const navegar = useNavigate();
  const { iniciarSesion } = usarTiendaAuth();
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const [mostrarTerminos, setMostrarTerminos] = useState(false);
  const [mostrarPrivacidad, setMostrarPrivacidad] = useState(false);
  const [errorServidor, setErrorServidor] = useState('');

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CamposRegistroCliente>({
    resolver: zodResolver(esquemaRegistroCliente),
    defaultValues: {
      nombreCompleto: '',
      email: '',
      telefono: '',
      ciudad: '',
      pais: 'Mexico',
      fechaNacimiento: '',
      contrasena: '',
      confirmarContrasena: '',
      aceptaTerminos: false,
    },
  });

  const contrasena = watch('contrasena') ?? '';

  const alEnviar = async (datos: CamposRegistroCliente) => {
    setErrorServidor('');
    try {
      const emailNormalizado = limpiarCorreoCliente(datos.email);
      const resultado = await registrarCliente({
        nombreCompleto: datos.nombreCompleto,
        email: emailNormalizado,
        telefono: datos.telefono || undefined,
        ciudad: datos.ciudad || undefined,
        pais: datos.pais,
        fechaNacimiento: datos.fechaNacimiento,
        contrasena: datos.contrasena,
      });

      const acceso = await iniciarSesion(emailNormalizado, datos.contrasena);
      if (acceso.exito) {
        navegar(acceso.ruta ?? '/cliente/inicio', { replace: true });
        return;
      }

      const parametros = new URLSearchParams({
        registro: 'ok',
        mensaje:
          resultado.mensaje ||
          'Tu cuenta está lista. Inicia sesión con tu correo y contraseña para continuar.',
      });
      navegar(`/iniciar-sesion?${parametros.toString()}`, { replace: true });
    } catch (error) {
      if (error instanceof ErrorServicioRegistro) {
        setErrorServidor(error.message);
        return;
      }
      setErrorServidor('No pudimos crear la cuenta. Intenta de nuevo.');
    }
  };

  const aceptarAcuerdo = () => {
    setValue('aceptaTerminos', true, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    setMostrarTerminos(false);
    setMostrarPrivacidad(false);
  };

  return (
    <main className="min-h-screen bg-[#f5efe6] px-6 py-10 sm:px-10 lg:px-14 lg:py-14">
      <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.88fr_1.12fr]">
        <section className="rounded-4xl bg-[#1d1b1a] p-8 text-white shadow-2xl shadow-black/20 sm:p-10">
          <MarcaAplicacion variante="oscura" subtitulo="Cuenta de cliente" />

          <div className="mt-10 max-w-md">
            <p className="text-sm uppercase tracking-[0.3em] text-[#f5cea7]">Registro rápido</p>
            <h1 className="mt-4 text-4xl font-semibold leading-tight">
              Crea tu cuenta y accede al instante.
            </h1>
            <p className="mt-5 text-base leading-7 text-white/70">
              La cuenta se activa inmediatamente con correos personales permitidos, sin códigos
              intermedios ni pasos extra.
            </p>
          </div>

          <div className="mt-10 space-y-4">
            {[
              MENSAJE_DOMINIO_CLIENTE,
              'Ingresas con el mismo correo y contraseña apenas terminas el registro.',
              'La misma cuenta funciona en los salones compatibles desde el primer acceso.',
            ].map((texto) => (
              <div
                key={texto}
                className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/75"
              >
                {texto}
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-4xl border border-[#e4d8c8] bg-[#fffdf9] p-6 shadow-[0_24px_80px_rgba(71,55,36,0.12)] sm:p-8">
          <div className="mb-8 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-3xl font-semibold tracking-tight text-slate-950">
                Crear cuenta de cliente
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Completa tus datos y entra de inmediato. No necesitas verificar con código.
              </p>
            </div>
            <div className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-[#f3eadf] text-slate-700 sm:flex">
              <UserRound className="h-5 w-5" aria-hidden="true" />
            </div>
          </div>

          {errorServidor ? (
            <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorServidor}
            </div>
          ) : null}

          <form onSubmit={handleSubmit(alEnviar)} noValidate className="space-y-4">
            <div>
              <label
                htmlFor="nombreCompleto"
                className="mb-1.5 block text-sm font-medium text-slate-700"
              >
                Nombre completo
              </label>
              <input
                id="nombreCompleto"
                type="text"
                autoComplete="name"
                className="w-full rounded-2xl border border-[#dacbb8] bg-white px-4 py-3.5 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-[#f0d7bb]"
                aria-invalid={Boolean(errors.nombreCompleto)}
                {...register('nombreCompleto', {
                  onChange: (evento) => {
                    evento.target.value = limpiarTextoSoloLetras(evento.target.value);
                  },
                })}
              />
              {errors.nombreCompleto ? (
                <p className="mt-1 text-xs text-red-600">{errors.nombreCompleto.message}</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                    aria-hidden="true"
                  />
                  <input
                    id="email"
                    type="email"
                    autoComplete="email"
                    className="w-full rounded-2xl border border-[#dacbb8] bg-white px-10 py-3.5 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-[#f0d7bb]"
                    aria-invalid={Boolean(errors.email)}
                    {...register('email', {
                      onChange: (evento) => {
                        evento.target.value = limpiarCorreoCliente(evento.target.value);
                      },
                    })}
                  />
                </div>
                {errors.email ? (
                  <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="telefono"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Teléfono
                </label>
                <input
                  id="telefono"
                  type="tel"
                  autoComplete="tel"
                  inputMode="numeric"
                  maxLength={10}
                  className="w-full rounded-2xl border border-[#dacbb8] bg-white px-4 py-3.5 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-[#f0d7bb]"
                  aria-invalid={Boolean(errors.telefono)}
                  {...register('telefono', {
                    onChange: (evento) => {
                      evento.target.value = limpiarTelefonoCliente(evento.target.value);
                    },
                  })}
                />
                {errors.telefono ? (
                  <p className="mt-1 text-xs text-red-600">{errors.telefono.message}</p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="pais" className="mb-1.5 block text-sm font-medium text-slate-700">
                  País
                </label>
                <select
                  id="pais"
                  className="w-full rounded-2xl border border-[#dacbb8] bg-white px-4 py-3.5 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-[#f0d7bb]"
                  {...register('pais')}
                >
                  {(['Mexico', 'Colombia'] as Pais[]).map((pais) => (
                    <option key={pais} value={pais}>
                      {pais === 'Mexico' ? 'México' : 'Colombia'}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="ciudad" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Ciudad
                </label>
                <input
                  id="ciudad"
                  type="text"
                  autoComplete="address-level2"
                  className="w-full rounded-2xl border border-[#dacbb8] bg-white px-4 py-3.5 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-[#f0d7bb]"
                  {...register('ciudad', {
                    onChange: (evento) => {
                      evento.target.value = limpiarTextoSoloLetras(evento.target.value);
                    },
                  })}
                />
                {errors.ciudad ? (
                  <p className="mt-1 text-xs text-red-600">{errors.ciudad.message}</p>
                ) : null}
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700">
                Fecha de cumpleaños
              </label>
              <SelectorCumpleanos
                valor={watch('fechaNacimiento') ?? ''}
                alCambiar={(valor) =>
                  setValue('fechaNacimiento', valor, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  })
                }
              />
              {errors.fechaNacimiento ? (
                <p className="mt-1 text-xs text-red-600">{errors.fechaNacimiento.message}</p>
              ) : null}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="contrasena"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="contrasena"
                    type={mostrarContrasena ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="w-full rounded-2xl border border-[#dacbb8] bg-white px-4 py-3.5 pr-12 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-[#f0d7bb]"
                    aria-invalid={Boolean(errors.contrasena)}
                    {...register('contrasena')}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarContrasena((valor) => !valor)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
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
                  <p className="mt-1 text-xs text-red-600">{errors.contrasena.message}</p>
                ) : null}
              </div>

              <div>
                <label
                  htmlFor="confirmarContrasena"
                  className="mb-1.5 block text-sm font-medium text-slate-700"
                >
                  Confirmar contraseña
                </label>
                <div className="relative">
                  <input
                    id="confirmarContrasena"
                    type={mostrarConfirmacion ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="w-full rounded-2xl border border-[#dacbb8] bg-white px-4 py-3.5 pr-12 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-[#f0d7bb]"
                    aria-invalid={Boolean(errors.confirmarContrasena)}
                    {...register('confirmarContrasena')}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarConfirmacion((valor) => !valor)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    aria-label={
                      mostrarConfirmacion ? 'Ocultar confirmación' : 'Mostrar confirmación'
                    }
                  >
                    {mostrarConfirmacion ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
                {errors.confirmarContrasena ? (
                  <p className="mt-1 text-xs text-red-600">{errors.confirmarContrasena.message}</p>
                ) : null}
              </div>
            </div>

            <MedidorContrasena contrasena={contrasena} />

            <label className="flex items-start gap-3 rounded-2xl border border-[#eadfce] bg-[#fffaf3] px-4 py-3 text-sm text-slate-600">
              <input
                type="checkbox"
                className="mt-1 h-4 w-4 rounded border-slate-300"
                {...register('aceptaTerminos')}
              />
              <span className="leading-6">
                Acepto los{' '}
                <button
                  type="button"
                  onClick={() => setMostrarTerminos(true)}
                  className="font-semibold text-slate-900 underline underline-offset-4"
                >
                  Términos del servicio
                </button>{' '}
                y la{' '}
                <button
                  type="button"
                  onClick={() => setMostrarPrivacidad(true)}
                  className="font-semibold text-slate-900 underline underline-offset-4"
                >
                  Política de privacidad
                </button>
                .
              </span>
            </label>
            {errors.aceptaTerminos ? (
              <p className="-mt-2 text-xs text-red-600">{errors.aceptaTerminos.message}</p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              aria-busy={isSubmitting}
              className="w-full rounded-2xl bg-[#161616] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-black disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            ¿Ya tienes cuenta?{' '}
            <Link
              to="/iniciar-sesion"
              className="font-semibold text-slate-900 underline decoration-[#c7b299] underline-offset-4"
            >
              Inicia sesión
            </Link>
          </p>
        </section>
      </div>

      <ModalTerminos
        abierto={mostrarTerminos}
        alCerrar={() => setMostrarTerminos(false)}
        alAceptar={aceptarAcuerdo}
      />
      <ModalPrivacidad
        abierto={mostrarPrivacidad}
        alCerrar={() => setMostrarPrivacidad(false)}
        alAceptar={aceptarAcuerdo}
      />
    </main>
  );
}
