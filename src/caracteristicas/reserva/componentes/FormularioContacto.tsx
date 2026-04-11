import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Palette, AlertTriangle, Gift } from 'lucide-react';
import {
  buscarClienteFidelidadPorTelefono,
  type EstadoFidelidadCliente,
} from '../../../servicios/servicioFidelidad';
import {
  esEmailSalonValido,
  limpiarNombrePersonaEntrada,
  limpiarTelefonoEntrada,
} from '../../../utils/formularioSalon';
import type { Estudio } from '../../../tipos';
import type { usarFlujoReserva } from '../hooks/usarFlujoReserva';

const esquema = z.object({
  nombreCliente: z
    .string()
    .min(3, 'Mínimo 3 caracteres')
    .regex(/^[\p{L}\s]+$/u, 'Ingresa solo letras y espacios'),
  telefonoCliente: z.string().regex(/^[0-9]{10}$/, '10 dígitos sin espacios ni guiones'),
  fechaNacimiento: z
    .string()
    .min(1, 'La fecha de nacimiento es requerida')
    .refine((v) => {
      const d = new Date(v);
      return !isNaN(d.getTime()) && d <= new Date();
    }, 'No puede ser una fecha futura')
    .refine((v) => {
      const d = new Date(v);
      const hace100 = new Date();
      hace100.setFullYear(hace100.getFullYear() - 100);
      return d >= hace100;
    }, 'Fecha no puede ser mayor a 100 años'),
  email: z
    .string()
    .refine(
      (valor) =>
        valor === '' || (z.string().email().safeParse(valor).success && esEmailSalonValido(valor)),
      {
        message: 'Usa un correo personal válido de Gmail, Hotmail, Outlook o Yahoo',
      },
    )
    .or(z.literal(''))
    .optional(),
  observaciones: z
    .string()
    .max(240, 'Máximo 240 caracteres')
    .regex(/^[\p{L}\p{N}\s.,:;()¿?¡!-]*$/u, 'Usa solo texto, números y signos básicos')
    .optional(),
});

type CamposContacto = z.infer<typeof esquema>;

type DatosEnvioContacto = CamposContacto & { usarRecompensa?: boolean; observaciones?: string };

interface PropsFormularioContacto {
  estudio: Estudio;
  flujo: ReturnType<typeof usarFlujoReserva>;
  requiereColor: boolean;
  onEnviar: (datos: DatosEnvioContacto) => void;
}

function calcularEdad(fechaNacimiento: string): number {
  const nacimiento = new Date(fechaNacimiento);
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const cumple = new Date(hoy.getFullYear(), nacimiento.getMonth(), nacimiento.getDate());
  if (hoy < cumple) edad--;
  return edad;
}

export function FormularioContacto({
  estudio,
  flujo,
  requiereColor,
  onEnviar,
}: PropsFormularioContacto) {
  const [fidelidadCliente, setFidelidadCliente] = useState<EstadoFidelidadCliente | null>(null);
  const [consultandoFidelidad, setConsultandoFidelidad] = useState(false);
  const [usarRecompensa, setUsarRecompensa] = useState(false);
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<CamposContacto>({
    resolver: zodResolver(esquema),
    defaultValues: {
      nombreCliente: flujo.nombreCliente,
      telefonoCliente: flujo.telefonoCliente,
      fechaNacimiento: flujo.fechaNacimiento,
      email: flujo.email,
    },
  });

  const fechaNacimientoValor = watch('fechaNacimiento');
  const registroFechaNacimiento = register('fechaNacimiento');
  const esMenor =
    fechaNacimientoValor && !errors.fechaNacimiento
      ? calcularEdad(fechaNacimientoValor) < 18
      : false;

  // Sincronizar cambios con el flujo para que enviarReserva tenga los valores
  const valores = watch();
  useEffect(() => {
    flujo.actualizarContacto('nombreCliente', valores.nombreCliente ?? '');
    flujo.actualizarContacto('telefonoCliente', valores.telefonoCliente ?? '');
    flujo.actualizarContacto('fechaNacimiento', valores.fechaNacimiento ?? '');
    flujo.actualizarContacto('email', valores.email ?? '');
  }, [valores.nombreCliente, valores.telefonoCliente, valores.fechaNacimiento, valores.email]);

  const formularioValido =
    flujo.personalSeleccionado && flujo.horaSeleccionada && flujo.serviciosSeleccionados.length > 0;

  const telefonoActual = valores.telefonoCliente?.trim() ?? '';

  useEffect(() => {
    let cancelado = false;

    if (telefonoActual.length !== 10) {
      setFidelidadCliente(null);
      setUsarRecompensa(false);
      return;
    }

    setConsultandoFidelidad(true);
    void buscarClienteFidelidadPorTelefono(estudio.id, telefonoActual)
      .then((resultado) => {
        if (cancelado) return;
        setFidelidadCliente(resultado);
        if (!resultado?.recompensaDisponible) {
          setUsarRecompensa(false);
        }
      })
      .catch(() => {
        if (cancelado) return;
        setFidelidadCliente(null);
        setUsarRecompensa(false);
      })
      .finally(() => {
        if (!cancelado) setConsultandoFidelidad(false);
      });

    return () => {
      cancelado = true;
    };
  }, [estudio.id, telefonoActual]);

  return (
    <section className="bg-slate-900 rounded-[2.5rem] md:rounded-[3.25rem] p-5 md:p-8 shadow-2xl flex flex-col text-white">
      <h3 className="text-lg md:text-2xl font-black italic uppercase tracking-tighter mb-6 flex items-center gap-3">
        <span
          className="bg-pink-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm"
          aria-hidden="true"
        >
          4
        </span>
        Tus Datos de Contacto
      </h3>

      {requiereColor && (
        <div className="bg-pink-950/40 p-4 md:p-6 rounded-3xl border border-pink-900/50 mb-6">
          <p className="text-[10px] font-black text-pink-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Palette className="w-4 h-4" aria-hidden="true" /> Detalles de tu Coloración (Opcional)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="marcaTinte"
                className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2"
              >
                Marca de Tinte Preferida
              </label>
              <input
                id="marcaTinte"
                type="text"
                className="w-full px-5 py-3 bg-slate-800 border border-slate-700 rounded-xl font-bold text-white outline-none focus:border-pink-500 transition-all"
                placeholder="Ej: L'Oréal, Wella..."
                value={flujo.marcaTinte}
                onChange={(e) => flujo.actualizarContacto('marcaTinte', e.target.value)}
              />
            </div>
            <div>
              <label
                htmlFor="numeroTinte"
                className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2"
              >
                Número / Tono del Tinte
              </label>
              <input
                id="numeroTinte"
                type="text"
                className="w-full px-5 py-3 bg-slate-800 border border-slate-700 rounded-xl font-bold text-white outline-none focus:border-pink-500 transition-all"
                placeholder="Ej: 7.1, 8.0..."
                value={flujo.numeroTinte}
                onChange={(e) => flujo.actualizarContacto('numeroTinte', e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      <form
        onSubmit={handleSubmit((datos) =>
          onEnviar({ ...datos, usarRecompensa, observaciones: datos.observaciones }),
        )}
        noValidate
      >
        <div className="space-y-5 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="nombreCliente"
                className="block text-[10px] font-black text-pink-400 uppercase tracking-widest mb-3 ml-2"
              >
                Nombre Completo{' '}
                <span className="text-red-500 text-sm" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="nombreCliente"
                type="text"
                {...register('nombreCliente')}
                onInput={(evento) => {
                  evento.currentTarget.value = limpiarNombrePersonaEntrada(
                    evento.currentTarget.value,
                  );
                }}
                className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-2xl font-bold text-white outline-none focus:border-pink-500 transition-all aria-invalid:border-red-500"
                placeholder="Ej: María López"
                aria-required="true"
                aria-describedby={errors.nombreCliente ? 'error-nombre' : undefined}
              />
              {errors.nombreCliente && (
                <p
                  id="error-nombre"
                  role="alert"
                  className="mt-2 ml-2 text-red-400 text-xs font-bold"
                >
                  {errors.nombreCliente.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="telefonoCliente"
                className="block text-[10px] font-black text-pink-400 uppercase tracking-widest mb-3 ml-2"
              >
                Teléfono Celular{' '}
                <span className="text-red-500 text-sm" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="telefonoCliente"
                type="tel"
                {...register('telefonoCliente')}
                onInput={(evento) => {
                  evento.currentTarget.value = limpiarTelefonoEntrada(evento.currentTarget.value);
                }}
                className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-2xl font-bold text-white outline-none focus:border-pink-500 transition-all"
                placeholder="Ej: 5512345678"
                aria-required="true"
                aria-describedby={errors.telefonoCliente ? 'error-telefono' : undefined}
              />
              {errors.telefonoCliente && (
                <p
                  id="error-telefono"
                  role="alert"
                  className="mt-2 ml-2 text-red-400 text-xs font-bold"
                >
                  {errors.telefonoCliente.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label
                htmlFor="fechaNacimiento"
                className="block text-[10px] font-black text-pink-400 uppercase tracking-widest mb-3 ml-2"
              >
                Fecha de Nacimiento{' '}
                <span className="text-red-500 text-sm" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="fechaNacimiento"
                type="date"
                {...registroFechaNacimiento}
                value={fechaNacimientoValor ?? ''}
                min="1926-01-01"
                max={new Date().toISOString().split('T')[0]}
                onChange={(evento) => {
                  registroFechaNacimiento.onChange(evento);
                  setValue('fechaNacimiento', evento.target.value, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  });
                }}
                className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-4 text-sm font-bold text-white outline-none transition-all focus:ring-2 focus:ring-pink-500 aria-invalid:border-red-500"
                aria-required="true"
                aria-invalid={errors.fechaNacimiento ? 'true' : 'false'}
                aria-describedby={
                  errors.fechaNacimiento
                    ? 'error-fecha-nacimiento'
                    : esMenor
                      ? 'aviso-menor'
                      : undefined
                }
              />
              {errors.fechaNacimiento && (
                <p
                  id="error-fecha-nacimiento"
                  role="alert"
                  className="mt-2 ml-2 text-red-400 text-xs font-bold"
                >
                  {errors.fechaNacimiento.message}
                </p>
              )}
              {esMenor && !errors.fechaNacimiento && (
                <p
                  id="aviso-menor"
                  className="mt-3 px-4 py-3 bg-yellow-900/40 border border-yellow-700/60 rounded-xl text-yellow-300 text-xs font-bold flex items-start gap-2"
                >
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  Cliente menor de edad. Al confirmar, el salón quedará informado de que se requiere
                  acompañante adulto el día de la cita.
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="email"
                className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2"
              >
                Correo Electrónico{' '}
                <span className="text-slate-600 text-[9px] normal-case">(opcional)</span>
              </label>
              <input
                id="email"
                type="email"
                {...register('email')}
                className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-2xl font-bold text-white outline-none focus:border-pink-500 transition-all"
                placeholder="Ej: maria@gmail.com"
                aria-describedby={errors.email ? 'error-email' : undefined}
              />
              {errors.email && (
                <p
                  id="error-email"
                  role="alert"
                  className="mt-2 ml-2 text-red-400 text-xs font-bold"
                >
                  {errors.email.message}
                </p>
              )}
            </div>
          </div>

          {consultandoFidelidad && (
            <div className="px-5 py-4 rounded-2xl bg-slate-800 border border-slate-700 text-sm text-slate-300 font-bold">
              Consultando tus beneficios de fidelidad...
            </div>
          )}

          {fidelidadCliente?.recompensaDisponible && (
            <div className="px-5 py-4 rounded-2xl bg-emerald-950/40 border border-emerald-700/60 text-emerald-200">
              <div className="flex items-start gap-3">
                <Gift className="w-5 h-5 mt-0.5 shrink-0" aria-hidden="true" />
                <div className="flex-1">
                  <p className="text-sm font-black">
                    🎁 Tienes una recompensa disponible: {fidelidadCliente.descripcionRecompensa}.
                    ¿Deseas usarla en esta reserva?
                  </p>
                  <button
                    type="button"
                    onClick={() => setUsarRecompensa((valorActual) => !valorActual)}
                    className={`mt-3 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-colors ${usarRecompensa ? 'bg-emerald-400 text-emerald-950' : 'bg-emerald-900 text-emerald-100 hover:bg-emerald-800'}`}
                  >
                    {usarRecompensa ? 'Recompensa aplicada' : 'Sí, usar recompensa'}
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-700 bg-slate-800/80 px-5 py-4 text-sm text-slate-200">
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-pink-400">
              Resumen
            </p>
            <p className="mt-2 font-bold text-white">{estudio.name}</p>
            <p className="mt-1 text-slate-300">
              Sede: {flujo.sucursalSeleccionada || estudio.branches[0] || 'Principal'}
            </p>
          </div>

          <div>
            <label
              htmlFor="observaciones"
              className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2"
            >
              Notas <span className="text-slate-600 text-[9px] normal-case">(opcional)</span>
            </label>
            <textarea
              id="observaciones"
              rows={3}
              maxLength={240}
              placeholder="Alergias, preferencias o una indicación breve..."
              {...register('observaciones')}
              className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-2xl font-bold text-white outline-none focus:border-pink-500 transition-all resize-none"
            />
            <p className="mt-2 ml-2 text-[11px] text-slate-400">
              {(watch('observaciones') ?? '').length}/240 caracteres
            </p>
            {errors.observaciones && (
              <p className="mt-2 ml-2 text-red-400 text-xs font-bold">
                {errors.observaciones.message}
              </p>
            )}
          </div>
        </div>

        <button
          type="submit"
          disabled={!formularioValido}
          className="w-full bg-pink-600 text-white font-black py-5 md:py-6 rounded-4xl shadow-xl shadow-pink-900/50 hover:bg-pink-500 transition-all uppercase tracking-widest text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
        >
          Confirmar reserva
        </button>
        <p className="mt-4 text-center text-xs font-bold uppercase tracking-widest text-slate-300">
          Pago en el salón al llegar a tu cita. No se realiza ningún cobro en línea.
        </p>
      </form>
    </section>
  );
}
