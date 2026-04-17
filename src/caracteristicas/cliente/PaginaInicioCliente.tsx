import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Clock, ChevronRight, Star, Sparkles, History } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { obtenerMiPerfil } from '../../servicios/servicioClienteApp';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';
import { NavegacionCliente } from '../../componentes/diseno/NavegacionCliente';
import type { Pais, ReservaCliente } from '../../tipos';

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

interface SalonClientePrivado {
  id: string;
  nombre: string;
  colorPrimario: string | null;
  logoUrl: string | null;
  direccion: string | null;
  pais: Pais;
  slug: string | null;
  categorias: string[];
  sedes: string[];
  totalVisitas: number;
  ultimaVisita: string;
}

function normalizarCategoria(valor?: string | null): string | null {
  const categoria = valor?.trim();
  return categoria ? categoria : null;
}

function formatearFechaCorta(fecha: string): string {
  const fechaBase = new Date(`${fecha}T12:00:00`);
  return new Intl.DateTimeFormat('es-MX', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(fechaBase);
}

function construirSalonesPrivados(
  reservas: ReservaCliente[],
  paisCliente: Pais,
): SalonClientePrivado[] {
  const reservasAtendidas = reservas.filter(
    (reserva) =>
      reserva.estado === 'completed' && (reserva.salon.pais ?? paisCliente) === paisCliente,
  );

  const acumulado = new Map<string, SalonClientePrivado>();

  reservasAtendidas.forEach((reserva) => {
    const existente = acumulado.get(reserva.salon.id);
    const categoriasReserva = [
      ...reserva.servicios.map((servicio) => normalizarCategoria(servicio.category)),
      ...(reserva.serviciosDetalle ?? []).map((servicio) => normalizarCategoria(servicio.category)),
    ].filter((categoria): categoria is string => Boolean(categoria));

    if (!existente) {
      acumulado.set(reserva.salon.id, {
        id: reserva.salon.id,
        nombre: reserva.salon.nombre,
        colorPrimario: reserva.salon.colorPrimario,
        logoUrl: reserva.salon.logoUrl,
        direccion: reserva.salon.direccion ?? null,
        pais: reserva.salon.pais ?? paisCliente,
        slug: reserva.salon.slug ?? null,
        categorias: Array.from(new Set(categoriasReserva)).sort((a, b) => a.localeCompare(b, 'es')),
        sedes: reserva.sucursal ? [reserva.sucursal] : [],
        totalVisitas: 1,
        ultimaVisita: reserva.fecha,
      });
      return;
    }

    existente.totalVisitas += 1;
    existente.ultimaVisita =
      existente.ultimaVisita > reserva.fecha ? existente.ultimaVisita : reserva.fecha;
    existente.categorias = Array.from(
      new Set([...existente.categorias, ...categoriasReserva]),
    ).sort((a, b) => a.localeCompare(b, 'es'));
    if (reserva.sucursal && !existente.sedes.includes(reserva.sucursal)) {
      existente.sedes.push(reserva.sucursal);
      existente.sedes.sort((a, b) => a.localeCompare(b, 'es'));
    }
  });

  return Array.from(acumulado.values()).sort(
    (a, b) =>
      b.ultimaVisita.localeCompare(a.ultimaVisita) || a.nombre.localeCompare(b.nombre, 'es'),
  );
}

interface PropsTarjetaSalon {
  salon: SalonClientePrivado;
}

function TarjetaSalon({ salon }: PropsTarjetaSalon) {
  const navegar = useNavigate();
  const color = salon.colorPrimario ?? '#C2185B';
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
          <p className="mt-1 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
            {salon.totalVisitas} visita{salon.totalVisitas === 1 ? '' : 's'} completada
            {salon.totalVisitas === 1 ? '' : 's'}
          </p>
        </div>

        {salon.categorias.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {salon.categorias.slice(0, 3).map((categoria) => (
              <span
                key={categoria}
                className="text-[10px] font-bold px-2 py-0.5 rounded-full border"
                style={{ borderColor: color, color }}
              >
                {categoria}
              </span>
            ))}
          </div>
        )}

        <div className="space-y-1">
          {salon.direccion && (
            <p className="flex items-center gap-1.5 text-xs text-slate-400 truncate">
              <MapPin className="w-3 h-3 shrink-0" aria-hidden="true" />
              {salon.direccion}
            </p>
          )}
          <p className="flex items-center gap-1.5 text-xs text-slate-400">
            <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />
            Última visita: {formatearFechaCorta(salon.ultimaVisita)}
          </p>
          {salon.sedes.length > 0 && (
            <p className="text-xs text-slate-500">
              <span className="font-bold text-slate-600">Sedes:</span> {salon.sedes.join(', ')}
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
  const { usuario, iniciando } = usarTiendaAuth();
  const [busqueda, setBusqueda] = useState('');
  const [categoriasActivas, setCategoriasActivas] = useState<string[]>([]);
  const [busquedaDelay, setBusquedaDelay] = useState('');

  const { data: perfilCliente } = useQuery({
    queryKey: ['mi-perfil'],
    queryFn: obtenerMiPerfil,
    enabled: !iniciando && usuario?.rol === 'cliente',
    staleTime: 1000 * 60,
  });

  const paisCliente = perfilCliente?.pais ?? 'Mexico';
  const salonesPrivados = useMemo(
    () => construirSalonesPrivados(perfilCliente?.reservas ?? [], paisCliente),
    [perfilCliente?.reservas, paisCliente],
  );
  const categoriasDisponibles = useMemo(
    () =>
      Array.from(new Set(salonesPrivados.flatMap((salon) => salon.categorias))).sort((a, b) =>
        a.localeCompare(b, 'es'),
      ),
    [salonesPrivados],
  );
  const salonesFiltrados = useMemo(() => {
    const termino = busquedaDelay.trim().toLowerCase();

    return salonesPrivados.filter((salon) => {
      const coincideBusqueda =
        termino.length === 0 ||
        salon.nombre.toLowerCase().includes(termino) ||
        salon.sedes.some((sede) => sede.toLowerCase().includes(termino)) ||
        salon.categorias.some((categoria) => categoria.toLowerCase().includes(termino));
      const coincideCategoria =
        categoriasActivas.length === 0 ||
        categoriasActivas.every((categoria) => salon.categorias.includes(categoria));

      return coincideBusqueda && coincideCategoria;
    });
  }, [busquedaDelay, categoriasActivas, salonesPrivados]);

  useEffect(() => {
    const t = window.setTimeout(() => setBusquedaDelay(busqueda), 300);
    return () => clearTimeout(t);
  }, [busqueda]);

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
        <header className="mb-8 overflow-hidden rounded-4xl border border-slate-200 bg-white shadow-sm">
          <div className="grid gap-6 px-6 py-7 md:grid-cols-[1.3fr_0.9fr] md:px-8 md:py-8">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-pink-200 bg-pink-50 px-3 py-1 text-[11px] font-black uppercase tracking-[0.22em] text-pink-700">
                <Sparkles className="h-3.5 w-3.5" /> Panel del cliente
              </div>
              <h1 className="text-3xl font-black text-slate-900 md:text-4xl">
                Bienvenida de vuelta, <span className="text-pink-600">{nombreCliente}</span>
              </h1>
              <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-slate-500 md:text-base">
                Aquí solo ves los salones donde ya te atendieron, con las sedes y categorías que
                realmente forman parte de tu historial.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-1">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  País activo
                </p>
                <p className="mt-2 text-lg font-black text-slate-900">
                  {etiquetaPais(paisCliente)}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Los salones visibles quedan restringidos a tu país.
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Historial real
                </p>
                <p className="mt-2 text-lg font-black text-slate-900">
                  {salonesPrivados.length} salones
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Basado solo en citas completadas de tu cuenta.
                </p>
              </div>
            </div>
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
            placeholder="Buscar por salón, sede o categoría consumida"
            autoComplete="off"
            className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl text-base font-medium placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-pink-400 shadow-sm"
            aria-label="Buscar salones"
          />
        </div>

        <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
          <p className="text-sm font-bold text-slate-600">Filtra por categorías consumidas</p>
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

        <div className="flex gap-2 flex-wrap mb-8" role="group" aria-label="Filtrar por categoría">
          {categoriasDisponibles.map((cat) => (
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

        {perfilCliente && salonesPrivados.length === 0 && (
          <div className="flex flex-col items-center py-20 text-center">
            <History className="w-16 h-16 text-slate-200 mb-4" aria-hidden="true" />
            <p className="font-black text-slate-900 text-lg">Aún no tienes historial atendido</p>
            <p className="text-slate-500 mt-1 text-sm max-w-md">
              Cuando completes tu primera cita, aquí aparecerán el salón, las sedes y las categorías
              que ya forman parte de tu historial.
            </p>
          </div>
        )}

        {perfilCliente && salonesPrivados.length > 0 && salonesFiltrados.length === 0 && (
          <div className="flex flex-col items-center py-20 text-center">
            <Star className="w-16 h-16 text-slate-200 mb-4" aria-hidden="true" />
            <p className="font-black text-slate-900 text-lg">No encontramos coincidencias</p>
            <p className="text-slate-500 mt-1 text-sm">
              Ajusta la búsqueda o limpia los filtros activos para ver más resultados.
            </p>
          </div>
        )}

        {salonesFiltrados.length > 0 && (
          <section aria-label="Salones disponibles">
            <p className="text-sm text-slate-400 font-medium mb-4">
              {salonesFiltrados.length} salón{salonesFiltrados.length !== 1 ? 'es' : ''}
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {salonesFiltrados.map((salon) => (
                <TarjetaSalon key={salon.id} salon={salon} />
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
