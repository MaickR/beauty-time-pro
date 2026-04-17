import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  listarPersonal,
  eliminarPersonal,
} from '../../../servicios/servicioPersonal';
import { SeccionAccesoEmpleado } from '../../empleado/componentes/SeccionAccesoEmpleado';
import { FormularioNuevoPersonal } from './FormularioNuevoPersonal';
import { ModalEditarPersonal } from './ModalEditarPersonal';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { DialogoConfirmacion } from '../../../componentes/ui/DialogoConfirmacion';
import { BotonIconoAccion } from '../../../componentes/ui/BotonIconoAccion.tsx';
import type { Estudio, Personal } from '../../../tipos';

interface PropsPanelMiEquipo {
  estudio: Estudio;
}

export function PanelMiEquipo({ estudio }: PropsPanelMiEquipo) {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [personalEditando, setPersonalEditando] = useState<Personal | null>(null);
  const [personalPendienteEliminar, setPersonalPendienteEliminar] = useState<Personal | null>(null);
  const queryClient = useQueryClient();
  const { mostrarToast } = usarToast();

  const consultaPersonal = useQuery({
    queryKey: ['personal-estudio', estudio.id],
    queryFn: () => listarPersonal(estudio.id),
    initialData: estudio.staff,
    staleTime: 60_000,
  });

  const mutacionEliminar = useMutation({
    mutationFn: (personalId: string) => eliminarPersonal(personalId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['personal-estudio', estudio.id] });
      setPersonalPendienteEliminar(null);
      mostrarToast({ mensaje: 'Especialista eliminado del equipo activo', variante: 'exito' });
    },
    onError: (error: Error) => {
      mostrarToast({ mensaje: error.message, variante: 'error' });
    },
  });

  const personal = consultaPersonal.data ?? [];

  const formatearFechaSuspendida = (fecha: string | null | undefined) => {
    if (!fecha) {
      return null;
    }

    return new Date(`${fecha}T00:00:00`).toLocaleDateString('es-MX', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const renderEstado = (miembro: Personal) => {
    if (miembro.active) {
      return {
        texto: 'Activo',
        clase: 'bg-emerald-100 text-emerald-700',
        detalle: 'Disponible para agenda y operación.',
      };
    }

    if (miembro.inactiveUntil) {
      return {
        texto: 'Suspendido',
        clase: 'bg-amber-100 text-amber-700',
        detalle: `Hasta ${formatearFechaSuspendida(miembro.inactiveUntil)}`,
      };
    }

    return {
      texto: 'Inactivo',
      clase: 'bg-slate-100 text-slate-500',
      detalle: 'Fuera del equipo activo.',
    };
  };

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

      <div className="grid gap-4 md:hidden">
        {personal.map((miembro) => {
          const estado = renderEstado(miembro);

          return (
            <article
              key={miembro.id}
              className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                {miembro.avatarUrl ? (
                  <img
                    src={miembro.avatarUrl}
                    alt={`Foto de ${miembro.name}`}
                    className="h-12 w-12 rounded-full border border-slate-200 object-cover shrink-0"
                  />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-pink-100 text-sm font-black text-pink-700 shrink-0">
                    {miembro.name.slice(0, 1).toUpperCase()}
                  </div>
                )}

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="truncate text-sm font-black text-slate-900">{miembro.name}</h4>
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-[10px] font-black uppercase ${estado.clase}`}
                    >
                      {estado.texto}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500">{estado.detalle}</p>
                  <p className="text-xs font-medium text-slate-600">
                    Jornada: {miembro.shiftStart ?? '—'} – {miembro.shiftEnd ?? '—'}
                  </p>
                  {(miembro.breakStart || miembro.breakEnd) && (
                    <p className="text-xs text-slate-400">
                      Descanso: {miembro.breakStart ?? '—'} – {miembro.breakEnd ?? '—'}
                    </p>
                  )}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {miembro.specialties.length === 0 ? (
                  <span className="text-xs italic text-slate-400">Sin servicios</span>
                ) : (
                  miembro.specialties.slice(0, 4).map((esp) => (
                    <span
                      key={esp}
                      className="rounded-full bg-pink-50 px-2.5 py-1 text-[10px] font-bold text-pink-700"
                    >
                      {esp}
                    </span>
                  ))
                )}
              </div>

              <div className="mt-4 flex items-center justify-center gap-2 rounded-2xl bg-slate-50 p-2">
                <BotonIconoAccion
                  descripcion="Editar"
                  tono="primario"
                  onClick={() => setPersonalEditando(miembro)}
                  icono={<Pencil className="h-4 w-4" aria-hidden="true" />}
                />
                <SeccionAccesoEmpleado
                  estudioId={estudio.id}
                  personalId={miembro.id}
                  nombreEmpleado={miembro.name}
                  activoPersonal={miembro.active}
                  desactivadoHasta={miembro.inactiveUntil ?? null}
                />
                <BotonIconoAccion
                  descripcion="Eliminar"
                  tono="peligro"
                  onClick={() => setPersonalPendienteEliminar(miembro)}
                  icono={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                />
              </div>
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th
                scope="col"
                className="text-left px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest"
              >
                Especialista
              </th>
              <th
                scope="col"
                className="text-left px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden sm:table-cell"
              >
                Horario
              </th>
              <th
                scope="col"
                className="text-left px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hidden md:table-cell"
              >
                Especialidades
              </th>
              <th
                scope="col"
                className="text-center px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest"
              >
                Estado
              </th>
              <th
                scope="col"
                className="px-4 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center"
              >
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {personal.map((miembro) => {
              const estado = renderEstado(miembro);
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
                        Descanso: {miembro.breakStart ?? '—'} – {miembro.breakEnd ?? '—'}
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
                        <span className="text-xs text-slate-400 italic">Sin servicios</span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 text-center">
                    <span
                      className={`inline-block rounded-full px-3 py-1 text-[10px] font-black uppercase ${estado.clase}`}
                    >
                      {estado.texto}
                    </span>
                    <p className="mt-1 text-[11px] font-medium text-slate-400">{estado.detalle}</p>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <BotonIconoAccion
                        descripcion="Editar"
                        tono="primario"
                        onClick={() => setPersonalEditando(miembro)}
                        icono={<Pencil className="h-4 w-4" aria-hidden="true" />}
                      />
                      <SeccionAccesoEmpleado
                        estudioId={estudio.id}
                        personalId={miembro.id}
                        nombreEmpleado={miembro.name}
                        activoPersonal={miembro.active}
                        desactivadoHasta={miembro.inactiveUntil ?? null}
                      />
                      <BotonIconoAccion
                        descripcion="Eliminar"
                        tono="peligro"
                        onClick={() => setPersonalPendienteEliminar(miembro)}
                        icono={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                      />
                    </div>
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

      <DialogoConfirmacion
        abierto={personalPendienteEliminar !== null}
        mensaje="Eliminar especialista"
        descripcion={
          personalPendienteEliminar
            ? `Se retirará a ${personalPendienteEliminar.name} del equipo activo y también se desactivará su acceso al sistema.`
            : undefined
        }
        textoConfirmar="Eliminar"
        variante="peligro"
        cargando={mutacionEliminar.isPending}
        onCancelar={() => setPersonalPendienteEliminar(null)}
        onConfirmar={() => {
          if (!personalPendienteEliminar) return;
          mutacionEliminar.mutate(personalPendienteEliminar.id);
        }}
      />
    </div>
  );
}
