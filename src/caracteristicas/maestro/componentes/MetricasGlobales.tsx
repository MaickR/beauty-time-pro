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
} from 'lucide-react';
import { peticion } from '../../../lib/clienteHTTP';
import { EsqueletoTarjeta } from '../../../componentes/ui/Esqueleto';

interface Metricas {
  totalSalones: number;
  salonesActivos: number;
  salonesPendientes: number;
  salonesVencidos: number;
  totalAdmins: number;
  totalAuditLogs: number;
  reservasUltimos30Dias: number;
  salonesNuevosUltimos30Dias: number;
  cancelacionesPendientes: number;
}

interface TarjetaMetricaProps {
  icono: React.ReactNode;
  etiqueta: string;
  valor: number | string;
  colorFondo: string;
  colorIcono: string;
  colorTexto?: string;
}

function TarjetaMetrica({
  icono,
  etiqueta,
  valor,
  colorFondo,
  colorIcono,
  colorTexto = 'text-slate-900',
}: TarjetaMetricaProps) {
  return (
    <div className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex items-center gap-4">
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${colorFondo}`}
      >
        <span className={colorIcono}>{icono}</span>
      </div>
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider wrap-break-word">
          {etiqueta}
        </p>
        <p className={`text-2xl font-black ${colorTexto}`}>{valor.toLocaleString('es-MX')}</p>
      </div>
    </div>
  );
}

export function MetricasGlobales() {
  const { data, isLoading, isError } = useQuery<Metricas>({
    queryKey: ['admin', 'metricas'],
    queryFn: () => peticion<{ datos: Metricas }>('/admin/metricas').then((r) => r.datos),
    staleTime: 5 * 60 * 1000,
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
      colorFondo: 'bg-slate-100',
      colorIcono: 'text-slate-600',
    },
    {
      icono: <CheckCircle className="w-5 h-5" />,
      etiqueta: 'Salones activos',
      valor: data.salonesActivos,
      colorFondo: 'bg-green-100',
      colorIcono: 'text-green-600',
      colorTexto: 'text-green-700',
    },
    {
      icono: <Clock className="w-5 h-5" />,
      etiqueta: 'Pendientes de aprobar',
      valor: data.salonesPendientes,
      colorFondo: 'bg-amber-100',
      colorIcono: 'text-amber-600',
      colorTexto: data.salonesPendientes > 0 ? 'text-amber-700' : 'text-slate-900',
    },
    {
      icono: <AlertTriangle className="w-5 h-5" />,
      etiqueta: 'Suscripciones vencidas',
      valor: data.salonesVencidos,
      colorFondo: 'bg-red-100',
      colorIcono: 'text-red-500',
      colorTexto: data.salonesVencidos > 0 ? 'text-red-600' : 'text-slate-900',
    },
    {
      icono: <Users className="w-5 h-5" />,
      etiqueta: 'Administradores activos',
      valor: data.totalAdmins,
      colorFondo: 'bg-purple-100',
      colorIcono: 'text-purple-600',
    },
    {
      icono: <ShieldCheck className="w-5 h-5" />,
      etiqueta: 'Entradas de auditoría',
      valor: data.totalAuditLogs,
      colorFondo: 'bg-blue-100',
      colorIcono: 'text-blue-600',
    },
    {
      icono: <CalendarDays className="w-5 h-5" />,
      etiqueta: 'Reservas (30 días)',
      valor: data.reservasUltimos30Dias,
      colorFondo: 'bg-pink-100',
      colorIcono: 'text-pink-600',
    },
    {
      icono: <TrendingUp className="w-5 h-5" />,
      etiqueta: 'Salones nuevos (30 días)',
      valor: data.salonesNuevosUltimos30Dias,
      colorFondo: 'bg-teal-100',
      colorIcono: 'text-teal-600',
    },
    ...(data.cancelacionesPendientes > 0
      ? [
          {
            icono: <XCircle className="w-5 h-5" />,
            etiqueta: 'Cancelaciones pendientes',
            valor: data.cancelacionesPendientes,
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
