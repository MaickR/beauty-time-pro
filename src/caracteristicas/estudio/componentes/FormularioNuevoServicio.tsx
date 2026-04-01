import { useState } from 'react';
import { PlusCircle } from 'lucide-react';
import type { Moneda, Servicio } from '../../../tipos';
import { convertirCentavosAMoneda, convertirMonedaACentavos } from '../../../utils/formato';
import { CATALOGO_SERVICIOS, type CategoriaServicio } from '../../../lib/constantes';

const CATEGORIAS_FORMULARIO = Object.keys(CATALOGO_SERVICIOS) as CategoriaServicio[];

const obtenerLocaleMoneda = (moneda: Moneda) => (moneda === 'COP' ? 'es-CO' : 'es-MX');

const limpiarDigitos = (valor: string) => valor.replace(/\D/g, '');

const normalizarEnteroEditable = (valor: string) => limpiarDigitos(valor).replace(/^0+(?=\d)/, '');

const formatearMontoEditable = (valor: string, moneda: Moneda) => {
  if (!valor) {
    return '';
  }

  return `$${new Intl.NumberFormat(obtenerLocaleMoneda(moneda), {
    maximumFractionDigits: 0,
  }).format(convertirCentavosAMoneda(parseInt(valor, 10)))}`;
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
  const [precio, setPrecio] = useState(String(convertirMonedaACentavos(350)));
  const [categoria, setCategoria] = useState<CategoriaServicio>('Otros');
  const [mensajeError, setMensajeError] = useState('');

  const manejarAgregar = () => {
    const nombreLimpio = nombre.trim();
    if (!nombreLimpio) {
      return;
    }

    const precioNumerico = parseInt(precio, 10) || 0;
    if (precioNumerico < 100) {
      setMensajeError('El precio debe ser mayor a 0.');
      return;
    }

    onAgregar({
      name: nombreLimpio,
      duration: Math.max(5, parseInt(duracion, 10) || 0),
      price: precioNumerico,
      category: categoria,
    });
    setNombre('');
    setDuracion('60');
    setPrecio(String(convertirMonedaACentavos(350)));
    setCategoria('Otros');
    setMensajeError('');
  };

  const manejarCambioDuracion = (valor: string) => {
    setDuracion(normalizarEnteroEditable(valor));
  };

  const manejarCambioPrecio = (valor: string) => {
    setMensajeError('');
    const montoVisible = parseInt(limpiarDigitos(valor) || '0', 10);
    setPrecio(String(convertirMonedaACentavos(montoVisible)));
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="grid gap-3 md:grid-cols-[1.4fr_0.8fr_0.7fr_0.7fr_auto] md:items-end">
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
            htmlFor="categoria-servicio"
            className="mb-1 block text-[10px] font-black uppercase tracking-widest text-slate-500"
          >
            Categoría
          </label>
          <select
            id="categoria-servicio"
            value={categoria}
            onChange={(evento) => setCategoria(evento.target.value as CategoriaServicio)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 outline-none transition focus:ring-2 focus:ring-pink-400"
          >
            {CATEGORIAS_FORMULARIO.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
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
