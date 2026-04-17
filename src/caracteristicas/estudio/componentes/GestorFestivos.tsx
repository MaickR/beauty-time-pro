import { useMemo, useState } from 'react';
import {
  Calendar,
  Clock3,
  Lock,
  LockOpen,
  MapPin,
  PencilLine,
  Save,
  Trash2,
  Undo2,
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { actualizarExcepcionesDisponibilidad } from '../../../servicios/servicioEstudios';
import {
  combinarExcepcionesDisponibilidad,
  formatearAlcanceExcepcion,
  ordenarExcepcionesDisponibilidad,
} from '../../../lib/disponibilidadExcepciones';
import { usarContextoApp } from '../../../contextos/ContextoApp';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import type { ExcepcionDisponibilidad } from '../../../tipos';
import type { Estudio } from '../../../tipos';

interface PropsGestorFestivos {
  estudio: Estudio;
}

interface EstadoFormulario {
  id: string | null;
  fecha: string;
  tipo: 'cerrado' | 'horario_modificado';
  horaInicio: string;
  horaFin: string;
  aplicaTodasLasSedes: boolean;
  sedes: string[];
  motivo: string;
  activa: boolean;
  creadoEn: string | null;
}

function crearFormularioInicial(nombrePrincipal: string): EstadoFormulario {
  return {
    id: null,
    fecha: '',
    tipo: 'cerrado',
    horaInicio: '09:00',
    horaFin: '18:00',
    aplicaTodasLasSedes: true,
    sedes: [nombrePrincipal],
    motivo: '',
    activa: true,
    creadoEn: null,
  };
}

export function GestorFestivos({ estudio }: PropsGestorFestivos) {
  const { mostrarToast } = usarToast();
  const { recargar } = usarContextoApp();
  const sedesDisponibles = useMemo(
    () => Array.from(new Set([estudio.name, ...(estudio.branches ?? []), ...(estudio.sedes?.map((sede) => sede.nombre) ?? [])])),
    [estudio.branches, estudio.name, estudio.sedes],
  );
  const [formulario, setFormulario] = useState<EstadoFormulario>(() => crearFormularioInicial(estudio.name));

  const excepciones = useMemo(
    () =>
      ordenarExcepcionesDisponibilidad(
        combinarExcepcionesDisponibilidad(estudio.holidays, estudio.availabilityExceptions),
      ),
    [estudio.availabilityExceptions, estudio.holidays],
  );

  const { mutate: guardarExcepciones, isPending } = useMutation({
    mutationFn: (excepcionesDisponibilidad: ExcepcionDisponibilidad[]) =>
      actualizarExcepcionesDisponibilidad(estudio.id, excepcionesDisponibilidad),
    onSuccess: () => {
      recargar();
      mostrarToast({ mensaje: 'Horario especial actualizado', variante: 'exito' });
      setFormulario(crearFormularioInicial(estudio.name));
    },
    onError: (error: Error) => {
      mostrarToast({ mensaje: error.message, variante: 'error' });
    },
  });

  const guardarFormulario = () => {
    if (!formulario.fecha) {
      mostrarToast({ mensaje: 'Selecciona una fecha', variante: 'error' });
      return;
    }

    if (!formulario.aplicaTodasLasSedes && formulario.sedes.length === 0) {
      mostrarToast({ mensaje: 'Selecciona al menos una sede', variante: 'error' });
      return;
    }

    if (formulario.tipo === 'horario_modificado' && formulario.horaInicio >= formulario.horaFin) {
      mostrarToast({ mensaje: 'La hora de cierre debe ser posterior a la apertura', variante: 'error' });
      return;
    }

    const excepcion: ExcepcionDisponibilidad = {
      id: formulario.id ?? `cliente-${formulario.fecha}-${formulario.tipo}`,
      fecha: formulario.fecha,
      tipo: formulario.tipo,
      horaInicio: formulario.tipo === 'horario_modificado' ? formulario.horaInicio : null,
      horaFin: formulario.tipo === 'horario_modificado' ? formulario.horaFin : null,
      aplicaTodasLasSedes: formulario.aplicaTodasLasSedes,
      sedes: formulario.aplicaTodasLasSedes ? [] : formulario.sedes,
      motivo: formulario.motivo.trim() || null,
      activa: formulario.activa,
      creadoEn: formulario.creadoEn,
      actualizadoEn: new Date().toISOString(),
    };

    const restantes = excepciones.filter((item) => item.id !== excepcion.id);
    guardarExcepciones([...restantes, excepcion]);
  };

  const alternarSede = (sede: string) => {
    setFormulario((actual) => ({
      ...actual,
      aplicaTodasLasSedes: false,
      sedes: actual.sedes.includes(sede)
        ? actual.sedes.filter((item) => item !== sede)
        : [...actual.sedes, sede],
    }));
  };

  const editarExcepcion = (excepcion: ExcepcionDisponibilidad) => {
    setFormulario({
      id: excepcion.id,
      fecha: excepcion.fecha,
      tipo: excepcion.tipo,
      horaInicio: excepcion.horaInicio ?? '09:00',
      horaFin: excepcion.horaFin ?? '18:00',
      aplicaTodasLasSedes: excepcion.aplicaTodasLasSedes,
      sedes: excepcion.sedes.length > 0 ? excepcion.sedes : [estudio.name],
      motivo: excepcion.motivo ?? '',
      activa: excepcion.activa,
      creadoEn: excepcion.creadoEn,
    });
  };

  const cambiarEstadoExcepcion = (id: string, activa: boolean) => {
    guardarExcepciones(
      excepciones.map((excepcion) =>
        excepcion.id === id
          ? { ...excepcion, activa, actualizadoEn: new Date().toISOString() }
          : excepcion,
      ),
    );
  };

  const eliminarExcepcion = (id: string) => {
    guardarExcepciones(excepciones.filter((excepcion) => excepcion.id !== id));
  };

  const resumenExcepciones = useMemo(() => {
    const activas = excepciones.filter((excepcion) => excepcion.activa);
    return {
      total: activas.length,
      cierres: activas.filter((excepcion) => excepcion.tipo === 'cerrado').length,
      modificados: activas.filter((excepcion) => excepcion.tipo === 'horario_modificado').length,
    };
  }, [excepciones]);

  return (
    <section className="space-y-5 rounded-4xl border border-slate-200 bg-white p-4 shadow-sm md:rounded-[2.5rem] md:p-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-black uppercase tracking-widest text-slate-900">
        <Calendar className="w-4 h-4 text-pink-600" /> Gestión de horario
          </h3>
          <p className="max-w-2xl text-xs font-semibold text-slate-500">
            Configura cierres totales y horarios puntuales por sede. Los cambios se reflejan en la agenda, la reserva pública y la vista del equipo.
          </p>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:min-w-[18rem]">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-slate-400">Activos</p>
            <p className="mt-1 text-lg font-black text-slate-900">{resumenExcepciones.total}</p>
          </div>
          <div className="rounded-2xl border border-orange-100 bg-orange-50 px-3 py-2 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-orange-500">Cierres</p>
            <p className="mt-1 text-lg font-black text-orange-700">{resumenExcepciones.cierres}</p>
          </div>
          <div className="rounded-2xl border border-sky-100 bg-sky-50 px-3 py-2 text-center">
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-sky-500">Modificados</p>
            <p className="mt-1 text-lg font-black text-sky-700">{resumenExcepciones.modificados}</p>
          </div>
        </div>
      </div>

      <div className="grid gap-3 rounded-[1.75rem] border border-slate-200 bg-slate-50 p-3 sm:p-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-bold text-slate-700">
          <span>Fecha</span>
          <input
            type="date"
            value={formulario.fecha}
            min={new Date().toISOString().split('T')[0]}
            onChange={(evento) => setFormulario((actual) => ({ ...actual, fecha: evento.target.value }))}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-pink-500"
          />
        </label>

        <div className="space-y-2 text-sm font-bold text-slate-700">
          <span>Tipo de ajuste</span>
          <div className="grid grid-cols-2 gap-2">
            {[
              { valor: 'cerrado', etiqueta: 'Cierre total', icono: Lock },
              { valor: 'horario_modificado', etiqueta: 'Horario modificado', icono: Clock3 },
            ].map((opcion) => {
              const Icono = opcion.icono;
              const activo = formulario.tipo === opcion.valor;

              return (
                <button
                  key={opcion.valor}
                  type="button"
                  onClick={() => setFormulario((actual) => ({ ...actual, tipo: opcion.valor as EstadoFormulario['tipo'] }))}
                  className={`rounded-2xl border px-3 py-2.5 text-left transition-all ${activo ? 'border-slate-900 bg-slate-900 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`flex h-8 w-8 items-center justify-center rounded-xl ${activo ? 'bg-white/15 text-white' : opcion.valor === 'cerrado' ? 'bg-orange-50 text-orange-600' : 'bg-sky-50 text-sky-600'}`}>
                      <Icono className="h-4 w-4" />
                    </span>
                    <div>
                      <div className="text-sm font-black leading-tight">{opcion.etiqueta}</div>
                      <div className={`text-[11px] font-semibold ${activo ? 'text-white/80' : 'text-slate-400'}`}>
                        {opcion.valor === 'cerrado' ? 'No abre ese día' : 'Apertura o cierre puntual'}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {formulario.tipo === 'horario_modificado' && (
          <>
            <label className="space-y-2 text-sm font-bold text-slate-700">
              <span>Apertura</span>
              <input
                type="time"
                value={formulario.horaInicio}
                onChange={(evento) => setFormulario((actual) => ({ ...actual, horaInicio: evento.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-pink-500"
              />
            </label>
            <label className="space-y-2 text-sm font-bold text-slate-700">
              <span>Cierre</span>
              <input
                type="time"
                value={formulario.horaFin}
                onChange={(evento) => setFormulario((actual) => ({ ...actual, horaFin: evento.target.value }))}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-pink-500"
              />
            </label>
          </>
        )}

        <div className="space-y-3 md:col-span-2">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-black text-slate-800">Alcance</p>
              <p className="text-xs text-slate-500">Aplica a una sede, varias o todas.</p>
            </div>
            <button
              type="button"
              onClick={() => setFormulario((actual) => ({ ...actual, aplicaTodasLasSedes: !actual.aplicaTodasLasSedes, sedes: actual.aplicaTodasLasSedes ? [estudio.name] : [] }))}
              className={`rounded-full px-4 py-2 text-xs font-black transition-all ${formulario.aplicaTodasLasSedes ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'}`}
            >
              {formulario.aplicaTodasLasSedes ? 'Todas las sedes' : 'Seleccionar sedes'}
            </button>
          </div>

          {!formulario.aplicaTodasLasSedes && (
            <div className="flex flex-wrap gap-2">
              {sedesDisponibles.map((sede) => {
                const activa = formulario.sedes.includes(sede);

                return (
                  <button
                    key={sede}
                    type="button"
                    onClick={() => alternarSede(sede)}
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-2 text-xs font-black transition-all ${activa ? 'bg-pink-600 text-white' : 'border border-slate-200 bg-white text-slate-600'}`}
                  >
                    <MapPin className="h-3 w-3" /> {sede}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <label className="space-y-2 text-sm font-bold text-slate-700 md:col-span-2">
          <span>Nota interna</span>
          <input
            type="text"
            value={formulario.motivo}
            onChange={(evento) => setFormulario((actual) => ({ ...actual, motivo: evento.target.value }))}
            placeholder="Ej. evento especial, mantenimiento, día festivo"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-pink-500"
          />
        </label>

        <div className="flex flex-col gap-2 sm:flex-row md:col-span-2">
          <button
            type="button"
            onClick={guardarFormulario}
            disabled={isPending}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-xs font-black uppercase text-white transition-all hover:bg-black disabled:opacity-60"
          >
            <Save className="h-4 w-4" /> {isPending ? 'Guardando...' : formulario.id ? 'Actualizar ajuste' : 'Guardar ajuste'}
          </button>
          {formulario.id && (
            <button
              type="button"
              onClick={() => setFormulario(crearFormularioInicial(estudio.name))}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase text-slate-700"
            >
              <Undo2 className="h-4 w-4" /> Cancelar edición
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {excepciones.length > 0 ? (
          excepciones.map((excepcion) => {
            const esCierre = excepcion.tipo === 'cerrado';
            const activa = excepcion.activa;

            return (
              <article
                key={excepcion.id}
                className={`rounded-[1.75rem] border p-4 transition-all ${activa ? 'border-slate-200 bg-white' : 'border-slate-200 bg-slate-50 opacity-75'}`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {esCierre ? (
                        activa ? <Lock className="h-4 w-4 text-orange-500" /> : <LockOpen className="h-4 w-4 text-slate-400" />
                      ) : (
                        <Clock3 className="h-4 w-4 text-blue-500" />
                      )}
                      <p className="text-sm font-black text-slate-900">{excepcion.fecha}</p>
                      <span className={`rounded-full px-2 py-1 text-[10px] font-black uppercase ${activa ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-600'}`}>
                        {activa ? 'Activo' : 'Revertido'}
                      </span>
                    </div>
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      {esCierre ? 'Cierre total' : `${excepcion.horaInicio} - ${excepcion.horaFin}`}
                    </p>
                    <p className="text-sm text-slate-600">
                      {formatearAlcanceExcepcion(excepcion, estudio.name)}
                    </p>
                    {excepcion.motivo && <p className="text-sm text-slate-500">{excepcion.motivo}</p>}
                  </div>

                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button
                      type="button"
                      onClick={() => editarExcepcion(excepcion)}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-xs font-black text-slate-700"
                    >
                      <PencilLine className="h-3.5 w-3.5" /> Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => cambiarEstadoExcepcion(excepcion.id, !activa)}
                      className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs font-black ${activa ? 'bg-slate-900 text-white' : 'bg-white text-slate-700 border border-slate-200'}`}
                    >
                      {activa ? <LockOpen className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                      {activa ? 'Revertir' : 'Restaurar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => eliminarExcepcion(excepcion.id)}
                      className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-3 py-2 text-xs font-black text-red-700 transition-colors hover:bg-red-100"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Eliminar
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <p className="text-sm font-semibold text-slate-400">No hay ajustes programados todavía.</p>
        )}
      </div>
    </section>
  );
}
