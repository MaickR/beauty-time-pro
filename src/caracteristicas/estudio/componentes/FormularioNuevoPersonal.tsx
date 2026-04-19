import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
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
import type { Servicio } from '../../../tipos';

interface PropsFormularioNuevoPersonal {
  estudioId: string;
  serviciosDisponibles: Servicio[];
  alCrearExitoso?: () => void | Promise<void>;
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
}: PropsFormularioNuevoPersonal) {
  const { mostrarToast } = usarToast();
  const { recargar } = usarContextoApp();
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
      if (alCrearExitoso) {
        await alCrearExitoso();
      } else {
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

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-nuevo-especialista"
      className="w-full max-w-2xl rounded-4xl bg-white p-6 shadow-2xl"
    >
      <form
        onSubmit={(evento) => {
          evento.preventDefault();
          manejarCrear();
        }}
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 id="titulo-nuevo-especialista" className="text-xl font-black text-slate-900">
            Nuevo especialista
          </h3>
          {alCrearExitoso && (
            <button type="button" onClick={() => void alCrearExitoso()} aria-label="Cerrar modal">
              <X className="h-5 w-5 text-slate-400" />
            </button>
          )}
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2 flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-pink-100 text-xl font-black text-pink-700 shrink-0">
              {obtenerIniciales(nombre)}
            </div>
            <div>
              <p className="text-sm font-bold text-slate-700">Avatar automático</p>
              <p className="text-xs text-slate-400">
                Se generará con las iniciales del especialista. Ya no es necesario subir foto.
              </p>
            </div>
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="nuevo-especialista"
              className="mb-1 block text-sm font-semibold text-slate-700"
            >
              Nombre completo
            </label>
            <input
              id="nuevo-especialista"
              name="nombreEspecialista"
              value={nombre}
              onChange={(evento) => setNombre(evento.target.value)}
              placeholder="Nombre del especialista"
              className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          <SelectorHora etiqueta="Entrada" valor={horaInicio} alCambiar={setHoraInicio} />
          <SelectorHora etiqueta="Salida" valor={horaFin} alCambiar={setHoraFin} />
          <SelectorHora
            etiqueta="Inicio de descanso"
            valor={descansoInicio}
            alCambiar={setDescansoInicio}
          />
          <SelectorHora etiqueta="Fin de descanso" valor={descansoFin} alCambiar={setDescansoFin} />

          <div className="md:col-span-2">
            <p className="mb-2 text-sm font-semibold text-slate-700">Días laborales</p>
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3, 4, 5, 6, 0].map((dia) => {
                const activo = diasLaborales.includes(dia);
                return (
                  <button
                    key={dia}
                    type="button"
                    onClick={() => alternarDia(dia)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${activo ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-pink-300 hover:text-pink-600'}`}
                  >
                    {NOMBRES_DIAS[dia]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="md:col-span-2">
            <p className="mb-2 text-sm font-semibold text-slate-700">Servicios que realiza</p>
            <div className="flex flex-wrap gap-2">
              {serviciosDisponibles.map((servicio, indiceServicio) => {
                const activo = especialidades.includes(servicio.name);
                return (
                  <button
                    key={`${servicio.name}-${indiceServicio}`}
                    type="button"
                    onClick={() => alternarEspecialidad(servicio.name)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${activo ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-pink-300 hover:text-pink-600'}`}
                  >
                    {activo ? '✓ ' : ''}
                    {servicio.name}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="md:col-span-2 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-semibold text-emerald-800">Comisión del especialista</p>
            <p className="mt-1 text-xs text-emerald-700">
              Define un porcentaje base y, si lo necesitas, ajusta porcentajes por servicio para
              transparentar el cálculo de comisiones.
            </p>

            <div className="mt-3 grid gap-3 md:grid-cols-[220px_1fr]">
              <label className="space-y-1">
                <span className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  Comisión base (%)
                </span>
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

              <div className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
                  Comisión por servicio (opcional)
                </p>
                {especialidades.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-emerald-200 bg-white px-3 py-2 text-xs text-emerald-700">
                    Selecciona al menos un servicio para configurar comisiones específicas.
                  </p>
                ) : (
                  <div className="grid gap-2 sm:grid-cols-2">
                    {especialidades.map((servicio) => (
                      <label
                        key={`comision-${servicio}`}
                        className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2"
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
                            className="w-16 rounded-lg border border-emerald-200 px-2 py-1 text-right text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-300"
                          />
                          <span className="text-xs font-black text-emerald-700">%</span>
                        </div>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="md:col-span-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="space-y-2">
              <p className="text-sm font-semibold text-slate-700">Acceso al sistema</p>
              <p className="text-xs text-slate-500">
                Cada especialista se crea con acceso inmediato. Define o genera la contraseña que se
                enviará por email junto con el enlace de ingreso.
              </p>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label
                  htmlFor="email-acceso-especialista"
                  className="block text-sm font-semibold text-slate-700"
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
                  className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              <div className="space-y-2">
                <label
                  htmlFor="contrasena-acceso-especialista"
                  className="block text-sm font-semibold text-slate-700"
                >
                  Contraseña de acceso
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      id="contrasena-acceso-especialista"
                      name="contrasenaAccesoEspecialista"
                      type={mostrarContrasenaAcceso ? 'text' : 'password'}
                      value={contrasenaAcceso}
                      onChange={(evento) => setContrasenaAcceso(evento.target.value)}
                      placeholder="Define una contraseña segura"
                      autoComplete="new-password"
                      className="w-full rounded-xl border border-slate-200 px-3.5 py-3 pr-10 text-sm outline-none focus:ring-2 focus:ring-pink-500"
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
                    className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-black uppercase tracking-widest text-slate-700 transition hover:bg-slate-100"
                  >
                    <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                    Generar
                  </button>
                </div>
                <p className="text-xs text-slate-500">
                  Usa al menos 8 caracteres, una mayúscula, un número y un símbolo.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          {alCrearExitoso && (
            <button
              type="button"
              onClick={() => void alCrearExitoso()}
              className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
            >
              Cancelar
            </button>
          )}
          <button
            type="submit"
            disabled={mutacionCrearPersonal.isPending}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white transition hover:bg-black disabled:opacity-60"
          >
            <PlusCircle className="h-4 w-4" />
            {mutacionCrearPersonal.isPending ? 'Guardando...' : 'Agregar especialista'}
          </button>
        </div>
      </form>
    </div>
  );
}
