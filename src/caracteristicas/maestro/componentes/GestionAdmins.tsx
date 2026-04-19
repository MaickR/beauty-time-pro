import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Settings,
  Pencil,
  Eye,
  EyeOff,
  Power,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { peticion } from '../../../lib/clienteHTTP';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { Tooltip } from '../../../componentes/ui/Tooltip';
import {
  esEmailColaboradorValido,
  generarContrasenaColaborador,
  limpiarNombrePersonaEntrada,
} from '../../../utils/formularioSalon';

// ─── Tipos ────────────────────────────────────────────

type CargoColaborador = 'maestro' | 'supervisor' | 'vendedor';
type OrdenColaboradores = 'recientes' | 'nombre' | 'rol' | 'estado';
type DireccionOrden = 'asc' | 'desc';

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
  porcentajeComision: number;
  porcentajeComisionPro: number;
  activo: boolean;
  protegido?: boolean;
  creadoEn: string;
  ultimoAcceso: string | null;
  permisos: PermisosMaestro | null;
  permisosSupervisor: PermisosSupervisor | null;
}

const esquemaNuevoColaborador = z.object({
  nombre: z.string().trim().min(2, 'Mínimo 2 caracteres'),
  email: z
    .string()
    .trim()
    .email('Correo inválido')
    .refine(esEmailColaboradorValido, 'No se aceptan correos temporales o de un solo uso'),
  contrasena: z
    .string()
    .refine(
      (valor) => valor === '' || (valor.length >= 8 && valor.length <= 10),
      'La contraseña debe tener entre 8 y 10 caracteres',
    ),
  cargo: z.enum(['maestro', 'supervisor', 'vendedor'], {
    message: 'El rol es obligatorio',
  }),
  porcentajeComision: z
    .number()
    .int('Ingresa un porcentaje entero')
    .min(0, 'El porcentaje mínimo es 0')
    .max(100, 'El porcentaje máximo es 100'),
  porcentajeComisionPro: z
    .number()
    .int('Ingresa un porcentaje entero')
    .min(0, 'El porcentaje mínimo es 0')
    .max(100, 'El porcentaje máximo es 100'),
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
  aprobarSalones: 'Aprobar salones',
  gestionarPagos: 'Gestionar pagos',
  crearAdmins: 'Gestionar colaboradores',
  verAuditLog: 'Ver auditoría',
  verMetricas: 'Ver métricas',
  suspenderSalones: 'Suspender salones',
};

const ETIQUETAS_CARGO: Record<CargoColaborador, string> = {
  maestro: 'Administrador',
  supervisor: 'Supervisor',
  vendedor: 'Vendedor',
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
    titulo: 'Métricas',
    campos: [
      { campo: 'verTotalSalones', etiqueta: 'Ver total de salones' },
      { campo: 'verControlSalones', etiqueta: 'Ver control de salones' },
      { campo: 'verReservas', etiqueta: 'Ver reservas' },
      { campo: 'verVentas', etiqueta: 'Ver ventas' },
    ],
  },
  {
    titulo: 'Directorio de acceso',
    campos: [
      { campo: 'verDirectorio', etiqueta: 'Ver directorio' },
      { campo: 'editarDirectorio', etiqueta: 'Editar directorio' },
    ],
  },
  {
    titulo: 'Control de cobros',
    campos: [
      { campo: 'verControlCobros', etiqueta: 'Ver control de cobros' },
      { campo: 'accionRecordatorio', etiqueta: 'Enviar recordatorios' },
      { campo: 'accionRegistroPago', etiqueta: 'Registrar pagos' },
      { campo: 'accionSuspension', etiqueta: 'Suspender salones' },
    ],
  },
  {
    titulo: 'Ventas y preregistros',
    campos: [
      { campo: 'activarSalones', etiqueta: 'Activar salones' },
      { campo: 'verPreregistros', etiqueta: 'Ver pre-registros' },
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
  const [colaboradorEdicionGeneral, setColaboradorEdicionGeneral] = useState<Colaborador | null>(
    null,
  );
  const [mostrarContrasena, setMostrarContrasena] = useState(false);

  const [orden, setOrden] = useState<OrdenColaboradores>('recientes');
  const [direccionOrden, setDireccionOrden] = useState<DireccionOrden>('asc');
  const [filtroNombre, setFiltroNombre] = useState('');
  const [filtroEmail, setFiltroEmail] = useState('');
  const [filtroRol, setFiltroRol] = useState<'todos' | CargoColaborador>('todos');
  const [filtroEstado, setFiltroEstado] = useState<'todos' | 'activo' | 'inactivo'>('todos');
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
    defaultValues: { cargo: 'maestro', porcentajeComision: 0, porcentajeComisionPro: 0 },
  });

  const cargoWatch = watch('cargo');
  const nombreWatch = watch('nombre');
  const emailWatch = watch('email');

  useEffect(() => {
    if (!mostrarFormulario && !colaboradorEditando) return;

    const manejarTecla = (evento: KeyboardEvent) => {
      if (evento.key !== 'Escape') return;
      if (mostrarFormulario) {
        cerrarFormulario();
        return;
      }
      setColaboradorEditando(null);
    };

    window.addEventListener('keydown', manejarTecla);
    return () => window.removeEventListener('keydown', manejarTecla);
  }, [colaboradorEditando, mostrarFormulario]);

  const crearColaborador = useMutation({
    mutationFn: async (datos: CamposNuevoColaborador) => {
      const cuerpo: Record<string, unknown> = { ...datos };
      if (datos.cargo === 'maestro') {
        cuerpo.permisos = normalizarPermisosMaestro(permisosMaestroEditando);
      } else if (datos.cargo === 'supervisor') {
        cuerpo.permisosSupervisor = permisosSupervisorEditando;
      } else {
        cuerpo.porcentajeComision = datos.porcentajeComision;
        cuerpo.porcentajeComisionPro = datos.porcentajeComisionPro;
      }
      await peticion('/admin/admins', {
        method: 'POST',
        body: JSON.stringify(cuerpo),
      });
    },
    onSuccess: () => {
      mostrarToast('Colaborador creado correctamente');
      cerrarFormulario();
      void clienteConsulta.invalidateQueries({ queryKey: ['colaboradores'] });
    },
    onError: (error) =>
      mostrarToast(error instanceof Error ? error.message : 'Error al crear el colaborador'),
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
      mostrarToast('Permisos actualizados correctamente');
      setColaboradorEditando(null);
      void clienteConsulta.invalidateQueries({ queryKey: ['colaboradores'] });
    },
    onError: (error) =>
      mostrarToast(error instanceof Error ? error.message : 'Error al actualizar los permisos'),
  });

  const desactivarColaborador = useMutation({
    mutationFn: async (id: string) => {
      await peticion(`/admin/admins/${id}/desactivar`, { method: 'PUT' });
    },
    onSuccess: () => {
      mostrarToast('Colaborador desactivado');
      void clienteConsulta.invalidateQueries({ queryKey: ['colaboradores'] });
    },
    onError: (error) =>
      mostrarToast(error instanceof Error ? error.message : 'Error al desactivar el colaborador'),
  });

  const activarColaborador = useMutation({
    mutationFn: async (id: string) => {
      await peticion(`/admin/admins/${id}/activar`, { method: 'PUT' });
    },
    onSuccess: () => {
      mostrarToast('Colaborador activado');
      void clienteConsulta.invalidateQueries({ queryKey: ['colaboradores'] });
    },
    onError: (error) =>
      mostrarToast(error instanceof Error ? error.message : 'Error al activar el colaborador'),
  });

  const actualizarColaborador = useMutation({
    mutationFn: async (datos: CamposNuevoColaborador & { id: string }) => {
      const cuerpo: Record<string, unknown> = {
        nombre: datos.nombre,
        email: datos.email,
        cargo: datos.cargo,
      };

      if (datos.contrasena.trim()) {
        cuerpo['contrasena'] = datos.contrasena;
      }

      if (datos.cargo === 'maestro') {
        cuerpo['permisos'] = normalizarPermisosMaestro(permisosMaestroEditando);
      } else if (datos.cargo === 'supervisor') {
        cuerpo['permisosSupervisor'] = permisosSupervisorEditando;
      } else {
        cuerpo['porcentajeComision'] = datos.porcentajeComision;
        cuerpo['porcentajeComisionPro'] = datos.porcentajeComisionPro;
      }

      await peticion(`/admin/admins/${datos.id}`, {
        method: 'PUT',
        body: JSON.stringify(cuerpo),
      });
    },
    onSuccess: () => {
      mostrarToast('Información actualizada correctamente');
      setColaboradorEdicionGeneral(null);
      cerrarFormulario();
      void clienteConsulta.invalidateQueries({ queryKey: ['colaboradores'] });
    },
    onError: (error) =>
      mostrarToast(error instanceof Error ? error.message : 'Error al actualizar el colaborador'),
  });

  const eliminarColaborador = useMutation({
    mutationFn: async (id: string) => {
      await peticion(`/admin/admins/${id}`, { method: 'DELETE' });
    },
    onSuccess: () => {
      mostrarToast('Colaborador eliminado definitivamente');
      void clienteConsulta.invalidateQueries({ queryKey: ['colaboradores'] });
    },
    onError: (error) =>
      mostrarToast(error instanceof Error ? error.message : 'Error al eliminar el colaborador'),
  });

  const cerrarFormulario = () => {
    setMostrarFormulario(false);
    setColaboradorEdicionGeneral(null);
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

  const abrirEdicionGeneral = (colaborador: Colaborador) => {
    setColaboradorEdicionGeneral(colaborador);
    setMostrarFormulario(true);
    setPermisosMaestroEditando(colaborador.permisos ?? PERMISOS_MAESTRO_VACIOS);
    setPermisosSupervisorEditando(colaborador.permisosSupervisor ?? PERMISOS_SUPERVISOR_VACIOS);
    reset({
      cargo: colaborador.rol as CargoColaborador,
      nombre: colaborador.nombre,
      email: colaborador.email,
      contrasena: '',
      porcentajeComision: colaborador.porcentajeComision,
      porcentajeComisionPro: colaborador.porcentajeComisionPro,
    });
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
    if (!nombreWatch?.trim() || !emailWatch?.trim()) {
      mostrarToast('Escribe primero el nombre y el correo para generar la contraseña.');
      return;
    }

    const nueva = generarContrasenaColaborador(nombreWatch, emailWatch);
    setValue('contrasena', nueva, { shouldValidate: true });
    setMostrarContrasena(true);
  };

  const colaboradoresOrdenados = useMemo(() => {
    const lista = [...colaboradores].filter((colaborador) => {
      const coincideNombre = colaborador.nombre
        .toLowerCase()
        .includes(filtroNombre.trim().toLowerCase());
      const coincideEmail = colaborador.email
        .toLowerCase()
        .includes(filtroEmail.trim().toLowerCase());
      const coincideRol = filtroRol === 'todos' || colaborador.rol === filtroRol;
      const coincideEstado =
        filtroEstado === 'todos' ||
        (filtroEstado === 'activo' ? colaborador.activo : !colaborador.activo);

      return coincideNombre && coincideEmail && coincideRol && coincideEstado;
    });

    lista.sort((a, b) => {
      const factor = direccionOrden === 'asc' ? 1 : -1;

      if (orden === 'nombre') {
        return a.nombre.localeCompare(b.nombre, 'es') * factor;
      }

      if (orden === 'estado') {
        const estadoA = a.activo ? 'activo' : 'inactivo';
        const estadoB = b.activo ? 'activo' : 'inactivo';
        return (
          estadoA.localeCompare(estadoB, 'es') * factor || a.nombre.localeCompare(b.nombre, 'es')
        );
      }

      if (orden === 'rol') {
        return a.rol.localeCompare(b.rol, 'es') * factor || a.nombre.localeCompare(b.nombre, 'es');
      }

      if (orden === 'recientes') {
        const accesoA = a.ultimoAcceso ? new Date(a.ultimoAcceso).getTime() : 0;
        const accesoB = b.ultimoAcceso ? new Date(b.ultimoAcceso).getTime() : 0;
        return (accesoA - accesoB) * factor || a.nombre.localeCompare(b.nombre, 'es');
      }

      return a.nombre.localeCompare(b.nombre, 'es');
    });

    return lista;
  }, [colaboradores, direccionOrden, filtroEmail, filtroEstado, filtroNombre, filtroRol, orden]);

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
          Colaboradores
        </h2>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-600">
            <span>Ordenar por</span>
            <select
              value={orden}
              onChange={(evento) => setOrden(evento.target.value as OrdenColaboradores)}
              className="bg-transparent text-sm font-semibold text-slate-900 outline-none"
            >
              <option value="recientes">Último acceso</option>
              <option value="nombre">Nombre</option>
              <option value="rol">Rol</option>
              <option value="estado">Estado</option>
            </select>
          </label>
          <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm font-semibold text-slate-600">
            <span>Dirección</span>
            <select
              value={direccionOrden}
              onChange={(evento) => setDireccionOrden(evento.target.value as DireccionOrden)}
              className="bg-transparent text-sm font-semibold text-slate-900 outline-none"
            >
              <option value="asc">Ascendente</option>
              <option value="desc">Descendente</option>
            </select>
          </label>
          <button
            onClick={() => {
              setColaboradorEdicionGeneral(null);
              setMostrarFormulario(true);
              reset({
                cargo: 'maestro',
                nombre: '',
                email: '',
                contrasena: '',
                porcentajeComision: 0,
                porcentajeComisionPro: 0,
              });
              setPermisosMaestroEditando(PERMISOS_MAESTRO_VACIOS);
              setPermisosSupervisorEditando(PERMISOS_SUPERVISOR_VACIOS);
            }}
            className="flex items-center justify-center gap-2 bg-pink-600 text-white px-5 py-3 rounded-xl font-bold shadow hover:bg-pink-700 transition-all shrink-0 w-full sm:w-auto"
          >
            <Plus className="w-4 h-4" /> Nuevo colaborador
          </button>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:grid-cols-[1.1fr_1.1fr_0.7fr_0.7fr]">
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={filtroNombre}
            onChange={(evento) => setFiltroNombre(evento.target.value)}
            placeholder="Filtrar por nombre"
            className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm font-medium outline-none focus:ring-2 focus:ring-pink-400"
          />
        </label>
        <label className="relative block">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={filtroEmail}
            onChange={(evento) => setFiltroEmail(evento.target.value)}
            placeholder="Filtrar por correo"
            className="w-full rounded-xl border border-slate-200 py-3 pl-10 pr-3 text-sm font-medium outline-none focus:ring-2 focus:ring-pink-400"
          />
        </label>
        <select
          value={filtroRol}
          onChange={(evento) => setFiltroRol(evento.target.value as 'todos' | CargoColaborador)}
          className="rounded-xl border border-slate-200 px-3 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-pink-400"
        >
          <option value="todos">Todos los roles</option>
          <option value="maestro">Administrador</option>
          <option value="supervisor">Supervisor</option>
          <option value="vendedor">Vendedor</option>
        </select>
        <select
          value={filtroEstado}
          onChange={(evento) =>
            setFiltroEstado(evento.target.value as 'todos' | 'activo' | 'inactivo')
          }
          className="rounded-xl border border-slate-200 px-3 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-pink-400"
        >
          <option value="todos">Todos los estados</option>
          <option value="activo">Activos</option>
          <option value="inactivo">Inactivos</option>
        </select>
      </div>

      {colaboradores.length === 0 ? (
        <p className="text-slate-500 text-sm">Aún no hay colaboradores registrados.</p>
      ) : (
        <div className="relative rounded-2xl border border-slate-200 bg-white">
          {/* Desktop: Tabla */}
          <div className="hidden overflow-x-auto overflow-y-visible md:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="text-left px-5 py-3 font-semibold text-slate-500 uppercase text-xs tracking-wide">
                    Nombre
                  </th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-500 uppercase text-xs tracking-wide">
                    Correo
                  </th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-500 uppercase text-xs tracking-wide">
                    Rol
                  </th>
                  <th className="text-left px-5 py-3 font-semibold text-slate-500 uppercase text-xs tracking-wide">
                    Estado
                  </th>
                  <th className="text-right px-5 py-3 font-semibold text-slate-500 uppercase text-xs tracking-wide">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {colaboradoresOrdenados.map((colaborador) => {
                  const protegido = esColaboradorProtegido(colaborador);

                  return (
                    <tr key={colaborador.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 truncate max-w-50">
                            {colaborador.nombre}
                          </span>
                          {protegido && (
                            <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-900 text-white shrink-0">
                              <ShieldCheck className="w-3 h-3" /> Protegido
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-5 py-4 text-slate-500 truncate max-w-62.5">
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
                          {colaborador.rol === 'vendedor' && (
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                              Comisión STD {colaborador.porcentajeComision}% · PRO{' '}
                              {colaborador.porcentajeComisionPro}%
                            </span>
                          )}
                          {colaborador.rol === 'maestro' &&
                            colaborador.permisos?.esMaestroTotal && (
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                                Maestro total
                              </span>
                            )}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colaborador.activo ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}
                        >
                          {colaborador.activo ? 'Activo' : 'Inactivo'}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex gap-1 items-center justify-end">
                          {colaborador.rol !== 'vendedor' && (
                            <Tooltip texto={protegido ? 'Cuenta protegida' : 'Actualizar accesos'}>
                              <button
                                onClick={() => {
                                  if (protegido) return;
                                  abrirEdicionPermisos(colaborador);
                                }}
                                aria-label={`Actualizar accesos de ${colaborador.nombre}`}
                                aria-disabled={protegido}
                                className={`p-2 rounded-xl transition-all ${protegido ? 'opacity-40 cursor-not-allowed bg-slate-50' : 'hover:bg-slate-100'}`}
                              >
                                <Settings className="w-4 h-4 text-slate-600" />
                              </button>
                            </Tooltip>
                          )}

                          <Tooltip
                            texto={protegido ? 'Cuenta protegida' : 'Actualizar información'}
                          >
                            <button
                              onClick={() => {
                                if (protegido) return;
                                abrirEdicionGeneral(colaborador);
                              }}
                              aria-label={`Actualizar información de ${colaborador.nombre}`}
                              aria-disabled={protegido}
                              className={`p-2 rounded-xl transition-all ${protegido ? 'opacity-40 cursor-not-allowed bg-slate-50' : 'hover:bg-slate-100'}`}
                            >
                              <Pencil className="w-4 h-4 text-slate-600" />
                            </button>
                          </Tooltip>

                          {!colaborador.activo && !protegido && (
                            <button
                              onClick={() => activarColaborador.mutate(colaborador.id)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-green-50 text-green-700 text-xs font-semibold hover:bg-green-100 transition-all"
                            >
                              <Power className="w-3.5 h-3.5" /> Activar
                            </button>
                          )}

                          {colaborador.activo && !protegido && (
                            <Tooltip texto="Desactivar">
                              <button
                                onClick={() => desactivarColaborador.mutate(colaborador.id)}
                                aria-label={`Desactivar a ${colaborador.nombre}`}
                                className="p-2 rounded-xl hover:bg-amber-50 transition-all"
                              >
                                <Power className="w-4 h-4 text-amber-600" />
                              </button>
                            </Tooltip>
                          )}

                          {!protegido && (
                            <Tooltip texto="Eliminar">
                              <button
                                onClick={() => eliminarColaborador.mutate(colaborador.id)}
                                aria-label={`Eliminar a ${colaborador.nombre}`}
                                className="p-2 rounded-xl hover:bg-red-50 transition-all"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </button>
                            </Tooltip>
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
            {colaboradoresOrdenados.map((colaborador) => {
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
                          aria-label={`Actualizar accesos de ${colaborador.nombre}`}
                          aria-disabled={protegido}
                          className={`p-2 rounded-xl transition-all ${protegido ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-100'}`}
                        >
                          <Settings className="w-4 h-4 text-slate-600" />
                        </button>
                      )}

                      <button
                        onClick={() => {
                          if (protegido) return;
                          abrirEdicionGeneral(colaborador);
                        }}
                        aria-label={`Actualizar información de ${colaborador.nombre}`}
                        aria-disabled={protegido}
                        className={`p-2 rounded-xl transition-all ${protegido ? 'opacity-40 cursor-not-allowed' : 'hover:bg-slate-100'}`}
                      >
                        <Pencil className="w-4 h-4 text-slate-600" />
                      </button>

                      {!colaborador.activo && !protegido && (
                        <button
                          onClick={() => activarColaborador.mutate(colaborador.id)}
                          className="flex items-center gap-1 px-2 py-1.5 rounded-xl bg-green-50 text-green-700 text-xs font-semibold"
                        >
                          <Power className="w-3.5 h-3.5" /> Activar
                        </button>
                      )}

                      {colaborador.activo && !protegido && (
                        <button
                          onClick={() => desactivarColaborador.mutate(colaborador.id)}
                          aria-label={`Desactivar a ${colaborador.nombre}`}
                          className="p-2 rounded-xl hover:bg-amber-50 transition-all"
                        >
                          <Power className="w-4 h-4 text-amber-600" />
                        </button>
                      )}

                      {!protegido && (
                        <button
                          onClick={() => eliminarColaborador.mutate(colaborador.id)}
                          aria-label={`Eliminar a ${colaborador.nombre}`}
                          className="p-2 rounded-xl hover:bg-red-50 transition-all"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${COLORES_CARGO[colaborador.rol as CargoColaborador] ?? 'bg-slate-100 text-slate-700'}`}
                    >
                      {ETIQUETAS_CARGO[colaborador.rol as CargoColaborador] ?? colaborador.rol}
                    </span>
                    {colaborador.rol === 'vendedor' && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                        Comisión STD {colaborador.porcentajeComision}% · PRO{' '}
                        {colaborador.porcentajeComisionPro}%
                      </span>
                    )}
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded-full ${colaborador.activo ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-600'}`}
                    >
                      {colaborador.activo ? 'Activo' : 'Inactivo'}
                    </span>
                    {colaborador.rol === 'maestro' && colaborador.permisos?.esMaestroTotal && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                        Maestro total
                      </span>
                    )}
                    {protegido && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-900 text-white">
                        <ShieldCheck className="w-3 h-3" /> Protegido
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
          onClick={(evento) => {
            if (evento.target === evento.currentTarget) {
              cerrarFormulario();
            }
          }}
        >
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] overflow-y-auto p-6">
            <button
              type="button"
              onClick={cerrarFormulario}
              className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>

            <h3
              id="titulo-nuevo-colaborador"
              className="text-xl font-black text-slate-900 mb-6 pr-10"
            >
              {colaboradorEdicionGeneral ? 'Actualizar información' : 'Nuevo colaborador'}
            </h3>
            <form
              onSubmit={handleSubmit((datos) => {
                if (!colaboradorEdicionGeneral && !datos.contrasena.trim()) {
                  mostrarToast('La contraseña es obligatoria para crear el colaborador.');
                  return;
                }

                if (colaboradorEdicionGeneral) {
                  actualizarColaborador.mutate({ ...datos, id: colaboradorEdicionGeneral.id });
                  return;
                }

                crearColaborador.mutate(datos);
              })}
              className="space-y-4"
            >
              {/* Cargo */}
              <div>
                <label
                  htmlFor="cargo-colaborador"
                  className="block text-sm font-semibold text-slate-700 mb-1"
                >
                  Rol
                </label>
                <select
                  id="cargo-colaborador"
                  {...register('cargo')}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-pink-400 outline-none bg-white"
                >
                  <option value="maestro">Administrador</option>
                  <option value="supervisor">Supervisor</option>
                  <option value="vendedor">Vendedor</option>
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
                  Nombre
                </label>
                <input
                  id="nombre-colaborador"
                  {...register('nombre')}
                  onInput={(evento) => {
                    const entrada = evento.currentTarget;
                    entrada.value = limpiarNombrePersonaEntrada(entrada.value);
                  }}
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
                  Correo
                </label>
                <input
                  id="email-colaborador"
                  type="email"
                  {...register('email')}
                  onInput={(evento) => {
                    const entrada = evento.currentTarget;
                    entrada.value = entrada.value.trim().toLowerCase();
                  }}
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
                  Contraseña
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      id="contrasena-colaborador"
                      type={mostrarContrasena ? 'text' : 'password'}
                      {...register('contrasena')}
                      readOnly
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 pr-10 text-sm focus:ring-2 focus:ring-pink-400 outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarContrasena((v) => !v)}
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
                  <button
                    type="button"
                    onClick={generarContrasena}
                    className="flex items-center gap-1 px-3 py-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all shrink-0"
                    aria-label="Generar contraseña automática"
                  >
                    <RefreshCw className="w-4 h-4" /> Generar
                  </button>
                </div>
                {errors.contrasena && (
                  <p className="text-xs text-red-500 mt-1">{errors.contrasena.message}</p>
                )}
                <p className="mt-1 text-xs font-medium text-slate-500">
                  La contraseña se genera automáticamente con el nombre y el correo del colaborador.
                </p>
              </div>

              {/* Permisos Admin (maestro) */}
              {cargoWatch === 'maestro' && (
                <fieldset className="border border-slate-200 rounded-xl p-4">
                  <legend className="text-sm font-bold text-slate-700 px-1">
                    Permisos de administrador
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
                      <span className="text-sm font-bold text-yellow-700">Maestro total</span>
                    </label>
                  </div>
                </fieldset>
              )}

              {/* Permisos Supervisor */}
              {cargoWatch === 'supervisor' && (
                <fieldset className="border border-slate-200 rounded-xl p-4">
                  <legend className="text-sm font-bold text-slate-700 px-1">
                    Permisos de supervisor
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
                <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-700">
                  <p>
                    Los vendedores tienen acceso restringido. Solo pueden gestionar sus
                    pre-registros y los salones asociados a su flujo comercial.
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <label
                        htmlFor="porcentaje-comision-colaborador"
                        className="block text-sm font-semibold text-slate-700 mb-1"
                      >
                        Comisión Standard (%)
                      </label>
                      <input
                        id="porcentaje-comision-colaborador"
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        {...register('porcentajeComision', { valueAsNumber: true })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-pink-400"
                      />
                      {errors.porcentajeComision && (
                        <p className="mt-1 text-xs text-red-500">
                          {errors.porcentajeComision.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        htmlFor="porcentaje-comision-pro-colaborador"
                        className="block text-sm font-semibold text-slate-700 mb-1"
                      >
                        Comisión PRO (%)
                      </label>
                      <input
                        id="porcentaje-comision-pro-colaborador"
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        {...register('porcentajeComisionPro', { valueAsNumber: true })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-pink-400"
                      />
                      {errors.porcentajeComisionPro && (
                        <p className="mt-1 text-xs text-red-500">
                          {errors.porcentajeComisionPro.message}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={cerrarFormulario}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-semibold hover:bg-slate-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    isSubmitting || crearColaborador.isPending || actualizarColaborador.isPending
                  }
                  className="px-6 py-2 rounded-xl bg-pink-600 text-white font-bold hover:bg-pink-700 transition-all disabled:opacity-50"
                >
                  {colaboradorEdicionGeneral
                    ? actualizarColaborador.isPending
                      ? 'Actualizando...'
                      : 'Actualizar cambios'
                    : crearColaborador.isPending
                      ? 'Creando...'
                      : 'Crear colaborador'}
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
          aria-labelledby="titulo-actualizar-accesos"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={(evento) => {
            if (evento.target === evento.currentTarget) {
              setColaboradorEditando(null);
            }
          }}
        >
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] overflow-y-auto p-6">
            <button
              type="button"
              onClick={() => setColaboradorEditando(null)}
              className="absolute right-4 top-4 rounded-xl p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>

            <h3
              id="titulo-actualizar-accesos"
              className="text-xl font-black text-slate-900 mb-1 pr-10"
            >
              Actualizar accesos de {colaboradorEditando.nombre}
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
                <legend className="text-sm font-bold text-slate-700 px-1">
                  Permisos de administrador
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
                      onChange={(e) => actualizarPermisoMaestro('esMaestroTotal', e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-sm font-bold text-yellow-700">Maestro total</span>
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
                Cancelar
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
                {actualizarPermisos.isPending ? 'Actualizando...' : 'Actualizar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
