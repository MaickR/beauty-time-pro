import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, CalendarDays } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { SelectorFecha } from '../../../componentes/ui/SelectorFecha';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { DIAS_SEMANA } from '../../../lib/constantes';
import { crearReserva, obtenerDisponibilidadEstudio } from '../../../servicios/servicioReservas';
import { obtenerFechaLocalISO, formatearDinero } from '../../../utils/formato';
import type { Estudio, Moneda, Servicio } from '../../../tipos';

const esquemaFormulario = z.object({
  nombreCliente: z.string().min(2, 'Mínimo 2 caracteres'),
  telefonoCliente: z.string().regex(/^[0-9]{10}$/, '10 dígitos sin espacios'),
  fechaNacimiento: z.string().min(1, 'Selecciona una fecha'),
  email: z.string().email('Correo inválido').or(z.literal('')),
  sucursal: z.string().optional(),
  marcaTinte: z.string().optional(),
});

type DatosFormulario = z.infer<typeof esquemaFormulario>;

interface PropsModalCrearReservaManual {
  abierto: boolean;
  estudio: Estudio;
  fechaVista: Date;
  onCerrar: () => void;
  onReservaCreada: () => void;
}

const PALABRAS_COLOR = [
  'tinte',
  'color',
  'balayage',
  'babylights',
  'canas',
  'ombré',
  'decoloración',
  'rayitos',
  'mechas',
];

export function ModalCrearReservaManual({
  abierto,
  estudio,
  fechaVista,
  onCerrar,
  onReservaCreada,
}: PropsModalCrearReservaManual) {
  const { mostrarToast } = usarToast();
  const [personalSeleccionado, setPersonalSeleccionado] = useState('');
  const [serviciosSeleccionados, setServiciosSeleccionados] = useState<Servicio[]>([]);
  const [horaSeleccionada, setHoraSeleccionada] = useState('');
  const moneda: Moneda = estudio.country === 'Colombia' ? 'COP' : 'MXN';
  const fechaStr = obtenerFechaLocalISO(fechaVista);
  const miembro = estudio.staff.find((item) => item.id === personalSeleccionado);
  const serviciosDisponibles = personalSeleccionado
    ? estudio.selectedServices.filter((servicio) => miembro?.specialties.includes(servicio.name))
    : [];
  const totalDuracion = serviciosSeleccionados.reduce(
    (total, servicio) => total + servicio.duration,
    0,
  );
  const totalPrecio = serviciosSeleccionados.reduce((total, servicio) => total + servicio.price, 0);
  const nombreDia = DIAS_SEMANA[fechaVista.getDay()]!;
  const horarioDia = estudio.schedule[nombreDia];
  const esFestivo = estudio.holidays?.includes(fechaStr) ?? false;
  const duracionConsulta = totalDuracion > 0 ? totalDuracion : 30;
  const consultaDisponibilidad = useQuery({
    queryKey: [
      'disponibilidad-estudio',
      estudio.id,
      personalSeleccionado,
      fechaStr,
      duracionConsulta,
    ],
    queryFn: () =>
      obtenerDisponibilidadEstudio(estudio.id, personalSeleccionado, fechaStr, duracionConsulta),
    enabled: Boolean(miembro && horarioDia?.isOpen && !esFestivo),
    staleTime: 30_000,
  });
  const slotsDisponibles = (consultaDisponibilidad.data ?? []).filter(
    (slot) => slot.status === 'AVAILABLE',
  );

  const formulario = useForm<DatosFormulario>({
    resolver: zodResolver(esquemaFormulario),
    defaultValues: {
      nombreCliente: '',
      telefonoCliente: '',
      fechaNacimiento: '',
      email: '',
      sucursal: estudio.branches[0] ?? '',
      marcaTinte: '',
    },
  });

  const requiereColor = serviciosSeleccionados.some((servicio) =>
    PALABRAS_COLOR.some((palabra) => servicio.name.toLowerCase().includes(palabra)),
  );

  const mutacionCrear = useMutation({
    mutationFn: async (datos: DatosFormulario) => {
      await crearReserva({
        studioId: estudio.id,
        studioName: estudio.name,
        clientName: datos.nombreCliente,
        clientPhone: datos.telefonoCliente,
        fechaNacimiento: datos.fechaNacimiento,
        email: datos.email,
        services: serviciosSeleccionados,
        totalDuration: totalDuracion,
        totalPrice: totalPrecio,
        status: 'confirmed',
        branch: datos.sucursal ?? '',
        staffId: personalSeleccionado,
        staffName: miembro?.name ?? '',
        colorBrand: requiereColor ? datos.marcaTinte || null : null,
        colorNumber: null,
        date: fechaStr,
        time: horaSeleccionada,
        createdAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      mostrarToast({ mensaje: 'Cita creada correctamente', variante: 'exito' });
      formulario.reset({
        nombreCliente: '',
        telefonoCliente: '',
        fechaNacimiento: '',
        email: '',
        sucursal: estudio.branches[0] ?? '',
        marcaTinte: '',
      });
      setPersonalSeleccionado('');
      setServiciosSeleccionados([]);
      setHoraSeleccionada('');
      onReservaCreada();
      onCerrar();
    },
    onError: (error: unknown) => {
      mostrarToast({
        mensaje: error instanceof Error ? error.message : 'No se pudo crear la cita',
        variante: 'error',
      });
    },
  });

  function alternarServicio(servicio: Servicio) {
    setServiciosSeleccionados((actuales) => {
      const existe = actuales.some((item) => item.name === servicio.name);
      return existe
        ? actuales.filter((item) => item.name !== servicio.name)
        : [...actuales, servicio];
    });
    setHoraSeleccionada('');
  }

  function cambiarPersonal(personalId: string) {
    setPersonalSeleccionado(personalId);
    setServiciosSeleccionados((actuales) => {
      const miembroSiguiente = estudio.staff.find((item) => item.id === personalId);
      if (!miembroSiguiente) return [];

      return actuales.filter((servicio) => miembroSiguiente.specialties.includes(servicio.name));
    });
    setHoraSeleccionada('');
  }

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-210 bg-slate-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-crear-cita"
    >
      <div className="mx-auto flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-4xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 id="titulo-crear-cita" className="text-xl font-black text-slate-900">
              Crear cita manual
            </h2>
            <p className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-500">
              <CalendarDays className="h-4 w-4 text-pink-500" aria-hidden="true" />
              {fechaVista.toLocaleDateString('es-MX', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar modal"
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form
          onSubmit={formulario.handleSubmit((datos) => mutacionCrear.mutate(datos))}
          className="grid gap-6 overflow-y-auto px-6 py-6 md:grid-cols-[1.1fr_0.9fr]"
        >
          <div className="space-y-5">
            <div>
              <label
                htmlFor="personal-manual"
                className="mb-1 block text-xs font-bold uppercase text-slate-500"
              >
                Especialista
              </label>
              <select
                id="personal-manual"
                value={personalSeleccionado}
                onChange={(evento) => cambiarPersonal(evento.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-400"
              >
                <option value="">Selecciona un especialista</option>
                {estudio.staff
                  .filter((item) => item.active)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase text-slate-500">Servicios</p>
              {serviciosDisponibles.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-400">
                  Selecciona primero un especialista.
                </p>
              ) : (
                <div className="grid gap-2">
                  {serviciosDisponibles.map((servicio) => {
                    const activo = serviciosSeleccionados.some(
                      (item) => item.name === servicio.name,
                    );
                    return (
                      <button
                        key={servicio.name}
                        type="button"
                        onClick={() => alternarServicio(servicio)}
                        className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${activo ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-slate-200 bg-white text-slate-700 hover:border-pink-200'}`}
                      >
                        <span className="font-bold">{servicio.name}</span>
                        <span className="text-xs font-black">
                          {formatearDinero(servicio.price, moneda)} · {servicio.duration} min
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase text-slate-500">Horario disponible</p>
              {!horarioDia?.isOpen || esFestivo ? (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-400">
                  El salón no recibe citas en esta fecha.
                </p>
              ) : serviciosSeleccionados.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-400">
                  Selecciona servicios para ver horarios disponibles.
                </p>
              ) : consultaDisponibilidad.isLoading ? (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-400">
                  Consultando horarios disponibles...
                </p>
              ) : slotsDisponibles.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-400">
                  No hay horarios disponibles para la combinación seleccionada.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {slotsDisponibles.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      onClick={() => setHoraSeleccionada(slot.time)}
                      className={`rounded-xl px-4 py-2 text-sm font-black transition-colors ${horaSeleccionada === slot.time ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-pink-50 p-4 border border-pink-200">
              <p className="text-xs font-bold uppercase tracking-widest text-pink-600">Resumen</p>
              <p className="mt-2 text-sm font-medium text-slate-700">
                {serviciosSeleccionados.length} servicio(s) · {totalDuracion} min
              </p>
              <p className="mt-1 text-2xl font-black text-pink-700">
                {formatearDinero(totalPrecio, moneda)}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="nombreCliente"
                className="mb-1 block text-xs font-bold uppercase text-slate-500"
              >
                Nombre del cliente
              </label>
              <input
                id="nombreCliente"
                type="text"
                {...formulario.register('nombreCliente')}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
              {formulario.formState.errors.nombreCliente && (
                <p className="mt-1 text-xs text-red-500">
                  {formulario.formState.errors.nombreCliente.message}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="telefonoCliente"
                className="mb-1 block text-xs font-bold uppercase text-slate-500"
              >
                Teléfono
              </label>
              <input
                id="telefonoCliente"
                type="tel"
                {...formulario.register('telefonoCliente')}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
              {formulario.formState.errors.telefonoCliente && (
                <p className="mt-1 text-xs text-red-500">
                  {formulario.formState.errors.telefonoCliente.message}
                </p>
              )}
            </div>
            <div>
              <input type="hidden" {...formulario.register('fechaNacimiento')} />
              <SelectorFecha
                etiqueta="Fecha de nacimiento"
                valor={formulario.watch('fechaNacimiento') ?? ''}
                max={new Date().toISOString().split('T')[0]}
                error={formulario.formState.errors.fechaNacimiento?.message}
                alCambiar={(valor) =>
                  formulario.setValue('fechaNacimiento', valor, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  })
                }
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-xs font-bold uppercase text-slate-500"
              >
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                {...formulario.register('email')}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
              {formulario.formState.errors.email && (
                <p className="mt-1 text-xs text-red-500">
                  {formulario.formState.errors.email.message}
                </p>
              )}
            </div>
            {estudio.branches.length > 1 && (
              <div>
                <label
                  htmlFor="sucursal"
                  className="mb-1 block text-xs font-bold uppercase text-slate-500"
                >
                  Sucursal
                </label>
                <select
                  id="sucursal"
                  {...formulario.register('sucursal')}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                >
                  {estudio.branches.map((sucursal) => (
                    <option key={sucursal} value={sucursal}>
                      {sucursal}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {requiereColor && (
              <div>
                <label
                  htmlFor="marcaTinte"
                  className="mb-1 block text-xs font-bold uppercase text-slate-500"
                >
                  Color o tono solicitado (opcional)
                </label>
                <input
                  id="marcaTinte"
                  type="text"
                  placeholder="Ej: rubio ceniza, tinte 7.1"
                  {...formulario.register('marcaTinte')}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                />
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onCerrar}
                className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 transition-colors hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={
                  mutacionCrear.isPending ||
                  !personalSeleccionado ||
                  !horaSeleccionada ||
                  serviciosSeleccionados.length === 0
                }
                className="flex-1 rounded-2xl bg-pink-600 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {mutacionCrear.isPending ? 'Guardando...' : 'Crear cita'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
