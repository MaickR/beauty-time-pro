import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CircleCheck, CircleOff, Pencil, Plus, Search, Sparkles, Trash2, X } from 'lucide-react';
import { DialogoConfirmacion } from '../../../componentes/ui/DialogoConfirmacion';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { BotonIconoAccion } from '../../../componentes/ui/BotonIconoAccion.tsx';
import {
  crearProducto,
  editarProducto,
  eliminarProducto,
  obtenerProductos,
  type Producto,
} from '../../../servicios/servicioProductos';
import {
  convertirCentavosAMoneda,
  convertirMonedaACentavos,
  formatearDinero,
} from '../../../utils/formato';
import type { Moneda } from '../../../tipos';

interface PropsPanelProductos {
  estudioId: string;
  moneda: Moneda;
  plan: 'STANDARD' | 'PRO';
}

const CATEGORIAS_PRODUCTO = [
  'General',
  'Cabello',
  'Piel',
  'Uñas',
  'Maquillaje',
  'Herramientas',
  'Otra',
] as const;

export function PanelProductos({ estudioId, moneda, plan }: PropsPanelProductos) {
  const { mostrarToast } = usarToast();
  const clienteConsulta = useQueryClient();
  const claveConsulta = ['productos', estudioId];

  const { data: productos = [], isLoading } = useQuery({
    queryKey: claveConsulta,
    queryFn: () => obtenerProductos(estudioId),
    enabled: plan === 'PRO',
    staleTime: 2 * 60 * 1000,
  });

  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [editando, setEditando] = useState<Producto | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [productoPendienteEliminar, setProductoPendienteEliminar] = useState<Producto | null>(null);
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('General');
  const [precioTexto, setPrecioTexto] = useState('');

  const categoriasExistentes = useMemo(() => {
    const categorias = new Set(productos.map((producto) => producto.categoria));
    return Array.from(categorias).sort();
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    let resultado = productos;

    if (busqueda.trim()) {
      const termino = busqueda.toLowerCase();
      resultado = resultado.filter((producto) => producto.nombre.toLowerCase().includes(termino));
    }

    if (filtroCategoria) {
      resultado = resultado.filter((producto) => producto.categoria === filtroCategoria);
    }

    return resultado;
  }, [productos, busqueda, filtroCategoria]);

  const mutacionCrear = useMutation({
    mutationFn: (datos: { nombre: string; categoria: string; precio: number }) =>
      crearProducto(estudioId, datos),
    onSuccess: () => {
      void clienteConsulta.invalidateQueries({ queryKey: claveConsulta });
      mostrarToast('Producto creado');
      limpiarFormulario();
    },
    onError: () => mostrarToast('No se pudo crear el producto'),
  });

  const mutacionEditar = useMutation({
    mutationFn: (datos: { id: string; nombre: string; categoria: string; precio: number }) =>
      editarProducto(estudioId, datos.id, {
        nombre: datos.nombre,
        categoria: datos.categoria,
        precio: datos.precio,
      }),
    onSuccess: () => {
      void clienteConsulta.invalidateQueries({ queryKey: claveConsulta });
      mostrarToast('Producto actualizado');
      limpiarFormulario();
    },
    onError: () => mostrarToast('No se pudo actualizar el producto'),
  });

  const mutacionEliminar = useMutation({
    mutationFn: (id: string) => eliminarProducto(estudioId, id),
    onSuccess: () => {
      void clienteConsulta.invalidateQueries({ queryKey: claveConsulta });
      mostrarToast('Producto eliminado');
    },
    onError: () => mostrarToast('No se pudo eliminar el producto'),
  });

  const mutacionToggle = useMutation({
    mutationFn: (producto: Producto) => editarProducto(estudioId, producto.id, { activo: !producto.activo }),
    onSuccess: () => {
      void clienteConsulta.invalidateQueries({ queryKey: claveConsulta });
      mostrarToast('Estado del producto actualizado');
    },
    onError: () => mostrarToast('No se pudo actualizar el estado del producto'),
  });

  function limpiarFormulario() {
    setNombre('');
    setCategoria('General');
    setPrecioTexto('');
    setEditando(null);
    setMostrarFormulario(false);
  }

  function iniciarEdicion(producto: Producto) {
    setEditando(producto);
    setNombre(producto.nombre);
    setCategoria(producto.categoria);
    setPrecioTexto(String(convertirCentavosAMoneda(producto.precio)));
    setMostrarFormulario(true);
  }

  function enviar() {
    if (!nombre.trim()) {
      mostrarToast('El nombre del producto es obligatorio');
      return;
    }

    const precioNumero = Number(precioTexto);
    if (!precioNumero || precioNumero <= 0) {
      mostrarToast('El precio debe ser mayor a 0');
      return;
    }

    const precioCentavos = convertirMonedaACentavos(precioNumero);

    if (editando) {
      mutacionEditar.mutate({
        id: editando.id,
        nombre: nombre.trim(),
        categoria,
        precio: precioCentavos,
      });
      return;
    }

    mutacionCrear.mutate({
      nombre: nombre.trim(),
      categoria,
      precio: precioCentavos,
    });
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-pink-600 border-t-transparent" />
      </div>
    );
  }

  if (plan !== 'PRO') {
    return (
      <div className="max-w-4xl rounded-4xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 rounded-3xl border border-amber-200 bg-linear-to-br from-amber-50 via-white to-pink-50 p-5 sm:p-6">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700">
            <Sparkles className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-black uppercase tracking-[0.25em] text-amber-700">
              Función Pro
            </p>
            <h3 className="text-2xl font-black tracking-tight text-slate-900">
              El catálogo de productos está disponible solo en membresías PRO
            </h3>
            <p className="max-w-2xl text-sm text-slate-600">
              Al subir de plan podrás gestionar productos extra, mostrarlos en tus flujos de venta y mantenerlos visibles u ocultos con control total desde este panel.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col gap-3 rounded-4xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar productos..."
              value={busqueda}
              onChange={(evento) => setBusqueda(evento.target.value)}
              className="w-full rounded-2xl border border-slate-200 py-3 pl-10 pr-4 text-sm outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
            />
          </div>

          {!mostrarFormulario && (
            <button
              type="button"
              onClick={() => setMostrarFormulario(true)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-(--color-primario) px-5 py-3 text-sm font-black uppercase tracking-widest text-white shadow-sm transition-colors hover:bg-(--color-primario-oscuro) sm:w-auto"
            >
              <Plus className="h-4 w-4" /> Agregar producto
            </button>
          )}
        </div>

        {categoriasExistentes.length > 1 && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label
              htmlFor="filtro-categoria"
              className="text-xs font-black uppercase tracking-widest text-slate-500"
            >
              Filtrar por categoría
            </label>
            <select
              id="filtro-categoria"
              value={filtroCategoria}
              onChange={(evento) => setFiltroCategoria(evento.target.value)}
              className="w-full rounded-2xl border border-slate-200 px-3 py-3 text-sm outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100 sm:w-auto"
              aria-label="Filtrar por categoría"
            >
              <option value="">Todas las categorías</option>
              {categoriasExistentes.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {mostrarFormulario && (
        <div className="space-y-4 rounded-4xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-lg font-black uppercase tracking-tight text-slate-900">
              {editando ? 'Editar producto' : 'Nuevo producto'}
            </h3>
            <button
              type="button"
              onClick={limpiarFormulario}
              className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Cerrar formulario"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label htmlFor="nombreProducto" className="mb-1 block text-sm font-bold text-slate-700">
                Nombre
              </label>
              <input
                id="nombreProducto"
                type="text"
                value={nombre}
                onChange={(evento) => setNombre(evento.target.value)}
                placeholder="Ej: Shampoo de queratina"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
              />
            </div>
            <div>
              <label htmlFor="categoriaProducto" className="mb-1 block text-sm font-bold text-slate-700">
                Categoría
              </label>
              <select
                id="categoriaProducto"
                value={categoria}
                onChange={(evento) => setCategoria(evento.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
              >
                {CATEGORIAS_PRODUCTO.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="precioProducto" className="mb-1 block text-sm font-bold text-slate-700">
                Precio
              </label>
              <input
                id="precioProducto"
                type="number"
                min="1"
                step="1"
                value={precioTexto}
                onChange={(evento) => setPrecioTexto(evento.target.value)}
                placeholder="350"
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={enviar}
            disabled={mutacionCrear.isPending || mutacionEditar.isPending}
            className="w-full rounded-2xl bg-(--color-primario) px-6 py-3 text-sm font-black uppercase tracking-widest text-white shadow-sm transition-colors hover:bg-(--color-primario-oscuro) disabled:opacity-60 sm:w-auto"
          >
            {mutacionCrear.isPending || mutacionEditar.isPending
              ? 'Guardando...'
              : editando
                ? 'Guardar cambios'
                : 'Agregar producto'}
          </button>
        </div>
      )}

      {productosFiltrados.length === 0 ? (
        <div className="rounded-4xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="font-bold text-slate-400">
            {productos.length === 0
              ? 'Aún no tienes productos. Agrega el primero.'
              : 'No hay productos que coincidan con tu búsqueda.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {productosFiltrados.map((producto) => (
            <article
              key={producto.id}
              className={`rounded-4xl border border-slate-200 bg-white p-4 shadow-sm transition-opacity sm:p-5 ${!producto.activo ? 'opacity-55' : ''}`}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="wrap-break-word text-base font-black tracking-tight text-slate-900">
                      {producto.nombre}
                    </h3>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                      {producto.categoria}
                    </span>
                    <span
                      className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${producto.activo ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                    >
                      {producto.activo ? 'Visible' : 'Oculto'}
                    </span>
                  </div>

                  <p className="text-2xl font-black tracking-tight text-slate-900">
                    {formatearDinero(producto.precio, moneda)}
                  </p>
                </div>

                <div className="flex items-center justify-center gap-2 rounded-2xl bg-slate-50 p-2 sm:shrink-0">
                  <BotonIconoAccion
                    descripcion="Editar"
                    tono="primario"
                    onClick={() => iniciarEdicion(producto)}
                    icono={<Pencil className="h-4 w-4" aria-hidden="true" />}
                  />
                  <BotonIconoAccion
                    descripcion={producto.activo ? 'Ocultar' : 'Activar'}
                    tono={producto.activo ? 'advertencia' : 'exito'}
                    onClick={() => mutacionToggle.mutate(producto)}
                    icono={
                      producto.activo ? (
                        <CircleOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <CircleCheck className="h-4 w-4" aria-hidden="true" />
                      )
                    }
                  />
                  <BotonIconoAccion
                    descripcion="Eliminar"
                    tono="peligro"
                    onClick={() => setProductoPendienteEliminar(producto)}
                    icono={<Trash2 className="h-4 w-4" aria-hidden="true" />}
                  />
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <DialogoConfirmacion
        abierto={productoPendienteEliminar !== null}
        mensaje="Eliminar producto"
        descripcion={
          productoPendienteEliminar
            ? `Este producto se eliminará del catálogo del salón: ${productoPendienteEliminar.nombre}.`
            : undefined
        }
        textoConfirmar="Eliminar"
        variante="peligro"
        cargando={mutacionEliminar.isPending}
        onCancelar={() => setProductoPendienteEliminar(null)}
        onConfirmar={() => {
          if (!productoPendienteEliminar) {
            return;
          }

          mutacionEliminar.mutate(productoPendienteEliminar.id, {
            onSettled: () => setProductoPendienteEliminar(null),
          });
        }}
      />
    </div>
  );
}
