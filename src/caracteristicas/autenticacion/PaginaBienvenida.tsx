import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calendar, CreditCard, Scissors, Star, TabletSmartphone, User } from 'lucide-react';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';

const BENEFICIOS = [
  {
    titulo: 'Agenda 24/7',
    descripcion: 'Reserva o gestiona turnos en cualquier momento, sin llamadas ni esperas.',
    icono: <Calendar className="h-6 w-6 text-pink-600" aria-hidden="true" />,
  },
  {
    titulo: 'Programa de fidelidad',
    descripcion: 'Convierte cada visita en recompensas y servicios gratis para tus clientes.',
    icono: <Star className="h-6 w-6 text-pink-600" aria-hidden="true" />,
  },
  {
    titulo: 'Operación sin fricción',
    descripcion: 'Todo el flujo queda centralizado para evitar errores y ahorrar tiempo.',
    icono: <CreditCard className="h-6 w-6 text-pink-600" aria-hidden="true" />,
  },
  {
    titulo: 'Multi-dispositivo',
    descripcion: 'Funciona perfecto en celular, tablet y computadora para clientes y salones.',
    icono: <TabletSmartphone className="h-6 w-6 text-pink-600" aria-hidden="true" />,
  },
];

const PASOS_CLIENTE = [
  'Explora salones, servicios y disponibilidad en segundos.',
  'Elige tu especialista, fecha y horario ideal desde cualquier dispositivo.',
  'Confirma tu reserva, recibe recordatorios y acumula puntos de fidelidad.',
];

const PASOS_SALON = [
  'Registra tu salón y configura tu identidad visual, horario y categorías.',
  'Organiza agenda, personal, solicitudes y operaciones desde un solo panel.',
  'Haz seguimiento a clientes, fidelidad y crecimiento del negocio en tiempo real.',
];

export function PaginaBienvenida() {
  usarTituloPagina('Bienvenido — Beauty Time Pro');
  const { rol } = usarTiendaAuth();
  const [tabActiva, setTabActiva] = useState<'clientes' | 'salones'>('clientes');

  void rol;

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(244,114,182,0.18),_transparent_30%),linear-gradient(to_bottom,_#f8fafc,_#ffffff)]">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-linear-to-br from-[#880E4F] to-[#F06292] p-2">
            <Scissors className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <span className="text-lg font-black text-slate-900">Beauty Time Pro</span>
        </div>
        <Link
          to="/iniciar-sesion"
          className="text-sm font-semibold text-pink-700 transition-colors hover:text-pink-900"
        >
          Iniciar sesión
        </Link>
      </header>

      <section className="flex flex-col items-center justify-center px-6 pb-12 pt-16 text-center">
        <div
          className="mb-6 flex h-24 w-24 items-center justify-center rounded-3xl bg-linear-to-br from-[#880E4F] to-[#F06292] shadow-lg shadow-pink-200"
          style={{ animation: 'entradaSuave 0.6s ease-out both' }}
          aria-hidden="true"
        >
          <Scissors className="h-12 w-12 text-white" />
        </div>
        <h1
          className="mb-4 max-w-2xl text-5xl font-black leading-tight text-slate-900"
          style={{ animation: 'entradaSuave 0.6s ease-out 0.1s both' }}
        >
          Beauty Time Pro
        </h1>
        <p
          className="max-w-xl text-xl text-slate-500"
          style={{ animation: 'entradaSuave 0.6s ease-out 0.2s both' }}
        >
          La plataforma líder para salones de belleza en México y Colombia
        </p>
        <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600">
          Beauty Time Pro conecta reservas, operación diaria, fidelidad y crecimiento en una
          experiencia clara para clientes y equipos de salón.
        </p>
      </section>

      <section
        className="mx-auto grid max-w-4xl grid-cols-1 gap-6 px-6 pb-16 md:grid-cols-2"
        aria-label="Elige cómo quieres usar la plataforma"
        style={{ animation: 'entradaSuave 0.6s ease-out 0.3s both' }}
      >
        <div className="group flex flex-col rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <div className="mb-5 mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-50 transition-colors group-hover:bg-pink-100">
            <User className="h-8 w-8 text-pink-600" aria-hidden="true" />
          </div>
          <h2 className="mb-2 text-center text-2xl font-black text-slate-900">
            Quiero reservar citas
          </h2>
          <p className="mb-6 text-slate-500">
            Encuentra el salón ideal, compara opciones y agenda sin fricción.
          </p>
          <Link
            to="/registro/cliente"
            className="mt-auto mb-3 block w-full rounded-2xl bg-linear-to-r from-[#C2185B] to-[#E91E8C] px-6 py-3.5 text-center font-bold text-white transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
          >
            Crear cuenta
          </Link>
          <ul className="mb-4 space-y-2 text-sm text-slate-600">
            <li>✓ Encuentra salones cerca de ti</li>
            <li>✓ Reserva en menos de 2 minutos</li>
            <li>✓ Acumula puntos y gana servicios gratis</li>
          </ul>
          <Link
            to="/iniciar-sesion"
            className="block text-center text-sm text-slate-500 transition-colors hover:text-pink-700"
          >
            ¿Ya tienes cuenta? Inicia sesión
          </Link>
        </div>

        <div className="group flex flex-col rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
          <div className="mb-5 mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-50 transition-colors group-hover:bg-pink-100">
            <Scissors className="h-8 w-8 text-pink-600" aria-hidden="true" />
          </div>
          <h2 className="mb-2 text-center text-2xl font-black text-slate-900">
            Quiero administrar mi salón
          </h2>
          <p className="mb-6 text-slate-500">
            Ordena tu operación diaria y profesionaliza la experiencia de tu salón.
          </p>
          <Link
            to="/registro/salon"
            className="mt-auto mb-3 block w-full rounded-2xl bg-linear-to-r from-[#C2185B] to-[#E91E8C] px-6 py-3.5 text-center font-bold text-white transition-all duration-200 hover:scale-[1.02] hover:shadow-lg"
          >
            Registrar mi salón
          </Link>
          <ul className="mb-4 space-y-2 text-sm text-slate-600">
            <li>✓ Agenda digital sin papel ni llamadas</li>
            <li>✓ Control total de tu equipo y servicios</li>
            <li>✓ Programa de fidelidad incluido sin costo extra</li>
          </ul>
          <Link
            to="/iniciar-sesion"
            className="block text-center text-sm text-slate-500 transition-colors hover:text-pink-700"
          >
            ¿Ya tienes cuenta? Inicia sesión
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-14">
        <div className="mb-8 text-center">
          <p className="text-xs font-black uppercase tracking-[0.3em] text-pink-600">
            Ventajas clave
          </p>
          <h2 className="mt-3 text-3xl font-black text-slate-900">
            Todo lo que la operación necesita en un solo lugar
          </h2>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {BENEFICIOS.map(({ icono, titulo, descripcion }) => (
            <div
              key={titulo}
              className="rounded-3xl border border-slate-100 bg-white p-6 shadow-[0_18px_40px_-24px_rgba(15,23,42,0.35)]"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-pink-100">
                {icono}
              </div>
              <p className="mt-4 font-bold text-slate-900">{titulo}</p>
              <p className="mt-2 text-sm leading-6 text-slate-500">{descripcion}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-[0_24px_60px_-30px_rgba(190,24,93,0.25)] md:p-8">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] text-pink-600">
                ¿Cómo funciona?
              </p>
              <h2 className="mt-3 text-3xl font-black text-slate-900">Elige tu recorrido ideal</h2>
            </div>
            <div className="inline-flex rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setTabActiva('clientes')}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${tabActiva === 'clientes' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                Para clientes
              </button>
              <button
                type="button"
                onClick={() => setTabActiva('salones')}
                className={`rounded-xl px-4 py-2 text-sm font-bold transition-colors ${tabActiva === 'salones' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}
              >
                Para salones
              </button>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
            {(tabActiva === 'clientes' ? PASOS_CLIENTE : PASOS_SALON).map((paso, indice) => (
              <div key={paso} className="rounded-3xl bg-slate-50 p-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-900 text-lg font-black text-white">
                  0{indice + 1}
                </div>
                <p className="mt-4 text-base font-semibold text-slate-900">{paso}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <footer className="pb-8 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} Beauty Time Pro · Hecho para México y Colombia
      </footer>

      <style>{`
        @keyframes entradaSuave {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
