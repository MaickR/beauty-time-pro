import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2 } from 'lucide-react';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';
import { obtenerPreciosPublicos } from '../../servicios/servicioPreciosPlanes';
import { formatearDinero } from '../../utils/formato';
import { MarcaAplicacion } from '../../componentes/ui/MarcaAplicacion';

function obtenerPrecioPlan(
  precios: Awaited<ReturnType<typeof obtenerPreciosPublicos>> | undefined,
  plan: 'STANDARD' | 'PRO',
) {
  const precioMexico = precios?.find((precio) => precio.plan === plan && precio.pais === 'Mexico');
  const precioColombia = precios?.find(
    (precio) => precio.plan === plan && precio.pais === 'Colombia',
  );

  if (!precioMexico || !precioColombia) {
    return 'Cargando precios...';
  }

  return `${formatearDinero(precioMexico.monto, 'MXN')} / ${formatearDinero(precioColombia.monto, 'COP')}`;
}

export function PaginaBienvenida() {
  usarTituloPagina('Bienvenido — Beauty Time Pro');
  const navegar = useNavigate();
  const { data: preciosPublicos } = useQuery({
    queryKey: ['precios-publicos'],
    queryFn: obtenerPreciosPublicos,
    staleTime: 60_000,
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(194,24,91,0.14),transparent_32%),radial-gradient(circle_at_bottom_right,rgba(240,98,146,0.14),transparent_34%),linear-gradient(180deg,#fff8fb_0%,#ffffff_42%,#fafafa_100%)]">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <MarcaAplicacion />
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-20 pt-8">
        <section className="rounded-4xl border border-(--color-borde) bg-white/95 p-8 shadow-[0_28px_60px_-40px_rgba(194,24,91,0.45)]">
          <p className="inline-flex rounded-full border border-pink-200 bg-pink-50 px-4 py-2 text-xs font-black uppercase tracking-tight text-pink-700">
            Plataforma para salones en México y Colombia
          </p>
          <h1 className="mt-6 max-w-3xl text-4xl font-black leading-tight text-(--color-texto) md:text-6xl">
            Tu salón, siempre organizado
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-8 text-(--color-texto-suave)">
            Beauty Time Pro es la plataforma que usan los mejores salones de México y Colombia para
            gestionar su agenda, fidelizar clientes y hacer crecer su negocio. Simple para el
            cliente. Poderosa para el salón.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => navegar('/iniciar-sesion')}
              className="rounded-2xl bg-(--color-primario) px-6 py-3 text-sm font-black uppercase tracking-tight text-white transition-colors hover:bg-(--color-primario-oscuro)"
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              onClick={() => navegar('/iniciar-sesion')}
              className="rounded-2xl border border-(--color-borde) bg-white px-6 py-3 text-sm font-black text-(--color-texto) transition-colors hover:bg-(--color-primario-suave)"
            >
              Administración
            </button>
            <button
              type="button"
              onClick={() => navegar('/iniciar-sesion')}
              className="rounded-2xl border border-(--color-borde) bg-white px-6 py-3 text-sm font-black text-(--color-texto) transition-colors hover:bg-(--color-primario-suave)"
            >
              Reserva cliente
            </button>
          </div>
        </section>

        <section className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
          <article className="rounded-3xl border border-(--color-borde) bg-white p-6">
            <h2 className="text-lg font-black text-(--color-texto)">Reservas en 2 minutos</h2>
            <p className="mt-3 text-sm leading-6 text-(--color-texto-suave)">
              Tus clientes reservan escaneando un QR. Sin apps, sin registros, sin complicaciones.
            </p>
          </article>
          <article className="rounded-3xl border border-(--color-borde) bg-white p-6">
            <h2 className="text-lg font-black text-(--color-texto)">Agenda siempre al día</h2>
            <p className="mt-3 text-sm leading-6 text-(--color-texto-suave)">
              Ve todas las citas del día, por especialista, en tiempo real. Crea citas manuales en
              segundos.
            </p>
          </article>
          <article className="rounded-3xl border border-(--color-borde) bg-white p-6">
            <h2 className="text-lg font-black text-(--color-texto)">Clientes que regresan</h2>
            <p className="mt-3 text-sm leading-6 text-(--color-texto-suave)">
              El programa de fidelidad premia a tus clientes frecuentes automáticamente. Tú
              configuras las reglas.
            </p>
          </article>
        </section>

        <section className="mt-8 rounded-4xl border border-(--color-borde) bg-white p-8">
          <h2 className="text-2xl font-black text-(--color-texto)">Planes</h2>
          <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
            <article className="rounded-2xl border border-(--color-borde) bg-(--color-superficie) p-5">
              <p className="text-xs font-black uppercase tracking-tight text-pink-700">Estándar</p>
              <p className="mt-2 text-lg font-black text-(--color-texto)">
                {obtenerPrecioPlan(preciosPublicos, 'STANDARD')}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-(--color-texto-suave)">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-pink-600" />
                  Agenda
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-pink-600" />
                  Citas
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-pink-600" />
                  QR de reservas
                </li>
              </ul>
            </article>
            <article className="rounded-2xl border border-(--color-borde) bg-(--color-superficie) p-5">
              <p className="text-xs font-black uppercase tracking-tight text-pink-700">Pro</p>
              <p className="mt-2 text-lg font-black text-(--color-texto)">
                {obtenerPrecioPlan(preciosPublicos, 'PRO')}
              </p>
              <ul className="mt-4 space-y-2 text-sm text-(--color-texto-suave)">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-pink-600" />
                  Todo lo anterior
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-pink-600" />
                  Fidelidad
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-pink-600" />
                  Recordatorios
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-pink-600" />
                  Exportación de datos
                </li>
              </ul>
            </article>
          </div>
        </section>
      </main>

      <footer className="pb-8 text-center text-sm text-(--color-texto-suave)">
        Beauty Time Pro © 2026
      </footer>
    </div>
  );
}
