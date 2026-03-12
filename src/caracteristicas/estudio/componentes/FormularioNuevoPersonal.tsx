import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { PlusCircle } from 'lucide-react';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { crearPersonal } from '../../../servicios/servicioPersonal';
import { usarContextoApp } from '../../../contextos/ContextoApp';
import type { Servicio } from '../../../tipos';

interface PropsFormularioNuevoPersonal {
  estudioId: string;
  serviciosDisponibles: Servicio[];
}

const DIAS_LABORALES_PREDETERMINADOS = [1, 2, 3, 4, 5];

export function FormularioNuevoPersonal({
  estudioId,
  serviciosDisponibles,
}: PropsFormularioNuevoPersonal) {
  const { mostrarToast } = usarToast();
  const { recargar } = usarContextoApp();
  const [nombre, setNombre] = useState('');

  const mutacionCrearPersonal = useMutation({
    mutationFn: async () =>
      crearPersonal(estudioId, {
        name: nombre.trim(),
        specialties: serviciosDisponibles.map((servicio) => servicio.name),
        active: true,
        shiftStart: '09:00',
        shiftEnd: '18:00',
        breakStart: '14:00',
        breakEnd: '15:00',
        workingDays: DIAS_LABORALES_PREDETERMINADOS,
      }),
    onSuccess: () => {
      setNombre('');
      recargar();
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
      <div className="flex flex-col gap-3 md:flex-row md:items-end">
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
        <button
          type="button"
          onClick={manejarCrear}
          disabled={mutacionCrearPersonal.isPending}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-pink-600 px-5 py-3 text-xs font-black uppercase text-white transition hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-60"
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
