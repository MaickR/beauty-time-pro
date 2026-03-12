import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Trash2,
  Settings,
  Eye,
  EyeOff,
  MoreHorizontal,
  Power,
  ShieldCheck,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { peticion } from '../../../lib/clienteHTTP';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { DialogoConfirmacion } from '../../../componentes/ui/DialogoConfirmacion';
import { Tooltip } from '../../../componentes/ui/Tooltip';

interface PermisosMaestro {
  aprobarSalones: boolean;
  gestionarPagos: boolean;
  crearAdmins: boolean;
  verAuditLog: boolean;
  verMetricas: boolean;
  suspenderSalones: boolean;
  esMaestroTotal: boolean;
}

interface Admin {
  id: string;
  email: string;
  nombre: string;
  activo: boolean;
  protegido?: boolean;
  creadoEn: string;
  ultimoAcceso: string | null;
  permisos: PermisosMaestro | null;
}

const esquemaNuevoAdmin = z.object({
  nombre: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email('Email inválido'),
  contrasena: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Requiere mayúscula')
    .regex(/[0-9]/, 'Requiere número'),
});

type CamposNuevoAdmin = z.infer<typeof esquemaNuevoAdmin>;

const PERMISOS_VACIOS: PermisosMaestro = {
  aprobarSalones: false,
  gestionarPagos: false,
  crearAdmins: false,
  verAuditLog: false,
  verMetricas: false,
  suspenderSalones: false,
  esMaestroTotal: false,
};

const ETIQUETAS_PERMISOS: Record<keyof Omit<PermisosMaestro, 'esMaestroTotal'>, string> = {
  aprobarSalones: 'Aprobar salones',
  gestionarPagos: 'Gestionar pagos',
  crearAdmins: 'Crear admins',
  verAuditLog: 'Ver auditoría',
  verMetricas: 'Ver métricas',
  suspenderSalones: 'Suspender salones',
};

async function obtenerAdmins(): Promise<Admin[]> {
  const respuesta = await peticion<{ datos: Admin[] }>('/admin/admins');
  return respuesta.datos;
}

function esAdminProtegido(admin: Admin): boolean {
  return Boolean(admin.protegido);
}

function normalizarPermisos(permisos: PermisosMaestro): PermisosMaestro {
  if (!permisos.esMaestroTotal) {
    return permisos;
  }

  return {
    aprobarSalones: true,
    gestionarPagos: true,
    crearAdmins: true,
    verAuditLog: true,
    verMetricas: true,
    suspenderSalones: true,
    esMaestroTotal: true,
  };
}

export function GestionAdmins() {
  const { mostrarToast } = usarToast();
  const clienteConsulta = useQueryClient();
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [adminEditando, setAdminEditando] = useState<Admin | null>(null);
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [adminAccionesAbierto, setAdminAccionesAbierto] = useState<string | null>(null);
  const [adminEliminar, setAdminEliminar] = useState<Admin | null>(null);
  const [permisosEditando, setPermisosEditando] = useState<PermisosMaestro>(PERMISOS_VACIOS);

  const { data: admins = [], isLoading } = useQuery({
    queryKey: ['admins'],
    queryFn: obtenerAdmins,
    staleTime: 5 * 60 * 1000,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CamposNuevoAdmin>({ resolver: zodResolver(esquemaNuevoAdmin) });

  const crearAdmin = useMutation({
    mutationFn: async (datos: CamposNuevoAdmin) => {
      await peticion('/admin/admins', {
        method: 'POST',
        body: JSON.stringify({ ...datos, permisos: normalizarPermisos(permisosEditando) }),
      });
    },
    onSuccess: () => {
      mostrarToast('Admin creado correctamente');
      setMostrarFormulario(false);
      reset();
      setPermisosEditando(PERMISOS_VACIOS);
      void clienteConsulta.invalidateQueries({ queryKey: ['admins'] });
    },
    onError: (error) =>
      mostrarToast(error instanceof Error ? error.message : 'Error al crear admin'),
  });

  const actualizarPermisos = useMutation({
    mutationFn: async ({ id, permisos }: { id: string; permisos: PermisosMaestro }) => {
      await peticion(`/admin/admins/${id}/permisos`, {
        method: 'PUT',
        body: JSON.stringify(normalizarPermisos(permisos)),
      });
    },
    onSuccess: () => {
      mostrarToast('Permisos actualizados');
      setAdminEditando(null);
      void clienteConsulta.invalidateQueries({ queryKey: ['admins'] });
    },
    onError: (error) =>
      mostrarToast(error instanceof Error ? error.message : 'Error al actualizar permisos'),
  });

  const desactivarAdmin = useMutation({
    mutationFn: async (id: string) => {
      await peticion(`/admin/admins/${id}/desactivar`, { method: 'PUT' });
    },
    onSuccess: () => {
      mostrarToast('Admin desactivado');
      void clienteConsulta.invalidateQueries({ queryKey: ['admins'] });
    },
    onError: (error) =>
      mostrarToast(error instanceof Error ? error.message : 'Error al desactivar admin'),
  });

  const activarAdmin = useMutation({
    mutationFn: async (id: string) => {
      await peticion(`/admin/admins/${id}/activar`, { method: 'PUT' });
    },
    onSuccess: () => {
      mostrarToast('Admin activado');
      void clienteConsulta.invalidateQueries({ queryKey: ['admins'] });
    },
    onError: (error) =>
      mostrarToast(error instanceof Error ? error.message : 'Error al activar admin'),
  });

  const eliminarAdmin = useMutation({
    mutationFn: async (id: string) => {
      await peticion(`/admin/admins/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      setAdminEliminar(null);
      mostrarToast('Admin eliminado definitivamente');
      void clienteConsulta.invalidateQueries({ queryKey: ['admins'] });
    },
    onError: (error) =>
      mostrarToast(error instanceof Error ? error.message : 'Error al eliminar admin'),
  });

  const abrirEdicionPermisos = (admin: Admin) => {
    setAdminEditando(admin);
    setPermisosEditando(admin.permisos ?? PERMISOS_VACIOS);
  };

  const actualizarPermiso = (campo: keyof PermisosMaestro, valor: boolean) => {
    if (campo === 'esMaestroTotal') {
      setPermisosEditando((prev) => ({
        ...prev,
        aprobarSalones: valor ? true : prev.aprobarSalones,
        gestionarPagos: valor ? true : prev.gestionarPagos,
        crearAdmins: valor ? true : prev.crearAdmins,
        verAuditLog: valor ? true : prev.verAuditLog,
        verMetricas: valor ? true : prev.verMetricas,
        suspenderSalones: valor ? true : prev.suspenderSalones,
        esMaestroTotal: valor,
      }));
      return;
    }

    setPermisosEditando((prev) => ({
      ...prev,
      [campo]: valor,
      esMaestroTotal: valor ? prev.esMaestroTotal : false,
    }));
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 animate-pulse">
        <div className="h-6 bg-slate-200 rounded w-48 mb-4" />
        <div className="space-y-3">
          {[1, 2, 3].map((indice) => (
            <div key={indice} className="h-16 bg-slate-100 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <section aria-labelledby="titulo-admins" className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 id="titulo-admins" className="text-2xl font-black text-slate-900">
          Administradores
        </h2>
        <button
          onClick={() => {
            setMostrarFormulario(true);
            reset();
            setPermisosEditando(PERMISOS_VACIOS);
          }}
          className="flex items-center gap-2 bg-pink-600 text-white px-5 py-3 rounded-xl font-bold shadow hover:bg-pink-700 transition-all"
        >
          <Plus className="w-4 h-4" /> Nuevo admin
        </button>
      </div>

      {admins.length === 0 ? (
        <p className="text-slate-500 text-sm">No hay administradores registrados.</p>
      ) : (
        <div className="grid gap-3">
          {admins.map((admin) => {
            const protegido = esAdminProtegido(admin);

            return (
              <div
                key={admin.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div>
                  <p className="font-bold text-slate-900">{admin.nombre}</p>
                  <p className="text-sm text-slate-500">{admin.email}</p>
                  <span
                    className={`text-xs font-semibold px-2 py-0.5 rounded-full ${admin.activo ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}
                  >
                    {admin.activo ? 'Activo' : 'Inactivo'}
                  </span>
                  {admin.permisos?.esMaestroTotal && (
                    <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                      Maestro total
                    </span>
                  )}
                  {protegido && (
                    <span className="ml-2 inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-900 text-white">
                      <ShieldCheck className="w-3 h-3" /> Cuenta protegida
                    </span>
                  )}
                </div>

                <div className="flex gap-2 items-center">
                  <Tooltip
                    texto={
                      protegido ? 'Cuenta protegida — no se puede modificar' : 'Editar permisos'
                    }
                  >
                    <button
                      onClick={() => {
                        if (protegido) return;
                        abrirEdicionPermisos(admin);
                      }}
                      aria-label={`Editar permisos de ${admin.nombre}`}
                      aria-disabled={protegido}
                      className={`p-2 rounded-xl transition-all ${protegido ? 'opacity-40 cursor-not-allowed bg-slate-50' : 'hover:bg-slate-100'}`}
                    >
                      <Settings className="w-4 h-4 text-slate-600" />
                    </button>
                  </Tooltip>

                  {!admin.activo && !protegido && (
                    <button
                      onClick={() => activarAdmin.mutate(admin.id)}
                      className="flex items-center gap-2 px-3 py-2 rounded-xl bg-green-50 text-green-700 text-sm font-semibold hover:bg-green-100 transition-all"
                    >
                      <Power className="w-4 h-4" /> Activar
                    </button>
                  )}

                  {admin.activo && (
                    <div className="relative">
                      <Tooltip
                        texto={
                          protegido ? 'Cuenta protegida — no se puede modificar' : 'Más acciones'
                        }
                      >
                        <button
                          onClick={() => {
                            if (protegido) return;
                            setAdminAccionesAbierto((actual) =>
                              actual === admin.id ? null : admin.id,
                            );
                          }}
                          aria-label={`Acciones de ${admin.nombre}`}
                          aria-disabled={protegido}
                          className={`p-2 rounded-xl transition-all ${protegido ? 'opacity-40 cursor-not-allowed bg-slate-50' : 'hover:bg-slate-100'}`}
                        >
                          <MoreHorizontal className="w-4 h-4 text-slate-600" />
                        </button>
                      </Tooltip>

                      {adminAccionesAbierto === admin.id && !protegido && (
                        <div className="absolute right-0 top-12 z-20 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
                          <button
                            onClick={() => {
                              setAdminAccionesAbierto(null);
                              desactivarAdmin.mutate(admin.id);
                            }}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Power className="w-4 h-4" /> Desactivar
                          </button>
                          <button
                            onClick={() => {
                              setAdminAccionesAbierto(null);
                              setAdminEliminar(admin);
                            }}
                            className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" /> Eliminar permanentemente
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {mostrarFormulario && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-nuevo-admin"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onKeyDown={(evento) => {
            if (evento.key === 'Escape') setMostrarFormulario(false);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-screen overflow-y-auto p-6">
            <h3 id="titulo-nuevo-admin" className="text-xl font-black text-slate-900 mb-6">
              Nuevo administrador
            </h3>
            <form
              onSubmit={handleSubmit((datos) => crearAdmin.mutate(datos))}
              className="space-y-4"
            >
              <div>
                <label
                  htmlFor="nombre-admin"
                  className="block text-sm font-semibold text-slate-700 mb-1"
                >
                  Nombre
                </label>
                <input
                  id="nombre-admin"
                  {...register('nombre')}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-pink-400 outline-none"
                />
                {errors.nombre && (
                  <p className="text-xs text-red-500 mt-1">{errors.nombre.message}</p>
                )}
              </div>
              <div>
                <label
                  htmlFor="email-admin"
                  className="block text-sm font-semibold text-slate-700 mb-1"
                >
                  Email
                </label>
                <input
                  id="email-admin"
                  type="email"
                  {...register('email')}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-pink-400 outline-none"
                />
                {errors.email && (
                  <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
                )}
              </div>
              <div>
                <label
                  htmlFor="contrasena-admin"
                  className="block text-sm font-semibold text-slate-700 mb-1"
                >
                  Contraseña
                </label>
                <div className="relative">
                  <input
                    id="contrasena-admin"
                    type={mostrarContrasena ? 'text' : 'password'}
                    {...register('contrasena')}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-pink-400 outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarContrasena((valor) => !valor)}
                    aria-label={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    {mostrarContrasena ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {errors.contrasena && (
                  <p className="text-xs text-red-500 mt-1">{errors.contrasena.message}</p>
                )}
              </div>

              <fieldset className="border border-slate-200 rounded-xl p-4">
                <legend className="text-sm font-bold text-slate-700 px-1">Permisos</legend>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {(Object.keys(ETIQUETAS_PERMISOS) as (keyof typeof ETIQUETAS_PERMISOS)[]).map(
                    (campo) => (
                      <label key={campo} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permisosEditando[campo]}
                          onChange={(evento) => actualizarPermiso(campo, evento.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm text-slate-700">{ETIQUETAS_PERMISOS[campo]}</span>
                      </label>
                    ),
                  )}
                  <label className="flex items-center gap-2 cursor-pointer col-span-2">
                    <input
                      type="checkbox"
                      checked={permisosEditando.esMaestroTotal}
                      onChange={(evento) =>
                        actualizarPermiso('esMaestroTotal', evento.target.checked)
                      }
                      className="rounded"
                    />
                    <span className="text-sm font-bold text-yellow-700">
                      Maestro total (marca todos los permisos)
                    </span>
                  </label>
                </div>
              </fieldset>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMostrarFormulario(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || crearAdmin.isPending}
                  className="px-6 py-2 rounded-xl bg-pink-600 text-white font-bold hover:bg-pink-700 transition-all disabled:opacity-50"
                >
                  {crearAdmin.isPending ? 'Creando...' : 'Crear admin'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {adminEditando && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-editar-permisos"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onKeyDown={(evento) => {
            if (evento.key === 'Escape') setAdminEditando(null);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-screen overflow-y-auto p-6">
            <h3 id="titulo-editar-permisos" className="text-xl font-black text-slate-900 mb-1">
              Permisos de {adminEditando.nombre}
            </h3>
            <p className="text-sm text-slate-500 mb-6">{adminEditando.email}</p>

            <fieldset className="border border-slate-200 rounded-xl p-4 mb-6">
              <legend className="text-sm font-bold text-slate-700 px-1">Permisos</legend>
              <div className="grid grid-cols-2 gap-3 mt-2">
                {(Object.keys(ETIQUETAS_PERMISOS) as (keyof typeof ETIQUETAS_PERMISOS)[]).map(
                  (campo) => (
                    <label key={campo} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permisosEditando[campo]}
                        onChange={(evento) => actualizarPermiso(campo, evento.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm text-slate-700">{ETIQUETAS_PERMISOS[campo]}</span>
                    </label>
                  ),
                )}
                <label className="flex items-center gap-2 cursor-pointer col-span-2">
                  <input
                    type="checkbox"
                    checked={permisosEditando.esMaestroTotal}
                    onChange={(evento) =>
                      actualizarPermiso('esMaestroTotal', evento.target.checked)
                    }
                    className="rounded"
                  />
                  <span className="text-sm font-bold text-yellow-700">Maestro total</span>
                </label>
              </div>
            </fieldset>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setAdminEditando(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={() =>
                  actualizarPermisos.mutate({ id: adminEditando.id, permisos: permisosEditando })
                }
                disabled={actualizarPermisos.isPending}
                className="px-6 py-2 rounded-xl bg-pink-600 text-white font-bold hover:bg-pink-700 transition-all disabled:opacity-50"
              >
                {actualizarPermisos.isPending ? 'Guardando...' : 'Guardar permisos'}
              </button>
            </div>
          </div>
        </div>
      )}

      <DialogoConfirmacion
        abierto={adminEliminar !== null}
        mensaje="Eliminar administrador"
        descripcion="⚠️ Esta acción es permanente e irreversible. Se eliminará el administrador y todo su historial de auditoría."
        textoConfirmar="Eliminar definitivamente"
        variante="peligro"
        cargando={eliminarAdmin.isPending}
        onCancelar={() => setAdminEliminar(null)}
        onConfirmar={() => {
          if (!adminEliminar) return;
          eliminarAdmin.mutate(adminEliminar.id);
        }}
      />
    </section>
  );
}
