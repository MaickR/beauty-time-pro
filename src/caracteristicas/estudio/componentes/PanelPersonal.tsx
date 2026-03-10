import { Clock, Coffee, Users, CheckCircle2, XCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { obtenerSlotsDisponibles } from '../../../utils/programacion';
import { actualizarStaff } from '../../../servicios/servicioEstudios';
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
  const fechaStr = obtenerFechaLocalISO(fechaVista);
  const diaSemana = fechaVista.toLocaleString('es-ES', { weekday: 'long' });
  const diaNombre = diaSemana.charAt(0).toUpperCase() + diaSemana.slice(1);
  const horarioDia = estudio.schedule?.[diaNombre];

  const { mutate: guardarStaff } = useMutation({
    mutationFn: (staffActualizado: typeof estudio.staff) =>
      actualizarStaff(estudio.id, staffActualizado),
  });

  const alternarEstado = (staffId: string, estadoActual: boolean) => {
    const personalActualizado = estudio.staff.map((s) => s.id === staffId ? { ...s, active: !estadoActual } : s);
    guardarStaff(personalActualizado);
  };

  const alternarEspecialidad = (staffId: string, nombreEsp: string) => {
    const personalActualizado = estudio.staff.map((s) => {
      if (s.id !== staffId) return s;
      const tiene = s.specialties.includes(nombreEsp);
      return { ...s, specialties: tiene ? s.specialties.filter((sp) => sp !== nombreEsp) : [...s.specialties, nombreEsp] };
    });
    guardarStaff(personalActualizado);
  };

  const actualizarHorario = (staffId: string, turnoInicio: string, turnoFin: string, descansoInicio: string, descansoFin: string) => {
    const personalActualizado = estudio.staff.map((s) =>
      s.id === staffId ? { ...s, shiftStart: turnoInicio, shiftEnd: turnoFin, breakStart: descansoInicio, breakEnd: descansoFin } : s,
    );
    guardarStaff(personalActualizado);
  };

  const personalActivo = estudio.staff.filter((st) => st.active);

  return (
    <div className="bg-white rounded-[3rem] p-6 md:p-8 border border-slate-200 shadow-sm">
      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2 flex items-center gap-2"><Users className="w-4 h-4 text-pink-600" /> Mi Personal</h3>
      <p className="text-[10px] text-slate-400 font-bold mb-6">Gestiona la disponibilidad, horarios, tratamientos y visualiza el mapa de hoy.</p>

      <div className="space-y-4">
        {estudio.staff.length === 0 && (
          <p className="text-sm text-slate-400 italic font-bold text-center py-8">
            No hay especialistas registrados. Agrega personal desde la configuración del studio.
          </p>
        )}
        {estudio.staff.map((st) => {
          const reservasEspecialista = reservas.filter((b) => b.studioId === estudio.id && b.staffId === st.id && b.date === fechaStr && b.status !== 'cancelled');
          const slots = horarioDia ? obtenerSlotsDisponibles({ horarioDia, miembro: st, reservasExistentes: reservasEspecialista, duracionSlot: 30, fechaStr }) : [];

          return (
            <div key={st.id} className={`rounded-[2rem] border p-5 transition-all ${st.active ? 'bg-white border-slate-200' : 'bg-slate-50 border-slate-100 opacity-60'}`}>
              <div className="flex justify-between items-center mb-4">
                <p className="font-black text-sm uppercase text-slate-900">{st.name}</p>
                <button onClick={() => alternarEstado(st.id, st.active)} aria-label={st.active ? 'Desactivar personal' : 'Activar personal'} className={`w-10 h-5 rounded-full transition-colors relative ${st.active ? 'bg-green-400' : 'bg-slate-300'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${st.active ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>

              {st.active && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <Clock className="w-3 h-3 text-pink-400" />
                    <input type="time" defaultValue={st.shiftStart ?? '09:00'} onBlur={(e) => actualizarHorario(st.id, e.target.value, st.shiftEnd ?? '19:00', st.breakStart ?? '', st.breakEnd ?? '')} className="text-[10px] font-bold outline-none bg-transparent rounded px-1" aria-label="Inicio turno" />
                    <span className="text-[9px] font-black text-slate-400">A</span>
                    <input type="time" defaultValue={st.shiftEnd ?? '19:00'} onBlur={(e) => actualizarHorario(st.id, st.shiftStart ?? '09:00', e.target.value, st.breakStart ?? '', st.breakEnd ?? '')} className="text-[10px] font-bold outline-none bg-transparent rounded px-1" aria-label="Fin turno" />
                    <Coffee className="w-3 h-3 text-yellow-600 ml-2" />
                    <input type="time" defaultValue={st.breakStart ?? '14:00'} onBlur={(e) => actualizarHorario(st.id, st.shiftStart ?? '09:00', st.shiftEnd ?? '19:00', e.target.value, st.breakEnd ?? '15:00')} className="text-[10px] font-bold outline-none bg-transparent rounded px-1" aria-label="Inicio descanso" />
                    <span className="text-[9px] font-black text-slate-400">A</span>
                    <input type="time" defaultValue={st.breakEnd ?? '15:00'} onBlur={(e) => actualizarHorario(st.id, st.shiftStart ?? '09:00', st.shiftEnd ?? '19:00', st.breakStart ?? '14:00', e.target.value)} className="text-[10px] font-bold outline-none bg-transparent rounded px-1" aria-label="Fin descanso" />
                  </div>

                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-2">Especialidades activas:</p>
                  <div className="flex flex-wrap gap-2">
                    {estudio.selectedServices.map((srv) => {
                      const asignado = st.specialties.includes(srv.name);
                      return (
                        <button key={srv.name} onClick={() => alternarEspecialidad(st.id, srv.name)} className={`px-3 py-1.5 rounded-xl text-[9px] font-black uppercase border transition-colors ${asignado ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-400'}`} aria-label={asignado ? `Desactivar ${srv.name}` : `Activar ${srv.name}`}>
                          {asignado && '✓ '}{srv.name}
                        </button>
                      );
                    })}
                  </div>

                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-3 flex items-center gap-1"><Clock className="w-3 h-3" /> Mapa Horarios Día</p>
                  <div className="flex flex-wrap gap-1.5 bg-white p-3 rounded-xl border border-slate-100">
                    {slots.length > 0 ? slots.map((slot) => (
                      <div key={slot.time} className={`px-2 py-1 rounded-lg text-[9px] font-black border flex items-center gap-1 ${slot.status === 'AVAILABLE' ? 'bg-green-100 text-green-700 border-green-200' : slot.status === 'BREAK_TIME' ? 'bg-yellow-100 text-yellow-700 border-yellow-200' : 'bg-red-100 text-red-700 border-red-200 opacity-60'}`} title={slot.time}>
                        {slot.status === 'BREAK_TIME' && <Coffee className="w-3 h-3" />}
                        {slot.time}
                      </div>
                    )) : <span className="text-xs text-slate-400 font-bold">Cerrado / Fuera de Turno</span>}
                  </div>
                </div>
              )}

              {!st.active && (
                <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold">
                  <XCircle className="w-4 h-4" /> Personal inactivo (no disponible para reservaciones)
                </div>
              )}
              <div className="flex gap-1 mt-3">
                {reservasEspecialista.map((r) => (
                  <span key={r.id} className={`px-2 py-1 rounded-lg text-[9px] font-black ${r.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-pink-100 text-pink-700'}`}>{r.time}</span>
                ))}
                {st.active && reservasEspecialista.length === 0 && <p className="text-[9px] text-slate-400 font-bold italic">Sin citas hoy.</p>}
              </div>
            </div>
          );
        })}
        {personalActivo.length === 0 && <p className="text-xs text-slate-400 italic font-bold">No hay personal activo hoy.</p>}
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />
          <span className="text-[10px] text-green-700 font-black">= Ocupado</span>
        </div>
      </div>
    </div>
  );
}
