import { startTransition, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowRight,
  BarChart3,
  FileText,
  FlaskConical,
  Landmark,
  RefreshCcw,
  ShieldAlert,
  Store,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  obtenerMisSalones,
  obtenerResumenVendedor,
  obtenerSalonDemoVendedor,
  type ResumenVendedor,
  type SalonDemoVendedor,
  type SalonVendedor,
} from '../../servicios/servicioVendedor';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';
import { TabPreregistros } from './componentes/TabPreregistros';
import { TabDemoVendedor } from './componentes/TabDemoVendedor';
import { TabVentasVendedor } from './componentes/TabVentasVendedor';
import { formatearDinero, formatearFechaHumana, formatearPlan } from '../../utils/formato';

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
    refetchInterval: 1000 * 30,
  });

  const { data: salonDemo } = useQuery({
    queryKey: ['vendedor', 'demo'],
    queryFn: obtenerSalonDemoVendedor,
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 30,
  });

  const { data: salones = [] } = useQuery({
    queryKey: ['vendedor', 'salones'],
    queryFn: obtenerMisSalones,
    staleTime: 1000 * 60 * 2,
    refetchInterval: 1000 * 30,
  });

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
              onClick={() => {
                startTransition(() => {
                  setTabActivo(valor);
                });
              }}
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
            salones={salones}
            cargando={isLoading}
            alCambiarTab={(tab) => {
              startTransition(() => {
                setTabActivo(tab);
              });
            }}
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
  resumen: ResumenVendedor | null;
  salonDemo: SalonDemoVendedor | null;
  salones: SalonVendedor[];
  cargando: boolean;
  alCambiarTab: (tab: Exclude<TabVendedor, 'dashboard'>) => void;
}

type DetalleDashboard = 'preregistros' | 'salones' | 'pagos' | 'ventas' | null;

function SeccionDashboard({ resumen, salonDemo, salones, cargando, alCambiarTab }: PropsDashboard) {
  const [detalleActivo, setDetalleActivo] = useState<DetalleDashboard>(null);

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

  const moneda = 'MXN';
  const tasaAprobacion = resumen.totalPreregistros
    ? Math.round((resumen.aprobados / resumen.totalPreregistros) * 100)
    : 0;
  const salonesActivos = salones.filter((salon) => salon.activo && salon.estado === 'aprobado');
  const salonesPendientes = salones.filter(
    (salon) =>
      salon.activo &&
      salon.estado === 'aprobado' &&
      salon.fechaVencimiento < new Date().toISOString().slice(0, 10),
  );

  const tarjetas = [
    {
      etiqueta: 'Pre-registros',
      valor: resumen.totalPreregistros,
      color: 'bg-white text-slate-900 border-slate-200',
      icono: FileText,
      detalle: 'preregistros' as const,
      descripcion: `${resumen.pendientes} pendientes por mover`,
    },
    {
      etiqueta: 'Salones aprobados',
      valor: resumen.aprobados,
      color: 'bg-emerald-50 text-emerald-700 border-emerald-100',
      icono: TrendingUp,
      detalle: 'salones' as const,
      descripcion: `${salonesActivos.length} operando ahora`,
    },
    {
      etiqueta: 'Pendientes de pago',
      valor: resumen.salonesPendientesPago,
      color: 'bg-amber-50 text-amber-700 border-amber-100',
      icono: ShieldAlert,
      detalle: 'pagos' as const,
      descripcion: 'Renovaciones vencidas',
    },
    {
      etiqueta: 'Ventas registradas',
      valor: resumen.ventasRegistradas,
      color: 'bg-slate-950 text-white border-slate-950',
      icono: Landmark,
      detalle: 'ventas' as const,
      descripcion: 'Corte comercial acumulado',
    },
  ];

  const tarjetasComerciales = [
    {
      etiqueta: 'Salones activos',
      valor: resumen.salonesActivos,
      descripcion: 'Operando y aprobados',
      icono: Store,
    },
    {
      etiqueta: 'Comisión proyectada',
      valor: resumen.porcentajeComision,
      descripcion: `${formatearDinero(resumen.comisionGenerada, moneda)} acumulados`,
      icono: TrendingUp,
    },
  ];

  const detalle = obtenerDetalleDashboard({
    detalleActivo,
    resumen,
    salonDemo,
    salones,
    salonesActivos,
    salonesPendientes,
    tasaAprobacion,
    moneda,
    alCambiarTab,
  });

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.4fr_0.9fr]">
        <article className="rounded-4xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">
                Embudo real
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                Revisa qué ya convirtió y qué aún necesita seguimiento.
              </h2>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
              <RefreshCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Sincroniza cada 30 s
            </div>
          </div>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {tarjetas.map((t) => (
              <button
                key={t.etiqueta}
                type="button"
                onClick={() => setDetalleActivo(t.detalle)}
                className={`rounded-3xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${t.color}`}
              >
                <t.icono className="h-5 w-5 opacity-80" aria-hidden="true" />
                <p className="mt-4 text-xs font-bold uppercase opacity-70">{t.etiqueta}</p>
                <p className="mt-1 text-3xl font-black">{t.valor}</p>
                <p className="mt-2 text-sm opacity-80">{t.descripcion}</p>
              </button>
            ))}
          </div>
        </article>

        <article className="rounded-4xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-white/60">
            Pulso de ventas
          </p>
          <p className="mt-3 text-4xl font-black tracking-tight">
            {formatearDinero(resumen.ingresosGenerados, moneda)}
          </p>
          <p className="mt-2 text-sm text-white/70">
            Ingreso total generado desde tus salones aprobados.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-3xl bg-white/8 p-4">
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-white/60">
                Comisión configurada
              </p>
              <p className="mt-3 text-3xl font-black">{resumen.porcentajeComision}%</p>
              <p className="mt-2 text-sm text-white/70">
                {formatearDinero(resumen.comisionGenerada, moneda)} generados en comisión.
              </p>
            </div>
            <div className="rounded-3xl bg-white/8 p-4">
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
          </div>
        </article>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {tarjetasComerciales.map((tarjeta) => (
          <article
            key={tarjeta.etiqueta}
            className="rounded-4xl border border-slate-200 bg-white/90 p-6 shadow-sm"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
                  {tarjeta.etiqueta}
                </p>
                <p className="mt-3 text-4xl font-black text-slate-900">
                  {tarjeta.etiqueta === 'Comisión proyectada' ? `${tarjeta.valor}%` : tarjeta.valor}
                </p>
                <p className="mt-2 text-sm text-slate-500">{tarjeta.descripcion}</p>
              </div>
              <div className="rounded-3xl bg-rose-50 p-3 text-rose-700">
                <tarjeta.icono className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <article className="rounded-4xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">
            Salón demo
          </p>
          <h3 className="mt-2 text-2xl font-black text-slate-900">
            {salonDemo?.nombre ?? 'Preparando tu espacio demo'}
          </h3>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-500">
            <span className="rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700">
              {salonDemo ? formatearPlan(salonDemo.plan) : 'Pro'}
            </span>
            <span>
              Renueva {salonDemo ? formatearFechaHumana(salonDemo.fechaVencimiento) : 'pronto'}
            </span>
          </div>
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

      {detalle && (
        <ModalDetalleDashboard
          titulo={detalle.titulo}
          subtitulo={detalle.subtitulo}
          onClose={() => setDetalleActivo(null)}
        >
          {detalle.contenido}
        </ModalDetalleDashboard>
      )}
    </div>
  );
}

function obtenerDetalleDashboard(params: {
  detalleActivo: DetalleDashboard;
  resumen: ResumenVendedor;
  salonDemo: SalonDemoVendedor | null;
  salones: SalonVendedor[];
  salonesActivos: SalonVendedor[];
  salonesPendientes: SalonVendedor[];
  tasaAprobacion: number;
  moneda: string;
  alCambiarTab: (tab: Exclude<TabVendedor, 'dashboard'>) => void;
}) {
  const {
    detalleActivo,
    resumen,
    salonDemo,
    salones,
    salonesActivos,
    salonesPendientes,
    tasaAprobacion,
    moneda,
    alCambiarTab,
  } = params;

  if (detalleActivo === 'preregistros') {
    return {
      titulo: 'Embudo de pre-registros',
      subtitulo: 'Lectura rápida del pipeline comercial actual.',
      contenido: (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <BloqueDetalle etiqueta="Pendientes" valor={resumen.pendientes} />
            <BloqueDetalle etiqueta="Aprobados" valor={resumen.aprobados} />
            <BloqueDetalle etiqueta="Rechazados" valor={resumen.rechazados} />
          </div>
          <div className="rounded-3xl bg-slate-100 p-4">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Tasa de aprobación
            </p>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-white">
              <div
                className="h-full rounded-full bg-emerald-500"
                style={{ width: `${tasaAprobacion}%` }}
              />
            </div>
            <p className="mt-3 text-sm font-semibold text-slate-700">
              {tasaAprobacion}% de tus prospectos terminó aprobado.
            </p>
          </div>
          <BotonDetalle
            onClick={() => alCambiarTab('preregistro')}
            texto="Abrir gestión de pre-registros"
          />
        </div>
      ),
    };
  }

  if (detalleActivo === 'salones') {
    return {
      titulo: 'Salones aprobados',
      subtitulo: 'Estado de tus cuentas ya convertidas.',
      contenido: (
        <div className="space-y-3">
          {salonesActivos.length === 0 ? (
            <EstadoVacioDetalle mensaje="Todavía no hay salones activos aprobados para mostrar." />
          ) : (
            salonesActivos.map((salon) => <FilaSalonDetalle key={salon.id} salon={salon} />)
          )}
        </div>
      ),
    };
  }

  if (detalleActivo === 'pagos') {
    return {
      titulo: 'Salones pendientes de pago',
      subtitulo: 'Prioriza seguimiento en los casos con renovación vencida.',
      contenido: (
        <div className="space-y-3">
          {salonesPendientes.length === 0 ? (
            <EstadoVacioDetalle mensaje="No tienes salones vencidos dentro de tu cartera actual." />
          ) : (
            salonesPendientes.map((salon) => (
              <FilaSalonDetalle key={salon.id} salon={salon} mostrarAlerta />
            ))
          )}
        </div>
      ),
    };
  }

  if (detalleActivo === 'ventas') {
    return {
      titulo: 'Corte comercial',
      subtitulo: 'Ingresos, comisión y actividad disponible en tu cartera.',
      contenido: (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <BloqueDetalle etiqueta="Ventas registradas" valor={resumen.ventasRegistradas} />
            <BloqueDetalle etiqueta="Salones convertidos" valor={salones.length} />
          </div>
          <div className="rounded-3xl bg-slate-950 p-5 text-white">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-white/60">
              Ingreso total
            </p>
            <p className="mt-2 text-3xl font-black">
              {formatearDinero(resumen.ingresosGenerados, moneda)}
            </p>
            <p className="mt-2 text-sm text-white/70">
              Comisión vigente: {resumen.porcentajeComision}% ·{' '}
              {formatearDinero(resumen.comisionGenerada, moneda)} acumulados.
            </p>
          </div>
          {salonDemo && (
            <div className="rounded-3xl bg-slate-100 p-4 text-sm text-slate-700">
              El demo actual se mantiene listo en {salonDemo.nombre} para apoyar cierres y
              seguimiento.
            </div>
          )}
          <BotonDetalle onClick={() => alCambiarTab('venta')} texto="Abrir pestaña de ventas" />
        </div>
      ),
    };
  }

  return null;
}

function ModalDetalleDashboard({
  titulo,
  subtitulo,
  children,
  onClose,
}: {
  titulo: string;
  subtitulo: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="detalle-dashboard-titulo"
    >
      <div className="w-full max-w-3xl rounded-4xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">Detalle</p>
            <h3 id="detalle-dashboard-titulo" className="mt-2 text-2xl font-black text-slate-900">
              {titulo}
            </h3>
            <p className="mt-2 text-sm text-slate-500">{subtitulo}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 p-2 text-slate-500 transition hover:border-slate-300 hover:text-slate-900"
            aria-label="Cerrar detalle"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}

function BloqueDetalle({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="rounded-3xl bg-slate-100 p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{etiqueta}</p>
      <p className="mt-2 text-3xl font-black text-slate-900">{valor}</p>
    </div>
  );
}

function EstadoVacioDetalle({ mensaje }: { mensaje: string }) {
  return (
    <div className="rounded-3xl bg-slate-100 px-4 py-8 text-center text-sm font-semibold text-slate-500">
      {mensaje}
    </div>
  );
}

function FilaSalonDetalle({
  salon,
  mostrarAlerta = false,
}: {
  salon: SalonVendedor;
  mostrarAlerta?: boolean;
}) {
  return (
    <article className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-base font-black text-slate-900">{salon.nombre}</p>
          <p className="mt-1 text-sm text-slate-500">{salon.propietario}</p>
          <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
            {formatearPlan(salon.plan)} · vence {formatearFechaHumana(salon.fechaVencimiento)}
          </p>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-sm font-semibold text-slate-700">{salon.totalReservas} reservas</p>
          <span
            className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-black ${mostrarAlerta ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-700'}`}
          >
            {mostrarAlerta ? 'Dar seguimiento' : 'Operando'}
          </span>
        </div>
      </div>
    </article>
  );
}

function BotonDetalle({ texto, onClick }: { texto: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-3 text-sm font-bold text-white transition hover:bg-slate-800"
    >
      {texto}
      <ArrowRight className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
