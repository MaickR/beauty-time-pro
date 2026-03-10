import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  PlusCircle,
  RefreshCw,
  ToggleLeft,
  ToggleRight,
  Copy,
  Eye,
  EyeOff,
  AlertCircle,
} from 'lucide-react';
import { peticion } from '../../../lib/clienteHTTP';
import { usarToast } from '../../../componentes/ui/ProveedorToast';

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface UsuarioDueno {
  id: string;
  email: string;
  nombre: string;
  ultimoAcceso: string | null;
  activo: boolean;
}

interface EstudioConAdmin {
  id: string;
  nombre: string;
  pais: string;
  fechaVencimiento: string;
  creadoEn: string;
  usuarios: UsuarioDueno[];
}

interface RespuestaSalones {
  datos: EstudioConAdmin[];
}

interface ResultadoSuspender {
  datos: { activo: boolean; mensaje: string };
}

interface ResultadoReset {
  datos: { contrasenaTemporal: string; email: string };
}

// ─── Esquema del formulario nuevo salón ──────────────────────────────────────

const esquemaCrear = z.object({
  nombreSalon: z.string().min(2, 'Mínimo 2 caracteres'),
  nombreAdmin: z.string().min(2, 'Mínimo 2 caracteres'),
  email: z.string().email('Correo electrónico inválido'),
  contrasena: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Debe incluir una mayúscula')
    .regex(/[0-9]/, 'Debe incluir un número'),
  telefono: z.string().optional(),
  pais: z.enum(['Mexico', 'Colombia']),
});

type CamposCrear = z.infer<typeof esquemaCrear>;

// ─── Utilidades ──────────────────────────────────────────────────────────────

function generarContrasena(): string {
  const letras = 'abcdefghijkmnpqrstuvwxyz';
  const mayusculas = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const numeros = '23456789';
  let result = mayusculas[Math.floor(Math.random() * mayusculas.length)]!;
  result += numeros[Math.floor(Math.random() * numeros.length)]!;
  for (let i = 0; i < 7; i++) {
    const pool = letras + mayusculas + numeros;
    result += pool[Math.floor(Math.random() * pool.length)]!;
  }
  return result;
}

function formatearFecha(fechaISO: string | null): string {
  if (!fechaISO) return '—';
  return new Date(fechaISO).toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

// ─── Sub-componentes ─────────────────────────────────────────────────────────

interface PropsBadgeEstado {
  activo: boolean;
}

function BadgeEstado({ activo }: PropsBadgeEstado) {
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
        activo ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${activo ? 'bg-green-500' : 'bg-red-400'}`} />
      {activo ? 'Activo' : 'Suspendido'}
    </span>
  );
}

interface PropsFila {
  estudio: EstudioConAdmin;
  alSuspender: (id: string) => void;
  alResetear: (id: string) => void;
  suspendiendo: boolean;
  reseteando: boolean;
}

function FilaEstudio({ estudio, alSuspender, alResetear, suspendiendo, reseteando }: PropsFila) {
  const admin = estudio.usuarios[0];

  return (
    <tr className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
      <td className="px-4 py-3">
        <p className="font-semibold text-slate-900 text-sm">{estudio.nombre}</p>
        <p className="text-xs text-slate-400">{estudio.pais}</p>
      </td>
      <td className="px-4 py-3">
        {admin ? (
          <>
            <p className="text-sm text-slate-700">{admin.nombre}</p>
            <p className="text-xs text-slate-400">{admin.email}</p>
          </>
        ) : (
          <span className="text-xs text-slate-400 italic">Sin admin asignado</span>
        )}
      </td>
      <td className="px-4 py-3 text-sm text-slate-600">
        {formatearFecha(estudio.fechaVencimiento)}
      </td>
      <td className="px-4 py-3 text-sm text-slate-400">
        {admin ? formatearFecha(admin.ultimoAcceso) : '—'}
      </td>
      <td className="px-4 py-3">
        {admin ? <BadgeEstado activo={admin.activo} /> : null}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => alResetear(estudio.id)}
            disabled={!admin || reseteando}
            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={`Resetear contraseña del salón ${estudio.nombre}`}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => alSuspender(estudio.id)}
            disabled={!admin || suspendiendo}
            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            aria-label={`${admin?.activo ? 'Suspender' : 'Activar'} acceso del salón ${estudio.nombre}`}
          >
            {admin?.activo ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
          </button>
        </div>
      </td>
    </tr>
  );
}

// ─── Modal crear salón ────────────────────────────────────────────────────────

interface PropsModalCrear {
  alCerrar: () => void;
}

function ModalCrearSalon({ alCerrar }: PropsModalCrear) {
  const [mostrarContrasena, setMostrarContrasena] = useState(false);
  const queryClient = useQueryClient();
  const { mostrarToast } = usarToast();

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CamposCrear>({
    resolver: zodResolver(esquemaCrear),
    defaultValues: { pais: 'Mexico' },
  });

  const alEnviar = async (datos: CamposCrear) => {
    try {
      await peticion('/admin/salones', {
        method: 'POST',
        body: JSON.stringify(datos),
      });
      await queryClient.invalidateQueries({ queryKey: ['admin-salones'] });
      mostrarToast(`Salón "${datos.nombreSalon}" creado correctamente`);
      alCerrar();
    } catch (error) {
      setError('root', {
        message: error instanceof Error ? error.message : 'Error al crear el salón. Intenta nuevamente.',
      });
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-crear"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={alCerrar} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 id="titulo-modal-crear" className="text-xl font-black text-slate-900 mb-5">
            Crear nuevo salón
          </h2>

          <form onSubmit={handleSubmit(alEnviar)} noValidate className="space-y-4">
            {[
              { id: 'nombreSalon', label: 'Nombre del salón', type: 'text', autoComplete: 'off' },
              { id: 'nombreAdmin', label: 'Nombre del administrador', type: 'text', autoComplete: 'name' },
              { id: 'email', label: 'Correo del administrador', type: 'email', autoComplete: 'email' },
              { id: 'telefono', label: 'Teléfono (opcional)', type: 'tel', autoComplete: 'tel' },
            ].map(({ id, label, type, autoComplete }) => (
              <div key={id}>
                <label htmlFor={`crear-${id}`} className="block text-sm font-semibold text-slate-700 mb-1">
                  {label}
                </label>
                <input
                  id={`crear-${id}`}
                  type={type}
                  autoComplete={autoComplete}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                  aria-invalid={!!errors[id as keyof CamposCrear]}
                  {...register(id as keyof CamposCrear)}
                />
                {errors[id as keyof CamposCrear] && (
                  <p role="alert" className="mt-1 text-xs text-red-500 font-medium">
                    {errors[id as keyof CamposCrear]?.message}
                  </p>
                )}
              </div>
            ))}

            {/* Contraseña con generador */}
            <div>
              <label htmlFor="crear-contrasena" className="block text-sm font-semibold text-slate-700 mb-1">
                Contraseña inicial
              </label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    id="crear-contrasena"
                    type={mostrarContrasena ? 'text' : 'password'}
                    autoComplete="new-password"
                    className="w-full pl-3.5 pr-10 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                    aria-invalid={!!errors.contrasena}
                    {...register('contrasena')}
                  />
                  <button
                    type="button"
                    onClick={() => setMostrarContrasena((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
                    aria-label={mostrarContrasena ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  >
                    {mostrarContrasena ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => setValue('contrasena', generarContrasena(), { shouldValidate: true })}
                  className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-semibold text-slate-600 transition-all"
                  aria-label="Generar contraseña automática"
                >
                  Auto
                </button>
              </div>
              {errors.contrasena && (
                <p role="alert" className="mt-1 text-xs text-red-500 font-medium">
                  {errors.contrasena.message}
                </p>
              )}
            </div>

            {/* País */}
            <div>
              <label htmlFor="crear-pais" className="block text-sm font-semibold text-slate-700 mb-1">
                País
              </label>
              <select
                id="crear-pais"
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 text-sm outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-all"
                {...register('pais')}
              >
                <option value="Mexico">México</option>
                <option value="Colombia">Colombia</option>
              </select>
            </div>

            {errors.root && (
              <div role="alert" className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" aria-hidden="true" />
                <p className="text-sm text-red-600 font-medium">{errors.root.message}</p>
              </div>
            )}

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={alCerrar}
                className="flex-1 py-2.5 border border-slate-200 rounded-xl text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-all"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className="flex-1 py-2.5 bg-linear-to-r from-[#880E4F] to-[#C2185B] text-white rounded-xl text-sm font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creando...' : 'Crear salón'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ─── Modal contraseña temporal ────────────────────────────────────────────────

interface PropsModalContrasena {
  email: string;
  contrasena: string;
  alCerrar: () => void;
}

function ModalContrasena({ email, contrasena, alCerrar }: PropsModalContrasena) {
  const [copiado, setCopiado] = useState(false);

  const copiar = async () => {
    await navigator.clipboard.writeText(contrasena);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2000);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-contrasena"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={alCerrar} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h2 id="titulo-modal-contrasena" className="text-xl font-black text-slate-900 mb-1">
          Contraseña temporal
        </h2>
        <p className="text-sm text-slate-500 mb-4">
          Comparte esta contraseña con <strong>{email}</strong>. Solo se muestra una vez.
        </p>

        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between gap-3 mb-4">
          <code className="font-mono font-bold text-slate-800 text-lg tracking-widest select-all">
            {contrasena}
          </code>
          <button
            onClick={copiar}
            className="p-2 bg-amber-100 hover:bg-amber-200 rounded-lg transition-colors shrink-0"
            aria-label="Copiar contraseña al portapapeles"
          >
            <Copy className={`w-4 h-4 ${copiado ? 'text-green-600' : 'text-amber-600'}`} />
          </button>
        </div>

        <p className="text-xs text-slate-400 mb-5">
          El administrador deberá cambiar esta contraseña en su primer inicio de sesión.
        </p>

        <button
          onClick={alCerrar}
          className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-black transition-all"
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────

export function GestionCuentas() {
  const [modalCrear, setModalCrear] = useState(false);
  const [contrasenaTemporal, setContrasenaTemporal] = useState<{ email: string; contrasena: string } | null>(
    null,
  );
  const { mostrarToast } = usarToast();
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ['admin-salones'],
    queryFn: () => peticion<RespuestaSalones>('/admin/salones'),
  });

  const mutacionSuspender = useMutation({
    mutationFn: (id: string) =>
      peticion<ResultadoSuspender>(`/admin/salones/${id}/suspender`, { method: 'PUT' }),
    onSuccess: (res) => {
      void queryClient.invalidateQueries({ queryKey: ['admin-salones'] });
      mostrarToast(res.datos.mensaje);
    },
    onError: () => mostrarToast('Error al actualizar el estado. Intenta nuevamente.'),
  });

  const mutacionReset = useMutation({
    mutationFn: (id: string) =>
      peticion<ResultadoReset>(`/admin/salones/${id}/reset-contrasena`, { method: 'PUT' }),
    onSuccess: (res) => {
      setContrasenaTemporal({ email: res.datos.email, contrasena: res.datos.contrasenaTemporal });
    },
    onError: () => mostrarToast('Error al resetear la contraseña. Intenta nuevamente.'),
  });

  const salones = data?.datos ?? [];

  return (
    <section aria-labelledby="titulo-gestion-cuentas">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2
            id="titulo-gestion-cuentas"
            className="text-2xl font-black text-slate-900"
          >
            Gestión de cuentas
          </h2>
          <p className="text-sm text-slate-500">
            {salones.length} {salones.length === 1 ? 'salón registrado' : 'salones registrados'}
          </p>
        </div>
        <button
          onClick={() => setModalCrear(true)}
          className="inline-flex items-center gap-2 bg-linear-to-r from-[#880E4F] to-[#C2185B] text-white font-bold px-4 py-2.5 rounded-xl text-sm shadow-lg shadow-pink-500/25 hover:from-[#6D0B3F] hover:to-[#A3153F] transition-all"
        >
          <PlusCircle className="w-4 h-4" aria-hidden="true" />
          Crear salón
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-16" aria-busy="true" aria-label="Cargando salones">
          <span className="w-8 h-8 border-2 border-pink-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {isError && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" aria-hidden="true" />
          <p className="text-sm text-red-600">
            Error al cargar los salones. Recarga la página e intenta nuevamente.
          </p>
        </div>
      )}

      {!isLoading && !isError && salones.length === 0 && (
        <div className="text-center py-16 bg-slate-50 rounded-2xl border border-slate-200">
          <p className="text-slate-500 font-medium">No hay salones registrados aún.</p>
          <button
            onClick={() => setModalCrear(true)}
            className="mt-3 text-sm font-semibold text-pink-600 hover:text-pink-700 transition-colors"
          >
            Crear el primero
          </button>
        </div>
      )}

      {!isLoading && !isError && salones.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {['Salón', 'Administrador', 'Vencimiento', 'Último acceso', 'Estado', 'Acciones'].map(
                    (col) => (
                      <th
                        key={col}
                        scope="col"
                        className="px-4 py-3 text-xs font-black uppercase tracking-wider text-slate-500"
                      >
                        {col}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {salones.map((estudio) => (
                  <FilaEstudio
                    key={estudio.id}
                    estudio={estudio}
                    alSuspender={(id) => mutacionSuspender.mutate(id)}
                    alResetear={(id) => mutacionReset.mutate(id)}
                    suspendiendo={mutacionSuspender.isPending}
                    reseteando={mutacionReset.isPending}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modalCrear && <ModalCrearSalon alCerrar={() => setModalCrear(false)} />}

      {contrasenaTemporal && (
        <ModalContrasena
          email={contrasenaTemporal.email}
          contrasena={contrasenaTemporal.contrasena}
          alCerrar={() => setContrasenaTemporal(null)}
        />
      )}
    </section>
  );
}
