import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X, Clock, CheckCircle, XCircle, FileText, Search } from 'lucide-react';
import { obtenerMisPreregistros, crearPreregistro } from '../../../servicios/servicioVendedor';
import type { PreregistroSalon } from '../../../servicios/servicioVendedor';

const CLAVE_BORRADOR_PREREGISTRO = 'vendedor_preregistro_salon_borrador_v1';

// ─── Schema ──────────────────────────────────────────────────────────────
const esquemaFormulario = z.object({
  nombreSalon: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120),
  propietario: z.string().trim().min(2, 'Mínimo 2 caracteres').max(120),
  emailPropietario: z.string().trim().email('Correo inválido').max(120),
  telefonoPropietario: z
    .string()
    .trim()
    .regex(/^\d{10}$/, 'Se requieren 10 dígitos'),
  pais: z.enum(['Mexico', 'Colombia']),
  direccion: z.string().trim().max(180).optional(),
  descripcion: z.string().trim().max(500).optional(),
  categorias: z.string().trim().max(240).optional(),
  plan: z.enum(['STANDARD', 'PRO']),
  notas: z.string().trim().max(500).optional(),
});

type CamposFormulario = z.infer<typeof esquemaFormulario>;

const ESTADOS_BADGE: Record<string, { etiqueta: string; color: string; icono: typeof Clock }> = {
  pendiente: { etiqueta: 'Pendiente', color: 'bg-amber-100 text-amber-700', icono: Clock },
  aprobado: { etiqueta: 'Aprobado', color: 'bg-green-100 text-green-700', icono: CheckCircle },
  rechazado: { etiqueta: 'Rechazado', color: 'bg-red-100 text-red-700', icono: XCircle },
};

// ─── Componente ──────────────────────────────────────────────────────────
export function TabPreregistros() {
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [busqueda, setBusqueda] = useState('');
  const [estado, setEstado] = useState<'pendiente' | 'aprobado' | 'rechazado' | ''>('');
  const [pagina, setPagina] = useState(1);
  const clienteConsulta = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['vendedor', 'preregistros', busqueda, estado, pagina],
    queryFn: () =>
      obtenerMisPreregistros({ busqueda, estado: estado || undefined, pagina, limite: 10 }),
    staleTime: 1000 * 60 * 2,
  });

  const preregistros = data?.datos ?? [];
  const total = data?.total ?? 0;
  const totalPaginas = Math.max(1, Math.ceil(total / 10));

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CamposFormulario>({
    resolver: zodResolver(esquemaFormulario),
    defaultValues: { pais: 'Mexico', plan: 'STANDARD' },
  });

  const [errorServidor, setErrorServidor] = useState('');

  useEffect(() => {
    try {
      const borrador = window.localStorage.getItem(CLAVE_BORRADOR_PREREGISTRO);
      if (!borrador) return;
      reset(JSON.parse(borrador) as CamposFormulario);
    } catch {
      // Ignorar borrador inválido.
    }
  }, [reset]);

  useEffect(() => {
    const suscripcion = watch((valores) => {
      try {
        window.localStorage.setItem(
          CLAVE_BORRADOR_PREREGISTRO,
          JSON.stringify({
            nombreSalon: valores.nombreSalon ?? '',
            propietario: valores.propietario ?? '',
            emailPropietario: valores.emailPropietario ?? '',
            telefonoPropietario: valores.telefonoPropietario ?? '',
            pais: valores.pais ?? 'Mexico',
            direccion: valores.direccion ?? '',
            descripcion: valores.descripcion ?? '',
            categorias: valores.categorias ?? '',
            plan: valores.plan ?? 'STANDARD',
            notas: valores.notas ?? '',
          }),
        );
      } catch {
        // Ignorar almacenamiento no disponible.
      }
    });

    return () => suscripcion.unsubscribe();
  }, [watch]);

  const mutacion = useMutation({
    mutationFn: crearPreregistro,
    onSuccess: () => {
      clienteConsulta.invalidateQueries({ queryKey: ['vendedor'] });
      setMostrarFormulario(false);
      reset();
      window.localStorage.removeItem(CLAVE_BORRADOR_PREREGISTRO);
      setErrorServidor('');
    },
    onError: (err: Error) => {
      setErrorServidor(err.message || 'Ocurrió un error.');
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
    <div className="space-y-6">
      <section className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">
              Pre-registros
            </p>
            <h2 className="mt-2 text-3xl font-black text-slate-900">
              Captura prospectos de salones y mantén visible su estado.
            </h2>
          </div>
          <button
            onClick={() => {
              setMostrarFormulario(true);
              try {
                const borrador = window.localStorage.getItem(CLAVE_BORRADOR_PREREGISTRO);
                reset(borrador ? (JSON.parse(borrador) as CamposFormulario) : undefined);
              } catch {
                reset();
              }
              setErrorServidor('');
            }}
            className="flex items-center justify-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            <Plus className="w-4 h-4" />
            Nuevo pre-registro
          </button>
        </div>

        <div className="mt-6 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
          <label className="relative block">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={busqueda}
              onChange={(evento) => {
                setBusqueda(evento.target.value);
                setPagina(1);
              }}
              className="w-full rounded-2xl border border-slate-300 py-3 pl-11 pr-4 text-sm text-slate-900"
              placeholder="Buscar por salón o propietario"
            />
          </label>
          <select
            value={estado}
            onChange={(evento) => {
              setEstado(evento.target.value as typeof estado);
              setPagina(1);
            }}
            className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900"
          >
            <option value="">Todos los estados</option>
            <option value="pendiente">Pendiente</option>
            <option value="aprobado">Aprobado</option>
            <option value="rechazado">Rechazado</option>
          </select>
        </div>
      </section>

      <div className="flex items-center justify-between px-1 text-sm text-slate-500">
        <p>{total} pre-registros encontrados.</p>
        <p>
          Página {pagina} de {totalPaginas}
        </p>
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
                Nuevo pre-registro
              </h3>
              <button
                onClick={() => setMostrarFormulario(false)}
                className="p-1 rounded-lg hover:bg-slate-100 transition-colors"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>

            <div className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600">
              El borrador se guarda automáticamente mientras completas este pre-registro.
            </div>

            <form onSubmit={handleSubmit(alEnviar)} className="space-y-4">
              <Campo etiqueta="Nombre del salón" error={errors.nombreSalon?.message}>
                <input
                  {...register('nombreSalon')}
                  className={estiloInput}
                  placeholder="Ej. Studio Bella"
                />
              </Campo>

              <Campo etiqueta="Nombre del propietario" error={errors.propietario?.message}>
                <input
                  {...register('propietario')}
                  className={estiloInput}
                  placeholder="Nombre completo"
                />
              </Campo>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Campo etiqueta="Correo del propietario" error={errors.emailPropietario?.message}>
                  <input
                    {...register('emailPropietario')}
                    type="email"
                    className={estiloInput}
                    placeholder="correo@ejemplo.com"
                  />
                </Campo>
                <Campo
                  etiqueta="Teléfono del propietario"
                  error={errors.telefonoPropietario?.message}
                >
                  <input
                    {...register('telefonoPropietario')}
                    className={estiloInput}
                    placeholder="10 dígitos"
                  />
                </Campo>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Campo etiqueta="País" error={errors.pais?.message}>
                  <select {...register('pais')} className={estiloInput}>
                    <option value="Mexico">México</option>
                    <option value="Colombia">Colombia</option>
                  </select>
                </Campo>
                <Campo etiqueta="Plan" error={errors.plan?.message}>
                  <select {...register('plan')} className={estiloInput}>
                    <option value="STANDARD">Estándar</option>
                    <option value="PRO">Pro</option>
                  </select>
                </Campo>
              </div>

              <Campo etiqueta="Dirección" error={errors.direccion?.message}>
                <input {...register('direccion')} className={estiloInput} placeholder="Opcional" />
              </Campo>

              <Campo etiqueta="Categorías" error={errors.categorias?.message}>
                <input
                  {...register('categorias')}
                  className={estiloInput}
                  placeholder="Ej. Hair, Nails, Spa"
                />
              </Campo>

              <Campo etiqueta="Descripción" error={errors.descripcion?.message}>
                <textarea
                  {...register('descripcion')}
                  className={estiloInput}
                  rows={2}
                  placeholder="Notas opcionales sobre el salón"
                />
              </Campo>

              <Campo etiqueta="Notas internas" error={errors.notas?.message}>
                <textarea
                  {...register('notas')}
                  className={estiloInput}
                  rows={2}
                  placeholder="Notas para el equipo administrativo"
                />
              </Campo>

              {errorServidor && <p className="text-sm text-red-600 font-medium">{errorServidor}</p>}

              <div className="flex gap-3 justify-end pt-2">
                <button
                  type="button"
                  onClick={() => {
                    window.localStorage.removeItem(CLAVE_BORRADOR_PREREGISTRO);
                    reset();
                    setMostrarFormulario(false);
                  }}
                  className="px-4 py-2 text-sm font-semibold text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
                >
                  Limpiar borrador
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || mutacion.isPending}
                  className="px-5 py-2 text-sm font-bold text-white bg-pink-600 rounded-lg hover:bg-pink-700 disabled:opacity-50 transition-colors"
                >
                  {mutacion.isPending ? 'Enviando...' : 'Enviar pre-registro'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Lista de preregistros */}
      {!preregistros || preregistros.length === 0 ? (
        <div className="rounded-4xl border border-slate-200 bg-white py-16 text-center shadow-sm">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-4" aria-hidden="true" />
          <p className="text-slate-500 font-medium">Aún no tienes pre-registros</p>
          <p className="text-slate-400 text-sm mt-1">
            Usa el botón superior para capturar tu siguiente prospecto.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {preregistros.map((pr) => (
            <TarjetaPreregistro key={pr.id} preregistro={pr} />
          ))}
        </div>
      )}

      {totalPaginas > 1 && (
        <div className="flex justify-center gap-2">
          <button
            type="button"
            disabled={pagina <= 1}
            onClick={() => setPagina((valor) => Math.max(1, valor - 1))}
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200 disabled:opacity-40"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={pagina >= totalPaginas}
            onClick={() => setPagina((valor) => Math.min(totalPaginas, valor + 1))}
            className="rounded-full bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-200 disabled:opacity-40"
          >
            Siguiente
          </button>
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
              <strong>Motivo:</strong> {pr.motivoRechazo}
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
