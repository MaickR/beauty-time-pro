import { useEffect, useMemo, useState } from 'react';
import { X, Eye, EyeOff, RefreshCw, Shield, KeyRound, CalendarClock, Mail } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  actualizarAccesoEmpleado,
  crearAccesoEmpleado,
} from '../../../servicios/servicioEmpleados';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { generarContrasenaColaborador } from '../../../utils/formularioSalon';
import type { EmpleadoAccesoInfo } from '../../../tipos';

interface PropsModalCrearAccesoEmpleado {
  estudioId: string;
  personalId: string;
  nombreEmpleado: string;
  abierto: boolean;
  accesoExistente?: EmpleadoAccesoInfo | null;
  activoPersonalInicial: boolean;
  desactivadoHastaInicial?: string | null;
  alCerrar: () => void;
}

export function ModalCrearAccesoEmpleado({
  estudioId,
  personalId,
  nombreEmpleado,
  abierto,
  accesoExistente = null,
  activoPersonalInicial,
  desactivadoHastaInicial = null,
  alCerrar,
}: PropsModalCrearAccesoEmpleado) {
  const [pestanaActiva, setPestanaActiva] = useState<'estado' | 'credenciales'>('estado');
  const [activoPersonal, setActivoPersonal] = useState(activoPersonalInicial);
  const [desactivarHasta, setDesactivarHasta] = useState<string>(desactivadoHastaInicial ?? '');
  const [email, setEmail] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const { mostrarToast } = usarToast();
  const queryClient = useQueryClient();
  const fechaMinima = useMemo(() => new Date().toISOString().slice(0, 10), []);

  useEffect(() => {
    if (!abierto) {
      return;
    }

    setPestanaActiva('estado');
    setActivoPersonal(accesoExistente?.personalActivo ?? activoPersonalInicial);
    setDesactivarHasta(accesoExistente?.desactivadoHasta ?? desactivadoHastaInicial ?? '');
    setEmail(accesoExistente?.email ?? '');
    setContrasena('');
    setMostrarContrasena(false);
  }, [abierto, accesoExistente, activoPersonalInicial, desactivadoHastaInicial]);

  const { mutate: guardarCredenciales, isPending: guardandoCredenciales } = useMutation({
    mutationFn: () =>
      crearAccesoEmpleado(estudioId, personalId, {
        email,
        contrasena,
        forzarCambioContrasena: false,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['acceso-empleado', personalId] }),
        queryClient.invalidateQueries({ queryKey: ['personal-estudio', estudioId] }),
      ]);

      mostrarToast(
        accesoExistente
          ? `Credenciales actualizadas y enviadas a ${email}`
          : `Acceso creado y enviado a ${email}`,
      );
      setContrasena('');
      alCerrar();
    },
    onError: (error: Error) => {
      mostrarToast({ mensaje: error.message ?? 'No se pudo guardar el acceso', variante: 'error' });
    },
  });

  const { mutate: guardarEstado, isPending: guardandoEstado } = useMutation({
    mutationFn: () =>
      actualizarAccesoEmpleado(estudioId, personalId, {
        activo: activoPersonal,
        desactivarHasta: activoPersonal ? null : desactivarHasta,
      }),
    onSuccess: async (datos) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['acceso-empleado', personalId] }),
        queryClient.invalidateQueries({ queryKey: ['personal-estudio', estudioId] }),
      ]);

      setActivoPersonal(datos?.personalActivo ?? activoPersonal);
      setDesactivarHasta(datos?.desactivadoHasta ?? (activoPersonal ? '' : desactivarHasta));
      mostrarToast(
        activoPersonal
          ? 'Especialista reactivado correctamente'
          : desactivarHasta
            ? `Especialista suspendido hasta ${desactivarHasta}`
            : 'Especialista suspendido correctamente',
      );
      alCerrar();
    },
    onError: (error: Error) => {
      mostrarToast({
        mensaje: error.message ?? 'No se pudo actualizar el estado',
        variante: 'error',
      });
    },
  });

  const manejarGenerarContrasena = () => {
    setContrasena(generarContrasenaColaborador(nombreEmpleado, email || 'empleado@beautytime.pro'));
    setMostrarContrasena(true);
  };

  const manejarGuardarCredenciales = (evento: React.FormEvent) => {
    evento.preventDefault();

    if (!email.trim()) {
      mostrarToast({ mensaje: 'Escribe el correo del especialista', variante: 'error' });
      return;
    }

    if (!contrasena.trim()) {
      mostrarToast({
        mensaje: 'Define una nueva contraseña para guardar los cambios',
        variante: 'error',
      });
      return;
    }

    guardarCredenciales();
  };

  const manejarGuardarEstado = () => {
    if (!activoPersonal && !desactivarHasta) {
      mostrarToast({
        mensaje: 'Selecciona la fecha hasta la que quedará suspendido',
        variante: 'error',
      });
      return;
    }

    guardarEstado();
  };

  const estaSuspendidoProgramado = !activoPersonal && Boolean(desactivarHasta);
  const pestañas = [
    { id: 'estado', etiqueta: 'Estado', icono: CalendarClock },
    { id: 'credenciales', etiqueta: 'Acceso', icono: KeyRound },
  ] as const;

  if (!abierto) {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-acceso"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      onKeyDown={(evento) => {
        if (evento.key === 'Escape') {
          alCerrar();
        }
      }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-4xl border border-slate-200 bg-white shadow-2xl">
        <div className="border-b border-slate-100 bg-linear-to-r from-slate-950 via-slate-900 to-pink-700 px-6 py-5 text-white sm:px-8">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-pink-100">
                Seguridad del especialista
              </p>
              <h2 id="titulo-modal-acceso" className="text-xl font-black tracking-tight text-white">
                {nombreEmpleado}
              </h2>
              <p className="text-sm text-pink-50/80">
                Gestiona el estado laboral y las credenciales de acceso desde un solo lugar.
              </p>
            </div>

            <button
              type="button"
              aria-label="Cerrar modal"
              onClick={alCerrar}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition hover:bg-white/20"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="border-b border-slate-100 px-4 py-3 sm:px-6">
          <div className="grid grid-cols-2 gap-2 rounded-2xl bg-slate-100 p-1">
            {pestañas.map(({ id, etiqueta, icono: Icono }) => {
              const activa = pestanaActiva === id;

              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={activa}
                  onClick={() => setPestanaActiva(id)}
                  className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-black transition-colors ${activa ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                >
                  <Icono className="h-4 w-4" aria-hidden="true" />
                  {etiqueta}
                </button>
              );
            })}
          </div>
        </div>

        <div className="p-4 sm:p-6">
          {pestanaActiva === 'estado' ? (
            <div className="space-y-5">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="space-y-2">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-widest text-slate-500">
                      <Shield className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" />
                      {activoPersonal ? 'Activo' : 'Suspendido'}
                    </div>
                    <p className="text-sm font-semibold text-slate-900">
                      {estaSuspendidoProgramado
                        ? `Este especialista volverá a activarse automáticamente después del ${desactivarHasta}.`
                        : activoPersonal
                          ? 'El especialista puede trabajar, iniciar sesión y recibir agendamientos.'
                          : 'El especialista está suspendido y no podrá operar en ningún flujo del salón.'}
                    </p>
                    <p className="text-sm text-slate-500">
                      La suspensión afecta agenda, acceso y disponibilidad en todo el sistema.
                    </p>
                  </div>

                  {!activoPersonal && (
                    <button
                      type="button"
                      onClick={() => {
                        setActivoPersonal(true);
                        setDesactivarHasta('');
                      }}
                      className="inline-flex items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-black text-emerald-700 transition hover:bg-emerald-100"
                    >
                      Reactivar ahora
                    </button>
                  )}
                </div>
              </div>

              <div className="rounded-3xl border border-slate-200 bg-white p-5">
                <label
                  htmlFor="desactivar-hasta"
                  className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-500"
                >
                  Desactivar hasta
                </label>
                <input
                  id="desactivar-hasta"
                  type="date"
                  min={fechaMinima}
                  value={desactivarHasta}
                  onChange={(evento) => {
                    setDesactivarHasta(evento.target.value);
                    setActivoPersonal(false);
                  }}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
                />
                <p className="mt-2 text-xs text-slate-500">
                  Al llegar el día siguiente, el especialista se reactiva automáticamente en el
                  sistema.
                </p>
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={alCerrar}
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={manejarGuardarEstado}
                  disabled={guardandoEstado}
                  className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white transition hover:bg-black disabled:opacity-60"
                >
                  {guardandoEstado
                    ? 'Guardando…'
                    : activoPersonal
                      ? 'Guardar reactivación'
                      : 'Guardar suspensión'}
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={manejarGuardarCredenciales} className="space-y-5">
              <div className="grid gap-4 lg:grid-cols-2">
                <div>
                  <label
                    htmlFor="email-acceso"
                    className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-500"
                  >
                    Correo de acceso
                  </label>
                  <div className="relative">
                    <Mail
                      className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      id="email-acceso"
                      type="email"
                      value={email}
                      onChange={(evento) => setEmail(evento.target.value)}
                      autoComplete="off"
                      placeholder="empleado@salon.com"
                      className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4 text-sm outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="contrasena-acceso"
                    className="mb-2 block text-xs font-black uppercase tracking-widest text-slate-500"
                  >
                    Contraseña
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <input
                        id="contrasena-acceso"
                        type={mostrarContrasena ? 'text' : 'password'}
                        value={contrasena}
                        onChange={(evento) => setContrasena(evento.target.value)}
                        autoComplete="new-password"
                        placeholder="Define una contraseña segura"
                        className="w-full rounded-2xl border border-slate-200 px-4 py-3 pr-10 text-sm outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
                      />
                      <button
                        type="button"
                        aria-label={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                        onClick={() => setMostrarContrasena((valorActual) => !valorActual)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                      >
                        {mostrarContrasena ? (
                          <EyeOff className="h-4 w-4" aria-hidden="true" />
                        ) : (
                          <Eye className="h-4 w-4" aria-hidden="true" />
                        )}
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={manejarGenerarContrasena}
                      className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-700 transition hover:bg-slate-100"
                    >
                      <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                      Generar
                    </button>
                  </div>
                </div>
              </div>

              <div className="rounded-3xl border border-blue-100 bg-blue-50 p-5 text-sm text-blue-900">
                Al guardar, se actualizan las credenciales en tiempo real y se envía un correo al
                especialista con su correo, nueva contraseña y enlace de acceso.
              </div>

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={alCerrar}
                  className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={guardandoCredenciales}
                  className="rounded-2xl bg-pink-600 px-5 py-3 text-sm font-black text-white transition hover:bg-pink-700 disabled:opacity-60"
                >
                  {guardandoCredenciales
                    ? 'Guardando…'
                    : accesoExistente
                      ? 'Actualizar acceso'
                      : 'Crear acceso'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
