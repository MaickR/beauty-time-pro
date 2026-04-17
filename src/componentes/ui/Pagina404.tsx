import { Home, LifeBuoy, LogIn, Mail, MessageCircle, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

const EMAIL_SOPORTE = 'soporte@beautytimepro.com';
const WHATSAPP_SOPORTE = '525512345678';

export function Pagina404() {
  const enlaceWhatsApp = `https://wa.me/${WHATSAPP_SOPORTE}?text=${encodeURIComponent('Hola, necesito ayuda para encontrar una página dentro de Beauty Time Pro.')}`;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#fce7f3_0%,#fff7ed_38%,#f8fafc_100%)] p-6 md:p-10">
      <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-4xl items-center justify-center">
        <div className="grid w-full gap-6 rounded-[2.75rem] border border-white/70 bg-white/90 p-6 shadow-[0_30px_100px_rgba(15,23,42,0.12)] backdrop-blur md:grid-cols-[1.1fr_0.9fr] md:p-10">
          <div className="flex flex-col justify-center">
            <div className="mb-6 flex justify-center md:justify-start">
              <div className="rounded-full bg-pink-50 p-4">
                <Search className="h-10 w-10 text-pink-500" aria-hidden="true" />
              </div>
            </div>
            <p className="mb-2 text-7xl font-black text-slate-200">404</p>
            <h1 className="mb-4 text-2xl font-black italic uppercase tracking-tighter text-slate-900 md:text-4xl">
              Esta ruta ya no está disponible
            </h1>
            <p className="max-w-xl text-sm font-medium leading-7 text-slate-600 md:text-base">
              La dirección puede estar incompleta, haber cambiado o requerir que vuelvas a iniciar
              sesión. Usa una de las acciones rápidas para regresar al flujo correcto sin perder
              tiempo.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-6 py-4 text-sm font-black text-white transition-colors hover:bg-black"
              >
                <Home className="h-4 w-4" aria-hidden="true" /> Ir al inicio
              </Link>
              <Link
                to="/iniciar-sesion"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 px-6 py-4 text-sm font-black text-slate-700 transition-colors hover:bg-slate-100"
              >
                <LogIn className="h-4 w-4" aria-hidden="true" /> Ir al acceso
              </Link>
            </div>
          </div>

          <aside className="rounded-[2.25rem] border border-slate-200 bg-slate-50 p-6 text-left">
            <div className="mb-5 inline-flex rounded-2xl bg-white p-3 text-slate-900 shadow-sm">
              <LifeBuoy className="h-5 w-5" aria-hidden="true" />
            </div>
            <h2 className="text-lg font-black text-slate-900">¿Necesitas ayuda?</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Si llegaste aquí desde un enlace interno o desde un marcador antiguo, soporte puede
              ayudarte a ubicar la pantalla correcta.
            </p>

            <div className="mt-6 space-y-3">
              <a
                href={enlaceWhatsApp}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-sm font-bold text-emerald-800 transition-colors hover:bg-emerald-100"
              >
                <span className="inline-flex items-center gap-2">
                  <MessageCircle className="h-4 w-4" aria-hidden="true" /> WhatsApp soporte
                </span>
                <span>+52 55 1234 5678</span>
              </a>
              <a
                href={`mailto:${EMAIL_SOPORTE}`}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-bold text-slate-700 transition-colors hover:bg-slate-100"
              >
                <span className="inline-flex items-center gap-2">
                  <Mail className="h-4 w-4" aria-hidden="true" /> Email soporte
                </span>
                <span>{EMAIL_SOPORTE}</span>
              </a>
            </div>

            <p className="mt-6 text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
              Tip rápido
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Si estabas entrando a un panel interno, vuelve a iniciar sesión para que el sistema te
              redirija automáticamente al rol correcto.
            </p>
          </aside>
        </div>
      </section>
    </main>
  );
}
