import { startTransition, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Bell,
  BellRing,
  FileText,
  FlaskConical,
  Landmark,
  LogOut,
  Search,
  ShieldAlert,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  obtenerMisPreregistros,
  obtenerMisSalones,
  obtenerNotificacionesVendedor,
  obtenerResumenVendedor,
  obtenerSalonDemoVendedor,
  obtenerVentasVendedor,
  type NotificacionVendedor,
  type PreregistroSalon,
  type ResumenVendedor,
  type SalonDemoVendedor,
  type SalonVendedor,
  type VentaVendedor,
} from '../../servicios/servicioVendedor';
import { obtenerPreciosPublicos } from '../../servicios/servicioPreciosPlanes';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';
import { TabPreregistros } from './componentes/TabPreregistros';
import { TabDemoVendedor } from './componentes/TabDemoVendedor';
import { TabVentasVendedor } from './componentes/TabVentasVendedor';
import { formatearDinero, formatearFechaHumana, formatearPlan } from '../../utils/formato';

type TabVendedor = 'dashboard' | 'demo' | 'preregistro' | 'venta';
type DetalleDashboard = 'preregistros' | 'salones' | 'pagos' | 'ventas' | null;

const TABS: { valor: TabVendedor; etiqueta: string; icono: typeof BarChart3 }[] = [
  { valor: 'dashboard', etiqueta: 'Resumen', icono: BarChart3 },
  { valor: 'demo', etiqueta: 'Demo', icono: FlaskConical },
  { valor: 'preregistro', etiqueta: 'Pre-registros', icono: FileText },
  { valor: 'venta', etiqueta: 'Ventas', icono: Landmark },
];

export function PaginaVendedor() {
  usarTituloPagina('Panel de Vendedor - Beauty Time Pro');

  const usuario = usarTiendaAuth((estado) => estado.usuario);
  const cerrarSesion = usarTiendaAuth((estado) => estado.cerrarSesion);
  const [tabActivo, setTabActivo] = useState<TabVendedor>('dashboard');
  const [detalleActivo, setDetalleActivo] = useState<DetalleDashboard>(null);

  const { data: resumen, isLoading: cargandoResumen } = useQuery({
    queryKey: ['vendedor', 'resumen'],
    queryFn: obtenerResumenVendedor,
    staleTime: 1000 * 60,
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
    staleTime: 1000 * 60,
    refetchInterval: 1000 * 30,
  });

  const { data: preregistros = [] } = useQuery({
    queryKey: ['vendedor', 'preregistros-snapshot'],
    queryFn: async () => (await obtenerMisPreregistros({ limite: 100, pagina: 1 })).datos,
    staleTime: 1000 * 45,
    refetchInterval: 1000 * 30,
  });

  const { data: ventas = [] } = useQuery({
    queryKey: ['vendedor', 'ventas-snapshot'],
    queryFn: () => obtenerVentasVendedor(),
    staleTime: 1000 * 45,
    refetchInterval: 1000 * 30,
  });

  const { data: notificaciones = [] } = useQuery({
    queryKey: ['vendedor', 'notificaciones'],
    queryFn: obtenerNotificacionesVendedor,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
  });

  const { data: preciosPublicos = [] } = useQuery({
    queryKey: ['planes', 'precios-publicos'],
    queryFn: obtenerPreciosPublicos,
    staleTime: 1000 * 60 * 10,
  });

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_0%_0%,rgba(198,150,140,0.16),transparent_34%),radial-gradient(circle_at_100%_10%,rgba(20,60,50,0.10),transparent_28%),linear-gradient(180deg,#f8f4f2_0%,#f0ebe8_40%,#ede7e4_100%)]">
      <header className="sticky top-0 z-40 border-b border-white/70 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-4 md:px-8">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-500">
              Panel comercial
            </p>
            <h1 className="mt-1 truncate text-xl font-black text-slate-900 md:text-3xl">
              {usuario?.nombre
                ? `Hola ${usuario.nombre}, vamos por mas cierres`
                : 'Panel de vendedor'}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <PanelNotificacionesVendedor notificaciones={notificaciones} />
            <button
              type="button"
              onClick={() => {
                void cerrarSesion();
              }}
              aria-label="Cerrar sesion"
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
            >
              <LogOut className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Cerrar sesion</span>
            </button>
          </div>
        </div>
      </header>

      <nav className="border-b border-slate-200/70 bg-white/70">
        <div className="mx-auto flex max-w-7xl gap-2 overflow-x-auto px-4 py-2 md:px-8">
          {TABS.map(({ valor, etiqueta, icono: Icono }) => (
            <button
              key={valor}
              type="button"
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
              <Icono className="h-4 w-4" aria-hidden="true" />
              {etiqueta}
            </button>
          ))}
        </div>
      </nav>

      <main className="mx-auto max-w-7xl px-4 py-8 md:px-8">
        {tabActivo === 'dashboard' && (
          <SeccionDashboard
            resumen={resumen ?? null}
            salonDemo={salonDemo ?? null}
            salones={salones}
            preregistros={preregistros}
            ventas={ventas}
            preciosPublicos={preciosPublicos}
            cargando={cargandoResumen}
            onAbrirDetalle={setDetalleActivo}
            onCambiarTab={(tab) => {
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

      {detalleActivo && resumen && (
        <ModalDetalleMetricas
          detalleActivo={detalleActivo}
          resumen={resumen}
          preregistros={preregistros}
          salones={salones}
          ventas={ventas}
          onClose={() => setDetalleActivo(null)}
          onCambiarTab={(tab) => {
            setDetalleActivo(null);
            setTabActivo(tab);
          }}
        />
      )}
    </div>
  );
}

function SeccionDashboard({
  resumen,
  salonDemo,
  salones,
  preregistros,
  ventas,
  preciosPublicos,
  cargando,
  onAbrirDetalle,
  onCambiarTab,
}: {
  resumen: ResumenVendedor | null;
  salonDemo: SalonDemoVendedor | null;
  salones: SalonVendedor[];
  preregistros: PreregistroSalon[];
  ventas: VentaVendedor[];
  preciosPublicos: Array<{
    plan: 'STANDARD' | 'PRO';
    pais: string;
    monto: number;
    moneda: 'MXN' | 'COP';
  }>;
  cargando: boolean;
  onAbrirDetalle: (detalle: DetalleDashboard) => void;
  onCambiarTab: (tab: Exclude<TabVendedor, 'dashboard'>) => void;
}) {
  if (cargando) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-pink-600" />
      </div>
    );
  }

  if (!resumen) {
    return (
      <p className="py-12 text-center text-slate-500">No se pudo cargar el resumen comercial.</p>
    );
  }

  const monedaPrincipal = ventas[0]?.moneda === 'COP' ? 'COP' : 'MXN';
  const tasaAprobacion = resumen.totalPreregistros
    ? Math.round((resumen.aprobados / resumen.totalPreregistros) * 100)
    : 0;

  const preciosMx = preciosPublicos.filter((precio) => precio.pais === 'Mexico');
  const preciosCo = preciosPublicos.filter((precio) => precio.pais === 'Colombia');

  const tarjetas = [
    {
      id: 'preregistros' as const,
      titulo: 'Pre-registros',
      valor: resumen.totalPreregistros,
      subtitulo: `${resumen.pendientes} en espera de aprobacion`,
      icono: FileText,
      estilo: 'bg-white border-slate-200 text-slate-900',
    },
    {
      id: 'salones' as const,
      titulo: 'Salones aprobados',
      valor: resumen.aprobados,
      subtitulo: `${resumen.salonesActivos} activos`,
      icono: TrendingUp,
      estilo: 'bg-emerald-50 border-emerald-100 text-emerald-900',
    },
    {
      id: 'pagos' as const,
      titulo: 'Pendientes de pago',
      valor: resumen.salonesPendientesPago,
      subtitulo: 'Requieren seguimiento inmediato',
      icono: ShieldAlert,
      estilo: 'bg-amber-50 border-amber-100 text-amber-900',
    },
    {
      id: 'ventas' as const,
      titulo: 'Ventas registradas',
      valor: resumen.ventasRegistradas,
      subtitulo: 'Abre detalle para corte comercial',
      icono: Landmark,
      estilo: 'bg-slate-950 border-slate-950 text-white',
    },
  ];

  return (
    <div className="space-y-6">
      <section className="grid gap-4 lg:grid-cols-[1.35fr_0.95fr]">
        <article className="rounded-4xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.28em] text-slate-500">
                Embudo comercial
              </p>
              <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">
                Pipeline vendedor en tiempo real
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Haz click en cualquier metrica para abrir tabla detallada con filtros.
              </p>
            </div>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
              <BellRing className="h-3.5 w-3.5" aria-hidden="true" />
              Refresco cada 30 s
            </span>
          </div>

          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {tarjetas.map((tarjeta) => (
              <button
                key={tarjeta.titulo}
                type="button"
                onClick={() => onAbrirDetalle(tarjeta.id)}
                className={`rounded-3xl border p-5 text-left transition hover:-translate-y-0.5 hover:shadow-lg ${tarjeta.estilo}`}
              >
                <tarjeta.icono className="h-5 w-5 opacity-80" aria-hidden="true" />
                <p className="mt-4 text-xs font-bold uppercase opacity-75">{tarjeta.titulo}</p>
                <p className="mt-1 text-3xl font-black">{tarjeta.valor}</p>
                <p className="mt-2 text-sm opacity-80">{tarjeta.subtitulo}</p>
              </button>
            ))}
          </div>
        </article>

        <article className="rounded-4xl border border-slate-200 bg-slate-950 p-6 text-white shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.28em] text-white/60">
            Pulso de ventas
          </p>
          <p className="mt-3 text-4xl font-black tracking-tight">
            {formatearDinero(resumen.ingresosGenerados, monedaPrincipal)}
          </p>
          <p className="mt-2 text-sm text-white/70">Ingreso total generado por tu cartera.</p>

          <div className="mt-6 space-y-3">
            <div className="rounded-3xl bg-white/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
                Comision proyectada
              </p>
              <p className="mt-2 text-xl font-black">
                {formatearDinero(resumen.comisionGenerada, monedaPrincipal)}
              </p>
              <p className="mt-2 text-xs text-white/70">
                Standard {resumen.porcentajeComision}% - Pro {resumen.porcentajeComisionPro}%
              </p>
            </div>
            <div className="rounded-3xl bg-white/10 p-4">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-white/60">
                Tasa de aprobacion
              </p>
              <div className="mt-3 h-3 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-emerald-400"
                  style={{ width: `${tasaAprobacion}%` }}
                />
              </div>
              <p className="mt-2 text-sm text-white/80">
                {tasaAprobacion}% de pre-registros convertidos.
              </p>
            </div>
          </div>
        </article>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <article className="rounded-4xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
            Salon demo
          </p>
          <h3 className="mt-2 text-2xl font-black text-slate-900">
            {salonDemo?.nombre ?? 'Demo no disponible'}
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            {salonDemo
              ? `${formatearPlan(salonDemo.plan)} · Renueva ${formatearFechaHumana(salonDemo.fechaVencimiento)}`
              : 'Configura el demo para tus presentaciones comerciales.'}
          </p>

          <div className="mt-4 grid grid-cols-3 gap-3">
            <KpiSalonDemo etiqueta="Reservas" valor={salonDemo?.totales.reservas ?? 0} />
            <KpiSalonDemo etiqueta="Clientes" valor={salonDemo?.totales.clientes ?? 0} />
            <KpiSalonDemo etiqueta="Personal" valor={salonDemo?.totales.personal ?? 0} />
          </div>

          <button
            type="button"
            onClick={() => onCambiarTab('demo')}
            className="mt-4 rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
          >
            Abrir demo
          </button>
        </article>

        <article className="rounded-4xl border border-slate-200 bg-white/90 p-6 shadow-sm">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
            Planes y precios
          </p>
          <h3 className="mt-2 text-2xl font-black text-slate-900">
            Argumentario comercial actualizado
          </h3>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <BloquePrecios pais="Mexico" precios={preciosMx} />
            <BloquePrecios pais="Colombia" precios={preciosCo} />
          </div>

          <div className="mt-4 rounded-3xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {preregistros.length} prospectos visibles y {salones.length} salones creados en cartera.
          </div>
        </article>
      </section>
    </div>
  );
}

function ModalDetalleMetricas({
  detalleActivo,
  resumen,
  preregistros,
  salones,
  ventas,
  onClose,
  onCambiarTab,
}: {
  detalleActivo: Exclude<DetalleDashboard, null>;
  resumen: ResumenVendedor;
  preregistros: PreregistroSalon[];
  salones: SalonVendedor[];
  ventas: VentaVendedor[];
  onClose: () => void;
  onCambiarTab: (tab: Exclude<TabVendedor, 'dashboard'>) => void;
}) {
  const [busqueda, setBusqueda] = useState('');
  const [filtroEstado, setFiltroEstado] = useState('');

  const titulo =
    detalleActivo === 'preregistros'
      ? 'Detalle de pre-registros'
      : detalleActivo === 'salones'
        ? 'Detalle de salones aprobados'
        : detalleActivo === 'pagos'
          ? 'Salones pendientes de pago'
          : 'Detalle de ventas';

  const filas = useMemo(() => {
    if (detalleActivo === 'preregistros') {
      return preregistros
        .filter((item) => (filtroEstado ? item.estado === filtroEstado : true))
        .filter((item) => {
          if (!busqueda.trim()) return true;
          const texto =
            `${item.nombreSalon} ${item.propietario} ${item.emailPropietario}`.toLowerCase();
          return texto.includes(busqueda.trim().toLowerCase());
        })
        .map((item) => ({
          columnaA: item.nombreSalon,
          columnaB: item.propietario,
          columnaC: item.estado,
          columnaD: formatearFechaHumana(item.creadoEn),
        }));
    }

    if (detalleActivo === 'salones') {
      return salones
        .filter((item) => item.estado === 'aprobado' && item.activo)
        .filter((item) => {
          if (!busqueda.trim()) return true;
          const texto = `${item.nombre} ${item.propietario} ${item.plan}`.toLowerCase();
          return texto.includes(busqueda.trim().toLowerCase());
        })
        .map((item) => ({
          columnaA: item.nombre,
          columnaB: item.propietario,
          columnaC: formatearPlan(item.plan),
          columnaD: formatearFechaHumana(item.fechaVencimiento),
        }));
    }

    if (detalleActivo === 'pagos') {
      return salones
        .filter((item) => item.estado === 'aprobado' && item.activo)
        .filter((item) => item.fechaVencimiento < new Date().toISOString().slice(0, 10))
        .filter((item) => {
          if (!busqueda.trim()) return true;
          const texto = `${item.nombre} ${item.propietario}`.toLowerCase();
          return texto.includes(busqueda.trim().toLowerCase());
        })
        .map((item) => ({
          columnaA: item.nombre,
          columnaB: item.propietario,
          columnaC: formatearPlan(item.plan),
          columnaD: formatearFechaHumana(item.fechaVencimiento),
        }));
    }

    return ventas
      .filter((item) => (filtroEstado === 'pendiente' ? item.pendientePago : true))
      .filter((item) => {
        if (!busqueda.trim()) return true;
        const texto = `${item.salonNombre} ${item.adminSalonNombre} ${item.plan}`.toLowerCase();
        return texto.includes(busqueda.trim().toLowerCase());
      })
      .map((item) => ({
        columnaA: item.salonNombre,
        columnaB: item.adminSalonNombre,
        columnaC: `${formatearPlan(item.plan)} · ${item.porcentajeComisionAplicado}%`,
        columnaD: formatearDinero(item.valorSuscripcion, item.moneda === 'COP' ? 'COP' : 'MXN'),
      }));
  }, [busqueda, detalleActivo, filtroEstado, preregistros, salones, ventas]);

  const resumenModal =
    detalleActivo === 'preregistros'
      ? `${resumen.pendientes} pendientes · ${resumen.aprobados} aprobados · ${resumen.rechazados} rechazados`
      : detalleActivo === 'salones'
        ? `${resumen.salonesActivos} salones activos`
        : detalleActivo === 'pagos'
          ? `${resumen.salonesPendientesPago} pendientes de pago`
          : `${resumen.ventasRegistradas} ventas registradas`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/65 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-detalle-vendedor"
    >
      <div className="w-full max-w-5xl overflow-hidden rounded-4xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 bg-slate-50 p-5">
          <div>
            <h3 id="titulo-modal-detalle-vendedor" className="text-2xl font-black text-slate-900">
              {titulo}
            </h3>
            <p className="mt-1 text-sm text-slate-500">{resumenModal}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-slate-400 transition hover:bg-white hover:text-slate-700"
            aria-label="Cerrar detalle"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4 p-5">
          <div className="flex flex-col gap-3 sm:flex-row">
            <label className="relative block flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={busqueda}
                onChange={(evento) => setBusqueda(evento.target.value)}
                placeholder="Buscar en la tabla"
                className="w-full rounded-2xl border border-slate-300 py-3 pl-11 pr-4 text-sm text-slate-900"
              />
            </label>

            {(detalleActivo === 'preregistros' || detalleActivo === 'ventas') && (
              <select
                value={filtroEstado}
                onChange={(evento) => setFiltroEstado(evento.target.value)}
                className="rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900"
              >
                <option value="">Todos</option>
                {detalleActivo === 'preregistros' && <option value="pendiente">Pendiente</option>}
                {detalleActivo === 'preregistros' && <option value="aprobado">Aprobado</option>}
                {detalleActivo === 'preregistros' && <option value="rechazado">Rechazado</option>}
                {detalleActivo === 'ventas' && (
                  <option value="pendiente">Solo pendientes de pago</option>
                )}
              </select>
            )}
          </div>

          <div className="overflow-x-auto rounded-3xl border border-slate-200">
            <table className="w-full min-w-190 text-sm">
              <thead className="bg-slate-50 text-left text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-black uppercase tracking-[0.14em]">Salon</th>
                  <th className="px-4 py-3 font-black uppercase tracking-[0.14em]">Responsable</th>
                  <th className="px-4 py-3 font-black uppercase tracking-[0.14em]">
                    Estado / Plan
                  </th>
                  <th className="px-4 py-3 font-black uppercase tracking-[0.14em]">
                    Fecha / Monto
                  </th>
                </tr>
              </thead>
              <tbody>
                {filas.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-10 text-center text-sm font-semibold text-slate-500"
                    >
                      No hay datos para el filtro actual.
                    </td>
                  </tr>
                ) : (
                  filas.map((fila, indice) => (
                    <tr key={`${fila.columnaA}-${indice}`} className="border-t border-slate-100">
                      <td className="px-4 py-3 font-semibold text-slate-900">{fila.columnaA}</td>
                      <td className="px-4 py-3 text-slate-700">{fila.columnaB}</td>
                      <td className="px-4 py-3 text-slate-700">{fila.columnaC}</td>
                      <td className="px-4 py-3 text-slate-700">{fila.columnaD}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-500">{filas.length} filas visibles</p>
            <button
              type="button"
              onClick={() => onCambiarTab(detalleActivo === 'ventas' ? 'venta' : 'preregistro')}
              className="rounded-full bg-slate-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
            >
              {detalleActivo === 'ventas'
                ? 'Abrir modulo de ventas'
                : 'Abrir modulo de pre-registros'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PanelNotificacionesVendedor({
  notificaciones,
}: {
  notificaciones: NotificacionVendedor[];
}) {
  const [abierto, setAbierto] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setAbierto((valor) => !valor)}
        aria-label="Notificaciones"
        className="relative rounded-full border border-amber-200 bg-amber-50 p-3 text-amber-700 transition hover:bg-amber-100"
      >
        <Bell className="h-5 w-5" aria-hidden="true" />
        {notificaciones.length > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
            {notificaciones.length > 9 ? '9+' : notificaciones.length}
          </span>
        )}
      </button>

      {abierto && (
        <div className="absolute right-0 top-full z-50 mt-2 w-96 max-w-[calc(100vw-1rem)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-black uppercase text-slate-900">Notificaciones</p>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Cerrar notificaciones"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notificaciones.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-slate-500">
                No hay alertas por ahora.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {notificaciones.map((notificacion) => (
                  <li key={notificacion.id} className="px-4 py-3">
                    <p className="text-sm font-bold text-slate-900">{notificacion.titulo}</p>
                    <p className="mt-1 text-xs text-slate-600">{notificacion.mensaje}</p>
                    <p className="mt-2 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-400">
                      {formatearFechaHumana(notificacion.creadoEn)} · {notificacion.prioridad}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiSalonDemo({ etiqueta, valor }: { etiqueta: string; valor: number }) {
  return (
    <div className="rounded-2xl bg-slate-100 p-4">
      <p className="text-xs font-bold uppercase text-slate-500">{etiqueta}</p>
      <p className="mt-1 text-2xl font-black text-slate-900">{valor}</p>
    </div>
  );
}

function BloquePrecios({
  pais,
  precios,
}: {
  pais: string;
  precios: Array<{ plan: 'STANDARD' | 'PRO'; monto: number; moneda: 'MXN' | 'COP' }>;
}) {
  const standard = precios.find((precio) => precio.plan === 'STANDARD');
  const pro = precios.find((precio) => precio.plan === 'PRO');

  return (
    <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{pais}</p>
      <p className="mt-2 text-sm font-semibold text-slate-700">
        Standard: {standard ? formatearDinero(standard.monto, standard.moneda) : 'Sin precio'}
      </p>
      <p className="mt-1 text-sm font-semibold text-slate-700">
        Pro: {pro ? formatearDinero(pro.monto, pro.moneda) : 'Sin precio'}
      </p>
    </div>
  );
}
