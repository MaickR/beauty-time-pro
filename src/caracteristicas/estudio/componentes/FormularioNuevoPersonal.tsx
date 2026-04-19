import { useCallback, useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Eye, EyeOff, PlusCircle, RefreshCw, X } from 'lucide-react';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { crearPersonal } from '../../../servicios/servicioPersonal';
import { crearAccesoEmpleado } from '../../../servicios/servicioEmpleados';
import { usarContextoApp } from '../../../contextos/ContextoApp';
import { SelectorHora } from '../../../componentes/ui/SelectorHora';
import {
  esEmailColaboradorValido,
  generarContrasenaColaborador,
} from '../../../utils/formularioSalon';
import type { Personal, Servicio } from '../../../tipos';

interface PropsFormularioNuevoPersonal {
  estudioId: string;
  serviciosDisponibles: Servicio[];
  alCrearExitoso?: (personalCreado: Personal) => void | Promise<void>;
  alCerrar?: () => void;
  modoModal?: boolean;
}

const DIAS_LABORALES_PREDETERMINADOS = [1, 2, 3, 4, 5];

const NOMBRES_DIAS: Record<number, string> = {
  0: 'Dom',
  1: 'Lun',
  2: 'Mar',
  3: 'Mié',
  4: 'Jue',
  5: 'Vie',
  6: 'Sáb',
};

const REGEX_CONTRASENA_SEGURA = /^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/;

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

export function FormularioNuevoPersonal({
  estudioId,
  serviciosDisponibles,
  alCrearExitoso,
  alCerrar,
  modoModal = false,
}: PropsFormularioNuevoPersonal) {
  const { mostrarToast } = usarToast();
  const { recargar } = usarContextoApp();
  const clienteConsulta = useQueryClient();
  const [nombre, setNombre] = useState('');
  const [horaInicio, setHoraInicio] = useState('09:00');
  const [horaFin, setHoraFin] = useState('18:00');
  const [descansoInicio, setDescansoInicio] = useState('14:00');
  const [descansoFin, setDescansoFin] = useState('15:00');
  const [diasLaborales, setDiasLaborales] = useState<number[]>(DIAS_LABORALES_PREDETERMINADOS);
  const [especialidades, setEspecialidades] = useState<string[]>(
    serviciosDisponibles.map((s) => s.name),
  );
  const [emailAcceso, setEmailAcceso] = useState('');
  const [contrasenaAcceso, setContrasenaAcceso] = useState('');
  const [mostrarContrasenaAcceso, setMostrarContrasenaAcceso] = useState(false);
  const [porcentajeComisionBase, setPorcentajeComisionBase] = useState(0);
  const [comisionServicios, setComisionServicios] = useState<Record<string, string>>({});
  const puedeCerrar = modoModal && typeof alCerrar === 'function';

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
      actual.includes(dia) ? actual.filter((d) => d !== dia) : [...actual, dia].sort(),
    );
  };

  const mutacionCrearPersonal = useMutation({
    mutationFn: async () => {
      const personal = await crearPersonal(estudioId, {
        name: nombre.trim(),
        specialties: especialidades,
        active: true,
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

      await crearAccesoEmpleado(estudioId, personal.id, {
        email: emailAcceso.trim(),
        contrasena: contrasenaAcceso.trim(),
        forzarCambioContrasena: false,
      });

      return { personal, accesoCreado: true };
    },
    onSuccess: async (resultado) => {
      setNombre('');
      setEspecialidades(serviciosDisponibles.map((s) => s.name));
      setHoraInicio('09:00');
      setHoraFin('18:00');
      setDescansoInicio('14:00');
      setDescansoFin('15:00');
      setDiasLaborales(DIAS_LABORALES_PREDETERMINADOS);
      setEmailAcceso('');
      setContrasenaAcceso('');
      setMostrarContrasenaAcceso(false);
      setPorcentajeComisionBase(0);
      setComisionServicios({});

      clienteConsulta.setQueryData<Personal[]>(['personal-estudio', estudioId], (actual) => {
        if (!actual) {
          return [resultado.personal];
        }

        const indiceExistente = actual.findIndex((item) => item.id === resultado.personal.id);
        if (indiceExistente >= 0) {
          return actual.map((item) =>
            item.id === resultado.personal.id ? { ...item, ...resultado.personal } : item,
          );
        }

        return [resultado.personal, ...actual];
      });

      if (alCrearExitoso) {
        await alCrearExitoso(resultado.personal);
      } else {
        // Fallback para vistas legadas que no consumen TanStack Query directamente.
        recargar();
      }
      mostrarToast(
        resultado.accesoCreado
          ? 'Especialista y acceso creados correctamente'
          : 'Especialista agregado correctamente',
      );
    },
    onError: (error) => {
      mostrarToast(error instanceof Error ? error.message : 'No se pudo agregar el especialista');
    },
  });

  const manejarCrear = () => {
    if (!nombre.trim()) {
      mostrarToast('Escribe el nombre del especialista');
      return;
    }

    if (!emailAcceso.trim()) {
      mostrarToast('Escribe el correo que usará el especialista para iniciar sesión');
      return;
    }

    if (!esEmailColaboradorValido(emailAcceso)) {
      mostrarToast('El correo del especialista no es válido o usa un dominio temporal');
      return;
    }

    if (!contrasenaAcceso.trim()) {
      mostrarToast('Define una contraseña de acceso para el especialista');
      return;
    }

    if (!REGEX_CONTRASENA_SEGURA.test(contrasenaAcceso.trim())) {
      mostrarToast(
        'La contraseña debe tener mínimo 8 caracteres, una mayúscula, un número y un símbolo',
      );
      return;
    }

    mutacionCrearPersonal.mutate();
  };

  const manejarGenerarContrasena = () => {
    setContrasenaAcceso(
      generarContrasenaColaborador(nombre.trim(), emailAcceso.trim() || 'empleado@beautytime.pro'),
    );
    setMostrarContrasenaAcceso(true);
  };

  const manejarCerrar = useCallback(() => {
    if (puedeCerrar) {
      alCerrar?.();
    }
  }, [alCerrar, puedeCerrar]);

  useEffect(() => {
    if (!puedeCerrar) {
      return;
    }

    const alPresionarTecla = (evento: KeyboardEvent) => {
      if (evento.key === 'Escape') {
        manejarCerrar();
      }
    };

    document.addEventListener('keydown', alPresionarTecla);
    return () => document.removeEventListener('keydown', alPresionarTecla);
  }, [manejarCerrar, puedeCerrar]);

  return (
    <div
      role={modoModal ? 'dialog' : undefined}
      aria-modal={modoModal ? 'true' : undefined}
      aria-labelledby={modoModal ? 'titulo-nuevo-especialista' : undefined}
      className="mx-auto flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl sm:max-h-[calc(100dvh-2rem)] sm:max-w-xl"
    >
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          manejarCrear();
        }}
        className="flex flex-col min-h-0"
      >
        {/* Header fijo */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-3 py-3.5 sm:px-5 sm:py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-pink-100 text-sm font-black text-pink-700 shrink-0">
              {obtenerIniciales(nombre)}
            </div>
            <h3 id="titulo-nuevo-especialista" className="text-lg font-black text-slate-900">
              Nuevo especialista
            </h3>
          </div>
          {puedeCerrar && (
            <button
              type="button"
              onClick={manejarCerrar}
              aria-label="Cerrar modal"
              className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Contenido con scroll */}
        <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain px-3 py-3.5 sm:space-y-5 sm:px-5 sm:py-4">
          <div>
            <label
              htmlFor="nuevo-especialista"
              className="mb-1 block text-xs font-bold uppercase tracking-wide text-slate-500"
            >
              Nombre completo
            </label>
            <input
              id="nuevo-especialista"
              name="nombreEspecialista"
              value={nombre}
              onChange={(evento) => setNombre(evento.target.value)}
              placeholder="Nombre del especialista"
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

          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-500">
              Servicios que realiza
            </p>
            <div className="flex flex-wrap gap-1.5">
              {serviciosDisponibles.map((servicio, indiceServicio) => {
                const activo = especialidades.includes(servicio.name);
                return (
                  <button
                    key={`${servicio.name}-${indiceServicio}`}
                    type="button"
                    onClick={() => alternarEspecialidad(servicio.name)}
                    className={`rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${activo ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-500 hover:border-pink-300 hover:text-pink-600'}`}
                  >
                    {activo ? '✓ ' : ''}
                    {servicio.name}
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
                        key={`comision-${servicio}`}
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

          <div className="space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-3.5 sm:p-4">
            <p className="text-xs font-bold uppercase tracking-wide text-slate-600">
              Acceso al sistema
            </p>

            <div className="space-y-3">
              <div>
                <label
                  htmlFor="email-acceso-especialista"
                  className="mb-1 block text-xs font-semibold text-slate-600"
                >
                  Correo de acceso
                </label>
                <input
                  id="email-acceso-especialista"
                  name="emailAccesoEspecialista"
                  type="email"
                  value={emailAcceso}
                  onChange={(evento) => setEmailAcceso(evento.target.value)}
                  placeholder="especialista@correo.com"
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-400"
                />
              </div>

              <div>
                <label
                  htmlFor="contrasena-acceso-especialista"
                  className="mb-1 block text-xs font-semibold text-slate-600"
                >
                  Contraseña de acceso
                </label>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="relative flex-1">
                    <input
                      id="contrasena-acceso-especialista"
                      name="contrasenaAccesoEspecialista"
                      type={mostrarContrasenaAcceso ? 'text' : 'password'}
                      value={contrasenaAcceso}
                      onChange={(evento) => setContrasenaAcceso(evento.target.value)}
                      placeholder="Contraseña segura"
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 pr-10 text-sm outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-400"
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarContrasenaAcceso((valorActual) => !valorActual)}
                      aria-label={
                        mostrarContrasenaAcceso ? 'Ocultar contraseña' : 'Mostrar contraseña'
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600"
                    >
                      {mostrarContrasenaAcceso ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={manejarGenerarContrasena}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-600 transition hover:bg-slate-100 sm:whitespace-nowrap"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Generar
                  </button>
                </div>
                <p className="mt-1 text-[11px] text-slate-400">
                  Min. 8 caracteres, 1 mayúscula, 1 número y 1 símbolo.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer fijo */}
        <div className="flex shrink-0 flex-col-reverse gap-2 border-t border-slate-100 px-3 py-3.5 sm:flex-row sm:justify-end sm:gap-3 sm:px-5 sm:py-4">
          {puedeCerrar && (
            <button
              type="button"
              onClick={manejarCerrar}
              className="rounded-xl bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-200 transition"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={mutacionCrearPersonal.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white transition hover:bg-black disabled:opacity-60"
          >
            <PlusCircle className="h-4 w-4" />
            {mutacionCrearPersonal.isPending ? 'Guardando...' : 'Agregar especialista'}
          </button>
        </div>
      </form>
    </div>
  );
}
