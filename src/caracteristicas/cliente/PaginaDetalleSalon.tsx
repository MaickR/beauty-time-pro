import { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  MapPin,
  Phone,
  Mail,
  Clock,
  Calendar,
  ChevronRight,
  Users,
  Tag,
  Package2,
} from 'lucide-react';
import { obtenerSalonPublicoPorIdentificador } from '../../servicios/servicioClienteApp';
import { NavegacionCliente } from '../../componentes/diseno/NavegacionCliente';
import { Spinner } from '../../componentes/ui/Spinner';
import { formatearDinero } from '../../utils/formato';
import {
  construirRutaReservaSalonCliente,
  construirRutaSalonCliente,
} from './utils/rutasSalonCliente';
import type { SalonDetalle } from '../../tipos';

function iniciales(nombre: string): string {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

function formatearDias(dias: string): string {
  const mapa: Record<string, string> = {
    lunes: 'Lun',
    martes: 'Mar',
    miercoles: 'Mié',
    jueves: 'Jue',
    viernes: 'Vie',
    sabado: 'Sáb',
    domingo: 'Dom',
  };
  return dias
    .split(',')
    .map((d) => mapa[d.trim().toLowerCase()] ?? d.trim())
    .join(' · ');
}

function agruparPorCategoria(
  servicios: SalonDetalle['servicios'],
): Record<string, SalonDetalle['servicios']> {
  const grupos: Record<string, SalonDetalle['servicios']> = {};
  for (const s of servicios) {
    const cat = s.category ?? 'General';
    if (!grupos[cat]) grupos[cat] = [];
    grupos[cat]!.push(s);
  }
  return grupos;
}

function agruparProductosPorCategoria(
  productos: SalonDetalle['productos'],
): Record<string, SalonDetalle['productos']> {
  const grupos: Record<string, SalonDetalle['productos']> = {};
  for (const producto of productos) {
    const categoria = producto.categoria?.trim() || 'General';
    if (!grupos[categoria]) grupos[categoria] = [];
    grupos[categoria]!.push(producto);
  }
  return grupos;
}

export function PaginaDetalleSalon() {
  const { identificador } = useParams<{ identificador: string }>();
  const navegar = useNavigate();

  const {
    data: salon,
    isLoading,
    isError,
  } = useQuery<SalonDetalle>({
    queryKey: ['salon-publico', identificador],
    queryFn: () => obtenerSalonPublicoPorIdentificador(identificador!),
    enabled: !!identificador,
    staleTime: 1000 * 60 * 5,
  });

  useEffect(() => {
    if (salon?.nombre) document.title = `${salon.nombre} — Beauty Time Pro`;
    return () => {
      document.title = 'Beauty Time Pro';
    };
  }, [salon?.nombre]);

  useEffect(() => {
    if (!salon?.slug || !identificador || salon.slug === identificador) {
      return;
    }

    navegar(construirRutaSalonCliente(salon), { replace: true });
  }, [identificador, navegar, salon]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans flex items-center justify-center">
        <Spinner tamaño="lg" />
      </div>
    );
  }

  if (isError || !salon) {
    return (
      <div className="min-h-screen bg-slate-50 font-sans flex flex-col items-center justify-center gap-4">
        <p className="font-black text-slate-900 text-xl">Salón no encontrado</p>
        <button
          onClick={() => navegar('/cliente/inicio')}
          className="text-pink-600 font-bold underline"
        >
          Volver al inicio
        </button>
      </div>
    );
  }

  const color = salon.colorPrimario ?? '#C2185B';
  const categorias = salon.categorias
    ? salon.categorias
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
    : [];
  const dias = salon.diasAtencion ? formatearDias(salon.diasAtencion) : null;
  const serviciosPorCategoria = agruparPorCategoria(salon.servicios);
  const productosPorCategoria = agruparProductosPorCategoria(salon.productos);
  const moneda = salon.pais === 'Colombia' ? 'COP' : 'MXN';

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-32">
      <NavegacionCliente />

      {/* Hero del salón */}
      <div
        className="h-48 md:h-64 flex items-center justify-center"
        style={{ backgroundColor: color + '20' }}
      >
        {salon.logoUrl ? (
          <img
            src={salon.logoUrl}
            alt={`Logo de ${salon.nombre}`}
            className="h-32 w-32 rounded-3xl object-cover shadow-xl"
          />
        ) : (
          <span
            className="text-5xl font-black rounded-3xl w-32 h-32 flex items-center justify-center text-white shadow-xl"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          >
            {iniciales(salon.nombre)}
          </span>
        )}
      </div>

      <main className="max-w-4xl mx-auto px-4 md:px-8 -mt-6">
        {/* Nombre y descripción */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-100 mb-6">
          <h1 className="text-3xl font-black text-slate-900">{salon.nombre}</h1>
          {categorias.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-3">
              {categorias.map((cat) => (
                <span
                  key={cat}
                  className="text-xs font-bold px-3 py-1 rounded-full border"
                  style={{ borderColor: color, color }}
                >
                  {cat}
                </span>
              ))}
            </div>
          )}
          {salon.descripcion && (
            <p className="text-slate-600 mt-4 leading-relaxed">{salon.descripcion}</p>
          )}

          {/* Info de contacto */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-5 pt-5 border-t border-slate-100">
            {salon.direccion && (
              <div className="flex items-start gap-2 text-sm text-slate-600">
                <MapPin className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" aria-hidden="true" />
                <span>{salon.direccion}</span>
              </div>
            )}
            {salon.telefono && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Phone className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                <a href={`tel:${salon.telefono}`} className="hover:text-pink-600">
                  {salon.telefono}
                </a>
              </div>
            )}
            {salon.emailContacto && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Mail className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                <a href={`mailto:${salon.emailContacto}`} className="hover:text-pink-600 truncate">
                  {salon.emailContacto}
                </a>
              </div>
            )}
            {salon.horarioApertura && salon.horarioCierre && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Clock className="w-4 h-4 text-slate-400 shrink-0" aria-hidden="true" />
                <span>
                  {salon.horarioApertura} – {salon.horarioCierre}
                </span>
              </div>
            )}
          </div>

          {/* Días de atención */}
          {dias && (
            <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
              <Calendar className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span>{dias}</span>
            </div>
          )}
        </div>

        {/* Especialistas */}
        {salon.personal.length > 0 && (
          <section aria-labelledby="titulo-especialistas" className="mb-6">
            <h2
              id="titulo-especialistas"
              className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2"
            >
              <Users className="w-5 h-5" aria-hidden="true" /> Nuestros especialistas
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {salon.personal.map((p) => {
                const especialidades = Array.isArray(p.especialidades)
                  ? (p.especialidades as string[])
                  : [];
                return (
                  <div
                    key={p.id}
                    className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm"
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm mb-2"
                      style={{ backgroundColor: color }}
                      aria-hidden="true"
                    >
                      {iniciales(p.nombre)}
                    </div>
                    <p className="font-bold text-slate-900 text-sm">{p.nombre}</p>
                    {especialidades.length > 0 && (
                      <p className="text-xs text-slate-400 mt-1">{especialidades.join(', ')}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Servicios */}
        {salon.servicios.length > 0 && (
          <section aria-labelledby="titulo-servicios" className="mb-6">
            <h2
              id="titulo-servicios"
              className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2"
            >
              <Tag className="w-5 h-5" aria-hidden="true" /> Servicios
            </h2>
            <div className="space-y-5">
              {Object.entries(serviciosPorCategoria).map(([categoria, servicios]) => (
                <div
                  key={categoria}
                  className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm"
                >
                  <div
                    className="px-5 py-3 border-b border-slate-50"
                    style={{ backgroundColor: color + '10' }}
                  >
                    <h3 className="font-bold text-sm" style={{ color }}>
                      {categoria}
                    </h3>
                  </div>
                  <ul>
                    {servicios.map((s, indiceServicio) => (
                      <li
                        key={`${s.name}-${indiceServicio}`}
                        className="flex items-center justify-between px-5 py-3 border-b border-slate-50 last:border-0"
                      >
                        <span className="font-medium text-slate-800 text-sm">{s.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold px-2 py-1 bg-blue-50 text-blue-700 rounded-lg">
                            {s.duration} min
                          </span>
                          {s.price > 0 && (
                            <span className="text-xs font-bold px-2 py-1 bg-green-50 text-green-700 rounded-lg">
                              {formatearDinero(s.price, moneda)}
                            </span>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {salon.plan === 'PRO' && salon.productos.length > 0 && (
          <section aria-labelledby="titulo-productos" className="mb-6">
            <h2
              id="titulo-productos"
              className="text-xl font-black text-slate-900 mb-4 flex items-center gap-2"
            >
              <Package2 className="w-5 h-5" aria-hidden="true" /> Productos PRO
            </h2>
            <div className="space-y-5">
              {Object.entries(productosPorCategoria).map(([categoria, productos]) => (
                <div
                  key={categoria}
                  className="bg-white rounded-2xl border border-slate-100 overflow-hidden shadow-sm"
                >
                  <div
                    className="px-5 py-3 border-b border-slate-50"
                    style={{ backgroundColor: color + '10' }}
                  >
                    <h3 className="font-bold text-sm" style={{ color }}>
                      {categoria}
                    </h3>
                  </div>
                  <ul>
                    {productos.map((producto) => (
                      <li
                        key={producto.id}
                        className="flex items-center justify-between px-5 py-3 border-b border-slate-50 last:border-0"
                      >
                        <span className="font-medium text-slate-800 text-sm">
                          {producto.nombre}
                        </span>
                        <span className="text-xs font-bold px-2 py-1 bg-green-50 text-green-700 rounded-lg">
                          {formatearDinero(producto.precio, moneda)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      {/* Botón flotante */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white/80 backdrop-blur-md border-t border-slate-100 flex justify-center z-40">
        <button
          onClick={() => navegar(construirRutaReservaSalonCliente(salon))}
          className="w-full max-w-md py-4 rounded-2xl font-black text-white flex items-center justify-center gap-2 shadow-xl hover:brightness-110 transition-all text-base"
          style={{ backgroundColor: color }}
        >
          Reservar cita <ChevronRight className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
