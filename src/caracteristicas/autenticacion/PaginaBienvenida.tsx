import { Link } from 'react-router-dom';
import { ArrowRight, KeyRound, Scissors, ShieldCheck, Sparkles } from 'lucide-react';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';

export function PaginaBienvenida() {
  usarTituloPagina('Bienvenido — Beauty Time Pro');

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(194,24,91,0.16),_transparent_28%),radial-gradient(circle_at_bottom_right,_rgba(15,23,42,0.08),_transparent_32%),linear-gradient(180deg,_#fff8fb_0%,_#ffffff_45%,_#f8fafc_100%)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <div className="rounded-xl bg-linear-to-br from-[#880E4F] to-[#F06292] p-2">
            <Scissors className="h-5 w-5 text-white" aria-hidden="true" />
          </div>
          <span className="text-lg font-black text-slate-900">Beauty Time Pro</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            to="/registro/salon"
            className="hidden rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:text-slate-900 md:inline-flex"
          >
            Registrar salón
          </Link>
          <Link
            to="/iniciar-sesion"
            className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-slate-800"
          >
            Acceder
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-8 px-6 pb-20 pt-12 lg:grid-cols-[1.2fr_0.8fr] lg:items-center lg:pt-18">
        <section>
          <div className="inline-flex items-center gap-2 rounded-full border border-pink-200 bg-white/80 px-4 py-2 text-xs font-black uppercase tracking-[0.24em] text-pink-700 backdrop-blur">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            Operación simple para salones reales
          </div>
          <h1 className="mt-6 max-w-3xl text-5xl font-black leading-[0.95] tracking-tight text-slate-900 md:text-6xl">
            Menos pantallas.
            <br />
            Más reservas.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Beauty Time Pro ahora concentra el acceso en dos rutas claras: administración por correo
            y contraseña, o reservas por clave única del salón.
          </p>

          <div className="mt-8 flex flex-col gap-4 sm:flex-row">
            <Link
              to="/iniciar-sesion"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 text-sm font-black uppercase tracking-[0.18em] text-white transition-transform hover:translate-y-[-1px] hover:bg-slate-800"
            >
              Acceder con clave o correo
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              to="/registro/salon"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.18em] text-slate-800 transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              Registrar mi salón
            </Link>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
            <article className="rounded-3xl border border-white/60 bg-white/90 p-5 shadow-[0_24px_50px_-34px_rgba(15,23,42,0.35)] backdrop-blur">
              <KeyRound className="h-5 w-5 text-pink-700" aria-hidden="true" />
              <p className="mt-4 text-sm font-black uppercase tracking-[0.16em] text-slate-900">
                Reserva directa
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                El cliente entra con la clave del salón y aterriza directo en la reserva.
              </p>
            </article>
            <article className="rounded-3xl border border-white/60 bg-white/90 p-5 shadow-[0_24px_50px_-34px_rgba(15,23,42,0.35)] backdrop-blur">
              <ShieldCheck className="h-5 w-5 text-pink-700" aria-hidden="true" />
              <p className="mt-4 text-sm font-black uppercase tracking-[0.16em] text-slate-900">
                Panel protegido
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Dueños, maestros y equipo siguen entrando por correo y contraseña.
              </p>
            </article>
            <article className="rounded-3xl border border-white/60 bg-white/90 p-5 shadow-[0_24px_50px_-34px_rgba(15,23,42,0.35)] backdrop-blur">
              <Scissors className="h-5 w-5 text-pink-700" aria-hidden="true" />
              <p className="mt-4 text-sm font-black uppercase tracking-[0.16em] text-slate-900">
                Marca del salón
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Cada experiencia de reserva se abre ya dentro de la identidad visual del estudio.
              </p>
            </article>
          </div>
        </section>

        <aside className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-900 p-7 text-white shadow-[0_30px_70px_-35px_rgba(15,23,42,0.55)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(244,114,182,0.28),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(255,255,255,0.08),_transparent_30%)]" />
          <div className="relative">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-pink-300">
              Nuevo flujo
            </p>
            <h2 className="mt-3 text-3xl font-black leading-tight">
              Una entrada para operar.
              <br />
              Otra para reservar.
            </h2>
            <div className="mt-8 space-y-4 text-sm leading-6 text-slate-200">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-black uppercase tracking-[0.16em] text-pink-200">
                  Administración
                </p>
                <p className="mt-2">Correo + contraseña para dueño, maestro y personal.</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
                <p className="font-black uppercase tracking-[0.16em] text-pink-200">
                  Reserva cliente
                </p>
                <p className="mt-2">
                  Clave del salón para entrar directo a disponibilidad y agenda.
                </p>
              </div>
            </div>
          </div>
        </aside>
      </main>

      <footer className="pb-8 text-center text-sm text-slate-400">
        © {new Date().getFullYear()} Beauty Time Pro · Hecho para México y Colombia
      </footer>
    </div>
  );
}
