import { useEffect, useCallback, useState } from 'react';
import { X } from 'lucide-react';
import { SelectorHora } from '../../../componentes/ui/SelectorHora';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { actualizarPersonal } from '../../../servicios/servicioPersonal';
import type { Personal } from '../../../tipos';

const NOMBRES_DIAS: Record<number, string> = {
  0: 'Dom',
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
};

const DIAS_LABORALES_PREDETERMINADOS = [1, 2, 3, 4, 5];

function obtenerIniciales(nombreCompleto: string) {
  return (
    nombreCompleto
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((fragmento) => fragmento.slice(0, 1).toUpperCase())
      .join('') || 'NS'
  );
}

interface PropsModalEditarPersonal {
  abierto: boolean;
  estudioId: string;
  personal: Personal | null;
  serviciosDisponibles: string[];
  onCerrar: () => void;
  onGuardado: (personal: Personal) => void;
}

export function ModalEditarPersonal({
  abierto,
  personal,
  serviciosDisponibles,
  onCerrar,
  onGuardado,
}: PropsModalEditarPersonal) {
  const { mostrarToast } = usarToast();
  const [nombre, setNombre] = useState('');
  const [especialidades, setEspecialidades] = useState<string[]>([]);
  const [horaInicio, setHoraInicio] = useState('09:00');
  const [horaFin, setHoraFin] = useState('18:00');
  const [descansoInicio, setDescansoInicio] = useState('14:00');
  const [descansoFin, setDescansoFin] = useState('15:00');
  const [diasLaborales, setDiasLaborales] = useState<number[]>(DIAS_LABORALES_PREDETERMINADOS);
  const [porcentajeComisionBase, setPorcentajeComisionBase] = useState(0);
  const [comisionServicios, setComisionServicios] = useState<Record<string, string>>({});
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto || !personal) return;
    setNombre(personal.name);
    setEspecialidades(personal.specialties);
    setHoraInicio(personal.shiftStart ?? '09:00');
    setHoraFin(personal.shiftEnd ?? '18:00');
    setDescansoInicio(personal.breakStart ?? '14:00');
    setDescansoFin(personal.breakEnd ?? '15:00');
    setDiasLaborales(personal.workingDays ?? DIAS_LABORALES_PREDETERMINADOS);
    setPorcentajeComisionBase(personal.commissionBasePercentage ?? 0);
    setComisionServicios(
      Object.fromEntries(
        Object.entries(personal.serviceCommissionPercentages ?? {}).map(
          ([servicio, porcentaje]) => [servicio, String(porcentaje)],
        ),
      ),
    );
  }, [abierto, personal]);

  // Cerrar con ESC
  const manejarCerrar = useCallback(() => onCerrar(), [onCerrar]);
  useEffect(() => {
    if (!abierto) return;
    const manejarTeclado = (e: KeyboardEvent) => {
      if (e.key === 'Escape') manejarCerrar();
    };
    document.addEventListener('keydown', manejarTeclado);
    return () => document.removeEventListener('keydown', manejarTeclado);
  }, [abierto, manejarCerrar]);

  if (!abierto || !personal) return null;

  const alternarEspecialidad = (servicio: string) => {
    setEspecialidades((actual) => {
      if (actual.includes(servicio)) {
        setComisionServicios((actualComision) => {
          const siguiente = { ...actualComision };
          delete siguiente[servicio];
          return siguiente;
        });
        return actual.filter((item) => item !== servicio);
      }

      return [...actual, servicio];
    });
  };

  const alternarDia = (dia: number) => {
    setDiasLaborales((actual) =>
      actual.includes(dia) ? actual.filter((item) => item !== dia) : [...actual, dia].sort(),
    );
  };

  const guardar = async () => {
    if (!nombre.trim()) {
      mostrarToast({ mensaje: 'Escribe el nombre del especialista', variante: 'error' });
      return;
    }

    setGuardando(true);
    try {
      const actualizado = await actualizarPersonal(personal.id, {
        name: nombre.trim(),
        specialties: especialidades,
        shiftStart: horaInicio,
        shiftEnd: horaFin,
        breakStart: descansoInicio,
        breakEnd: descansoFin,
        workingDays: diasLaborales,
        commissionBasePercentage: porcentajeComisionBase,
        serviceCommissionPercentages: Object.fromEntries(
          Object.entries(comisionServicios)
            .map(([servicio, porcentaje]) => [
              servicio,
              Number.parseInt(porcentaje.replace(/\D/g, ''), 10),
            ])
            .filter((entrada): entrada is [string, number] => Number.isFinite(entrada[1]))
            .map(([servicio, porcentaje]) => [servicio, Math.min(100, Math.max(0, porcentaje))]),
        ),
      });

      onGuardado(actualizado);
      mostrarToast('Especialista actualizado correctamente');
      onCerrar();
    } catch (error) {
      mostrarToast({
        mensaje: error instanceof Error ? error.message : 'No se pudo actualizar el especialista',
        variante: 'error',
      });
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-black/55 p-2 sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCerrar();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-editar-especialista"
        className="mx-auto flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-xl"
      >
        {/* Header fijo */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-3 py-3.5 sm:px-5 sm:py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-100 text-sm font-black text-pink-700 shrink-0">
              {obtenerIniciales(nombre)}
            </div>
            <h3 id="titulo-editar-especialista" className="text-lg font-black text-slate-900">
              Editar especialista
            </h3>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar modal"
            className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Contenido con scroll */}
        <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-3 py-3.5 sm:space-y-5 sm:px-5 sm:py-4">
          <div>
            <label
              htmlFor="nombre-especialista-modal"
              className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500"
            >
              Nombre completo
            </label>
            <input
              id="nombre-especialista-modal"
              value={nombre}
              onChange={(evento) => setNombre(evento.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-400"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <SelectorHora etiqueta="Entrada" valor={horaInicio} alCambiar={setHoraInicio} />
            <SelectorHora etiqueta="Salida" valor={horaFin} alCambiar={setHoraFin} />
            <SelectorHora
              etiqueta="Inicio descanso"
              valor={descansoInicio}
              alCambiar={setDescansoInicio}
            />
            <SelectorHora etiqueta="Fin descanso" valor={descansoFin} alCambiar={setDescansoFin} />
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              Servicios que realiza
            </p>
            <div className="flex flex-wrap gap-1.5">
              {serviciosDisponibles.map((servicio) => {
                const activo = especialidades.includes(servicio);
                return (
                  <button
                    key={servicio}
                    type="button"
                    onClick={() => alternarEspecialidad(servicio)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${activo ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-500 hover:border-pink-300 hover:text-pink-600'}`}
                  >
                    {activo ? '✓ ' : ''}
                    {servicio}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50/50 p-3.5 sm:p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-emerald-800">
              Comisión del especialista
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1">
                <span className="text-xs font-semibold text-emerald-700">Comisión base (%)</span>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={porcentajeComisionBase}
                  onChange={(evento) => {
                    const valor = Number.parseInt(evento.target.value.replace(/\D/g, ''), 10);
                    setPorcentajeComisionBase(Number.isNaN(valor) ? 0 : Math.min(100, valor));
                  }}
                  className="w-full rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:ring-2 focus:ring-emerald-300"
                />
              </label>

              {especialidades.length > 0 && (
                <div className="sm:col-span-2 space-y-2">
                  <p className="text-xs font-semibold text-emerald-700">Por servicio (opcional)</p>
                  <div className="grid gap-1.5 sm:grid-cols-2">
                    {especialidades.map((servicio) => (
                      <label
                        key={`editar-comision-${servicio}`}
                        className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-1.5"
                      >
                        <span className="truncate text-xs font-semibold text-slate-700">
                          {servicio}
                        </span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            step={1}
                            value={comisionServicios[servicio] ?? ''}
                            onChange={(evento) => {
                              const valor = evento.target.value.replace(/\D/g, '');
                              setComisionServicios((actual) => ({
                                ...actual,
                                [servicio]: valor,
                              }));
                            }}
                            placeholder="Base"
                            className="w-14 rounded-lg border border-emerald-200 px-2 py-1 text-right text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-300"
                          />
                          <span className="text-xs font-black text-emerald-700">%</span>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              Días laborales
            </p>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 0].map((dia) => {
                const activo = diasLaborales.includes(dia);
                return (
                  <button
                    key={dia}
                    type="button"
                    onClick={() => alternarDia(dia)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${activo ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-500 hover:border-pink-300 hover:text-pink-600'}`}
                  >
                    {NOMBRES_DIAS[dia]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer fijo */}
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 px-3 py-3.5 sm:flex-row sm:justify-end sm:gap-3 sm:px-5 sm:py-4">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void guardar()}
            disabled={guardando}
            className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white hover:bg-black disabled:opacity-60 transition"
          >
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
