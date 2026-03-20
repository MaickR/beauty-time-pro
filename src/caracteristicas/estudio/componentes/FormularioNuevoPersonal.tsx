import { useEffect, useRef, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Camera, PlusCircle } from 'lucide-react';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { crearPersonal, subirAvatarPersonal } from '../../../servicios/servicioPersonal';
import { usarContextoApp } from '../../../contextos/ContextoApp';
import type { Servicio } from '../../../tipos';

interface PropsFormularioNuevoPersonal {
  estudioId: string;
  serviciosDisponibles: Servicio[];
  alCrearExitoso?: () => void | Promise<void>;
}

const DIAS_LABORALES_PREDETERMINADOS = [1, 2, 3, 4, 5];

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
  const refArchivo = useRef<HTMLInputElement>(null);
  const CLAVE_ALMACEN = `nuevo_personal_${estudioId}`;

  useEffect(() => {
    try {
      const borrador = localStorage.getItem(CLAVE_ALMACEN);
      if (!borrador) return;
      const datos = JSON.parse(borrador) as { nombre?: string };
      setNombre(datos.nombre ?? '');
    } catch {
      localStorage.removeItem(CLAVE_ALMACEN);
    }
  }, [CLAVE_ALMACEN]);

  useEffect(() => {
    localStorage.setItem(CLAVE_ALMACEN, JSON.stringify({ nombre }));
  }, [CLAVE_ALMACEN, nombre]);

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

  const mutacionCrearPersonal = useMutation({
    mutationFn: async () => {
      const personal = await crearPersonal(estudioId, {
        name: nombre.trim(),
        specialties: serviciosDisponibles.map((servicio) => servicio.name),
        active: true,
        shiftStart: '09:00',
        shiftEnd: '18:00',
        breakStart: '14:00',
        breakEnd: '15:00',
        workingDays: DIAS_LABORALES_PREDETERMINADOS,
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
      localStorage.removeItem(CLAVE_ALMACEN);
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
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3">
        {/* Fila 1: avatar + input */}
        <div className="flex items-end gap-3">
          <button
            type="button"
            aria-label="Subir foto del especialista"
            onClick={() => refArchivo.current?.click()}
            className="relative w-14 h-14 rounded-full bg-slate-200 hover:bg-slate-300 flex items-center justify-center shrink-0 transition-colors overflow-hidden border-2 border-dashed border-slate-300"
          >
            {avatarPreview ? (
              <img src={avatarPreview} alt="Vista previa" className="w-full h-full object-cover" />
            ) : (
              <Camera className="w-5 h-5 text-slate-400" aria-hidden="true" />
            )}
          </button>
          <input
            ref={refArchivo}
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={manejarArchivoAvatar}
          />
          <div className="flex-1">
            <label
              htmlFor="nuevo-especialista"
              className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500"
            >
              Nuevo especialista
            </label>
            <input
              id="nuevo-especialista"
              value={nombre}
              onChange={(evento) => setNombre(evento.target.value)}
              placeholder="Nombre del especialista"
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:ring-2 focus:ring-pink-400"
            />
          </div>
        </div>

        {/* Fila 2: botón full-width */}
        <button
          type="button"
          onClick={manejarCrear}
          disabled={mutacionCrearPersonal.isPending}
          className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-pink-600 px-5 py-3 text-xs font-black uppercase text-white transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <PlusCircle className="h-4 w-4" />
          {mutacionCrearPersonal.isPending ? 'Guardando...' : 'Agregar especialista'}
        </button>
      </div>
      <p className="mt-3 text-xs font-medium text-slate-500">
        Se crea con turno 09:00 a 18:00, descanso 14:00 a 15:00 y días laborales de lunes a viernes.
      </p>
    </div>
  );
}
