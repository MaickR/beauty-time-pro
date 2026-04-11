import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart3, FileText, FlaskConical, Landmark, Store, TrendingUp } from 'lucide-react';
import {
  obtenerResumenVendedor,
  obtenerSalonDemoVendedor,
  obtenerVentasVendedor,
} from '../../servicios/servicioVendedor';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';
import { TabPreregistros } from './componentes/TabPreregistros';
import { TabDemoVendedor } from './componentes/TabDemoVendedor';
import { TabVentasVendedor } from './componentes/TabVentasVendedor';
import { formatearDinero } from '../../utils/formato';

type TabVendedor = 'dashboard' | 'demo' | 'preregistro' | 'venta';

const TABS: { valor: TabVendedor; etiqueta: string; icono: typeof BarChart3 }[] = [
  { valor: 'dashboard', etiqueta: 'Resumen', icono: BarChart3 },
  { valor: 'demo', etiqueta: 'Demo', icono: FlaskConical },
  { valor: 'preregistro', etiqueta: 'Pre-registros', icono: FileText },
  { valor: 'venta', etiqueta: 'Ventas', icono: Landmark },
];

export function PaginaVendedor() {
  usarTituloPagina('Panel de Vendedor — Beauty Time Pro');
  const usuario = usarTiendaAuth((estado) => estado.usuario);
  const [tabActivo, setTabActivo] = useState<TabVendedor>('dashboard');

  const { data: resumen, isLoading } = useQuery({
    queryKey: ['vendedor', 'resumen'],
    queryFn: obtenerResumenVendedor,
    staleTime: 1000 * 60 * 2,
  });

  const { data: salonDemo } = useQuery({
    queryKey: ['vendedor', 'demo'],
    queryFn: obtenerSalonDemoVendedor,
    staleTime: 1000 * 60,
  });

  const { data: ventas } = useQuery({
    queryKey: ['vendedor', 'ventas', 'dashboard'],
    queryFn: () => obtenerVentasVendedor(),
    staleTime: 1000 * 60,
  });

  const ventasUltimosTreintaDias = useMemo(() => {
    if (!ventas) return [];
    const haceTreintaDias = new Date();
    haceTreintaDias.setDate(haceTreintaDias.getDate() - 30);
    const limite = haceTreintaDias.toISOString().slice(0, 10);
    return ventas.filter((venta) => venta.fecha >= limite);
  }, [ventas]);

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,rgba(244,114,182,0.14),transparent_28%),linear-gradient(180deg,#fff7ed_0%,#f8fafc_38%,#eef2ff_100%)]">
      <header className="sticky top-0 z-30 border-b border-white/70 bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 md:px-8">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500">
              Panel comercial
            </p>
            <h1 className="mt-1 text-xl font-black text-slate-900 md:text-3xl">
              {usuario?.nombre ? `Bienvenido de nuevo, ${usuario.nombre}` : 'Panel de vendedor'}
            </h1>
          </div>
          <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white shadow-sm">
            Beauty Time Pro
          </span>
        </div>
      </header>

      <nav className="border-b border-slate-200/70 bg-white/70">
        <div className="mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-2 md:px-8">
          {TABS.map(({ valor, etiqueta, icono: Icono }) => (
            <button
              key={valor}
              onClick={() => setTabActivo(valor)}
              className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition-all ${
                tabActivo === valor
                  ? 'bg-slate-900 text-white shadow-lg shadow-slate-900/15'
                  : 'text-slate-600 hover:bg-white hover:text-slate-900'
              }`}
            >
              <Icono className="w-4 h-4" aria-hidden="true" />
              {etiqueta}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 py-8 md:px-8">
        {tabActivo === 'dashboard' && (
          <SeccionDashboard
            resumen={resumen ?? null}
            salonDemo={salonDemo ?? null}
            ventasUltimosTreintaDias={ventasUltimosTreintaDias}
            cargando={isLoading}
          />
        )}
        {tabActivo === 'demo' && <TabDemoVendedor />}
        {tabActivo === 'preregistro' && <TabPreregistros />}
        {tabActivo === 'venta' && <TabVentasVendedor />}
      </main>
    </div>
  );
}

// ─── Sección Resumen ─────────────────────────────────────────────────────

interface PropsDashboard {
  resumen: {
    totalPreregistros: number;
    pendientes: number;
    aprobados: number;
    rechazados: number;
    totalSalones: number;
    salonesActivos: number;
  } | null;
  salonDemo: {
    nombre: string;
    plan: 'STANDARD' | 'PRO';
    totales: {
      reservas: number;
      clientes: number;
      personal: number;
    };
  } | null;
  ventasUltimosTreintaDias: Array<{ monto: number; moneda: string }>;
  cargando: boolean;
}

function SeccionDashboard({
  resumen,
  salonDemo,
  ventasUltimosTreintaDias,
  cargando,
}: PropsDashboard) {
  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-pink-600" />
      </div>
    );
  }

  if (!resumen) {
    return (
      <p className="py-12 text-center text-slate-500">No se pudo cargar el resumen del panel.</p>
    );
  }

  const totalCobrado = ventasUltimosTreintaDias.reduce(
    (acumulado, venta) => acumulado + venta.monto,
    0,
  );
  const moneda = ventasUltimosTreintaDias[0]?.moneda === 'COP' ? 'COP' : 'MXN';
  const tasaAprobacion = resumen.totalPreregistros
    ? Math.round((resumen.aprobados / resumen.totalPreregistros) * 100)
    : 0;

  const tarjetas = [
    {
      etiqueta: 'Pre-registros',
      valor: resumen.totalPreregistros,
      color: 'bg-white text-slate-900 border-slate-200',
      icono: FileText,
    },
    {
      etiqueta: 'Aprobados',
      valor: resumen.aprobados,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      icono: TrendingUp,
    },
    {
      etiqueta: 'Rechazados',
      valor: resumen.rechazados,
      color: 'bg-rose-50 text-rose-700 border-rose-100',
      icono: FileText,
    },
    {
      etiqueta: 'Salones activos',
      valor: resumen.salonesActivos,
      color: 'bg-sky-50 text-sky-700 border-sky-100',
      icono: Store,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <article className="rounded-4xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">
            Embudo real
          </p>
          <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
            Revisa qué ya convirtió y qué aún necesita seguimiento.
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {tarjetas.map((t) => (
              <div key={t.etiqueta} className={`rounded-3xl border p-5 ${t.color}`}>
                <t.icono className="h-5 w-5 opacity-80" aria-hidden="true" />
                <p className="mt-4 text-xs font-bold uppercase opacity-70">{t.etiqueta}</p>
                <p className="mt-1 text-3xl font-black">{t.valor}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-4xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-white/60">
            Pulso de ventas
          </p>
          <p className="mt-3 text-4xl font-black tracking-tight">
            {formatearDinero(totalCobrado, moneda)}
          </p>
          <p className="mt-2 text-sm text-white/70">
            Cobrado en los últimos 30 días desde tus salones aprobados.
          </p>
          <div className="mt-6 rounded-3xl bg-white/8 p-4">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/60">
              Tasa de aprobación
            </p>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${tasaAprobacion}%` }}
              />
            </div>
            <p className="mt-3 text-sm font-semibold">
              {tasaAprobacion}% de tus prospectos ya fueron aprobados.
            </p>
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <article className="rounded-4xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">
            Salón demo
          </p>
          <h3 className="mt-2 text-2xl font-black text-slate-900">
            {salonDemo?.nombre ?? 'Preparando tu espacio demo'}
          </h3>
          <div className="mt-5 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-slate-100 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Reservas</p>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {salonDemo?.totales.reservas ?? 0}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-100 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Clientes</p>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {salonDemo?.totales.clientes ?? 0}
              </p>
            </div>
            <div className="rounded-2xl bg-slate-100 p-4">
              <p className="text-xs font-bold uppercase text-slate-500">Personal</p>
              <p className="mt-1 text-2xl font-black text-slate-900">
                {salonDemo?.totales.personal ?? 0}
              </p>
            </div>
          </div>
        </article>

        <article className="rounded-4xl border border-amber-200 bg-amber-50/90 p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-amber-700">
            Siguientes acciones
          </p>
          <ul className="mt-4 space-y-3 text-sm font-medium text-amber-950">
            <li>Mueve a diario los pre-registros pendientes dentro del flujo de aprobación.</li>
            <li>Usa el salón demo para presentar la agenda y la operación real en vivo.</li>
            <li>Exporta ventas filtradas cuando necesites entregar corte o revisar comisión.</li>
          </ul>
        </article>
      </section>
    </div>
  );
}
