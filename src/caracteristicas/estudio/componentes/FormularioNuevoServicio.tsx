import { useState } from 'react';
import { PlusCircle } from 'lucide-react';
import type { Moneda, Servicio } from '../../../tipos';

const obtenerLocaleMoneda = (moneda: Moneda) => (moneda === 'COP' ? 'es-CO' : 'es-MX');

const limpiarDigitos = (valor: string) => valor.replace(/\D/g, '');

const normalizarEnteroEditable = (valor: string) => limpiarDigitos(valor).replace(/^0+(?=\d)/, '');

const formatearMontoEditable = (valor: string, moneda: Moneda) => {
  if (!valor) {
    return '';
  }

  return `$${new Intl.NumberFormat(obtenerLocaleMoneda(moneda), {
    maximumFractionDigits: 0,
  }).format(parseInt(valor, 10))}`;
};

interface PropsFormularioNuevoServicio {
  moneda: Moneda;
  onAgregar: (servicio: Servicio) => void;
  bloqueado?: boolean;
  mensajeBloqueo?: string;
}

export function FormularioNuevoServicio({
  moneda,
  onAgregar,
  bloqueado = false,
  mensajeBloqueo,
}: PropsFormularioNuevoServicio) {
  const [nombre, setNombre] = useState('');
  const [duracion, setDuracion] = useState('60');
  const [precio, setPrecio] = useState('350');
  const [mensajeError, setMensajeError] = useState('');

  const manejarAgregar = () => {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      return;
    }

    const precioNumerico = parseInt(precio, 10) || 0;
    if (precioNumerico < 1) {
      setMensajeError('El precio debe ser mayor a 0.');
      return;
    }

    onAgregar({
      name: nombreLimpio,
      duration: Math.max(5, parseInt(duracion, 10) || 0),
      price: precioNumerico,
    });
    setNombre('');
    setDuracion('60');
    setPrecio('350');
    setMensajeError('');
  };

  const manejarCambioDuracion = (valor: string) => {
    setDuracion(normalizarEnteroEditable(valor));
  };

  const manejarCambioPrecio = (valor: string) => {
    setMensajeError('');
    setPrecio(limpiarDigitos(valor));
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
            value={duracion}
            onChange={(evento) => manejarCambioDuracion(evento.target.value)}
            inputMode="numeric"
            placeholder="90"
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
            value={formatearMontoEditable(precio, moneda)}
            onChange={(evento) => manejarCambioPrecio(evento.target.value)}
            inputMode="numeric"
            placeholder={moneda === 'COP' ? '$25.000' : '$25,000'}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-800 outline-none transition focus:ring-2 focus:ring-pink-400"
          />
        </div>
        <button
          type="button"
          onClick={manejarAgregar}
          disabled={bloqueado}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-5 py-3 text-xs font-black uppercase text-white transition hover:bg-black disabled:opacity-50"
        >
          <PlusCircle className="h-4 w-4" />
          Agregar
        </button>
      </div>
      {mensajeBloqueo && (
        <p className="mt-3 text-xs font-medium text-amber-700">{mensajeBloqueo}</p>
      )}
      {mensajeError && <p className="mt-3 text-xs font-medium text-red-600">{mensajeError}</p>}
    </div>
  );
}
