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
    <section className="rounded-4xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Extra opcional PRO
          </p>
          <h2 className="mt-2 flex items-center gap-2 text-lg font-black text-slate-900">
            <Package2 className="h-5 w-5 text-pink-500" /> Productos para sumar a la cita
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Selecciona productos si el cliente desea apartarlos junto con el servicio.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {productos.map((producto) => {
          const productoSeleccionado = productosSeleccionados.find((item) => item.id === producto.id) ?? null;
          const activo = Boolean(productoSeleccionado);

          return (
            <div
              key={producto.id}
              className={`rounded-3xl border p-4 transition ${activo ? 'border-pink-300 bg-pink-50' : 'border-slate-200 bg-slate-50'}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-900">{producto.nombre}</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">{producto.categoria}</p>
                </div>
                <p className="text-sm font-black text-pink-600">{formatearDinero(producto.precio, moneda)}</p>
              </div>

              <div className="mt-4 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={() => onAlternarProducto(producto)}
                  className={`rounded-2xl px-4 py-3 text-xs font-black uppercase tracking-[0.18em] transition ${activo ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}
                >
                  {activo ? 'Quitar' : 'Agregar'}
                </button>

                {activo ? (
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-pink-200 bg-white px-2 py-2">
                    <button
                      type="button"
                      onClick={() => onActualizarCantidad(producto.id, Math.max(1, (productoSeleccionado?.cantidad ?? 1) - 1))}
                      className="rounded-xl p-2 text-slate-600 transition hover:bg-slate-100"
                      aria-label={`Disminuir cantidad de ${producto.nombre}`}
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="min-w-8 text-center text-sm font-black text-slate-900">
                      {productoSeleccionado?.cantidad ?? 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => onActualizarCantidad(producto.id, Math.min(20, (productoSeleccionado?.cantidad ?? 1) + 1))}
                      className="rounded-xl p-2 text-slate-600 transition hover:bg-slate-100"
                      aria-label={`Aumentar cantidad de ${producto.nombre}`}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}