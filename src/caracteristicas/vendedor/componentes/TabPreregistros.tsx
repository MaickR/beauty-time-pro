import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X, Clock, CheckCircle, XCircle, FileText } from 'lucide-react';
import { obtenerMisPreregistros, crearPreregistro } from '../../../servicios/servicioVendedor';
import type { PreregistroSalon } from '../../../servicios/servicioVendedor';

// ─── Schema ──────────────────────────────────────────────────────────────
const esquemaFormulario = z.object({
  nombreSalon: z.string().trim().min(2, 'Minimum 2 characters').max(120),
  propietario: z.string().trim().min(2, 'Minimum 2 characters').max(120),
  emailPropietario: z.string().trim().email('Invalid email').max(120),
  telefonoPropietario: z
    .string()
    .trim()
    .regex(/^\d{10}$/, '10-digit phone number required'),
  pais: z.enum(['Mexico', 'Colombia']),
  direccion: z.string().trim().max(180).optional(),
  descripcion: z.string().trim().max(500).optional(),
  categorias: z.string().trim().max(240).optional(),
  plan: z.enum(['STANDARD', 'PRO']),
  notas: z.string().trim().max(500).optional(),
});

type CamposFormulario = z.infer<typeof esquemaFormulario>;

const ESTADOS_BADGE: Record<string, { etiqueta: string; color: string; icono: typeof Clock }> = {
  pendiente: { etiqueta: 'Pending', color: 'bg-amber-100 text-amber-700', icono: Clock },
  aprobado: { etiqueta: 'Approved', color: 'bg-green-100 text-green-700', icono: CheckCircle },
  rechazado: { etiqueta: 'Rejected', color: 'bg-red-100 text-red-700', icono: XCircle },
};

// ─── Componente ──────────────────────────────────────────────────────────
export function TabPreregistros() {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const clienteConsulta = useQueryClient();

  const { data: preregistros, isLoading } = useQuery({
    queryKey: ['vendedor', 'preregistros'],
    queryFn: obtenerMisPreregistros,
    staleTime: 1000 * 60 * 2,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CamposFormulario>({
    resolver: zodResolver(esquemaFormulario),
    defaultValues: { pais: 'Mexico', plan: 'STANDARD' },
  });

  const [errorServidor, setErrorServidor] = useState('');

  const mutacion = useMutation({
    mutationFn: crearPreregistro,
    onSuccess: () => {
      clienteConsulta.invalidateQueries({ queryKey: ['vendedor'] });
      setMostrarFormulario(false);
      reset();
      setErrorServidor('');
    },
    onError: (err: Error) => {
      setErrorServidor(err.message || 'An error occurred.');
    },
  });

  const alEnviar = (datos: CamposFormulario) => {
    setErrorServidor('');
    mutacion.mutate(datos);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-pink-600" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-slate-900">Pre-registrations</h2>
        <button
          onClick={() => {
            setMostrarFormulario(true);
            reset();
            setErrorServidor('');
          }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-pink-600 rounded-lg hover:bg-pink-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          New
        </button>
      </div>

      {/* Modal formulario */}
      {mostrarFormulario && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-labelledby="titulo-preregistro"
          onClick={() => setMostrarFormulario(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 id="titulo-preregistro" className="text-lg font-bold text-slate-900">
                New Pre-registration
              </h3>
              <button
                onClick={() => setMostrarFormulario(false)}
                className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Close"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <form onSubmit={handleSubmit(alEnviar)} className="space-y-4">
              <Campo etiqueta="Salon Name" error={errors.nombreSalon?.message}>
                <input
                  {...register('nombreSalon')}
                  className={estiloInput}
                  placeholder="Ej. Studio Bella"
                />
              </Campo>

              <Campo etiqueta="Owner Name" error={errors.propietario?.message}>
                <input
                  {...register('propietario')}
                  className={estiloInput}
                  placeholder="Full name"
                />
              </Campo>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Campo etiqueta="Owner Email" error={errors.emailPropietario?.message}>
                  <input
                    {...register('emailPropietario')}
                    type="email"
                    className={estiloInput}
                    placeholder="email@example.com"
                  />
                </Campo>
                <Campo etiqueta="Owner Phone" error={errors.telefonoPropietario?.message}>
                  <input
                    {...register('telefonoPropietario')}
                    className={estiloInput}
                    placeholder="10 digits"
                  />
                </Campo>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Campo etiqueta="Country" error={errors.pais?.message}>
                  <select {...register('pais')} className={estiloInput}>
                    <option value="Mexico">Mexico</option>
                    <option value="Colombia">Colombia</option>
                  </select>
                </Campo>
                <Campo etiqueta="Plan" error={errors.plan?.message}>
                  <select {...register('plan')} className={estiloInput}>
                    <option value="STANDARD">Standard</option>
                    <option value="PRO">Pro</option>
                  </select>
                </Campo>
              </div>

              <Campo etiqueta="Address" error={errors.direccion?.message}>
                <input {...register('direccion')} className={estiloInput} placeholder="Optional" />
              </Campo>

              <Campo etiqueta="Categories" error={errors.categorias?.message}>
                <input
                  {...register('categorias')}
                  className={estiloInput}
                  placeholder="Ej. Hair, Nails, Spa"
                />
              </Campo>

              <Campo etiqueta="Description" error={errors.descripcion?.message}>
                <textarea
                  {...register('descripcion')}
                  className={estiloInput}
                  rows={2}
                  placeholder="Optional notes about the salon"
                />
              </Campo>

              <Campo etiqueta="Internal Notes" error={errors.notas?.message}>
                <textarea
                  {...register('notas')}
                  className={estiloInput}
                  rows={2}
                  placeholder="Notes for the admin team"
                />
              </Campo>

              {errorServidor && <p className="text-sm text-red-600 font-medium">{errorServidor}</p>}

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setMostrarFormulario(false)}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || mutacion.isPending}
                  className="px-5 py-2 text-sm font-bold text-white bg-pink-600 rounded-lg hover:bg-pink-700 disabled:opacity-50 transition-colors"
                >
                  {mutacion.isPending ? 'Submitting...' : 'Submit Pre-registration'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lista de preregistros */}
      {!preregistros || preregistros.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" aria-hidden="true" />
          <p className="text-slate-500 font-medium">No pre-registrations yet</p>
          <p className="text-slate-400 text-sm mt-1">Click "New" to register your first salon.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {preregistros.map((pr) => (
            <TarjetaPreregistro key={pr.id} preregistro={pr} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Tarjeta ─────────────────────────────────────────────────────────────

function TarjetaPreregistro({ preregistro: pr }: { preregistro: PreregistroSalon }) {
  const badge = ESTADOS_BADGE[pr.estado] ?? ESTADOS_BADGE.pendiente;
  const Icono = badge.icono;

  return (
    <article className="bg-white rounded-2xl border border-slate-100 p-4 md:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-bold text-slate-900">{pr.nombreSalon}</p>
          <p className="text-sm text-slate-500 mt-0.5">
            {pr.propietario} &middot; {pr.emailPropietario}
          </p>
          <p className="text-xs text-slate-400 mt-1">
            {pr.pais} &middot; {pr.plan} &middot; {new Date(pr.creadoEn).toLocaleDateString()}
          </p>
          {pr.estado === 'rechazado' && pr.motivoRechazo && (
            <p className="text-xs text-red-600 mt-2 bg-red-50 p-2 rounded-lg">
              <strong>Reason:</strong> {pr.motivoRechazo}
            </p>
          )}
        </div>
        <span
          className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold shrink-0 ${badge.color}`}
        >
          <Icono className="w-3.5 h-3.5" aria-hidden="true" />
          {badge.etiqueta}
        </span>
      </div>
    </article>
  );
}

// ─── Helpers de estilo ───────────────────────────────────────────────────

const estiloInput =
  'w-full px-3 py-2 border border-slate-300 rounded-lg text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent transition-colors';

function Campo({
  etiqueta,
  error,
  children,
}: {
  etiqueta: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1">{etiqueta}</label>
      {children}
      {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
    </div>
  );
}
