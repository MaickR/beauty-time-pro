import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, Scissors, User } from 'lucide-react';
import { SelectorFecha } from '../../componentes/ui/SelectorFecha';
import { registrarCliente } from '../../servicios/servicioRegistro';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';
import { ModalTerminos } from './componentes/ModalTerminos';
import { ModalPrivacidad } from './componentes/ModalPrivacidad';

const DOMINIOS_MSG = 'Solo aceptamos correos de Gmail, Hotmail, Outlook, Yahoo o iCloud';
const DOMINIOS = [
  'gmail.com',
  'googlemail.com',
  'hotmail.com',
  'hotmail.es',
  'hotmail.com.mx',
  'hotmail.com.co',
  'outlook.com',
  'outlook.es',
  'outlook.com.mx',
  'live.com',
  'live.com.mx',
  'live.com.co',
  'yahoo.com',
  'yahoo.es',
  'yahoo.com.mx',
  'yahoo.com.co',
  'icloud.com',
  'me.com',
  'protonmail.com',
  'pm.me',
];

function esDominioPermitido(email: string): boolean {
  const dom = email.split('@')[1]?.toLowerCase();
  return dom !== undefined && DOMINIOS.includes(dom);
}

const esquema = z
  .object({
    nombre: z.string().min(2, 'Mínimo 2 caracteres'),
    apellido: z.string().min(2, 'Mínimo 2 caracteres'),
    email: z.string().email('Correo inválido').refine(esDominioPermitido, DOMINIOS_MSG),
    contrasena: z
      .string()
      .min(8, 'Mínimo 8 caracteres')
      .regex(/[A-Z]/, 'Necesita al menos una mayúscula')
      .regex(/[0-9]/, 'Necesita al menos un número'),
    confirmarContrasena: z.string(),
    telefono: z
      .string()
      .regex(/^[0-9]{10}$/, '10 dígitos sin espacios')
      .optional()
      .or(z.literal('')),
    fechaNacimiento: z.string().min(1, 'Selecciona la fecha de nacimiento'),
    aceptaTerminos: z.literal(true, 'Debes aceptar los términos para continuar'),
  })
  .refine((d) => d.contrasena === d.confirmarContrasena, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmarContrasena'],
  })
  .superRefine((datos, contexto) => {
    const fecha = new Date(`${datos.fechaNacimiento}T00:00:00`);
    if (Number.isNaN(fecha.getTime())) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fechaNacimiento'],
        message: 'La fecha de nacimiento no es válida',
      });
      return;
    }

    const hoy = new Date();
    let edad = hoy.getFullYear() - fecha.getFullYear();
    const aunNoCumple =
      hoy.getMonth() < fecha.getMonth() ||
      (hoy.getMonth() === fecha.getMonth() && hoy.getDate() < fecha.getDate());
    if (aunNoCumple) edad -= 1;

    if (edad < 13) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['fechaNacimiento'],
        message: 'Debes tener al menos 13 años para registrarte en Beauty Time Pro',
      });
    }
  });

type CamposFormulario = z.infer<typeof esquema>;

function calcularFortaleza(contrasena: string): { nivel: number; etiqueta: string; color: string } {
  let puntos = 0;
  if (contrasena.length >= 8) puntos++;
  if (/[A-Z]/.test(contrasena)) puntos++;
  if (/[0-9]/.test(contrasena)) puntos++;
  if (/[^A-Za-z0-9]/.test(contrasena)) puntos++;
  if (puntos <= 1) return { nivel: 1, etiqueta: 'Débil', color: 'bg-red-400' };
  if (puntos === 2) return { nivel: 2, etiqueta: 'Media', color: 'bg-yellow-400' };
  return { nivel: 3, etiqueta: 'Fuerte', color: 'bg-green-500' };
}

export function PaginaRegistroCliente() {
  usarTituloPagina('Crear cuenta — Beauty Time Pro');
  const navegar = useNavigate();
  const [mostrarPass, setMostrarPass] = useState(false);
  const [mostrarConfirm, setMostrarConfirm] = useState(false);
  const [mostrarTerminos, setMostrarTerminos] = useState(false);
  const [mostrarPrivacidad, setMostrarPrivacidad] = useState(false);
  const [errorServidor, setErrorServidor] = useState('');
  const hoy = new Date();
  const fechaMaxima = `${hoy.getFullYear() - 13}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;
  const fechaMinima = `${hoy.getFullYear() - 100}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CamposFormulario>({
    resolver: zodResolver(esquema),
    defaultValues: {
      telefono: '',
      fechaNacimiento: '',
    },
  });

  const contrasenaActual = watch('contrasena') ?? '';
  const fechaNacimiento = watch('fechaNacimiento') ?? '';
  const fortaleza = calcularFortaleza(contrasenaActual);

  const alEnviar = async (datos: CamposFormulario) => {
    setErrorServidor('');
    try {
      const resultado = await registrarCliente({
        email: datos.email,
        contrasena: datos.contrasena,
        nombre: datos.nombre,
        apellido: datos.apellido,
        fechaNacimiento: datos.fechaNacimiento,
        telefono: datos.telefono || undefined,
      });
      const parametros = new URLSearchParams({
        motivo: 'verificacion',
        mensaje: resultado.mensaje,
      });
      if (resultado.enlaceVerificacion) {
        parametros.set('enlace', resultado.enlaceVerificacion);
      }
      navegar(`/email-enviado?${parametros.toString()}`);
    } catch (error) {
      setErrorServidor(
        error instanceof Error ? error.message : 'Ocurrió un error. Intenta de nuevo.',
      );
    }
  };

  const aceptarTerminos = () => {
    setValue('aceptaTerminos', true, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    setMostrarTerminos(false);
  };

  const aceptarPrivacidad = () => {
    setValue('aceptaTerminos', true, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true,
    });
    setMostrarPrivacidad(false);
  };

  return (
    <div className="min-h-screen flex">
      {/* Panel izquierdo */}
      <div className="hidden lg:flex lg:w-2/5 flex-col justify-between p-12 bg-linear-to-br from-[#880E4F] via-[#C2185B] to-[#F06292]">
        <div className="flex items-center gap-3">
          <div className="bg-white/20 p-3 rounded-2xl">
            <Scissors className="text-white w-7 h-7" aria-hidden="true" />
          </div>
          <span className="text-white font-black text-xl">Beauty Time Pro</span>
        </div>
        <div className="text-white">
          <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-3xl bg-white/20">
            <User className="w-10 h-10 text-white" aria-hidden="true" />
          </div>
          <h2 className="text-4xl font-black mb-4">Únete a Beauty Time Pro</h2>
          <ul className="space-y-3" aria-label="Beneficios para clientes">
            {[
              'Reserva en cualquier momento',
              'Historial de tus citas',
              'Acumula puntos de fidelidad',
            ].map((b) => (
              <li key={b} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full bg-white/30 flex items-center justify-center shrink-0">
                  <span className="w-2 h-2 rounded-full bg-white" />
                </span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </div>
        <p className="text-white/50 text-sm">© {new Date().getFullYear()} Beauty Time Pro</p>
      </div>

      {/* Panel derecho */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-gray-50 overflow-y-auto">
        <div className="w-full max-w-lg py-8">
          <div className="flex lg:hidden items-center gap-2 justify-center mb-6">
            <div className="bg-linear-to-br from-[#880E4F] to-[#F06292] p-2.5 rounded-xl">
              <Scissors className="text-white w-6 h-6" aria-hidden="true" />
            </div>
            <span className="font-black text-lg text-slate-900">Beauty Time Pro</span>
          </div>

          <h1 className="text-3xl font-black text-slate-900 mb-1">Crear tu cuenta</h1>
          <p className="text-slate-500 text-sm mb-7">Completa los datos para comenzar</p>

          {errorServidor && (
            <div
              role="alert"
              className="mb-5 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700"
            >
              {errorServidor}
            </div>
          )}

          <form onSubmit={handleSubmit(alEnviar)} noValidate className="space-y-4">
            {/* Nombre y Apellido */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="nombre" className="block text-sm font-semibold text-slate-700 mb-1">
                  Nombre
                </label>
                <input
                  id="nombre"
                  type="text"
                  autoComplete="given-name"
                  className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  aria-invalid={!!errors.nombre}
                  {...register('nombre')}
                />
                {errors.nombre && (
                  <p role="alert" className="mt-1 text-xs text-red-500">
                    {errors.nombre.message}
                  </p>
                )}
              </div>
              <div>
                <label
                  htmlFor="apellido"
                  className="block text-sm font-semibold text-slate-700 mb-1"
                >
                  Apellido
                </label>
                <input
                  id="apellido"
                  type="text"
                  autoComplete="family-name"
                  className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  aria-invalid={!!errors.apellido}
                  {...register('apellido')}
                />
                {errors.apellido && (
                  <p role="alert" className="mt-1 text-xs text-red-500">
                    {errors.apellido.message}
                  </p>
                )}
              </div>
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700 mb-1">
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                aria-invalid={!!errors.email}
                aria-describedby={errors.email ? 'error-email' : undefined}
                {...register('email')}
              />
              {errors.email && (
                <p id="error-email" role="alert" className="mt-1 text-xs text-red-500">
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Contraseña */}
            <div>
              <label
                htmlFor="contrasena"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="contrasena"
                  type={mostrarPass ? 'text' : 'password'}
                  className="w-full pr-11 px-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  aria-invalid={!!errors.contrasena}
                  {...register('contrasena')}
                />
                <button
                  type="button"
                  onClick={() => setMostrarPass((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={mostrarPass ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {mostrarPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {/* Medidor de fortaleza */}
              {contrasenaActual.length > 0 && (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1, 2, 3].map((n) => (
                      <div
                        key={n}
                        className={`h-1.5 flex-1 rounded-full transition-colors ${n <= fortaleza.nivel ? fortaleza.color : 'bg-slate-200'}`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-slate-500">
                    Fortaleza: <span className="font-semibold">{fortaleza.etiqueta}</span>
                  </p>
                </div>
              )}
              {errors.contrasena && (
                <p role="alert" className="mt-1 text-xs text-red-500">
                  {errors.contrasena.message}
                </p>
              )}
            </div>

            {/* Confirmar contraseña */}
            <div>
              <label
                htmlFor="confirmarContrasena"
                className="block text-sm font-semibold text-slate-700 mb-1"
              >
                Confirmar contraseña
              </label>
              <div className="relative">
                <input
                  id="confirmarContrasena"
                  type={mostrarConfirm ? 'text' : 'password'}
                  className="w-full pr-11 px-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  aria-invalid={!!errors.confirmarContrasena}
                  {...register('confirmarContrasena')}
                />
                <button
                  type="button"
                  onClick={() => setMostrarConfirm((v) => !v)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  aria-label={mostrarConfirm ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {mostrarConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {errors.confirmarContrasena && (
                <p role="alert" className="mt-1 text-xs text-red-500">
                  {errors.confirmarContrasena.message}
                </p>
              )}
            </div>

            {/* Fecha de nacimiento */}
            <div>
              <input type="hidden" {...register('fechaNacimiento')} />
              <div className="rounded-2xl border border-slate-200 bg-white p-3">
                <SelectorFecha
                  etiqueta="Fecha de nacimiento"
                  valor={fechaNacimiento}
                  min={fechaMinima}
                  max={fechaMaxima}
                  error={errors.fechaNacimiento?.message}
                  alCambiar={(valor) =>
                    setValue('fechaNacimiento', valor, {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    })
                  }
                />
                <p className="mt-2 text-xs text-slate-400">
                  Debes tener al menos 13 años para crear una cuenta. Si eres menor de edad, pide a
                  un adulto que te acompañe al salón.
                </p>
              </div>
            </div>

            {/* Teléfono opcional */}
            <div>
              <label htmlFor="telefono" className="block text-sm font-semibold text-slate-700 mb-1">
                Teléfono <span className="font-normal text-slate-400">(opcional)</span>
              </label>
              <input
                id="telefono"
                type="tel"
                autoComplete="tel"
                className="w-full px-3.5 py-3 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                placeholder="10 dígitos"
                {...register('telefono')}
              />
              {errors.telefono && (
                <p role="alert" className="mt-1 text-xs text-red-500">
                  {errors.telefono.message}
                </p>
              )}
            </div>

            {/* Términos */}
            <div>
              <div className="flex items-start gap-2">
                <input
                  type="checkbox"
                  id="aceptaTerminos"
                  {...register('aceptaTerminos')}
                  className="mt-1 h-4 w-4 shrink-0 rounded accent-pink-600"
                />
                <label htmlFor="aceptaTerminos" className="text-sm text-gray-600">
                  Acepto los{' '}
                  <button
                    type="button"
                    onClick={() => setMostrarTerminos(true)}
                    className="font-medium text-pink-600 underline"
                  >
                    Términos y condiciones
                  </button>{' '}
                  y la{' '}
                  <button
                    type="button"
                    onClick={() => setMostrarPrivacidad(true)}
                    className="font-medium text-pink-600 underline"
                  >
                    Política de privacidad
                  </button>
                </label>
              </div>
              {errors.aceptaTerminos && (
                <p role="alert" className="mt-1 text-xs text-red-500">
                  Debes aceptar los términos para continuar
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-linear-to-r from-[#C2185B] to-[#E91E8C] text-white font-bold py-3.5 rounded-2xl hover:shadow-lg hover:scale-[1.01] disabled:opacity-60 disabled:cursor-not-allowed transition-all"
            >
              {isSubmitting ? 'Creando cuenta...' : 'Crear cuenta'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            ¿Ya tienes cuenta?{' '}
            <Link to="/iniciar-sesion" className="text-pink-700 font-semibold hover:underline">
              Inicia sesión
            </Link>
          </p>
        </div>
      </div>
      <ModalTerminos
        abierto={mostrarTerminos}
        alAceptar={aceptarTerminos}
        alCerrar={() => setMostrarTerminos(false)}
      />
      <ModalPrivacidad
        abierto={mostrarPrivacidad}
        alAceptar={aceptarPrivacidad}
        alCerrar={() => setMostrarPrivacidad(false)}
      />
    </div>
  );
}
