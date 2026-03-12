import { Clock, Coffee, Users, CheckCircle2, XCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { SelectorHora } from '../../../componentes/ui/SelectorHora';
import { obtenerSlotsDisponibles } from '../../../utils/programacion';
import { actualizarPersonal } from '../../../servicios/servicioPersonal';
import { usarContextoApp } from '../../../contextos/ContextoApp';
import { FormularioNuevoPersonal } from './FormularioNuevoPersonal';
import type { Estudio, Reserva } from '../../../tipos';

interface PropsPanelPersonal {
  estudio: Estudio;
  reservas: Reserva[];
  fechaVista: Date;
}

function obtenerFechaLocalISO(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

export function PanelPersonal({ estudio, reservas, fechaVista }: PropsPanelPersonal) {
  const { recargar } = usarContextoApp();
  const [personalVisual, setPersonalVisual] = useState(estudio.staff);
  const [personalPendiente, setPersonalPendiente] = useState<string[]>([]);
  const fechaStr = obtenerFechaLocalISO(fechaVista);
  const diaSemana = fechaVista.toLocaleString('es-ES', { weekday: 'long' });
  const diaNombre = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
  const horarioDia = estudio.schedule?.[diaNombre];

  useEffect(() => {
    setPersonalVisual(estudio.staff);
  }, [estudio.staff]);

  const { mutate: guardarCambioPersonal } = useMutation({
    mutationFn: ({
      personalId,
      cambios,
    }: {
      personalId: string;
      cambios: Parameters<typeof actualizarPersonal>[1];
    }) => actualizarPersonal(personalId, cambios),
    onMutate: async ({ personalId, cambios }) => {
      setPersonalPendiente((actual) => Array.from(new Set([...actual, personalId])));
      const personalAnterior = personalVisual;
      setPersonalVisual((actual) =>
        actual.map((item) => (item.id === personalId ? { ...item, ...cambios } : item)),
      );
      return { personalAnterior, personalId };
    },
    onError: (_error, _variables, contexto) => {
      if (contexto?.personalAnterior) {
        setPersonalVisual(contexto.personalAnterior);
      }
    },
    onSuccess: (personalActualizado) => {
      setPersonalVisual((actual) =>
        actual.map((item) =>
          item.id === personalActualizado.id ? { ...item, ...personalActualizado } : item,
        ),
      );
    },
    onSettled: (_resultado, _error, variables) => {
      setPersonalPendiente((actual) => actual.filter((id) => id !== variables.personalId));
      recargar();
    },
  });

  const alternarEstado = (staffId: string, estadoActual: boolean) => {
    guardarCambioPersonal({ personalId: staffId, cambios: { active: !estadoActual } });
  };

  const alternarEspecialidad = (staffId: string, nombreEsp: string) => {
    const personal = personalVisual.find((item) => item.id === staffId);
    if (!personal) return;
    const tiene = personal.specialties.includes(nombreEsp);
    guardarCambioPersonal({
      personalId: staffId,
      cambios: {
        specialties: tiene
          ? personal.specialties.filter((especialidad) => especialidad !== nombreEsp)
          : [...personal.specialties, nombreEsp],
      },
    });
  };

  const actualizarHorario = (
    staffId: string,
    turnoInicio: string,
    turnoFin: string,
    descansoInicio: string,
    descansoFin: string,
  ) => {
    guardarCambioPersonal({
      personalId: staffId,
      cambios: {
        shiftStart: turnoInicio,
        shiftEnd: turnoFin,
        breakStart: descansoInicio,
        breakEnd: descansoFin,
      },
    });
  };

  const personalActivo = personalVisual.filter((st) => st.active);

  return (
    <div className="bg-white rounded-[3rem] p-6 md:p-8 border border-slate-200 shadow-sm">
      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2 flex items-center gap-2">
        <Users className="w-4 h-4 text-pink-600" /> Mi Personal
      </h3>
      <p className="text-[10px] text-slate-400 font-bold mb-6">
        Gestiona la disponibilidad, horarios, tratamientos y visualiza el mapa de hoy.
      </p>

      <div className="mb-6">
        <FormularioNuevoPersonal
          estudioId={estudio.id}
          serviciosDisponibles={estudio.selectedServices}
        />
      </div>

      <div className="space-y-4">
        {personalVisual.length === 0 && (
          <p className="text-sm text-slate-400 italic font-bold text-center py-8">
            No hay especialistas registrados. Agrega personal desde la configuración del studio.
          </p>
        )}
        {personalVisual.map((st) => {
          const estaGuardando = personalPendiente.includes(st.id);
          const reservasEspecialista = reservas.filter(
            (b) =>
              b.studioId === estudio.id &&
              b.staffId === st.id &&
              b.date === fechaStr &&
              b.status !== 'cancelled',
          );
          const slots = horarioDia
            ? obtenerSlotsDisponibles({
                horarioDia,
                miembro: st,
                reservasExistentes: reservasEspecialista,
                duracionSlot: 30,
                fechaStr,
              })
            : [];

          return (
            <div
              key={st.id}
              className={`rounded-4xl border p-5 transition-all duration-300 ${st.active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-80'} ${estaGuardando ? 'scale-[0.99] shadow-lg shadow-emerald-100' : ''}`}
            >
              <div className="flex justify-between items-center mb-4">
                <p className="font-black text-sm uppercase text-slate-900">{st.name}</p>
                <div className="flex items-center gap-3">
                  <span
                    className={`text-[10px] font-black uppercase tracking-widest transition-colors ${st.active ? 'text-emerald-600' : 'text-slate-400'}`}
                  >
                    {st.active ? 'Activo' : 'Inactivo'}
                  </span>
                  <button
                    type="button"
                    onClick={() => alternarEstado(st.id, st.active)}
                    aria-label={st.active ? 'Desactivar personal' : 'Activar personal'}
                    aria-busy={estaGuardando}
                    className={`relative inline-flex h-7 w-13 shrink-0 items-center rounded-full px-1 transition-all duration-300 ${st.active ? 'bg-emerald-500 shadow-lg shadow-emerald-200' : 'bg-slate-300'} ${estaGuardando ? 'animate-pulse' : ''}`}
                  >
                    <span
                      className={`h-5 w-5 rounded-full bg-white shadow-md transition-transform duration-300 ${st.active ? 'translate-x-6' : 'translate-x-0'}`}
                    />
                  </button>
                </div>
              </div>

              {st.active && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <Clock className="w-3 h-3 text-pink-400" />
                    <SelectorHora
                      etiqueta="Inicio turno"
                      valor={st.shiftStart ?? '09:00'}
                      alCambiar={(valor) =>
                        actualizarHorario(
                          st.id,
                          valor,
                          st.shiftEnd ?? '19:00',
                          st.breakStart ?? '',
                          st.breakEnd ?? '',
                        )
                      }
                      ocultarEtiqueta
                      claseContenedor="w-[90px]"
                      claseSelect="w-full rounded bg-transparent px-1 text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-pink-500"
                    />
                    <span className="text-[9px] font-black text-slate-400">A</span>
                    <SelectorHora
                      etiqueta="Fin turno"
                      valor={st.shiftEnd ?? '19:00'}
                      alCambiar={(valor) =>
                        actualizarHorario(
                          st.id,
                          st.shiftStart ?? '09:00',
                          valor,
                          st.breakStart ?? '',
                          st.breakEnd ?? '',
                        )
                      }
                      ocultarEtiqueta
                      claseContenedor="w-[90px]"
                      claseSelect="w-full rounded bg-transparent px-1 text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-pink-500"
                    />
                    <Coffee className="w-3 h-3 text-yellow-600 ml-2" />
                    <SelectorHora
                      etiqueta="Inicio descanso"
                      valor={st.breakStart ?? '14:00'}
                      alCambiar={(valor) =>
                        actualizarHorario(
                          st.id,
                          st.shiftStart ?? '09:00',
                          st.shiftEnd ?? '19:00',
                          valor,
                          st.breakEnd ?? '15:00',
                        )
                      }
                      ocultarEtiqueta
                      claseContenedor="w-[90px]"
                      claseSelect="w-full rounded bg-transparent px-1 text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-pink-500"
                    />
                    <span className="text-[9px] font-black text-slate-400">A</span>
                    <SelectorHora
                      etiqueta="Fin descanso"
                      valor={st.breakEnd ?? '15:00'}
                      alCambiar={(valor) =>
                        actualizarHorario(
                          st.id,
                          st.shiftStart ?? '09:00',
                          st.shiftEnd ?? '19:00',
                          st.breakStart ?? '14:00',
                          valor,
                        )
                      }
                      ocultarEtiqueta
                      claseContenedor="w-[90px]"
                      claseSelect="w-full rounded bg-transparent px-1 text-[10px] font-bold text-slate-700 outline-none focus:ring-2 focus:ring-pink-500"
                    />
                  </div>

                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    Especialidades activas:
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {estudio.selectedServices.map((srv) => {
                      const asignado = st.specialties.includes(srv.name);
                      return (
                        <button
                          key={srv.name}
                          onClick={() => alternarEspecialidad(st.id, srv.name)}
                          className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase border transition-colors ${asignado ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'}`}
                          aria-label={asignado ? `Desactivar ${srv.name}` : `Activar ${srv.name}`}
                        >
                          {asignado && '✓ '}
                          {srv.name}
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-3 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Mapa Horarios Día
                  </p>
                  <div className="flex flex-wrap gap-1.5 bg-white p-3 rounded-xl border border-slate-100">
                    {slots.length > 0 ? (
                      slots.map((slot) => (
                        <div
                          key={slot.time}
                          className={`px-2 py-1 rounded-lg text-[9px] font-black border flex items-center gap-1 ${slot.status === 'AVAILABLE' ? 'bg-green-100 text-green-700 border-green-200' : slot.status === 'BREAK_TIME' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-red-100 text-red-700 border-red-200 opacity-60'}`}
                          title={slot.time}
                        >
                          {slot.status === 'BREAK_TIME' && <Coffee className="w-3 h-3" />}
                          {slot.time}
                        </div>
                      ))
                    ) : (
                      <span className="text-xs text-slate-400 font-bold">
                        Cerrado / Fuera de Turno
                      </span>
                    )}
                  </div>
                </div>
              )}

              {!st.active && (
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                  <XCircle className="w-4 h-4" /> Personal inactivo (no disponible para
                  reservaciones)
                </div>
              )}
              <div className="flex gap-1 mt-3">
                {reservasEspecialista.map((r) => (
                  <span
                    key={r.id}
                    className={`px-2 py-1 rounded-lg text-[9px] font-black ${r.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-pink-100 text-pink-700'}`}
                  >
                    {r.time}
                  </span>
                ))}
                {st.active && reservasEspecialista.length === 0 && (
                  <p className="text-[9px] text-slate-400 font-bold italic">Sin citas hoy.</p>
                )}
              </div>
            </div>
          );
        })}
        {personalActivo.length === 0 && (
          <p className="text-xs text-slate-400 italic font-bold">No hay personal activo hoy.</p>
        )}
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span className="text-[10px] text-green-700 font-black">= Ocupado</span>
        </div>
      </div>
    </div>
  );
}
