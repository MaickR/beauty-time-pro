import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { AlertTriangle, Gift } from 'lucide-react';
import {
  buscarClienteFidelidadPorTelefono,
  type EstadoFidelidadCliente,
} from '../../../servicios/servicioFidelidad';
import {
  esEmailSalonValido,
  limpiarNombrePersonaEntrada,
  limpiarTelefonoEntrada,
} from '../../../utils/formularioSalon';
import { esCumpleanosActualValido } from '../../../lib/registroCliente';
import type { Estudio } from '../../../tipos';
import type { usarFlujoReserva } from '../hooks/usarFlujoReserva';
import {
  obtenerClaveServicioReserva,
  obtenerSeccionDetalleServicio,
} from '../utils/detallesServicios';

const esquema = z.object({
  nombreCliente: z
    .string()
    .min(3, 'Mínimo 3 caracteres')
    .regex(/^[\p{L}\p{M}\s'’-]+$/u, 'Ingresa letras, espacios, apóstrofes y guiones válidos'),
  telefonoCliente: z.string().regex(/^[0-9]{10}$/, '10 dígitos sin espacios ni guiones'),
  fechaNacimiento: z
    .string()
    .min(1, 'La fecha de cumpleaños es requerida')
    .refine((v) => {
      if (esCumpleanosActualValido(v)) {
        return true;
      }
      const d = new Date(v);
      return !isNaN(d.getTime()) && d <= new Date();
    }, 'No puede ser una fecha futura')
    .refine((v) => {
      if (esCumpleanosActualValido(v)) {
        return true;
      }
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
  metodoPago: z.enum(['cash', 'card', 'bank_transfer', 'digital_transfer']),
  observaciones: z
    .string()
    .max(240, 'Máximo 240 caracteres')
    .regex(
      /^[\p{L}\p{M}\p{N}\s.,:;()¿?¡!'"%/#&+\-–—]*$/u,
      'Usa letras, números y signos comunes del español',
    )
    .optional(),
});

type CamposContacto = z.infer<typeof esquema>;

type DatosEnvioContacto = CamposContacto & { usarRecompensa?: boolean; observaciones?: string };

const METODOS_PAGO = [
  { valor: 'cash', etiqueta: 'Efectivo' },
  { valor: 'card', etiqueta: 'Tarjeta' },
  { valor: 'bank_transfer', etiqueta: 'Transferencia bancaria' },
  { valor: 'digital_transfer', etiqueta: 'Transferencia digital' },
] as const;

interface PropsFormularioContacto {
  estudio: Estudio;
  flujo: ReturnType<typeof usarFlujoReserva>;
  onEnviar: (datos: DatosEnvioContacto) => void;
}

function calcularEdad(fechaNacimiento: string): number | null {
  if (esCumpleanosActualValido(fechaNacimiento)) {
    return null;
  }
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
      metodoPago: flujo.metodoPago,
    },
  });

  const fechaNacimientoValor = watch('fechaNacimiento');
  const registroFechaNacimiento = register('fechaNacimiento');
  const edadCliente =
    fechaNacimientoValor && !errors.fechaNacimiento ? calcularEdad(fechaNacimientoValor) : null;
  const esMenor =
    edadCliente !== null ? edadCliente < 18 : false;
  const seccionesDetalleServicio = useMemo(
    () =>
      flujo.serviciosSeleccionados.map((servicio) => {
        const claveServicio = obtenerClaveServicioReserva(servicio);
        return {
          servicio,
          claveServicio,
          seccion: obtenerSeccionDetalleServicio(servicio),
          valores: flujo.detallesServicios[claveServicio] ?? {},
        };
      }),
    [flujo.detallesServicios, flujo.serviciosSeleccionados],
  );

  // Sincronizar cambios con el flujo para que enviarReserva tenga los valores
  const valores = watch();
  useEffect(() => {
    flujo.actualizarContacto('nombreCliente', valores.nombreCliente ?? '');
    flujo.actualizarContacto('telefonoCliente', valores.telefonoCliente ?? '');
    flujo.actualizarContacto('fechaNacimiento', valores.fechaNacimiento ?? '');
    flujo.actualizarContacto('email', valores.email ?? '');
    flujo.actualizarContacto('metodoPago', valores.metodoPago ?? 'cash');
  }, [
    valores.nombreCliente,
    valores.telefonoCliente,
    valores.fechaNacimiento,
    valores.email,
    valores.metodoPago,
  ]);

  useEffect(() => {
    setValue('nombreCliente', flujo.nombreCliente, { shouldDirty: false });
    setValue('telefonoCliente', flujo.telefonoCliente, { shouldDirty: false });
    setValue('fechaNacimiento', flujo.fechaNacimiento, { shouldDirty: false });
    setValue('email', flujo.email, { shouldDirty: false });
  }, [flujo.nombreCliente, flujo.telefonoCliente, flujo.fechaNacimiento, flujo.email, setValue]);

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

      {seccionesDetalleServicio.length > 0 && (
        <div className="mb-6 space-y-4">
          {seccionesDetalleServicio.map(({ servicio, claveServicio, seccion, valores }) => (
            <div
              key={claveServicio}
              className="rounded-3xl border border-pink-900/50 bg-pink-950/40 p-4 md:p-6"
            >
              <div className="mb-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-pink-400">
                  {servicio.name}
                </p>
                <h4 className="mt-2 text-sm font-black text-white md:text-base">{seccion.titulo}</h4>
                <p className="mt-1 text-xs text-slate-300">{seccion.descripcion}</p>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {seccion.campos.map((campo) => {
                  const valorActual = valores[campo.clave] ?? '';
                  const idCampo = `${claveServicio}-${campo.clave}`;

                  return (
                    <div key={campo.clave} className={campo.tipo === 'area' ? 'md:col-span-2' : ''}>
                      <label
                        htmlFor={idCampo}
                        className="mb-2 ml-2 block text-[10px] font-black uppercase tracking-widest text-slate-300"
                      >
                        {campo.etiqueta}
                      </label>
                      {campo.tipo === 'area' ? (
                        <textarea
                          id={idCampo}
                          rows={3}
                          maxLength={campo.maximo}
                          className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-medium text-white outline-none transition-all focus:border-pink-500"
                          placeholder={campo.placeholder}
                          value={valorActual}
                          onChange={(evento) =>
                            flujo.actualizarDetalleServicio(
                              claveServicio,
                              campo.clave,
                              evento.target.value.slice(0, campo.maximo),
                            )
                          }
                        />
                      ) : (
                        <input
                          id={idCampo}
                          type="text"
                          maxLength={campo.maximo}
                          className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm font-bold text-white outline-none transition-all focus:border-pink-500"
                          placeholder={campo.placeholder}
                          value={valorActual}
                          onChange={(evento) =>
                            flujo.actualizarDetalleServicio(
                              claveServicio,
                              campo.clave,
                              evento.target.value.slice(0, campo.maximo),
                            )
                          }
                        />
                      )}
                      <p className="mt-2 text-right text-[11px] font-semibold text-slate-400">
                        {valorActual.length}/{campo.maximo}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
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
                Fecha de Cumpleaños{' '}
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

          <div>
            <label
              htmlFor="metodoPago"
              className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2"
            >
              Método de pago
            </label>
            <select
              id="metodoPago"
              {...register('metodoPago')}
              className="w-full rounded-2xl border border-slate-700 bg-slate-800 px-6 py-4 font-bold text-white outline-none transition-all focus:border-pink-500"
            >
              {METODOS_PAGO.map((metodo) => (
                <option key={metodo.valor} value={metodo.valor}>
                  {metodo.etiqueta}
                </option>
              ))}
            </select>
            <p className="mt-2 ml-2 text-[11px] text-slate-400">
              El pago se realiza al llegar o al finalizar el servicio en el salón.
            </p>
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
              Salón: {flujo.sucursalSeleccionada || estudio.name || 'Principal'}
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
