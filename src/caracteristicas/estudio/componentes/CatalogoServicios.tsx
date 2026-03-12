import { useEffect, useState } from 'react';
import { Check, Clock, DollarSign, Pencil, Trash2, X } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { formatearDinero } from '../../../utils/formato';
import { actualizarPreciosServicios } from '../../../servicios/servicioEstudios';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { usarContextoApp } from '../../../contextos/ContextoApp';
import { FormularioNuevoServicio } from './FormularioNuevoServicio';
import type { Estudio, Moneda, Servicio } from '../../../tipos';

interface PropsCatalogoServicios {
  estudio: Estudio;
}

export function CatalogoServicios({ estudio }: PropsCatalogoServicios) {
  const moneda: Moneda = estudio.country === 'Colombia' ? 'COP' : 'MXN';
  const { mostrarToast } = usarToast();
  const { recargar } = usarContextoApp();
  const [serviciosLocales, setServiciosLocales] = useState(estudio.selectedServices);
  const [servicioEditando, setServicioEditando] = useState<string | null>(null);
  const [borrandoServicio, setBorrandoServicio] = useState<string | null>(null);

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

  const actualizarCampoLocal = (
    nombreServicio: string,
    campo: 'price' | 'duration',
    valor: string,
  ) => {
    setServiciosLocales((actuales) =>
      actuales.map((servicio) =>
        servicio.name === nombreServicio
          ? { ...servicio, [campo]: Math.max(0, parseInt(valor) || 0) }
          : servicio,
      ),
    );
  };

  const guardarServicios = (serviciosActualizados: Servicio[]) => {
    setServiciosLocales(serviciosActualizados);
    guardarPrecios(serviciosActualizados);
  };

  const confirmarEdicion = (nombreServicio: string) => {
    const serviciosActualizados = serviciosLocales.map((servicio) =>
      servicio.name === nombreServicio
        ? {
            ...servicio,
            duration: Math.max(5, servicio.duration || 0),
            price: Math.max(0, servicio.price || 0),
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
    setBorrandoServicio((actual) => (actual === nombreServicio ? null : nombreServicio));
  };

  const serviciosOrdenados = [...serviciosLocales].sort((a, b) =>
    a.name.localeCompare(b.name, 'es'),
  );

  const actualizarPrecio = (nombreServicio: string, nuevoPrecio: string) => {
    const serviciosActualizados = serviciosLocales.map((s) =>
      s.name === nombreServicio ? { ...s, price: parseInt(nuevoPrecio) || 0 } : s,
    );
    guardarServicios(serviciosActualizados);
  };

  const agregarServicio = (servicioNuevo: Servicio) => {
    if (
      serviciosLocales.some(
        (servicio) => servicio.name.toLowerCase() === servicioNuevo.name.toLowerCase(),
      )
    ) {
      mostrarToast('Ese servicio ya existe');
      return;
    }

    guardarServicios([...serviciosLocales, servicioNuevo]);
    mostrarToast('Servicio agregado correctamente');
  };

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
        <FormularioNuevoServicio moneda={moneda} onAgregar={agregarServicio} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {serviciosOrdenados.map((s) => {
          const editando = servicioEditando === s.name;
          const porEliminar = borrandoServicio === s.name;
          const servicioActual = obtenerServicio(s.name) ?? s;

          return (
            <div
              key={s.name}
              className="group flex flex-col justify-between rounded-2xl border border-slate-100 border-l-[3px] border-l-transparent bg-white p-5 transition-all duration-150 hover:border-l-[var(--color-primario)] hover:bg-gray-50"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <span className="block text-sm font-black uppercase text-slate-800">
                    {s.name}
                  </span>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-3 py-1 text-[10px] font-black uppercase text-green-700">
                      <DollarSign className="w-3 h-3" />
                      {formatearDinero(servicioActual.price ?? 0, moneda)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-[10px] font-black uppercase text-blue-700">
                      <Clock className="w-3 h-3" />
                      {servicioActual.duration} min
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                  {!editando && !porEliminar && (
                    <>
                      <button
                        type="button"
                        onClick={() => iniciarEdicion(s.name)}
                        className="rounded-xl bg-white p-2 text-slate-500 shadow-sm transition hover:text-[var(--color-primario)]"
                        aria-label={`Editar ${s.name}`}
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => alternarEliminar(s.name)}
                        className="rounded-xl bg-white p-2 text-slate-500 shadow-sm transition hover:text-red-600"
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
                        onClick={() => eliminarServicio(s.name)}
                        className="rounded-xl bg-red-100 px-3 py-2 text-[10px] font-black uppercase text-red-700 transition hover:bg-red-200"
                      >
                        Confirmar
                      </button>
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
                        type="number"
                        min="0"
                        value={servicioActual.price ?? 0}
                        onChange={(e) => actualizarCampoLocal(s.name, 'price', e.target.value)}
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
                        type="number"
                        min="5"
                        step="5"
                        value={servicioActual.duration}
                        onChange={(e) => actualizarCampoLocal(s.name, 'duration', e.target.value)}
                        className="w-full bg-transparent text-right text-sm font-black text-slate-800 outline-none"
                        aria-label={`Duración de ${s.name}`}
                      />
                      <span className="text-xs font-black uppercase text-blue-700">min</span>
                    </div>
                  </label>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => actualizarPrecio(s.name, String(servicioActual.price ?? 0))}
                  className="rounded-2xl border border-slate-200 bg-white p-3 text-left transition group-hover:border-green-300"
                >
                  <p className="text-[10px] font-black uppercase text-slate-400">Resumen</p>
                  <p className="mt-1 text-sm font-black text-slate-800">
                    {formatearDinero(servicioActual.price ?? 0, moneda)}
                  </p>
                </button>
              )}
            </div>
          );
        })}
        {serviciosLocales.length === 0 && (
          <p className="col-span-full text-center text-slate-400 italic font-bold py-8">
            No hay servicios configurados.
          </p>
        )}
      </div>
    </div>
  );
}
