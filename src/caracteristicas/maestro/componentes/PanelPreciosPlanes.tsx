import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { PencilLine, Tags, WalletCards } from 'lucide-react';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { EsqueletoTarjeta } from '../../../componentes/ui/Esqueleto';
import { formatearDinero } from '../../../utils/formato';
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

function TarjetaResumen({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">{etiqueta}</p>
      <p className="mt-3 text-3xl font-black text-slate-900">{valor.toLocaleString('es-MX')}</p>
    </article>
  );
}

function ordenarPrecios(precios: PrecioPlanActual[]) {
  return [...precios].sort((a, b) => `${a.plan}-${a.pais}`.localeCompare(`${b.plan}-${b.pais}`));
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
    <section aria-labelledby="titulo-precios-planes" className="space-y-5">
      <div>
        <h2 id="titulo-precios-planes" className="text-2xl font-black text-slate-900 mb-2">
          Precios y planes
        </h2>
        <p className="max-w-3xl text-sm font-medium text-slate-500">
          Los cambios se guardan en base de datos. Los salones activos conservan su precio actual
          hasta su próxima fecha de corte; las nuevas altas toman el precio vigente inmediatamente.
        </p>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, indice) => (
            <EsqueletoTarjeta key={indice} className="h-28 rounded-3xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <TarjetaResumen
            etiqueta="Suscripciones activas"
            valor={data?.metricas.totalSuscripcionesActivas ?? 0}
          />
          <TarjetaResumen
            etiqueta="Activas Standard"
            valor={data?.metricas.totalActivasStandard ?? 0}
          />
          <TarjetaResumen etiqueta="Activas Pro" valor={data?.metricas.totalActivasPro ?? 0} />
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-4">
        {isLoading
          ? Array.from({ length: 4 }).map((_, indice) => (
              <EsqueletoTarjeta key={indice} className="h-48 rounded-3xl" />
            ))
          : precios.map((precio) => (
              <article
                key={precio.id}
                className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">
                      {precio.plan === 'PRO' ? 'Pro' : 'Standard'}
                    </p>
                    <h3 className="mt-2 text-xl font-black text-slate-900">{precio.pais}</h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => abrirEdicion(precio)}
                    className="rounded-2xl border border-pink-200 bg-pink-50 p-3 text-pink-700 transition-colors hover:bg-pink-100"
                    aria-label={`Editar precio ${precio.plan} ${precio.pais}`}
                  >
                    <PencilLine className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-5 rounded-3xl bg-slate-950 p-5 text-white">
                  <p className="text-[11px] font-black uppercase tracking-[0.2em] text-white/60">
                    Precio vigente
                  </p>
                  <p className="mt-3 text-3xl font-black">
                    {formatearDinero(precio.monto, precio.moneda)}
                  </p>
                  <p className="mt-2 text-sm font-medium text-white/70">Versión {precio.version}</p>
                </div>

                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <p className="flex items-center gap-2">
                    <WalletCards className="h-4 w-4 text-slate-400" /> Moneda: {precio.moneda}
                  </p>
                  <p className="flex items-center gap-2">
                    <Tags className="h-4 w-4 text-slate-400" /> Vigente desde:{' '}
                    {new Date(precio.vigenteDesde).toLocaleDateString('es-MX')}
                  </p>
                </div>
              </article>
            ))}
      </div>

      {precioEditable && (
        <div className="fixed inset-0 z-[220] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-[2rem] bg-white p-6 shadow-2xl">
            <h3 className="text-2xl font-black text-slate-900">
              Editar precio {precioEditable.plan === 'PRO' ? 'Pro' : 'Standard'} ·{' '}
              {precioEditable.pais}
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
