import { useEffect, useState } from 'react';
import { Check, Clock, DollarSign, Pencil, Trash2, X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import {
  convertirCentavosAMoneda,
  convertirMonedaACentavos,
  formatearDinero,
} from '../../../utils/formato';
import { actualizarPreciosServicios } from '../../../servicios/servicioEstudios';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { DialogoConfirmacion } from '../../../componentes/ui/DialogoConfirmacion';
import { usarContextoApp } from '../../../contextos/ContextoApp';
import { FormularioNuevoServicio } from './FormularioNuevoServicio';
import type { Estudio, Moneda, Servicio } from '../../../tipos';
import { CATALOGO_SERVICIOS, type CategoriaServicio } from '../../../lib/constantes';
import { MENSAJE_FUNCION_PRO, obtenerDefinicionPlan } from '../../../lib/planes';

const obtenerLocaleMoneda = (moneda: Moneda) => (moneda === 'COP' ? 'es-CO' : 'es-MX');

const limpiarDigitos = (valor: string) => valor.replace(/\D/g, '');

const normalizarEnteroEditable = (valor: string) => limpiarDigitos(valor).replace(/^0+(?=\d)/, '');

const formatearMontoEditable = (valor: number, moneda: Moneda) =>
  `$${new Intl.NumberFormat(obtenerLocaleMoneda(moneda), {
    maximumFractionDigits: 0,
  }).format(Math.max(0, convertirCentavosAMoneda(valor || 0)))}`;

const CATEGORIAS = Object.keys(CATALOGO_SERVICIOS) as CategoriaServicio[];

function inferirCategoria(nombreServicio: string): string {
  for (const [categoria, servicios] of Object.entries(CATALOGO_SERVICIOS)) {
    if (
      (servicios as readonly string[]).some((s) => s.toLowerCase() === nombreServicio.toLowerCase())
    ) {
      return categoria;
    }
  }
  return 'Otros';
}
interface PropsCatalogoServicios {
  estudio: Estudio;
}

export function CatalogoServicios({ estudio }: PropsCatalogoServicios) {
  const moneda: Moneda = estudio.country === 'Colombia' ? 'COP' : 'MXN';
  const definicionPlan = obtenerDefinicionPlan(estudio.plan);
  const { mostrarToast } = usarToast();
  const { recargar } = usarContextoApp();
  const [serviciosLocales, setServiciosLocales] = useState(estudio.selectedServices);
  const [servicioEditando, setServicioEditando] = useState<string | null>(null);
  const [borrandoServicio, setBorrandoServicio] = useState<string | null>(null);
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('Todos');
  const serviciosBaseDisponibles = Array.from(
    new Set(Object.values(CATALOGO_SERVICIOS).flat()),
  ).sort((a, b) => a.localeCompare(b, 'es'));

  useEffect(() => {
    setServiciosLocales(estudio.selectedServices);
  }, [estudio.selectedServices]);

  const { mutate: guardarPrecios } = useMutation({
    mutationFn: (serviciosActualizados: Servicio[]) =>
      actualizarPreciosServicios(estudio.id, serviciosActualizados),
    onSuccess: () => {
      recargar();
    },
    onError: (error) => {
      mostrarToast(error instanceof Error ? error.message : 'No se pudieron guardar los servicios');
      setServiciosLocales(estudio.selectedServices);
    },
  });

  const actualizarCampoLocal = (nombreServicio: string, campo: 'duration', valor: string) => {
    setServiciosLocales((actuales) =>
      actuales.map((servicio) =>
        servicio.name === nombreServicio
          ? { ...servicio, [campo]: Math.max(0, parseInt(valor) || 0) }
          : servicio,
      ),
    );
  };

  const actualizarPrecioLocal = (nombreServicio: string, valor: string) => {
    const montoVisible = parseInt(limpiarDigitos(valor) || '0', 10);
    const precioCentavos = convertirMonedaACentavos(montoVisible);
    setServiciosLocales((actuales) =>
      actuales.map((servicio) =>
        servicio.name === nombreServicio
          ? { ...servicio, price: Math.max(0, precioCentavos) }
          : servicio,
      ),
    );
  };

  const actualizarDuracionLocal = (nombreServicio: string, valor: string) => {
    actualizarCampoLocal(nombreServicio, 'duration', normalizarEnteroEditable(valor));
  };

  const guardarServicios = (serviciosActualizados: Servicio[]) => {
    setServiciosLocales(serviciosActualizados);
    guardarPrecios(serviciosActualizados);
  };

  const confirmarEdicion = (nombreServicio: string) => {
    const servicioEditado = serviciosLocales.find((servicio) => servicio.name === nombreServicio);
    if ((servicioEditado?.price ?? 0) < 100) {
      mostrarToast({ mensaje: 'El precio debe ser mayor a 0', variante: 'error' });
      return;
    }

    const serviciosActualizados = serviciosLocales.map((servicio) =>
      servicio.name === nombreServicio
        ? {
            ...servicio,
            duration: Math.max(5, servicio.duration || 0),
            price: Math.max(100, servicio.price || 0),
          }
        : servicio,
    );

    guardarServicios(serviciosActualizados);
    setServicioEditando(null);
  };

  const cancelarEdicion = () => {
    setServiciosLocales(estudio.selectedServices);
    setServicioEditando(null);
  };

  const eliminarServicio = (nombreServicio: string) => {
    const serviciosActualizados = serviciosLocales.filter(
      (servicio) => servicio.name !== nombreServicio,
    );
    guardarServicios(serviciosActualizados);
    setBorrandoServicio(null);
  };

  const obtenerServicio = (nombreServicio: string) =>
    serviciosLocales.find((servicio) => servicio.name === nombreServicio);

  const iniciarEdicion = (nombreServicio: string) => {
    setBorrandoServicio(null);
    setServicioEditando(nombreServicio);
  };

  const alternarEliminar = (nombreServicio: string) => {
    setServicioEditando(null);
    setBorrandoServicio(nombreServicio);
  };

  const serviciosConCategoria = serviciosLocales.map((s) => ({
    ...s,
    category: s.category || inferirCategoria(s.name),
  }));

  const categoriasConServicios = CATEGORIAS.filter((cat) =>
    serviciosConCategoria.some((s) => s.category === cat),
  );

  const serviciosFiltrados =
    categoriaFiltro === 'Todos'
      ? serviciosConCategoria
      : serviciosConCategoria.filter((s) => s.category === categoriaFiltro);

  const serviciosOrdenados = [...serviciosFiltrados].sort((a, b) =>
    a.name.localeCompare(b.name, 'es'),
  );

  const agregarServicio = (servicioNuevo: Servicio) => {
    if (
      definicionPlan.maxServicios !== null &&
      serviciosLocales.length >= definicionPlan.maxServicios
    ) {
      mostrarToast({
        mensaje: `El plan ${definicionPlan.nombre} permite hasta ${definicionPlan.maxServicios} servicios activos. ${MENSAJE_FUNCION_PRO}`,
        variante: 'error',
      });
      return;
    }

    if (
      serviciosLocales.some(
        (servicio) => servicio.name.toLowerCase() === servicioNuevo.name.toLowerCase(),
      )
    ) {
      mostrarToast({
        mensaje: 'Ya tienes un servicio con ese nombre en tu catálogo',
        variante: 'error',
      });
      return;
    }

    guardarServicios([...serviciosLocales, servicioNuevo]);
    mostrarToast('Servicio agregado correctamente');
  };

  const activarServicioBase = (nombreServicio: string) => {
    agregarServicio({
      name: nombreServicio,
      duration: 60,
      price: 100,
      category: inferirCategoria(nombreServicio),
    });
  };

  const nombresServiciosActivos = new Set(
    serviciosLocales.map((servicio) => servicio.name.trim().toLowerCase()),
  );
  const llegoLimitePlan =
    definicionPlan.maxServicios !== null && serviciosLocales.length >= definicionPlan.maxServicios;

  return (
    <div className="bg-white rounded-[3rem] p-6 md:p-8 border border-slate-200 shadow-sm">
      <div className="mb-6">
        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2 mb-1">
          <DollarSign className="w-4 h-4 text-pink-600" /> Catálogo de Servicios
        </h3>
        <p className="text-xs text-slate-500 font-bold">
          Ajusta los precios de tus servicios en cualquier momento. Los cambios se reflejarán
          inmediatamente para los clientes.
        </p>
      </div>

      <div className="mb-6">
        <div className="mb-4 rounded-3xl border border-pink-100 bg-pink-50/70 p-4">
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-pink-700">
            Activa servicios del catálogo base
          </p>
          <p className="mt-2 text-sm font-medium text-slate-600">
            Agrega servicios sugeridos con un clic y luego ajusta precio y duración a tu medida.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {serviciosBaseDisponibles.map((nombreServicio) => {
              const activo = nombresServiciosActivos.has(nombreServicio.toLowerCase());

              return (
                <button
                  key={nombreServicio}
                  type="button"
                  onClick={() => activarServicioBase(nombreServicio)}
                  disabled={activo || llegoLimitePlan}
                  className="rounded-full border border-pink-200 bg-white px-3 py-2 text-xs font-black text-pink-700 transition hover:border-pink-400 hover:bg-pink-100 disabled:cursor-not-allowed disabled:border-slate-200 disabled:bg-slate-100 disabled:text-slate-400"
                >
                  {activo ? `${nombreServicio} activo` : `Activar ${nombreServicio}`}
                </button>
              );
            })}
          </div>
        </div>

        <FormularioNuevoServicio
          moneda={moneda}
          onAgregar={agregarServicio}
          bloqueado={llegoLimitePlan}
          mensajeBloqueo={
            llegoLimitePlan
              ? `Llegaste al límite de ${definicionPlan.maxServicios} servicios del plan ${definicionPlan.nombre}. ${MENSAJE_FUNCION_PRO}`
              : undefined
          }
        />
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
        <p className="text-xs font-black uppercase tracking-widest text-slate-500">
          Plan actual: {definicionPlan.nombre}
        </p>
        <p className="mt-2 text-sm font-medium text-slate-600">
          {definicionPlan.maxServicios === null
            ? 'Puedes administrar un catálogo de servicios sin límite.'
            : `Tienes ${serviciosLocales.length} de ${definicionPlan.maxServicios} servicios activos disponibles.`}
        </p>
      </div>

      {categoriasConServicios.length > 1 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {['Todos', ...categoriasConServicios].map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoriaFiltro(cat)}
              className={`rounded-full px-3 py-1.5 text-xs font-black transition ${
                categoriaFiltro === cat
                  ? 'bg-pink-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {serviciosOrdenados.map((s) => {
          const editando = servicioEditando === s.name;
          const porEliminar = borrandoServicio === s.name;
          const servicioActual = obtenerServicio(s.name) ?? s;

          return (
            <div
              key={s.name}
              className="rounded-2xl border border-pink-100 bg-white p-4 transition-all hover:border-pink-300 hover:shadow-md"
            >
              <div className="mb-3 flex items-start justify-between gap-4">
                <div>
                  <span
                    className="block text-sm font-medium"
                    style={{ color: 'var(--color-texto)' }}
                  >
                    {s.name}
                  </span>
                  <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wider text-pink-500">
                    {s.category || inferirCategoria(s.name)}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {!editando && !porEliminar && (
                    <>
                      <button
                        type="button"
                        onClick={() => iniciarEdicion(s.name)}
                        className="rounded-lg p-1.5 text-pink-400 transition hover:bg-pink-50"
                        aria-label={`Editar ${s.name}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => alternarEliminar(s.name)}
                        className="rounded-lg p-1.5 text-red-400 transition hover:bg-red-50"
                        aria-label={`Eliminar ${s.name}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  {editando && (
                    <>
                      <button
                        type="button"
                        onClick={() => confirmarEdicion(s.name)}
                        className="rounded-xl bg-green-100 p-2 text-green-700 transition hover:bg-green-200"
                        aria-label={`Guardar cambios de ${s.name}`}
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={cancelarEdicion}
                        className="rounded-xl bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
                        aria-label={`Cancelar edición de ${s.name}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  )}

                  {porEliminar && (
                    <>
                      <button
                        type="button"
                        onClick={() => setBorrandoServicio(null)}
                        className="rounded-xl bg-slate-100 p-2 text-slate-600 transition hover:bg-slate-200"
                        aria-label={`Cancelar eliminación de ${s.name}`}
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {editando ? (
                <div className="grid grid-cols-2 gap-3">
                  <label className="rounded-2xl border border-green-200 bg-green-50 p-3">
                    <span className="mb-1 block text-[10px] font-black uppercase text-green-700">
                      Precio
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-green-700">{moneda}</span>
                      <input
                        value={formatearMontoEditable(servicioActual.price ?? 0, moneda)}
                        onChange={(e) => actualizarPrecioLocal(s.name, e.target.value)}
                        inputMode="numeric"
                        className="w-full bg-transparent text-right text-sm font-black text-slate-800 outline-none"
                        aria-label={`Precio de ${s.name}`}
                      />
                    </div>
                  </label>

                  <label className="rounded-2xl border border-blue-200 bg-blue-50 p-3">
                    <span className="mb-1 block text-[10px] font-black uppercase text-blue-700">
                      Duración
                    </span>
                    <div className="flex items-center gap-2">
                      <input
                        value={servicioActual.duration}
                        onChange={(e) => actualizarDuracionLocal(s.name, e.target.value)}
                        inputMode="numeric"
                        className="w-full bg-transparent text-right text-sm font-black text-slate-800 outline-none"
                        aria-label={`Duración de ${s.name}`}
                      />
                      <span className="text-xs font-black uppercase text-blue-700">min</span>
                    </div>
                  </label>
                </div>
              ) : (
                <div className="flex gap-4 text-sm" style={{ color: 'var(--color-texto-suave)' }}>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-4 w-4 text-pink-400" /> {servicioActual.duration} min
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <DollarSign className="h-4 w-4 text-pink-400" />
                    {formatearDinero(servicioActual.price ?? 0, moneda)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
        {serviciosOrdenados.length === 0 && serviciosLocales.length > 0 && (
          <p className="col-span-full text-center text-slate-400 italic font-bold py-8">
            No hay servicios en esta categoría.
          </p>
        )}
        {serviciosLocales.length === 0 && (
          <p className="col-span-full text-center text-slate-400 italic font-bold py-8">
            No hay servicios configurados.
          </p>
        )}
      </div>

      <DialogoConfirmacion
        abierto={Boolean(borrandoServicio)}
        mensaje="Eliminar servicio"
        descripcion={
          borrandoServicio ? `Se quitará ${borrandoServicio} del catálogo del salón.` : undefined
        }
        variante="peligro"
        textoConfirmar="Eliminar"
        onCancelar={() => setBorrandoServicio(null)}
        onConfirmar={() => {
          if (borrandoServicio) {
            eliminarServicio(borrandoServicio);
          }
        }}
      />
    </div>
  );
}
