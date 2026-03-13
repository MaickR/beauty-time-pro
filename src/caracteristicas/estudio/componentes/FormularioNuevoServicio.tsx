import { useState } from 'react';
import { PlusCircle } from 'lucide-react';
import type { Moneda, Servicio } from '../../../tipos';

interface PropsFormularioNuevoServicio {
  moneda: Moneda;
  onAgregar: (servicio: Servicio) => void;
}

export function FormularioNuevoServicio({ moneda, onAgregar }: PropsFormularioNuevoServicio) {
  const [nombre, setNombre] = useState('');
  const [duracion, setDuracion] = useState('60');
  const [precio, setPrecio] = useState('350');

  const manejarAgregar = () => {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      return;
    }

    onAgregar({
      name: nombreLimpio,
      duration: Math.max(5, parseInt(duracion, 10) || 0),
      price: Math.max(0, parseInt(precio, 10) || 0),
    });
    setNombre('');
    setDuracion('60');
    setPrecio('350');
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-3 md:grid-cols-[1.6fr_0.8fr_0.8fr_auto] md:items-end">
        <div>
          <label
            htmlFor="nuevo-servicio"
            className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500"
          >
            Nuevo servicio
          </label>
          <input
            id="nuevo-servicio"
            value={nombre}
            onChange={(evento) => setNombre(evento.target.value)}
            placeholder="Ej. Balayage premium"
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:ring-2 focus:ring-pink-400"
          />
        </div>
        <div>
          <label
            htmlFor="duracion-servicio"
            className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500"
          >
            Duración
          </label>
          <input
            id="duracion-servicio"
            type="number"
            min="5"
            max="480"
            step="5"
            value={duracion}
            onChange={(evento) => setDuracion(evento.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 outline-none transition focus:ring-2 focus:ring-pink-400"
          />
        </div>
        <div>
          <label
            htmlFor="precio-servicio"
            className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500"
          >
            Precio {moneda}
          </label>
          <input
            id="precio-servicio"
            type="number"
            min="0"
            value={precio}
            onChange={(evento) => setPrecio(evento.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 outline-none transition focus:ring-2 focus:ring-pink-400"
          />
        </div>
        <button
          type="button"
          onClick={manejarAgregar}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-xs font-black uppercase text-white transition hover:bg-black"
        >
          <PlusCircle className="h-4 w-4" />
          Agregar
        </button>
      </div>
    </div>
  );
}
