import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Clock, ChevronRight, Star } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { obtenerMiPerfil, obtenerSalonesPublicos } from '../../servicios/servicioClienteApp';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';
import { NavegacionCliente } from '../../componentes/diseno/NavegacionCliente';
import type { Pais, SalonPublico } from '../../tipos';

const CATEGORIAS = ['Corte', 'Color', 'Tratamiento', 'Uñas', 'Maquillaje', 'Depilación'];

function etiquetaPais(pais: Pais): string {
  return pais === 'Mexico' ? 'México' : 'Colombia';
}

function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

interface PropsTarjetaSalon {
  salon: SalonPublico;
}

function TarjetaSalon({ salon }: PropsTarjetaSalon) {
  const navegar = useNavigate();
  const color = salon.colorPrimario ?? '#C2185B';
  const chips = salon.categorias
    ? salon.categorias
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
    : [];
  const horario =
    salon.horarioApertura && salon.horarioCierre
      ? `${salon.horarioApertura}–${salon.horarioCierre}`
      : null;

  return (
    <article
      className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-1 transition-all duration-200 flex flex-col"
      aria-label={`Salón ${salon.nombre}`}
    >
      {/* Avatar del salón */}
      <div
        className="h-28 flex items-center justify-center"
        style={{ backgroundColor: color + '18' }}
      >
        {salon.logoUrl ? (
          <img
            src={salon.logoUrl}
            alt={`Logo de ${salon.nombre}`}
            loading="lazy"
            className="h-20 w-20 rounded-2xl object-cover"
          />
        ) : (
          <span
            className="text-3xl font-black rounded-2xl w-20 h-20 flex items-center justify-center text-white"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          >
            {iniciales(salon.nombre)}
          </span>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1 gap-3">
        <div>
          <h3 className="font-black text-slate-900 text-base leading-tight">{salon.nombre}</h3>
          {salon.descripcion && (
            <p className="text-slate-500 text-xs mt-1 line-clamp-2">{salon.descripcion}</p>
          )}
        </div>

        {/* Categorías */}
        {chips.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {chips.slice(0, 3).map((c) => (
              <span
                key={c}
                className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                style={{ borderColor: color, color }}
              >
                {c}
              </span>
            ))}
          </div>
        )}

        {/* Info */}
        <div className="space-y-1">
          {horario && (
            <p className="flex items-center gap-1.5 text-xs text-slate-400">
              <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
              {horario}
            </p>
          )}
          {salon.direccion && (
            <p className="flex items-center gap-1.5 text-xs text-slate-400 truncate">
              <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
              {salon.direccion}
            </p>
          )}
        </div>

        {/* Botón */}
        <button
          onClick={() => navegar(`/cliente/salon/${salon.id}`)}
          className="mt-auto w-full py-3 rounded-2xl font-black text-xs text-white flex items-center justify-center gap-1.5 hover:brightness-110 transition-all"
          style={{ backgroundColor: color }}
        >
          Reservar cita <ChevronRight className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

export function PaginaInicioCliente() {
  const { usuario } = usarTiendaAuth();
  const [busqueda, setBusqueda] = useState('');
  const [categoriasActivas, setCategoriasActivas] = useState<string[]>([]);
  const [busquedaDelay, setBusquedaDelay] = useState('');
  const [paisExplorado, setPaisExplorado] = useState<Pais | null>(null);

  const { data: perfilCliente } = useQuery({
    queryKey: ['mi-perfil'],
    queryFn: obtenerMiPerfil,
    staleTime: 1000 * 60,
  });

  const paisCliente = perfilCliente?.pais ?? 'Mexico';
  const paisActivo = paisExplorado ?? paisCliente;
  const paisAlternativo = paisCliente === 'Mexico' ? 'Colombia' : 'Mexico';
  const explorandoOtroPais = paisActivo !== paisCliente;

  // Debounce 300ms
  useEffect(() => {
    const t = window.setTimeout(() => setBusquedaDelay(busqueda), 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  const { data: salones = [], isLoading } = useQuery<SalonPublico[]>({
    queryKey: ['salones-publicos', busquedaDelay, categoriasActivas.join('|'), paisActivo],
    queryFn: () =>
      obtenerSalonesPublicos({
        buscar: busquedaDelay || undefined,
        categorias: categoriasActivas,
        pais: paisActivo,
      }),
    staleTime: 1000 * 60,
  });

  const alternarCategoria = useCallback((cat: string) => {
    setCategoriasActivas((prev) =>
      prev.includes(cat) ? prev.filter((item) => item !== cat) : [...prev, cat],
    );
  }, []);

  const nombreCliente = usuario?.nombre?.split(' ')[0] ?? 'tú';

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <NavegacionCliente />

      <main className="max-w-7xl mx-auto px-4 md:px-8 pt-8 pb-24">
        {/* Saludo */}
        <header className="mb-8">
          <h1 className="text-3xl md:text-4xl font-black text-slate-900">
            ¡Hola, <span className="text-pink-600">{nombreCliente}</span>! 👋
          </h1>
          <p className="text-slate-500 font-medium mt-1">
            Encuentra y reserva en tu salón favorito
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <span className="rounded-full bg-white border border-slate-200 px-3 py-1.5 font-bold text-slate-600">
              Mostrando salones de {etiquetaPais(paisActivo)}
            </span>
            <button
              type="button"
              onClick={() => setPaisExplorado(explorandoOtroPais ? null : paisAlternativo)}
              className="text-xs font-bold text-slate-500 hover:text-pink-600 transition-colors"
            >
              {explorandoOtroPais
                ? `Volver a ${etiquetaPais(paisCliente)}`
                : `Ver salones de ${etiquetaPais(paisAlternativo)}`}
            </button>
          </div>
        </header>

        {/* Buscador */}
        <div className="relative mb-4">
          <Search
            className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5"
            aria-hidden="true"
          />
          <input
            id="busqueda-salones"
            name="busquedaSalones"
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Busca tu salón favorito..."
            autoComplete="off"
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-base font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-400 shadow-sm"
            aria-label="Buscar salones"
          />
        </div>

        <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-bold text-slate-600">Filtra por servicios</p>
          {categoriasActivas.length > 0 && (
            <button
              type="button"
              onClick={() => setCategoriasActivas([])}
              className="text-xs font-bold text-slate-400 hover:text-slate-600"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Chips de categorías */}
        <div className="flex gap-2 flex-wrap mb-8" role="group" aria-label="Filtrar por categoría">
          {CATEGORIAS.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => alternarCategoria(cat)}
              aria-pressed={categoriasActivas.includes(cat)}
              className={`px-4 py-2 rounded-full text-sm font-bold transition-all border ${
                categoriasActivas.includes(cat)
                  ? 'bg-pink-600 text-white border-pink-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-pink-300 hover:text-pink-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Estado de carga */}
        {isLoading && (
          <div className="flex justify-center py-16" aria-busy="true" aria-label="Cargando salones">
            <span className="w-10 h-10 border-2 border-pink-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        {/* Sin resultados */}
        {!isLoading && salones.length === 0 && (
          <div className="flex flex-col items-center py-20 text-center">
            <Star className="w-16 h-16 text-slate-200 mb-4" aria-hidden="true" />
            <p className="font-black text-slate-900 text-lg">No encontramos salones</p>
            <p className="text-slate-500 mt-1 text-sm">
              Intenta con otra búsqueda o elimina alguno de los filtros activos
            </p>
          </div>
        )}

        {/* Grid de salones */}
        {!isLoading && salones.length > 0 && (
          <section aria-label="Salones disponibles">
            <p className="text-sm text-slate-400 font-medium mb-4">
              {salones.length} salón{salones.length !== 1 ? 'es' : ''}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {salones.map((salon) => (
                <TarjetaSalon key={salon.id} salon={salon} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
