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
        <FormularioNuevoPersonal
          estudioId={estudio.id}
          serviciosDisponibles={estudio.selectedServices}
          alCrearExitoso={async () => {
            setMostrarFormulario(false);
            await queryClient.invalidateQueries({ queryKey: ['personal-estudio', estudio.id] });
          }}
        />
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {personal.map((miembro) => {
          const guardando =
            mutacionEstado.isPending && mutacionEstado.variables?.personalId === miembro.id;
          return (
            <article
              key={miembro.id}
              className="rounded-4xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {miembro.avatarUrl ? (
                    <img
                      src={miembro.avatarUrl}
                      alt={`Foto de ${miembro.name}`}
                      className="h-14 w-14 rounded-full border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pink-100 text-lg font-black text-pink-700">
                      {miembro.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <h4 className="text-base font-black text-slate-900">{miembro.name}</h4>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                      {miembro.active ? 'Activo' : 'Inactivo'}
                    </p>
                  </div>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[10px] font-black uppercase ${miembro.active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                >
                  {miembro.active ? 'Disponible' : 'Oculto'}
                </span>
              </div>

              <div className="mb-4 flex flex-wrap gap-2">
                {miembro.specialties.map((especialidad) => (
                  <span
                    key={especialidad}
                    className="rounded-full bg-pink-50 px-2.5 py-1 text-[11px] font-bold text-pink-700"
                  >
                    {especialidad}
                  </span>
                ))}
                {miembro.specialties.length === 0 && (
                  <span className="text-xs text-slate-400">Sin especialidades configuradas.</span>
                )}
              </div>

              <div className="mb-5 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                <p>
                  <span className="font-black text-slate-900">Horario:</span>{' '}
                  {miembro.shiftStart ?? '—'} a {miembro.shiftEnd ?? '—'}
                </p>
                {(miembro.breakStart || miembro.breakEnd) && (
                  <p className="mt-1">
                    <span className="font-black text-slate-900">Descanso:</span>{' '}
                    {miembro.breakStart ?? '—'} a {miembro.breakEnd ?? '—'}
                  </p>
                )}
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setPersonalEditando(miembro)}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-4 py-2.5 text-xs font-black text-slate-700 transition hover:border-pink-200 hover:bg-pink-50 hover:text-pink-700"
                >
                  <Pencil className="h-4 w-4" /> Editar
                </button>
                <button
                  type="button"
                  disabled={guardando}
                  onClick={() =>
                    mutacionEstado.mutate({ personalId: miembro.id, activo: !miembro.active })
                  }
                  className={`inline-flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-black transition disabled:opacity-60 ${miembro.active ? 'bg-amber-50 text-amber-700 hover:bg-amber-100' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'}`}
                >
                  {miembro.active ? (
                    <UserX className="h-4 w-4" />
                  ) : (
                    <UserCheck className="h-4 w-4" />
                  )}
                  {miembro.active ? 'Desactivar' : 'Activar'}
                </button>
              </div>

              <SeccionAccesoEmpleado
                estudioId={estudio.id}
                personalId={miembro.id}
                nombreEmpleado={miembro.name}
              />
            </article>
          );
        })}
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
