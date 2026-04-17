import { Minus, Package2, Plus } from 'lucide-react';
import { formatearDinero } from '../../../utils/formato';
import type { Moneda, ProductoAdicionalReserva, ProductoPublicoReserva } from '../../../tipos';

interface PropsSelectorProductosPublicos {
  productos: ProductoPublicoReserva[];
  productosSeleccionados: ProductoAdicionalReserva[];
  moneda: Moneda;
  onAlternarProducto: (producto: ProductoPublicoReserva) => void;
  onActualizarCantidad: (productoId: string, cantidad: number) => void;
}

export function SelectorProductosPublicos({
  productos,
  productosSeleccionados,
  moneda,
  onAlternarProducto,
  onActualizarCantidad,
}: PropsSelectorProductosPublicos) {
  if (productos.length === 0) {
    return null;
  }

  return (
    <section className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Productos PRO
          </p>
          <h2 className="mt-2 flex items-center gap-2 text-lg font-black text-slate-900">
            <Package2 className="h-5 w-5 text-pink-500" /> Productos disponibles del salón
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Añade productos relacionados a tu cita si deseas reservarlos junto con el servicio.
          </p>
        </div>
      </div>

      <ul className="space-y-2">
        {productos.map((producto) => {
          const productoSeleccionado =
            productosSeleccionados.find((item) => item.id === producto.id) ?? null;
          const activo = Boolean(productoSeleccionado);

          return (
            <li key={producto.id}>
              <div
                className={`rounded-2xl border-2 p-4 transition-all ${
                  activo
                    ? 'border-pink-400 bg-pink-50'
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => onAlternarProducto(producto)}
                    className="flex flex-1 items-center gap-3 text-left"
                    aria-pressed={activo}
                  >
                    <span
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                        activo ? 'border-pink-500 bg-pink-500' : 'border-slate-300'
                      }`}
                      aria-hidden="true"
                    >
                      {activo ? <Package2 className="h-3 w-3 text-white" /> : null}
                    </span>
                    <span className="flex-1">
                      <span className="block text-sm font-medium text-slate-800">
                        {producto.nombre}
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-400">
                        {producto.categoria}
                      </span>
                    </span>
                  </button>
                  <div className="flex items-center gap-2">
                    {activo ? (
                      <span className="rounded-lg bg-amber-50 px-2 py-1 text-xs font-bold text-amber-700">
                        x{productoSeleccionado?.cantidad ?? 1}
                      </span>
                    ) : null}
                    <span className="rounded-lg bg-green-50 px-2 py-1 text-xs font-bold text-green-700">
                      {formatearDinero(producto.precio, moneda)}
                    </span>
                  </div>
                </div>

                {activo ? (
                  <div className="mt-4 flex items-center justify-end gap-2 border-t border-pink-100 pt-3">
                    <button
                      type="button"
                      onClick={() =>
                        onActualizarCantidad(
                          producto.id,
                          Math.max(1, (productoSeleccionado?.cantidad ?? 1) - 1),
                        )
                      }
                      className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-100"
                      aria-label={`Disminuir cantidad de ${producto.nombre}`}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-8 text-center text-sm font-black text-slate-900">
                      {productoSeleccionado?.cantidad ?? 1}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        onActualizarCantidad(
                          producto.id,
                          Math.min(20, (productoSeleccionado?.cantidad ?? 1) + 1),
                        )
                      }
                      className="rounded-xl border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-100"
                      aria-label={`Aumentar cantidad de ${producto.nombre}`}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
