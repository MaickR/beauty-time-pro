import { useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Camera, PlusCircle, X } from 'lucide-react';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { crearPersonal, subirAvatarPersonal } from '../../../servicios/servicioPersonal';
import { usarContextoApp } from '../../../contextos/ContextoApp';
import { SelectorHora } from '../../../componentes/ui/SelectorHora';
import type { Servicio } from '../../../tipos';

interface PropsFormularioNuevoPersonal {
  estudioId: string;
  serviciosDisponibles: Servicio[];
  alCrearExitoso?: () => void | Promise<void>;
}

const DIAS_LABORALES_PREDETERMINADOS = [1, 2, 3, 4, 5];

const NOMBRES_DIAS: Record<number, string> = {
  0: 'Sun',
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
};

export function FormularioNuevoPersonal({
  estudioId,
  serviciosDisponibles,
  alCrearExitoso,
}: PropsFormularioNuevoPersonal) {
  const { mostrarToast } = usarToast();
  const { recargar } = usarContextoApp();
  const [nombre, setNombre] = useState('');
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [archivoAvatar, setArchivoAvatar] = useState<File | null>(null);
  const [horaInicio, setHoraInicio] = useState('09:00');
  const [horaFin, setHoraFin] = useState('18:00');
  const [descansoInicio, setDescansoInicio] = useState('14:00');
  const [descansoFin, setDescansoFin] = useState('15:00');
  const [diasLaborales, setDiasLaborales] = useState<number[]>(DIAS_LABORALES_PREDETERMINADOS);
  const [especialidades, setEspecialidades] = useState<string[]>(
    serviciosDisponibles.map((s) => s.name),
  );
  const refArchivo = useRef<HTMLInputElement>(null);

  const manejarArchivoAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = e.target.files?.[0];
    if (!archivo) return;
    if (!['image/jpeg', 'image/png'].includes(archivo.type)) {
      mostrarToast({ mensaje: 'Solo se permiten imágenes JPG o PNG', variante: 'error' });
      return;
    }
    if (archivo.size > 2 * 1024 * 1024) {
      mostrarToast({ mensaje: 'La imagen no debe superar 2 MB', variante: 'error' });
      return;
    }
    setArchivoAvatar(archivo);
    setAvatarPreview(URL.createObjectURL(archivo));
  };

  const alternarEspecialidad = (servicio: string) => {
    setEspecialidades((actual) =>
      actual.includes(servicio)
        ? actual.filter((item) => item !== servicio)
        : [...actual, servicio],
    );
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
      });

      if (archivoAvatar) {
        const avatarUrl = await subirAvatarPersonal(estudioId, personal.id, archivoAvatar);
        personal.avatarUrl = avatarUrl;
      }

      return personal;
    },
    onSuccess: async () => {
      setNombre('');
      setAvatarPreview(null);
      setArchivoAvatar(null);
      setEspecialidades(serviciosDisponibles.map((s) => s.name));
      setHoraInicio('09:00');
      setHoraFin('18:00');
      setDescansoInicio('14:00');
      setDescansoFin('15:00');
      setDiasLaborales(DIAS_LABORALES_PREDETERMINADOS);
      if (alCrearExitoso) {
        await alCrearExitoso();
      } else {
        recargar();
      }
      mostrarToast('Especialista agregado correctamente');
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
    mutacionCrearPersonal.mutate();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-nuevo-especialista"
      className="w-full max-w-2xl rounded-4xl bg-white p-6 shadow-2xl"
    >
      <div className="mb-5 flex items-center justify-between">
        <h3 id="titulo-nuevo-especialista" className="text-xl font-black text-slate-900">
          New Specialist
        </h3>
        {alCrearExitoso && (
          <button type="button" onClick={() => void alCrearExitoso()} aria-label="Cerrar modal">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="md:col-span-2 flex items-center gap-4">
          <button
            type="button"
            onClick={() => refArchivo.current?.click()}
            aria-label="Subir foto del especialista"
            className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-slate-300 bg-slate-100 shrink-0 transition-colors hover:bg-slate-200"
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="Vista previa" className="h-full w-full object-cover" />
            ) : (
              <Camera className="h-6 w-6 text-slate-400" aria-hidden="true" />
            )}
          </button>
          <div>
            <p className="text-sm font-bold text-slate-700">Photo</p>
            <p className="text-xs text-slate-400">JPG or PNG, max 2 MB.</p>
          </div>
          <input
            ref={refArchivo}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={manejarArchivoAvatar}
          />
        </div>

        <div className="md:col-span-2">
          <label
            htmlFor="nuevo-especialista"
            className="mb-1 block text-sm font-semibold text-slate-700"
          >
            Full name
          </label>
          <input
            id="nuevo-especialista"
            value={nombre}
            onChange={(evento) => setNombre(evento.target.value)}
            placeholder="Specialist's name"
            className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-pink-500"
          />
        </div>

        <SelectorHora etiqueta="Shift start" valor={horaInicio} alCambiar={setHoraInicio} />
        <SelectorHora etiqueta="Shift end" valor={horaFin} alCambiar={setHoraFin} />
        <SelectorHora etiqueta="Break start" valor={descansoInicio} alCambiar={setDescansoInicio} />
        <SelectorHora etiqueta="Break end" valor={descansoFin} alCambiar={setDescansoFin} />

        <div className="md:col-span-2">
          <p className="mb-2 text-sm font-semibold text-slate-700">Working days</p>
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
          <p className="mb-2 text-sm font-semibold text-slate-700">Services performed</p>
          <div className="flex flex-wrap gap-2">
            {serviciosDisponibles.map((servicio) => {
              const activo = especialidades.includes(servicio.name);
              return (
                <button
                  key={servicio.name}
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
      </div>

      <div className="mt-6 flex justify-end gap-3">
        {alCrearExitoso && (
          <button
            type="button"
            onClick={() => void alCrearExitoso()}
            className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={manejarCrear}
          disabled={mutacionCrearPersonal.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white transition hover:bg-black disabled:opacity-60"
        >
          <PlusCircle className="h-4 w-4" />
          {mutacionCrearPersonal.isPending ? 'Saving...' : 'Add Specialist'}
        </button>
      </div>
    </div>
  );
}
