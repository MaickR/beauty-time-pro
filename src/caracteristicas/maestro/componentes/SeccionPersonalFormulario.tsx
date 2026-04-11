import { useReducer } from 'react';
import { useMutation } from '@tanstack/react-query';
import { UserPlus, Clock, Coffee } from 'lucide-react';
import { SelectorHora } from '../../../componentes/ui/SelectorHora';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import type { Personal, Servicio } from '../../../tipos';
import { limpiarNombrePersonaEntrada } from '../../../utils/formularioSalon';

interface PropsSeccionPersonalFormulario {
  serviciosDisponibles: Servicio[];
  onAgregarPersonal: (personal: Personal) => void;
}

interface EstadoFormPersonal {
  nombre: string;
  turnoInicio: string;
  turnoFin: string;
  descansoInicio: string;
  descansoFin: string;
  especialidades: string[];
}

type AccionFormPersonal =
  | { tipo: 'NOMBRE'; valor: string }
  | { tipo: 'TURNO_INICIO'; valor: string }
  | { tipo: 'TURNO_FIN'; valor: string }
  | { tipo: 'DESCANSO_INICIO'; valor: string }
  | { tipo: 'DESCANSO_FIN'; valor: string }
  | { tipo: 'TOGGLE_ESPECIALIDAD'; nombre: string }
  | { tipo: 'RESET' };

const estadoInicial: EstadoFormPersonal = {
  nombre: '',
  turnoInicio: '09:00',
  turnoFin: '19:00',
  descansoInicio: '14:00',
  descansoFin: '15:00',
  especialidades: [],
};

function reducer(estado: EstadoFormPersonal, accion: AccionFormPersonal): EstadoFormPersonal {
  switch (accion.tipo) {
    case 'NOMBRE':
      return { ...estado, nombre: accion.valor };
    case 'TURNO_INICIO':
      return { ...estado, turnoInicio: accion.valor };
    case 'TURNO_FIN':
      return { ...estado, turnoFin: accion.valor };
    case 'DESCANSO_INICIO':
      return { ...estado, descansoInicio: accion.valor };
    case 'DESCANSO_FIN':
      return { ...estado, descansoFin: accion.valor };
    case 'TOGGLE_ESPECIALIDAD': {
      const lista = estado.especialidades.includes(accion.nombre)
        ? estado.especialidades.filter((e) => e !== accion.nombre)
        : [...estado.especialidades, accion.nombre];
      return { ...estado, especialidades: lista };
    }
    case 'RESET':
      return estadoInicial;
    default:
      return estado;
  }
}

export function SeccionPersonalFormulario({
  serviciosDisponibles,
  onAgregarPersonal,
}: PropsSeccionPersonalFormulario) {
  const [form, dispatch] = useReducer(reducer, estadoInicial);
  const { mostrarToast } = usarToast();

  const { mutate: crearPersonal, isPending } = useMutation({
    mutationFn: async (nuevoPersonal: Personal) => nuevoPersonal,
    onSuccess: (nuevoPersonal) => {
      onAgregarPersonal(nuevoPersonal);
      dispatch({ tipo: 'RESET' });
      mostrarToast({
        mensaje: `Personal creado exitosamente. ${nuevoPersonal.name} ya aparece en tu equipo.`,
        variante: 'exito',
        icono: '✓',
        duracionMs: 4000,
      });
    },
    onError: () => {
      mostrarToast({
        mensaje: 'No se pudo crear el personal. Verifica los datos e intenta de nuevo.',
        variante: 'error',
        icono: '✗',
        duracionMs: 4000,
      });
    },
  });

  const manejarAgregar = () => {
    if (!form.nombre.trim()) {
      mostrarToast({
        mensaje: 'No se pudo crear el personal. Verifica los datos e intenta de nuevo.',
        variante: 'error',
        icono: '✗',
        duracionMs: 4000,
      });
      return;
    }

    crearPersonal({
      id: `staff_${Date.now()}`,
      name: form.nombre.trim(),
      specialties: form.especialidades,
      active: true,
      shiftStart: form.turnoInicio || '09:00',
      shiftEnd: form.turnoFin || '19:00',
      breakStart: form.descansoInicio || null,
      breakEnd: form.descansoFin || null,
      workingDays: null,
    });
  };

  return (
    <div className="bg-slate-50 p-6 rounded-4xl border border-slate-100 space-y-4">
      <div className="font-black text-xs text-pink-600 uppercase tracking-widest flex items-center gap-2">
        <UserPlus className="w-4 h-4" /> Personal
      </div>
      <input
        id="nombre-personal"
        name="nombrePersonal"
        type="text"
        autoComplete="off"
        placeholder="Nombre completo"
        value={form.nombre}
        onChange={(e) =>
          dispatch({ tipo: 'NOMBRE', valor: limpiarNombrePersonaEntrada(e.target.value) })
        }
        className="w-full p-3 bg-white border border-slate-200 rounded-xl font-bold text-sm outline-none focus:ring-2 focus:ring-pink-500"
      />
      <div className="p-4 bg-white rounded-2xl border border-slate-100 space-y-4">
        <div className="grid gap-3 lg:grid-cols-[auto_auto_1fr_auto_1fr] lg:items-center">
          <Clock className="w-3 h-3 text-blue-600 shrink-0" />
          <span className="text-[9px] font-black text-slate-600 uppercase">Turno</span>
          <SelectorHora
            etiqueta="Inicio turno"
            valor={form.turnoInicio}
            alCambiar={(valor) => dispatch({ tipo: 'TURNO_INICIO', valor })}
            ocultarEtiqueta
            claseContenedor="w-full"
            claseSelect="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-pink-500"
          />
          <span className="text-slate-400 text-xs font-bold">a</span>
          <SelectorHora
            etiqueta="Fin turno"
            valor={form.turnoFin}
            alCambiar={(valor) => dispatch({ tipo: 'TURNO_FIN', valor })}
            ocultarEtiqueta
            claseContenedor="w-full"
            claseSelect="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-pink-500"
          />
        </div>
        <div className="grid gap-3 lg:grid-cols-[auto_auto_1fr_auto_1fr] lg:items-center">
          <Coffee className="w-3 h-3 text-yellow-600 shrink-0" />
          <span className="text-[9px] font-black text-slate-600 uppercase">Break</span>
          <SelectorHora
            etiqueta="Inicio descanso"
            valor={form.descansoInicio}
            alCambiar={(valor) => dispatch({ tipo: 'DESCANSO_INICIO', valor })}
            ocultarEtiqueta
            claseContenedor="w-full"
            claseSelect="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-pink-500"
          />
          <span className="text-slate-400 text-xs font-bold">a</span>
          <SelectorHora
            etiqueta="Fin descanso"
            valor={form.descansoFin}
            alCambiar={(valor) => dispatch({ tipo: 'DESCANSO_FIN', valor })}
            ocultarEtiqueta
            claseContenedor="w-full"
            claseSelect="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-pink-500"
          />
        </div>
      </div>
      {serviciosDisponibles.length > 0 && (
        <div>
          <p className="text-[10px] font-black text-slate-400 uppercase mb-2">
            ¿Qué servicios realiza?
          </p>
          <div className="flex flex-wrap gap-2">
            {serviciosDisponibles.map((s) => (
              <button
                key={s.name}
                type="button"
                onClick={() => dispatch({ tipo: 'TOGGLE_ESPECIALIDAD', nombre: s.name })}
                className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase border transition-colors ${
                  form.especialidades.includes(s.name)
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-500 border-slate-200'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <button
        type="button"
        onClick={manejarAgregar}
        aria-busy={isPending}
        className="w-full py-3 bg-pink-100 text-pink-700 font-black rounded-xl text-xs uppercase flex items-center justify-center gap-2 hover:bg-pink-200"
      >
        <UserPlus className="w-4 h-4" /> {isPending ? 'Guardando...' : 'Guardar Empleado'}
      </button>
    </div>
  );
}
