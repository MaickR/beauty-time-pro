import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, UserCheck, UserX } from 'lucide-react';
import { listarPersonal, actualizarPersonal } from '../../../servicios/servicioPersonal';
import { SeccionAccesoEmpleado } from '../../empleado/componentes/SeccionAccesoEmpleado';
import { FormularioNuevoPersonal } from './FormularioNuevoPersonal';
import { ModalEditarPersonal } from './ModalEditarPersonal';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import type { Estudio, Personal } from '../../../tipos';

interface PropsPanelMiEquipo {
  estudio: Estudio;
}

export function PanelMiEquipo({ estudio }: PropsPanelMiEquipo) {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [personalEditando, setPersonalEditando] = useState<Personal | null>(null);
  const queryClient = useQueryClient();
  const { mostrarToast } = usarToast();

  const consultaPersonal = useQuery({
    queryKey: ['personal-estudio', estudio.id],
    queryFn: () => listarPersonal(estudio.id),
    initialData: estudio.staff,
    staleTime: 60_000,
  });

  const mutacionEstado = useMutation({
    mutationFn: ({ personalId, activo }: { personalId: string; activo: boolean }) =>
      actualizarPersonal(personalId, { active: activo }),
    onSuccess: async (_datos, variables) => {
      await queryClient.invalidateQueries({ queryKey: ['personal-estudio', estudio.id] });
      mostrarToast({
        mensaje: variables.activo ? 'Especialista activado' : 'Especialista desactivado',
        variante: 'exito',
      });
    },
    onError: (error: Error) => {
      mostrarToast({ mensaje: error.message, variante: 'error' });
    },
  });

  const personal = consultaPersonal.data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-4xl border border-slate-200 bg-white p-6 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-xl font-black text-slate-900">Mi equipo</h3>
          <p className="text-sm text-slate-500">
            Administra especialistas, su disponibilidad y su acceso al sistema.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setMostrarFormulario((actual) => !actual)}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-pink-600 px-5 py-3 text-sm font-black text-white transition hover:bg-pink-700"
        >
          <Plus className="h-4 w-4" /> Añadir especialista
        </button>
      </div>

      {mostrarFormulario && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <FormularioNuevoPersonal
            estudioId={estudio.id}
            serviciosDisponibles={estudio.selectedServices}
            alCrearExitoso={async () => {
              setMostrarFormulario(false);
              await queryClient.invalidateQueries({ queryKey: ['personal-estudio', estudio.id] });
            }}
          />
        </div>
      )}

      <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th
                scope="col"
                className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest"
              >
                Specialist
              </th>
              <th
                scope="col"
                className="text-left px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:table-cell"
              >
                Schedule
              </th>
              <th
                scope="col"
                className="text-left px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:table-cell"
              >
                Specialties
              </th>
              <th
                scope="col"
                className="text-center px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {personal.map((miembro) => {
              const guardando =
                mutacionEstado.isPending && mutacionEstado.variables?.personalId === miembro.id;
              return (
                <tr
                  key={miembro.id}
                  className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                >
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      {miembro.avatarUrl ? (
                        <img
                          src={miembro.avatarUrl}
                          alt={`Foto de ${miembro.name}`}
                          className="h-10 w-10 rounded-full border border-slate-200 object-cover shrink-0"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-100 text-sm font-black text-pink-700 shrink-0">
                          {miembro.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <span className="font-black text-slate-800">{miembro.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-4 hidden sm:table-cell text-slate-600 font-medium">
                    <p>
                      {miembro.shiftStart ?? '—'} – {miembro.shiftEnd ?? '—'}
                    </p>
                    {(miembro.breakStart || miembro.breakEnd) && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        Break: {miembro.breakStart ?? '—'} – {miembro.breakEnd ?? '—'}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-4 hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {miembro.specialties.slice(0, 3).map((esp) => (
                        <span
                          key={esp}
                          className="rounded-full bg-pink-50 px-2 py-0.5 text-[10px] font-bold text-pink-700"
                        >
                          {esp}
                        </span>
                      ))}
                      {miembro.specialties.length > 3 && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">
                          +{miembro.specialties.length - 3}
                        </span>
                      )}
                      {miembro.specialties.length === 0 && (
                        <span className="text-xs text-slate-400 italic">None</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-[10px] font-black uppercase ${miembro.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                    >
                      {miembro.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setPersonalEditando(miembro)}
                        className="rounded-xl p-2 text-pink-400 transition hover:bg-pink-50 hover:text-pink-600"
                        aria-label={`Editar ${miembro.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        disabled={guardando}
                        onClick={() =>
                          mutacionEstado.mutate({ personalId: miembro.id, activo: !miembro.active })
                        }
                        className={`rounded-xl p-2 transition disabled:opacity-60 ${miembro.active ? 'text-amber-500 hover:bg-amber-50 hover:text-amber-600' : 'text-emerald-500 hover:bg-emerald-50 hover:text-emerald-600'}`}
                        aria-label={
                          miembro.active ? `Desactivar ${miembro.name}` : `Activar ${miembro.name}`
                        }
                      >
                        {miembro.active ? (
                          <UserX className="h-4 w-4" />
                        ) : (
                          <UserCheck className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    <SeccionAccesoEmpleado
                      estudioId={estudio.id}
                      personalId={miembro.id}
                      nombreEmpleado={miembro.name}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {personal.length === 0 && (
        <div className="rounded-4xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-400">
          Todavía no tienes especialistas registrados.
        </div>
      )}

      <ModalEditarPersonal
        abierto={personalEditando !== null}
        estudioId={estudio.id}
        personal={personalEditando}
        serviciosDisponibles={estudio.selectedServices.map((servicio) => servicio.name)}
        onCerrar={() => setPersonalEditando(null)}
        onGuardado={async () => {
          setPersonalEditando(null);
          await queryClient.invalidateQueries({ queryKey: ['personal-estudio', estudio.id] });
        }}
      />
    </div>
  );
}
