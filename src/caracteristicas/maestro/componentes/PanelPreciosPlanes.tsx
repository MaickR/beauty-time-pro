import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PencilLine, Tags, WalletCards } from 'lucide-react';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { EsqueletoTarjeta } from '../../../componentes/ui/Esqueleto';
import { BanderaPais } from '../../../componentes/ui/BanderaPais';
import { formatearDinero, formatearPlan } from '../../../utils/formato';
import {
  actualizarPrecioPlan,
  obtenerGestionPreciosPlanes,
  type PrecioPlanActual,
} from '../../../servicios/servicioPreciosPlanes';

interface PropsPanelPreciosPlanes {
  onActualizado?: () => void;
}

interface PrecioEditable {
  plan: 'STANDARD' | 'PRO';
  pais: 'Mexico' | 'Colombia';
  moneda: 'MXN' | 'COP';
  monto: string;
}

const ORDEN_PAIS: Record<string, number> = { Mexico: 0, Colombia: 1 };
const ORDEN_PLAN: Record<string, number> = { STANDARD: 0, PRO: 1 };

function TarjetaResumen({
  etiqueta,
  valor,
  colorFondo = 'bg-slate-950',
  colorTexto = 'text-white',
  colorEtiqueta = 'text-white/60',
}: {
  etiqueta: string;
  valor: number;
  colorFondo?: string;
  colorTexto?: string;
  colorEtiqueta?: string;
}) {
  return (
    <article
      className={`flex min-h-34 flex-col items-center justify-center rounded-3xl ${colorFondo} p-6 text-center shadow-sm`}
    >
      <p className={`text-[11px] font-black uppercase tracking-[0.2em] ${colorEtiqueta}`}>
        {etiqueta}
      </p>
      <p className={`mt-3 text-5xl font-black leading-none tabular-nums sm:text-6xl ${colorTexto}`}>
        {valor.toLocaleString('es-MX')}
      </p>
    </article>
  );
}

function ordenarPrecios(precios: PrecioPlanActual[]) {
  return [...precios].sort(
    (a, b) =>
      (ORDEN_PAIS[a.pais] ?? 99) - (ORDEN_PAIS[b.pais] ?? 99) ||
      (ORDEN_PLAN[a.plan] ?? 99) - (ORDEN_PLAN[b.plan] ?? 99),
  );
}

export function PanelPreciosPlanes({ onActualizado }: PropsPanelPreciosPlanes) {
  const [precioEditable, setPrecioEditable] = useState<PrecioEditable | null>(null);
  const clienteConsulta = useQueryClient();
  const { mostrarToast } = usarToast();

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'precios-planes'],
    queryFn: obtenerGestionPreciosPlanes,
    staleTime: 30_000,
  });

  const precios = useMemo(() => ordenarPrecios(data?.precios ?? []), [data?.precios]);

  const mutacionActualizar = useMutation({
    mutationFn: actualizarPrecioPlan,
    onSuccess: async (resultado) => {
      await clienteConsulta.invalidateQueries({ queryKey: ['admin', 'precios-planes'] });
      await clienteConsulta.invalidateQueries({ queryKey: ['admin', 'metricas'] });
      if (onActualizado) onActualizado();

      const cambio = resultado.cambio;
      if (cambio) {
        mostrarToast({
          mensaje: `Precio actualizado. ${cambio.salonesProgramados} salones activos lo aplicarán en su próximo corte.`,
          variante: 'exito',
        });
      }
      setPrecioEditable(null);
    },
    onError: (error: Error) => {
      mostrarToast({ mensaje: error.message, variante: 'error' });
    },
  });

  const abrirEdicion = (precio: PrecioPlanActual) => {
    setPrecioEditable({
      plan: precio.plan,
      pais: precio.pais,
      moneda: precio.moneda,
      monto: String(Math.trunc(precio.monto / 100)),
    });
  };

  const guardarPrecio = () => {
    if (!precioEditable) return;
    const monto = Number(precioEditable.monto);
    if (!Number.isInteger(monto) || monto <= 0) {
      mostrarToast({ mensaje: 'Captura un monto entero válido.', variante: 'error' });
      return;
    }
    mutacionActualizar.mutate({
      plan: precioEditable.plan,
      pais: precioEditable.pais,
      monto,
    });
  };

  return (
    <section aria-labelledby="titulo-precios-planes" className="space-y-6">
      {/* Header */}
      <div>
        <h2 id="titulo-precios-planes" className="text-2xl font-black text-slate-900 mb-2">
          Precios y planes
        </h2>
        <p className="max-w-3xl text-sm font-medium text-slate-500">
          Los cambios se guardan en base de datos. Los salones activos conservan su precio actual
          hasta su próxima fecha de corte; las nuevas altas toman el precio vigente inmediatamente.
        </p>
      </div>

      {/* Métricas: 1 col en móvil → 3 col desde sm */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <EsqueletoTarjeta key={i} className="h-32 rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <TarjetaResumen
            etiqueta="Suscripciones activas"
            valor={data?.metricas.totalSuscripcionesActivas ?? 0}
            colorFondo="bg-slate-950"
            colorTexto="text-white"
            colorEtiqueta="text-white/60"
          />
          <TarjetaResumen
            etiqueta="Activas Standard"
            valor={data?.metricas.totalActivasStandard ?? 0}
            colorFondo="bg-slate-100"
            colorTexto="text-slate-900"
            colorEtiqueta="text-slate-500"
          />
          <TarjetaResumen
            etiqueta="Activas Pro"
            valor={data?.metricas.totalActivasPro ?? 0}
            colorFondo="bg-pink-600"
            colorTexto="text-white"
            colorEtiqueta="text-white/70"
          />
        </div>
      )}

      {/* Planes: 1 col móvil → 2 col desde sm → 4 col desde lg */}
      <div>
        <h3 className="mb-4 text-xs font-black uppercase tracking-[0.2em] text-slate-400">
          Precios vigentes por plan y país
        </h3>
        {isLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <EsqueletoTarjeta key={i} className="h-52 rounded-3xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {precios.map((precio) => {
              const esPro = precio.plan === 'PRO';
              return (
                <article
                  key={precio.id}
                  className="flex flex-col rounded-3xl border border-slate-100 bg-white shadow-sm overflow-hidden"
                >
                  {/* Banda superior según plan */}
                  <div
                    className={`flex items-center justify-between px-5 py-3 ${esPro ? 'bg-pink-600' : 'bg-slate-950'}`}
                  >
                    <div className="flex items-center gap-2">
                      <BanderaPais pais={precio.pais} />
                      <span className="text-[11px] font-black uppercase tracking-[0.18em] text-white">
                        {formatearPlan(precio.plan)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => abrirEdicion(precio)}
                      className="rounded-xl bg-white/15 p-2 text-white transition-colors hover:bg-white/25"
                      aria-label={`Editar precio ${precio.plan} ${precio.pais}`}
                    >
                      <PencilLine className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Cuerpo */}
                  <div className="flex flex-1 flex-col gap-4 p-5">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">
                        País
                      </p>
                      <p className="mt-1 text-base font-black text-slate-900">{precio.pais}</p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 px-4 py-4">
                      <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">
                        Precio mensual
                      </p>
                      <p className="mt-1 text-2xl font-black text-slate-900">
                        {formatearDinero(precio.monto, precio.moneda)}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        {precio.moneda} · v{precio.version}
                      </p>
                    </div>

                    <div className="mt-auto flex flex-col gap-1.5 text-xs font-semibold text-slate-500">
                      <span className="inline-flex items-center gap-1.5">
                        <WalletCards className="h-3.5 w-3.5 text-slate-400" />
                        Moneda: {precio.moneda}
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Tags className="h-3.5 w-3.5 text-slate-400" />
                        Vigente desde:{' '}
                        {new Date(precio.vigenteDesde).toLocaleDateString('es-MX', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal edición */}
      {precioEditable && (
        <div className="fixed inset-0 z-220 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-4xl bg-white p-6 shadow-2xl">
            <h3 className="text-2xl font-black text-slate-900">
              Editar precio {formatearPlan(precioEditable.plan)} · {precioEditable.pais}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              Captura el valor mensual en {precioEditable.moneda}. El sistema programará
              automáticamente su entrada en vigor por fecha de corte.
            </p>

            <label className="mt-6 block text-sm font-black text-slate-700">
              Precio mensual ({precioEditable.moneda})
            </label>
            <input
              type="number"
              min={1}
              step={1}
              value={precioEditable.monto}
              onChange={(evento) =>
                setPrecioEditable((actual) =>
                  actual ? { ...actual, monto: evento.target.value } : actual,
                )
              }
              className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-lg font-black text-slate-900 outline-none focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
            />

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setPrecioEditable(null)}
                className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-black text-slate-600 hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={guardarPrecio}
                disabled={mutacionActualizar.isPending}
                className="rounded-2xl bg-pink-600 px-5 py-3 text-sm font-black text-white hover:bg-pink-700 disabled:opacity-50"
              >
                {mutacionActualizar.isPending ? 'Guardando...' : 'Guardar precio'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
