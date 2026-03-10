import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Palette, AlertTriangle, Gift } from 'lucide-react';
import { buscarClienteFidelidadPorTelefono, type EstadoFidelidadCliente } from '../../../servicios/servicioFidelidad';
import type { Estudio } from '../../../tipos';
import type { usarFlujoReserva } from '../hooks/usarFlujoReserva';

const esquema = z.object({
  nombreCliente: z.string().min(3, 'Mínimo 3 caracteres'),
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
    .email('Correo electrónico inválido')
    .or(z.literal(''))
    .optional(),
});

type CamposContacto = z.infer<typeof esquema>;

type DatosEnvioContacto = CamposContacto & { usarRecompensa?: boolean };

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

export function FormularioContacto({ estudio, flujo, requiereColor, onEnviar }: PropsFormularioContacto) {
  const [fidelidadCliente, setFidelidadCliente] = useState<EstadoFidelidadCliente | null>(null);
  const [consultandoFidelidad, setConsultandoFidelidad] = useState(false);
  const [usarRecompensa, setUsarRecompensa] = useState(false);
  const {
    register,
    handleSubmit,
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
  const esMenor = fechaNacimientoValor && !errors.fechaNacimiento
    ? calcularEdad(fechaNacimientoValor) < 18
    : false;

  // Sincronizar cambios con el flujo para que enviarReserva tenga los valores
  const valores = watch();
  useEffect(() => {
    flujo.actualizarContacto('nombreCliente', valores.nombreCliente ?? '');
    flujo.actualizarContacto('telefonoCliente', valores.telefonoCliente ?? '');
    flujo.actualizarContacto('fechaNacimiento', valores.fechaNacimiento ?? '');
    flujo.actualizarContacto('email', valores.email ?? '');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valores.nombreCliente, valores.telefonoCliente, valores.fechaNacimiento, valores.email]);

  const formularioValido =
    flujo.personalSeleccionado &&
    flujo.horaSeleccionada &&
    flujo.serviciosSeleccionados.length > 0;

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
    <section className="bg-slate-900 rounded-[3.5rem] p-10 shadow-2xl flex flex-col text-white">
      <h3 className="text-xl md:text-2xl font-black italic uppercase tracking-tighter mb-8 flex items-center gap-3">
        <span className="bg-pink-600 text-white w-8 h-8 rounded-full flex items-center justify-center text-sm" aria-hidden="true">4</span>
        Tus Datos de Contacto
      </h3>

      {requiereColor && (
        <div className="bg-pink-950/40 p-6 rounded-3xl border border-pink-900/50 mb-8">
          <p className="text-[10px] font-black text-pink-400 uppercase tracking-widest mb-4 flex items-center gap-2">
            <Palette className="w-4 h-4" aria-hidden="true" /> Detalles de tu Coloración (Opcional)
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="marcaTinte" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">Marca de Tinte Preferida</label>
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
              <label htmlFor="numeroTinte" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-2">Número / Tono del Tinte</label>
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

      {/* eslint-disable-next-line @typescript-eslint/no-misused-promises */}
      <form onSubmit={handleSubmit((datos) => onEnviar({ ...datos, usarRecompensa }))} noValidate>
        <div className="space-y-6 mb-10">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="nombreCliente" className="block text-[10px] font-black text-pink-400 uppercase tracking-widest mb-3 ml-2">
                Nombre Completo <span className="text-red-500 text-sm" aria-hidden="true">*</span>
              </label>
              <input
                id="nombreCliente"
                type="text"
                {...register('nombreCliente')}
                className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-2xl font-bold text-white outline-none focus:border-pink-500 transition-all aria-invalid:border-red-500"
                placeholder="Ej: María López"
                aria-required="true"
                aria-describedby={errors.nombreCliente ? 'error-nombre' : undefined}
              />
              {errors.nombreCliente && (
                <p id="error-nombre" role="alert" className="mt-2 ml-2 text-red-400 text-xs font-bold">
                  {errors.nombreCliente.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="telefonoCliente" className="block text-[10px] font-black text-pink-400 uppercase tracking-widest mb-3 ml-2">
                Teléfono Celular <span className="text-red-500 text-sm" aria-hidden="true">*</span>
              </label>
              <input
                id="telefonoCliente"
                type="tel"
                {...register('telefonoCliente')}
                className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-2xl font-bold text-white outline-none focus:border-pink-500 transition-all"
                placeholder="Ej: 5512345678"
                aria-required="true"
                aria-describedby={errors.telefonoCliente ? 'error-telefono' : undefined}
              />
              {errors.telefonoCliente && (
                <p id="error-telefono" role="alert" className="mt-2 ml-2 text-red-400 text-xs font-bold">
                  {errors.telefonoCliente.message}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label htmlFor="fechaNacimiento" className="block text-[10px] font-black text-pink-400 uppercase tracking-widest mb-3 ml-2">
                Fecha de Nacimiento <span className="text-red-500 text-sm" aria-hidden="true">*</span>
              </label>
              <input
                id="fechaNacimiento"
                type="date"
                {...register('fechaNacimiento')}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-2xl font-bold text-white outline-none focus:border-pink-500 transition-all"
                aria-required="true"
                aria-describedby={errors.fechaNacimiento ? 'error-fecha' : esMenor ? 'aviso-menor' : undefined}
              />
              {errors.fechaNacimiento && (
                <p id="error-fecha" role="alert" className="mt-2 ml-2 text-red-400 text-xs font-bold">
                  {errors.fechaNacimiento.message}
                </p>
              )}
              {esMenor && !errors.fechaNacimiento && (
                <p id="aviso-menor" className="mt-3 px-4 py-3 bg-yellow-900/40 border border-yellow-700/60 rounded-xl text-yellow-300 text-xs font-bold flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                  Cliente menor de edad. Al confirmar, el salón quedará informado de que se requiere acompañante adulto el día de la cita.
                </p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">
                Correo Electrónico <span className="text-slate-600 text-[9px] normal-case">(opcional)</span>
              </label>
              <input
                id="email"
                type="email"
                {...register('email')}
                className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-2xl font-bold text-white outline-none focus:border-pink-500 transition-all"
                placeholder="Ej: maria@correo.com"
                aria-describedby={errors.email ? 'error-email' : undefined}
              />
              {errors.email && (
                <p id="error-email" role="alert" className="mt-2 ml-2 text-red-400 text-xs font-bold">
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
                    🎁 Tienes una recompensa disponible: {fidelidadCliente.descripcionRecompensa}. ¿Deseas usarla en esta reserva?
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

          {estudio.branches.length > 1 && (
            <div>
              <label htmlFor="sucursalSelect" className="block text-[10px] font-black text-pink-400 uppercase tracking-widest mb-3 ml-2">
                Elige tu Sucursal <span className="text-red-500 text-sm" aria-hidden="true">*</span>
              </label>
              <select
                id="sucursalSelect"
                className="w-full px-6 py-4 bg-slate-800 border border-slate-700 rounded-2xl font-bold text-white outline-none focus:border-pink-500 appearance-none"
                value={flujo.sucursalSeleccionada}
                onChange={(e) => flujo.seleccionarSucursal(e.target.value)}
              >
                {estudio.branches.map((b, i) => <option key={i} value={b}>{b}</option>)}
              </select>
            </div>
          )}
        </div>

        <button
          type="submit"
          disabled={!formularioValido}
          className="w-full bg-pink-600 text-white font-black py-6 md:py-8 rounded-[2.5rem] shadow-xl shadow-pink-900/50 hover:bg-pink-500 transition-all uppercase tracking-widest text-sm md:text-base disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
        >
          Confirmar mi Reservación
        </button>
      </form>
    </section>
  );
}

