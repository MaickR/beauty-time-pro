import { useState, useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
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

export function PanelProductos({ estudioId, moneda }: PropsPanelProductos) {
  const { mostrarToast } = usarToast();
  const clienteConsulta = useQueryClient();
  const claveConsulta = ['productos', estudioId];

  const { data: productos = [], isLoading } = useQuery({
    queryKey: claveConsulta,
    queryFn: () => obtenerProductos(estudioId),
    staleTime: 2 * 60 * 1000,
  });

  const [busqueda, setBusqueda] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState<string>('');
  const [editando, setEditando] = useState<Producto | null>(null);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);

  // Formulario
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('General');
  const [precioTexto, setPrecioTexto] = useState('');

  const categoriasExistentes = useMemo(() => {
    const cats = new Set(productos.map((p) => p.categoria));
    return Array.from(cats).sort();
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    let resultado = productos;
    if (busqueda.trim()) {
      const termino = busqueda.toLowerCase();
      resultado = resultado.filter((p) => p.nombre.toLowerCase().includes(termino));
    }
    if (filtroCategoria) {
      resultado = resultado.filter((p) => p.categoria === filtroCategoria);
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
    mutationFn: (p: Producto) => editarProducto(estudioId, p.id, { activo: !p.activo }),
    onSuccess: () => {
      void clienteConsulta.invalidateQueries({ queryKey: claveConsulta });
    },
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

    const precioNum = Number(precioTexto);
    if (!precioNum || precioNum <= 0) {
      mostrarToast('El precio debe ser mayor a 0');
      return;
    }

    const precioCentavos = convertirMonedaACentavos(precioNum);

    if (editando) {
      mutacionEditar.mutate({
        id: editando.id,
        nombre: nombre.trim(),
        categoria,
        precio: precioCentavos,
      });
    } else {
      mutacionCrear.mutate({
        nombre: nombre.trim(),
        categoria,
        precio: precioCentavos,
      });
    }
  }

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <div className="w-8 h-8 border-2 border-pink-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Barra de acciones */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar productos..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-2xl text-sm"
          />
        </div>
        <div className="flex gap-2 items-center">
          {categoriasExistentes.length > 1 && (
            <select
              value={filtroCategoria}
              onChange={(e) => setFiltroCategoria(e.target.value)}
              className="border border-slate-200 rounded-2xl px-3 py-2.5 text-sm"
              aria-label="Filtrar por categoría"
            >
              <option value="">Todas las categorías</option>
              {categoriasExistentes.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}
          {!mostrarFormulario && (
            <button
              type="button"
              onClick={() => setMostrarFormulario(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl bg-(--color-primario) hover:bg-(--color-primario-oscuro) text-white text-sm font-black uppercase tracking-widest transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" /> Agregar producto
            </button>
          )}
        </div>
      </div>

      {/* Formulario crear/editar */}
      {mostrarFormulario && (
        <div className="bg-white rounded-[2.5rem] p-6 border border-slate-200 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-black uppercase tracking-tight">
              {editando ? 'Editar producto' : 'Nuevo producto'}
            </h3>
            <button
              type="button"
              onClick={limpiarFormulario}
              className="text-slate-400 hover:text-slate-600"
              aria-label="Cerrar formulario"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="nombreProducto"
                className="block text-sm font-bold text-slate-700 mb-1"
              >
                Nombre
              </label>
              <input
                id="nombreProducto"
                type="text"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej: Shampoo de queratina"
                className="w-full border border-slate-200 rounded-2xl px-4 py-2.5 text-sm"
              />
            </div>
            <div>
              <label
                htmlFor="categoriaProducto"
                className="block text-sm font-bold text-slate-700 mb-1"
              >
                Categoría
              </label>
              <select
                id="categoriaProducto"
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
                className="w-full border border-slate-200 rounded-2xl px-4 py-2.5 text-sm"
              >
                {CATEGORIAS_PRODUCTO.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="precioProducto"
                className="block text-sm font-bold text-slate-700 mb-1"
              >
                Precio
              </label>
              <input
                id="precioProducto"
                type="number"
                min="1"
                step="1"
                value={precioTexto}
                onChange={(e) => setPrecioTexto(e.target.value)}
                placeholder="350"
                className="w-full border border-slate-200 rounded-2xl px-4 py-2.5 text-sm"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={enviar}
            disabled={mutacionCrear.isPending || mutacionEditar.isPending}
            className="px-6 py-2.5 rounded-2xl bg-(--color-primario) hover:bg-(--color-primario-oscuro) text-white text-sm font-black uppercase tracking-widest transition-colors shadow-sm disabled:opacity-60"
          >
            {mutacionCrear.isPending || mutacionEditar.isPending
              ? 'Guardando...'
              : editando
                ? 'Guardar cambios'
                : 'Agregar producto'}
          </button>
        </div>
      )}

      {/* Lista de productos */}
      {productosFiltrados.length === 0 ? (
        <div className="bg-white rounded-[2.5rem] p-12 border border-slate-200 shadow-sm text-center">
          <p className="text-slate-400 font-bold">
            {productos.length === 0
              ? 'Aún no tienes productos. Agrega el primero.'
              : 'No hay productos que coincidan con tu búsqueda.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {productosFiltrados.map((producto) => (
            <div
              key={producto.id}
              className={`flex items-center justify-between gap-4 bg-white rounded-2xl border border-slate-200 px-5 py-3.5 transition-opacity ${!producto.activo ? 'opacity-50' : ''}`}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-bold text-slate-800 truncate">{producto.nombre}</p>
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                    {producto.categoria}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="text-sm font-black text-slate-800">
                  {formatearDinero(producto.precio, moneda)}
                </span>
                <button
                  type="button"
                  onClick={() => iniciarEdicion(producto)}
                  className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600"
                  aria-label={`Editar ${producto.nombre}`}
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => mutacionToggle.mutate(producto)}
                  className={`text-xs font-bold px-3 py-1 rounded-full border transition-colors ${producto.activo ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500'}`}
                >
                  {producto.activo ? 'Activo' : 'Inactivo'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm('¿Deseas eliminar este producto?')) {
                      mutacionEliminar.mutate(producto.id);
                    }
                  }}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500"
                  aria-label={`Eliminar ${producto.nombre}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
