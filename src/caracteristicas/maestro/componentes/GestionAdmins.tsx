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
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { peticion } from '../../../lib/clienteHTTP';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { DialogoConfirmacion } from '../../../componentes/ui/DialogoConfirmacion';
import { Tooltip } from '../../../componentes/ui/Tooltip';

// ─── Tipos ────────────────────────────────────────────

type CargoColaborador = 'maestro' | 'supervisor' | 'vendedor';

interface PermisosMaestro {
  aprobarSalones: boolean;
  gestionarPagos: boolean;
  crearAdmins: boolean;
  verAuditLog: boolean;
  verMetricas: boolean;
  suspenderSalones: boolean;
  esMaestroTotal: boolean;
}

interface PermisosSupervisor {
  verTotalSalones: boolean;
  verControlSalones: boolean;
  verReservas: boolean;
  verVentas: boolean;
  verDirectorio: boolean;
  editarDirectorio: boolean;
  verControlCobros: boolean;
  accionRecordatorio: boolean;
  accionRegistroPago: boolean;
  accionSuspension: boolean;
  activarSalones: boolean;
  verPreregistros: boolean;
}

interface Colaborador {
  id: string;
  email: string;
  nombre: string;
  rol: string;
  activo: boolean;
  protegido?: boolean;
  creadoEn: string;
  ultimoAcceso: string | null;
  permisos: PermisosMaestro | null;
  permisosSupervisor: PermisosSupervisor | null;
}

const esquemaNuevoColaborador = z.object({
  nombre: z.string().min(2, 'Minimum 2 characters'),
  email: z.string().email('Invalid email'),
  contrasena: z
    .string()
    .min(8, 'Minimum 8 characters')
    .regex(/[A-Z]/, 'Requires uppercase letter')
    .regex(/[0-9]/, 'Requires number'),
  cargo: z.enum(['maestro', 'supervisor', 'vendedor'], {
    message: 'Role is required',
  }),
});

type CamposNuevoColaborador = z.infer<typeof esquemaNuevoColaborador>;

const PERMISOS_MAESTRO_VACIOS: PermisosMaestro = {
  aprobarSalones: false,
  gestionarPagos: false,
  crearAdmins: false,
  verAuditLog: false,
  verMetricas: false,
  suspenderSalones: false,
  esMaestroTotal: false,
};

const PERMISOS_SUPERVISOR_VACIOS: PermisosSupervisor = {
  verTotalSalones: false,
  verControlSalones: false,
  verReservas: false,
  verVentas: false,
  verDirectorio: false,
  editarDirectorio: false,
  verControlCobros: false,
  accionRecordatorio: false,
  accionRegistroPago: false,
  accionSuspension: false,
  activarSalones: false,
  verPreregistros: false,
};

const ETIQUETAS_PERMISOS_MAESTRO: Record<keyof Omit<PermisosMaestro, 'esMaestroTotal'>, string> = {
  aprobarSalones: 'Approve salons',
  gestionarPagos: 'Manage payments',
  crearAdmins: 'Create admins',
  verAuditLog: 'View audit log',
  verMetricas: 'View metrics',
  suspenderSalones: 'Suspend salons',
};

const ETIQUETAS_CARGO: Record<CargoColaborador, string> = {
  maestro: 'Admin',
  supervisor: 'Supervisor',
  vendedor: 'Seller',
};

const COLORES_CARGO: Record<string, string> = {
  maestro: 'bg-purple-100 text-purple-700',
  supervisor: 'bg-blue-100 text-blue-700',
  vendedor: 'bg-orange-100 text-orange-700',
};

interface GrupoPermisoSupervisor {
  titulo: string;
  campos: { campo: keyof PermisosSupervisor; etiqueta: string }[];
}

const GRUPOS_PERMISOS_SUPERVISOR: GrupoPermisoSupervisor[] = [
  {
    titulo: 'Metrics',
    campos: [
      { campo: 'verTotalSalones', etiqueta: 'View total salons' },
      { campo: 'verControlSalones', etiqueta: 'View salon control' },
      { campo: 'verReservas', etiqueta: 'View bookings' },
      { campo: 'verVentas', etiqueta: 'View sales' },
    ],
  },
  {
    titulo: 'Access Directory',
    campos: [
      { campo: 'verDirectorio', etiqueta: 'View directory' },
      { campo: 'editarDirectorio', etiqueta: 'Edit directory' },
    ],
  },
  {
    titulo: 'Payment Control',
    campos: [
      { campo: 'verControlCobros', etiqueta: 'View payment control' },
      { campo: 'accionRecordatorio', etiqueta: 'Send reminders' },
      { campo: 'accionRegistroPago', etiqueta: 'Register payments' },
      { campo: 'accionSuspension', etiqueta: 'Suspend salons' },
    ],
  },
  {
    titulo: 'Sellers',
    campos: [
      { campo: 'activarSalones', etiqueta: 'Activate salons' },
      { campo: 'verPreregistros', etiqueta: 'View pre-registrations' },
    ],
  },
];

async function obtenerColaboradores(): Promise<Colaborador[]> {
  const respuesta = await peticion<{ datos: Colaborador[] }>('/admin/admins');
  return respuesta.datos;
}

function esColaboradorProtegido(colaborador: Colaborador): boolean {
  return Boolean(colaborador.protegido);
}

function normalizarPermisosMaestro(permisos: PermisosMaestro): PermisosMaestro {
  if (!permisos.esMaestroTotal) return permisos;
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

function generarContrasenaSeguraLocal(longitud = 16): string {
  const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
  const valores = new Uint8Array(longitud);
  crypto.getRandomValues(valores);
  return Array.from(valores, (v) => caracteres[v % caracteres.length]).join('');
}

function AcordeonPermisos({
  titulo,
  campos,
  permisos,
  onChange,
}: {
  titulo: string;
  campos: { campo: keyof PermisosSupervisor; etiqueta: string }[];
  permisos: PermisosSupervisor;
  onChange: (campo: keyof PermisosSupervisor, valor: boolean) => void;
}) {
  const [abierto, setAbierto] = useState(false);
  const algunoActivo = campos.some((c) => permisos[c.campo]);

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <span className="text-sm font-semibold text-slate-700 flex items-center gap-2">
          {titulo}
          {algunoActivo && <span className="w-2 h-2 rounded-full bg-blue-500" />}
        </span>
        {abierto ? (
          <ChevronDown className="w-4 h-4 text-slate-400" />
        ) : (
          <ChevronRight className="w-4 h-4 text-slate-400" />
        )}
      </button>
      {abierto && (
        <div className="px-4 py-3 space-y-2">
          {campos.map(({ campo, etiqueta }) => (
            <label key={campo} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={permisos[campo]}
                onChange={(e) => onChange(campo, e.target.checked)}
                className="rounded"
              />
              <span className="text-sm text-slate-700">{etiqueta}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

export function GestionAdmins() {
  const { mostrarToast } = usarToast();
  const clienteConsulta = useQueryClient();
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [colaboradorEditando, setColaboradorEditando] = useState<Colaborador | null>(null);
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const [accionesAbiertas, setAccionesAbiertas] = useState<string | null>(null);
  const [colaboradorEliminar, setColaboradorEliminar] = useState<Colaborador | null>(null);
  const [permisosMaestroEditando, setPermisosMaestroEditando] =
    useState<PermisosMaestro>(PERMISOS_MAESTRO_VACIOS);
  const [permisosSupervisorEditando, setPermisosSupervisorEditando] = useState<PermisosSupervisor>(
    PERMISOS_SUPERVISOR_VACIOS,
  );

  const { data: colaboradores = [], isLoading } = useQuery({
    queryKey: ['colaboradores'],
    queryFn: obtenerColaboradores,
    staleTime: 5 * 60 * 1000,
  });

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CamposNuevoColaborador>({
    resolver: zodResolver(esquemaNuevoColaborador),
    defaultValues: { cargo: 'maestro' },
  });

  const cargoWatch = watch('cargo');

  const crearColaborador = useMutation({
    mutationFn: async (datos: CamposNuevoColaborador) => {
      const cuerpo: Record<string, unknown> = { ...datos };
      if (datos.cargo === 'maestro') {
        cuerpo.permisos = normalizarPermisosMaestro(permisosMaestroEditando);
      } else if (datos.cargo === 'supervisor') {
        cuerpo.permisosSupervisor = permisosSupervisorEditando;
      }
      await peticion('/admin/admins', {
        method: 'POST',
        body: JSON.stringify(cuerpo),
      });
    },
    onSuccess: () => {
      mostrarToast('Collaborator created successfully');
      cerrarFormulario();
      void clienteConsulta.invalidateQueries({ queryKey: ['colaboradores'] });
    },
    onError: (error) =>
      mostrarToast(error instanceof Error ? error.message : 'Error creating collaborator'),
  });

  const actualizarPermisos = useMutation({
    mutationFn: async ({ id, rol }: { id: string; rol: string }) => {
      const cuerpo: Record<string, unknown> = {};
      if (rol === 'maestro') {
        Object.assign(cuerpo, normalizarPermisosMaestro(permisosMaestroEditando));
      } else if (rol === 'supervisor') {
        cuerpo.permisosSupervisor = permisosSupervisorEditando;
      }
      await peticion(`/admin/admins/${id}/permisos`, {
        method: 'PUT',
        body: JSON.stringify(cuerpo),
      });
    },
    onSuccess: () => {
      mostrarToast('Permissions updated');
      setColaboradorEditando(null);
      void clienteConsulta.invalidateQueries({ queryKey: ['colaboradores'] });
    },
    onError: (error) =>
      mostrarToast(error instanceof Error ? error.message : 'Error updating permissions'),
  });

  const desactivarColaborador = useMutation({
    mutationFn: async (id: string) => {
      await peticion(`/admin/admins/${id}/desactivar`, { method: 'PUT' });
    },
    onSuccess: () => {
      mostrarToast('Collaborator deactivated');
      void clienteConsulta.invalidateQueries({ queryKey: ['colaboradores'] });
    },
    onError: (error) => mostrarToast(error instanceof Error ? error.message : 'Error deactivating'),
  });

  const activarColaborador = useMutation({
    mutationFn: async (id: string) => {
      await peticion(`/admin/admins/${id}/activar`, { method: 'PUT' });
    },
    onSuccess: () => {
      mostrarToast('Collaborator activated');
      void clienteConsulta.invalidateQueries({ queryKey: ['colaboradores'] });
    },
    onError: (error) => mostrarToast(error instanceof Error ? error.message : 'Error activating'),
  });

  const eliminarColaborador = useMutation({
    mutationFn: async (id: string) => {
      await peticion(`/admin/admins/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      setColaboradorEliminar(null);
      mostrarToast('Collaborator permanently deleted');
      void clienteConsulta.invalidateQueries({ queryKey: ['colaboradores'] });
    },
    onError: (error) => mostrarToast(error instanceof Error ? error.message : 'Error deleting'),
  });

  const cerrarFormulario = () => {
    setMostrarFormulario(false);
    reset();
    setPermisosMaestroEditando(PERMISOS_MAESTRO_VACIOS);
    setPermisosSupervisorEditando(PERMISOS_SUPERVISOR_VACIOS);
    setMostrarContrasena(false);
  };

  const abrirEdicionPermisos = (colaborador: Colaborador) => {
    setColaboradorEditando(colaborador);
    setPermisosMaestroEditando(colaborador.permisos ?? PERMISOS_MAESTRO_VACIOS);
    setPermisosSupervisorEditando(colaborador.permisosSupervisor ?? PERMISOS_SUPERVISOR_VACIOS);
  };

  const actualizarPermisoMaestro = (campo: keyof PermisosMaestro, valor: boolean) => {
    if (campo === 'esMaestroTotal') {
      setPermisosMaestroEditando((prev) => ({
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
    setPermisosMaestroEditando((prev) => ({
      ...prev,
      [campo]: valor,
      esMaestroTotal: valor ? prev.esMaestroTotal : false,
    }));
  };

  const actualizarPermisoSupervisor = (campo: keyof PermisosSupervisor, valor: boolean) => {
    setPermisosSupervisorEditando((prev) => ({ ...prev, [campo]: valor }));
  };

  const generarContrasena = () => {
    const nueva = generarContrasenaSeguraLocal();
    setValue('contrasena', nueva, { shouldValidate: true });
    setMostrarContrasena(true);
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
    <section aria-labelledby="titulo-colaboradores" className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="titulo-colaboradores" className="text-2xl font-black text-slate-900">
          Collaborators
        </h2>
        <button
          onClick={() => {
            setMostrarFormulario(true);
            reset({ cargo: 'maestro', nombre: '', email: '', contrasena: '' });
            setPermisosMaestroEditando(PERMISOS_MAESTRO_VACIOS);
            setPermisosSupervisorEditando(PERMISOS_SUPERVISOR_VACIOS);
          }}
          className="flex items-center justify-center gap-2 bg-pink-600 text-white px-5 py-3 rounded-xl font-bold shadow hover:bg-pink-700 transition-all shrink-0 w-full sm:w-auto"
        >
          <Plus className="w-4 h-4" /> New collaborator
        </button>
      </div>

      {colaboradores.length === 0 ? (
        <p className="text-slate-500 text-sm">No collaborators registered yet.</p>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
          {/* Desktop: Tabla */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3 font-semibold text-slate-500 uppercase text-xs tracking-wide">
                    Name
                  </th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-500 uppercase text-xs tracking-wide">
                    Email
                  </th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-500 uppercase text-xs tracking-wide">
                    Role
                  </th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-500 uppercase text-xs tracking-wide">
                    Status
                  </th>
                  <th className="text-right px-5 py-3 font-semibold text-slate-500 uppercase text-xs tracking-wide">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {colaboradores.map((colaborador) => {
                  const protegido = esColaboradorProtegido(colaborador);

                  return (
                    <tr key={colaborador.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 truncate max-w-[200px]">
                            {colaborador.nombre}
                          </span>
                          {protegido && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-900 text-white shrink-0">
                              <ShieldCheck className="w-3 h-3" /> Protected
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-500 truncate max-w-[250px]">
                        {colaborador.email}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${COLORES_CARGO[colaborador.rol as CargoColaborador] ?? 'bg-slate-100 text-slate-700'}`}
                          >
                            {ETIQUETAS_CARGO[colaborador.rol as CargoColaborador] ??
                              colaborador.rol}
                          </span>
                          {colaborador.rol === 'maestro' &&
                            colaborador.permisos?.esMaestroTotal && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                                Full Master
                              </span>
                            )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colaborador.activo ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}
                        >
                          {colaborador.activo ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-1 items-center justify-end">
                          {colaborador.rol !== 'vendedor' && (
                            <Tooltip
                              texto={
                                protegido ? 'Protected account — cannot modify' : 'Edit permissions'
                              }
                            >
                              <button
                                onClick={() => {
                                  if (protegido) return;
                                  abrirEdicionPermisos(colaborador);
                                }}
                                aria-label={`Edit permissions for ${colaborador.nombre}`}
                                aria-disabled={protegido}
                                className={`p-2 rounded-xl transition-all ${protegido ? 'opacity-40 cursor-not-allowed bg-slate-50' : 'hover:bg-slate-100'}`}
                              >
                                <Settings className="w-4 h-4 text-slate-600" />
                              </button>
                            </Tooltip>
                          )}

                          {!colaborador.activo && !protegido && (
                            <button
                              onClick={() => activarColaborador.mutate(colaborador.id)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition-all"
                            >
                              <Power className="w-3.5 h-3.5" /> Activate
                            </button>
                          )}

                          {colaborador.activo && (
                            <div className="relative">
                              <Tooltip
                                texto={
                                  protegido ? 'Protected account — cannot modify' : 'More actions'
                                }
                              >
                                <button
                                  onClick={() => {
                                    if (protegido) return;
                                    setAccionesAbiertas((a) =>
                                      a === colaborador.id ? null : colaborador.id,
                                    );
                                  }}
                                  aria-label={`Actions for ${colaborador.nombre}`}
                                  aria-disabled={protegido}
                                  className={`p-2 rounded-xl transition-all ${protegido ? 'opacity-40 cursor-not-allowed bg-slate-50' : 'hover:bg-slate-100'}`}
                                >
                                  <MoreHorizontal className="w-4 h-4 text-slate-600" />
                                </button>
                              </Tooltip>

                              {accionesAbiertas === colaborador.id && !protegido && (
                                <div className="absolute right-0 top-10 z-20 w-52 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
                                  <button
                                    onClick={() => {
                                      setAccionesAbiertas(null);
                                      desactivarColaborador.mutate(colaborador.id);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                                  >
                                    <Power className="w-4 h-4" /> Deactivate
                                  </button>
                                  <button
                                    onClick={() => {
                                      setAccionesAbiertas(null);
                                      setColaboradorEliminar(colaborador);
                                    }}
                                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                                  >
                                    <Trash2 className="w-4 h-4" /> Delete permanently
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile: Tarjetas */}
          <div className="md:hidden divide-y divide-slate-100">
            {colaboradores.map((colaborador) => {
              const protegido = esColaboradorProtegido(colaborador);

              return (
                <div key={colaborador.id} className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate">{colaborador.nombre}</p>
                      <p className="text-sm text-slate-500 truncate">{colaborador.email}</p>
                    </div>
                    <div className="flex gap-1 items-center shrink-0">
                      {colaborador.rol !== 'vendedor' && (
                        <button
                          onClick={() => {
                            if (protegido) return;
                            abrirEdicionPermisos(colaborador);
                          }}
                          aria-label={`Edit permissions for ${colaborador.nombre}`}
                          aria-disabled={protegido}
                          className={`p-2 rounded-xl transition-all ${protegido ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-100'}`}
                        >
                          <Settings className="w-4 h-4 text-slate-600" />
                        </button>
                      )}

                      {!colaborador.activo && !protegido && (
                        <button
                          onClick={() => activarColaborador.mutate(colaborador.id)}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-green-50 text-green-700 text-xs font-semibold"
                        >
                          <Power className="w-3.5 h-3.5" /> Activate
                        </button>
                      )}

                      {colaborador.activo && !protegido && (
                        <div className="relative">
                          <button
                            onClick={() =>
                              setAccionesAbiertas((a) =>
                                a === colaborador.id ? null : colaborador.id,
                              )
                            }
                            aria-label={`Actions for ${colaborador.nombre}`}
                            className="p-2 rounded-xl hover:bg-slate-100 transition-all"
                          >
                            <MoreHorizontal className="w-4 h-4 text-slate-600" />
                          </button>
                          {accionesAbiertas === colaborador.id && (
                            <div className="absolute right-0 top-10 z-20 w-52 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl">
                              <button
                                onClick={() => {
                                  setAccionesAbiertas(null);
                                  desactivarColaborador.mutate(colaborador.id);
                                }}
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                              >
                                <Power className="w-4 h-4" /> Deactivate
                              </button>
                              <button
                                onClick={() => {
                                  setAccionesAbiertas(null);
                                  setColaboradorEliminar(colaborador);
                                }}
                                className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
                              >
                                <Trash2 className="w-4 h-4" /> Delete permanently
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${COLORES_CARGO[colaborador.rol as CargoColaborador] ?? 'bg-slate-100 text-slate-700'}`}
                    >
                      {ETIQUETAS_CARGO[colaborador.rol as CargoColaborador] ?? colaborador.rol}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colaborador.activo ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}
                    >
                      {colaborador.activo ? 'Active' : 'Inactive'}
                    </span>
                    {colaborador.rol === 'maestro' && colaborador.permisos?.esMaestroTotal && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                        Full Master
                      </span>
                    )}
                    {protegido && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-900 text-white">
                        <ShieldCheck className="w-3 h-3" /> Protected
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal: Nuevo colaborador */}
      {mostrarFormulario && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-nuevo-colaborador"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onKeyDown={(evento) => {
            if (evento.key === 'Escape') cerrarFormulario();
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-screen overflow-y-auto p-6">
            <h3 id="titulo-nuevo-colaborador" className="text-xl font-black text-slate-900 mb-6">
              New collaborator
            </h3>
            <form
              onSubmit={handleSubmit((datos) => crearColaborador.mutate(datos))}
              className="space-y-4"
            >
              {/* Cargo */}
              <div>
                <label
                  htmlFor="cargo-colaborador"
                  className="block text-sm font-semibold text-slate-700 mb-1"
                >
                  Role
                </label>
                <select
                  id="cargo-colaborador"
                  {...register('cargo')}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-pink-400 outline-none bg-white"
                >
                  <option value="maestro">Admin</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="vendedor">Seller</option>
                </select>
                {errors.cargo && (
                  <p className="text-xs text-red-500 mt-1">{errors.cargo.message}</p>
                )}
              </div>

              {/* Nombre */}
              <div>
                <label
                  htmlFor="nombre-colaborador"
                  className="block text-sm font-semibold text-slate-700 mb-1"
                >
                  Name
                </label>
                <input
                  id="nombre-colaborador"
                  {...register('nombre')}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-pink-400 outline-none"
                />
                {errors.nombre && (
                  <p className="text-xs text-red-500 mt-1">{errors.nombre.message}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label
                  htmlFor="email-colaborador"
                  className="block text-sm font-semibold text-slate-700 mb-1"
                >
                  Email
                </label>
                <input
                  id="email-colaborador"
                  type="email"
                  {...register('email')}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-pink-400 outline-none"
                />
                {errors.email && (
                  <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
                )}
              </div>

              {/* Contraseña */}
              <div>
                <label
                  htmlFor="contrasena-colaborador"
                  className="block text-sm font-semibold text-slate-700 mb-1"
                >
                  Password
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      id="contrasena-colaborador"
                      type={mostrarContrasena ? 'text' : 'password'}
                      {...register('contrasena')}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-pink-400 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarContrasena((v) => !v)}
                      aria-label={mostrarContrasena ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    >
                      {mostrarContrasena ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={generarContrasena}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all shrink-0"
                    aria-label="Generate secure password"
                  >
                    <RefreshCw className="w-4 h-4" /> Generate
                  </button>
                </div>
                {errors.contrasena && (
                  <p className="text-xs text-red-500 mt-1">{errors.contrasena.message}</p>
                )}
              </div>

              {/* Permisos Admin (maestro) */}
              {cargoWatch === 'maestro' && (
                <fieldset className="border border-slate-200 rounded-xl p-4">
                  <legend className="text-sm font-bold text-slate-700 px-1">
                    Admin permissions
                  </legend>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    {(
                      Object.keys(
                        ETIQUETAS_PERMISOS_MAESTRO,
                      ) as (keyof typeof ETIQUETAS_PERMISOS_MAESTRO)[]
                    ).map((campo) => (
                      <label key={campo} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={permisosMaestroEditando[campo]}
                          onChange={(e) => actualizarPermisoMaestro(campo, e.target.checked)}
                          className="rounded"
                        />
                        <span className="text-sm text-slate-700">
                          {ETIQUETAS_PERMISOS_MAESTRO[campo]}
                        </span>
                      </label>
                    ))}
                    <label className="flex items-center gap-2 cursor-pointer col-span-2">
                      <input
                        type="checkbox"
                        checked={permisosMaestroEditando.esMaestroTotal}
                        onChange={(e) =>
                          actualizarPermisoMaestro('esMaestroTotal', e.target.checked)
                        }
                        className="rounded"
                      />
                      <span className="text-sm font-bold text-yellow-700">
                        Full Master (grants all permissions)
                      </span>
                    </label>
                  </div>
                </fieldset>
              )}

              {/* Permisos Supervisor */}
              {cargoWatch === 'supervisor' && (
                <fieldset className="border border-slate-200 rounded-xl p-4">
                  <legend className="text-sm font-bold text-slate-700 px-1">
                    Supervisor permissions
                  </legend>
                  <div className="space-y-2 mt-2">
                    {GRUPOS_PERMISOS_SUPERVISOR.map((grupo) => (
                      <AcordeonPermisos
                        key={grupo.titulo}
                        titulo={grupo.titulo}
                        campos={grupo.campos}
                        permisos={permisosSupervisorEditando}
                        onChange={actualizarPermisoSupervisor}
                      />
                    ))}
                  </div>
                </fieldset>
              )}

              {/* Info vendedor */}
              {cargoWatch === 'vendedor' && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
                  Sellers have restricted access. They can only manage pre-registrations assigned to
                  them.
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={cerrarFormulario}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || crearColaborador.isPending}
                  className="px-6 py-2 rounded-xl bg-pink-600 text-white font-bold hover:bg-pink-700 transition-all disabled:opacity-50"
                >
                  {crearColaborador.isPending ? 'Creating...' : 'Create collaborator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar permisos */}
      {colaboradorEditando && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-editar-permisos"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onKeyDown={(evento) => {
            if (evento.key === 'Escape') setColaboradorEditando(null);
          }}
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-screen overflow-y-auto p-6">
            <h3 id="titulo-editar-permisos" className="text-xl font-black text-slate-900 mb-1">
              Permissions — {colaboradorEditando.nombre}
            </h3>
            <p className="text-sm text-slate-500 mb-1">{colaboradorEditando.email}</p>
            <span
              className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full mb-6 ${COLORES_CARGO[colaboradorEditando.rol as CargoColaborador] ?? 'bg-slate-100 text-slate-700'}`}
            >
              {ETIQUETAS_CARGO[colaboradorEditando.rol as CargoColaborador] ??
                colaboradorEditando.rol}
            </span>

            {colaboradorEditando.rol === 'maestro' && (
              <fieldset className="border border-slate-200 rounded-xl p-4 mb-6">
                <legend className="text-sm font-bold text-slate-700 px-1">Admin permissions</legend>
                <div className="grid grid-cols-2 gap-3 mt-2">
                  {(
                    Object.keys(
                      ETIQUETAS_PERMISOS_MAESTRO,
                    ) as (keyof typeof ETIQUETAS_PERMISOS_MAESTRO)[]
                  ).map((campo) => (
                    <label key={campo} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={permisosMaestroEditando[campo]}
                        onChange={(e) => actualizarPermisoMaestro(campo, e.target.checked)}
                        className="rounded"
                      />
                      <span className="text-sm text-slate-700">
                        {ETIQUETAS_PERMISOS_MAESTRO[campo]}
                      </span>
                    </label>
                  ))}
                  <label className="flex items-center gap-2 cursor-pointer col-span-2">
                    <input
                      type="checkbox"
                      checked={permisosMaestroEditando.esMaestroTotal}
                      onChange={(e) => actualizarPermisoMaestro('esMaestroTotal', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm font-bold text-yellow-700">Full Master</span>
                  </label>
                </div>
              </fieldset>
            )}

            {colaboradorEditando.rol === 'supervisor' && (
              <div className="space-y-2 mb-6">
                {GRUPOS_PERMISOS_SUPERVISOR.map((grupo) => (
                  <AcordeonPermisos
                    key={grupo.titulo}
                    titulo={grupo.titulo}
                    campos={grupo.campos}
                    permisos={permisosSupervisorEditando}
                    onChange={actualizarPermisoSupervisor}
                  />
                ))}
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setColaboradorEditando(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={() =>
                  actualizarPermisos.mutate({
                    id: colaboradorEditando.id,
                    rol: colaboradorEditando.rol,
                  })
                }
                disabled={actualizarPermisos.isPending}
                className="px-6 py-2 rounded-xl bg-pink-600 text-white font-bold hover:bg-pink-700 transition-all disabled:opacity-50"
              >
                {actualizarPermisos.isPending ? 'Saving...' : 'Save permissions'}
              </button>
            </div>
          </div>
        </div>
      )}

      <DialogoConfirmacion
        abierto={colaboradorEliminar !== null}
        mensaje="Delete collaborator"
        descripcion="This action is permanent and irreversible. The collaborator and all their audit history will be deleted."
        textoConfirmar="Delete permanently"
        variante="peligro"
        cargando={eliminarColaborador.isPending}
        onCancelar={() => setColaboradorEliminar(null)}
        onConfirmar={() => {
          if (!colaboradorEliminar) return;
          eliminarColaborador.mutate(colaboradorEliminar.id);
        }}
      />
    </section>
  );
}
