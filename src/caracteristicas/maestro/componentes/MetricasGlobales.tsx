import { useQuery } from '@tanstack/react-query';
import {
  Store,
  CheckCircle,
  Clock,
  AlertTriangle,
  Users,
  ShieldCheck,
  CalendarDays,
  TrendingUp,
  XCircle,
  Wallet,
  Activity,
  TimerReset,
} from 'lucide-react';
import { peticion } from '../../../lib/clienteHTTP';
import { EsqueletoTarjeta } from '../../../componentes/ui/Esqueleto';

interface IngresoPorMoneda {
  moneda: string;
  actual: number;
  anterior: number;
  variacion: number;
}

interface Metricas {
  totalSalones: number;
  salonesActivos: number;
  salonesPendientes: number;
  salonesSuspendidos: number;
  salonesVencidos: number;
  salonesPorVencer7Dias: number;
  salonesPorVencer30Dias: number;
  totalAdmins: number;
  totalAuditLogs: number;
  reservasHoy: number;
  reservasUltimos30Dias: number;
  ticketPromedioUltimos30Dias: number;
  promedioReservasPorSalonActivo: number;
  salonesNuevosUltimos30Dias: number;
  tasaAprobacionUltimos30Dias: number;
  cancelacionesPendientes: number;
  ingresosPorMoneda: IngresoPorMoneda[];
}

interface TarjetaMetricaProps {
  icono: React.ReactNode;
  etiqueta: string;
  valor: number | string;
  descripcion?: string;
  colorFondo: string;
  colorIcono: string;
  colorTexto?: string;
}

function TarjetaMetrica({
  icono,
  etiqueta,
  valor,
  descripcion,
  colorFondo,
  colorIcono,
  colorTexto = 'text-slate-900',
}: TarjetaMetricaProps) {
  const valorFormateado = typeof valor === 'number' ? valor.toLocaleString('es-MX') : valor;

  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col items-center text-center gap-3">
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${colorFondo}`}
      >
        <span className={colorIcono}>{icono}</span>
      </div>
      <div className="min-w-0 w-full">
        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider wrap-break-word">
          {etiqueta}
        </p>
        <p className={`text-2xl font-black text-center ${colorTexto}`}>{valorFormateado}</p>
        {descripcion ? (
          <p className="mt-1 text-xs font-medium text-slate-500">{descripcion}</p>
        ) : null}
      </div>
    </div>
  );
}

function formatearMoneda(monto: number, moneda: string) {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: moneda,
    maximumFractionDigits: moneda === 'COP' ? 0 : 2,
  }).format(monto);
}

function resumirIngresos(ingresos: IngresoPorMoneda[]) {
  if (ingresos.length === 0) return 'Sin pagos';
  return ingresos.map((ingreso) => formatearMoneda(ingreso.actual, ingreso.moneda)).join(' · ');
}

function resumirVariacion(ingresos: IngresoPorMoneda[]) {
  if (ingresos.length === 0) return 'Sin referencia';
  return ingresos
    .map(
      (ingreso) =>
        `${ingreso.moneda} ${ingreso.variacion > 0 ? '+' : ''}${ingreso.variacion.toLocaleString('es-MX')}%`,
    )
    .join(' · ');
}

export function MetricasGlobales() {
  const { data, isLoading, isError } = useQuery<Metricas>({
    queryKey: ['admin', 'metricas'],
    queryFn: () => peticion<{ datos: Metricas }>('/admin/metricas').then((r) => r.datos),
    staleTime: 30 * 1000,
    refetchInterval: 30 * 1000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 8 }).map((_, i) => (
          <EsqueletoTarjeta key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mb-8 p-4 bg-red-50 border border-red-200 rounded-2xl text-sm text-red-700 font-semibold">
        No se pudieron cargar las métricas.
      </div>
    );
  }

  const tarjetas: TarjetaMetricaProps[] = [
    {
      icono: <Store className="w-5 h-5" />,
      etiqueta: 'Total salones',
      valor: data.totalSalones,
      descripcion: `${data.salonesNuevosUltimos30Dias} nuevos en los últimos 30 días`,
      colorFondo: 'bg-slate-100',
      colorIcono: 'text-slate-600',
    },
    {
      icono: <CheckCircle className="w-5 h-5" />,
      etiqueta: 'Salones activos',
      valor: data.salonesActivos,
      descripcion: `${data.salonesPorVencer30Dias} por vencer en los próximos 30 días`,
      colorFondo: 'bg-green-100',
      colorIcono: 'text-green-600',
      colorTexto: 'text-green-700',
    },
    {
      icono: <Clock className="w-5 h-5" />,
      etiqueta: 'Pendientes de aprobar',
      valor: data.salonesPendientes,
      descripcion: `${data.tasaAprobacionUltimos30Dias}% de aprobación en 30 días`,
      colorFondo: 'bg-amber-100',
      colorIcono: 'text-amber-600',
      colorTexto: data.salonesPendientes > 0 ? 'text-amber-700' : 'text-slate-900',
    },
    {
      icono: <AlertTriangle className="w-5 h-5" />,
      etiqueta: 'Suscripciones vencidas',
      valor: data.salonesVencidos,
      descripcion: `${data.salonesPorVencer7Dias} vencen en 7 días`,
      colorFondo: 'bg-red-100',
      colorIcono: 'text-red-500',
      colorTexto: data.salonesVencidos > 0 ? 'text-red-600' : 'text-slate-900',
    },
    {
      icono: <TimerReset className="w-5 h-5" />,
      etiqueta: 'Salones suspendidos',
      valor: data.salonesSuspendidos,
      descripcion: 'Impacta capacidad de la red y continuidad operativa',
      colorFondo: 'bg-orange-100',
      colorIcono: 'text-orange-600',
      colorTexto: data.salonesSuspendidos > 0 ? 'text-orange-700' : 'text-slate-900',
    },
    {
      icono: <Users className="w-5 h-5" />,
      etiqueta: 'Administradores activos',
      valor: data.totalAdmins,
      descripcion: 'Usuarios maestro con acceso vigente',
      colorFondo: 'bg-purple-100',
      colorIcono: 'text-purple-600',
    },
    {
      icono: <ShieldCheck className="w-5 h-5" />,
      etiqueta: 'Entradas de auditoría',
      valor: data.totalAuditLogs,
      descripcion: 'Eventos trazables para revisión y cumplimiento',
      colorFondo: 'bg-blue-100',
      colorIcono: 'text-blue-600',
    },
    {
      icono: <Activity className="w-5 h-5" />,
      etiqueta: 'Reservas hoy',
      valor: data.reservasHoy,
      descripcion: 'Pulso operativo del día en toda la red',
      colorFondo: 'bg-cyan-100',
      colorIcono: 'text-cyan-700',
    },
    {
      icono: <CalendarDays className="w-5 h-5" />,
      etiqueta: 'Reservas (30 días)',
      valor: data.reservasUltimos30Dias,
      descripcion: `${data.promedioReservasPorSalonActivo.toLocaleString('es-MX')} por salón activo`,
      colorFondo: 'bg-pink-100',
      colorIcono: 'text-pink-600',
    },
    {
      icono: <Wallet className="w-5 h-5" />,
      etiqueta: 'Cobros del mes',
      valor: resumirIngresos(data.ingresosPorMoneda),
      descripcion: 'Agrupado por moneda para no mezclar MXN y COP',
      colorFondo: 'bg-emerald-100',
      colorIcono: 'text-emerald-700',
    },
    {
      icono: <TrendingUp className="w-5 h-5" />,
      etiqueta: 'Salones nuevos (30 días)',
      valor: data.salonesNuevosUltimos30Dias,
      descripcion: 'Altas reales registradas en la plataforma',
      colorFondo: 'bg-teal-100',
      colorIcono: 'text-teal-600',
    },
    {
      icono: <TrendingUp className="w-5 h-5" />,
      etiqueta: 'Tendencia mensual',
      valor: resumirVariacion(data.ingresosPorMoneda),
      descripcion: 'Comparativo del mes actual contra el mes anterior',
      colorFondo: 'bg-violet-100',
      colorIcono: 'text-violet-700',
    },
    ...(data.cancelacionesPendientes > 0
      ? [
          {
            icono: <XCircle className="w-5 h-5" />,
            etiqueta: 'Cancelaciones pendientes',
            valor: data.cancelacionesPendientes,
            descripcion: 'Requieren decisión operativa del maestro',
            colorFondo: 'bg-red-100',
            colorIcono: 'text-red-600',
            colorTexto: 'text-red-700',
          } satisfies TarjetaMetricaProps,
        ]
      : []),
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {tarjetas.map((t) => (
        <TarjetaMetrica key={t.etiqueta} {...t} />
      ))}
    </div>
  );
}
