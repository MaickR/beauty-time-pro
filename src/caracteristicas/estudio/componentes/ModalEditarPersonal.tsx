import { useEffect, useRef, useState } from 'react';
import { Camera, X } from 'lucide-react';
import { SelectorHora } from '../../../componentes/ui/SelectorHora';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { actualizarPersonal, subirAvatarPersonal } from '../../../servicios/servicioPersonal';
import type { Personal } from '../../../tipos';

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
  estudioId,
  personal,
  serviciosDisponibles,
  onCerrar,
  onGuardado,
}: PropsModalEditarPersonal) {
  const { mostrarToast } = usarToast();
  const refArchivo = useRef<HTMLInputElement>(null);
  const [nombre, setNombre] = useState('');
  const [especialidades, setEspecialidades] = useState<string[]>([]);
  const [horaInicio, setHoraInicio] = useState('09:00');
  const [horaFin, setHoraFin] = useState('18:00');
  const [descansoInicio, setDescansoInicio] = useState('14:00');
  const [descansoFin, setDescansoFin] = useState('15:00');
  const [archivoAvatar, setArchivoAvatar] = useState<File | null>(null);
  const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (!abierto || !personal) return;
    setNombre(personal.name);
    setEspecialidades(personal.specialties);
    setHoraInicio(personal.shiftStart ?? '09:00');
    setHoraFin(personal.shiftEnd ?? '18:00');
    setDescansoInicio(personal.breakStart ?? '14:00');
    setDescansoFin(personal.breakEnd ?? '15:00');
    setArchivoAvatar(null);
    setVistaPrevia(personal.avatarUrl ?? null);
  }, [abierto, personal]);

  if (!abierto || !personal) return null;

  const alternarEspecialidad = (servicio: string) => {
    setEspecialidades((actual) =>
      actual.includes(servicio)
        ? actual.filter((item) => item !== servicio)
        : [...actual, servicio],
    );
  };

  const manejarArchivo = (evento: React.ChangeEvent<HTMLInputElement>) => {
    const archivo = evento.target.files?.[0];
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
    setVistaPrevia(URL.createObjectURL(archivo));
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
      });

      if (archivoAvatar) {
        const avatarUrl = await subirAvatarPersonal(estudioId, personal.id, archivoAvatar);
        actualizado.avatarUrl = avatarUrl;
      }

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-editar-especialista"
        className="w-full max-w-2xl rounded-4xl bg-white p-6 shadow-2xl"
      >
        <div className="mb-5 flex items-center justify-between">
          <h3 id="titulo-editar-especialista" className="text-xl font-black text-slate-900">
            Editar especialista
          </h3>
          <button type="button" onClick={onCerrar} aria-label="Cerrar modal">
            <X className="h-5 w-5 text-slate-400" />
          </button>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2 flex items-center gap-4">
            <button
              type="button"
              onClick={() => refArchivo.current?.click()}
              className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-slate-300 bg-slate-100"
            >
              {vistaPrevia ? (
                <img
                  src={vistaPrevia}
                  alt={`Foto de ${nombre}`}
                  className="h-full w-full object-cover"
                />
              ) : (
                <Camera className="h-6 w-6 text-slate-400" />
              )}
            </button>
            <div>
              <p className="text-sm font-bold text-slate-700">Foto del especialista</p>
              <p className="text-xs text-slate-400">JPG o PNG, máximo 2 MB.</p>
            </div>
            <input
              ref={refArchivo}
              type="file"
              accept="image/jpeg,image/png"
              className="hidden"
              onChange={manejarArchivo}
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="nombre-especialista-modal"
              className="mb-1 block text-sm font-semibold text-slate-700"
            >
              Nombre completo
            </label>
            <input
              id="nombre-especialista-modal"
              value={nombre}
              onChange={(evento) => setNombre(evento.target.value)}
              className="w-full rounded-xl border border-slate-200 px-3.5 py-3 text-sm outline-none focus:ring-2 focus:ring-pink-500"
            />
          </div>

          <SelectorHora etiqueta="Entrada" valor={horaInicio} alCambiar={setHoraInicio} />
          <SelectorHora etiqueta="Salida" valor={horaFin} alCambiar={setHoraFin} />
          <SelectorHora
            etiqueta="Inicio de almuerzo"
            valor={descansoInicio}
            alCambiar={setDescansoInicio}
          />
          <SelectorHora etiqueta="Fin de almuerzo" valor={descansoFin} alCambiar={setDescansoFin} />

          <div className="md:col-span-2">
            <p className="mb-2 text-sm font-semibold text-slate-700">Servicios que realiza</p>
            <div className="flex flex-wrap gap-2">
              {serviciosDisponibles.map((servicio) => {
                const activo = especialidades.includes(servicio);
                return (
                  <button
                    key={servicio}
                    type="button"
                    onClick={() => alternarEspecialidad(servicio)}
                    className={`rounded-xl px-3 py-1.5 text-xs font-bold transition-colors ${activo ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-600 hover:border-pink-300 hover:text-pink-600'}`}
                  >
                    {activo ? '✓ ' : ''}
                    {servicio}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-2xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void guardar()}
            disabled={guardando}
            className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-black text-white hover:bg-black disabled:opacity-60"
          >
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </div>
    </div>
  );
}
