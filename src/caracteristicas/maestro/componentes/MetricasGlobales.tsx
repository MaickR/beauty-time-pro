import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Store, ShieldCheck, CalendarDays, Wallet } from 'lucide-react';
import { peticion } from '../../../lib/clienteHTTP';
import { EsqueletoTarjeta } from '../../../componentes/ui/Esqueleto';
import { formatearDinero } from '../../../utils/formato';
import { ModalTotalSalones } from './ModalTotalSalones';
import { ModalControlSalones } from './ModalControlSalones';
import { ModalReservas } from './ModalReservas';
import { ModalVentas } from './ModalVentas';

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

type ModalActivo = 'total-salones' | 'control' | 'reservas' | 'ventas' | null;

interface TarjetaMetricaProps {
  icono: React.ReactNode;
  etiqueta: string;
  valor: number | string;
  descripcion?: string;
  colorFondo: string;
  colorIcono: string;
  colorTexto?: string;
  onClick?: () => void;
}

function TarjetaMetrica({
  icono,
  etiqueta,
  valor,
  descripcion,
  colorFondo,
  colorIcono,
  colorTexto = 'text-slate-900',
  onClick,
}: TarjetaMetricaProps) {
  const valorFormateado = typeof valor === 'number' ? valor.toLocaleString('es-MX') : valor;

  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col items-center text-center gap-3 hover:border-pink-300 hover:shadow-md transition-all cursor-pointer w-full"
    >
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
    </button>
  );
}

function resumirIngresos(ingresos: IngresoPorMoneda[]) {
  if (ingresos.length === 0) return 'Sin pagos';
  return ingresos
    .map((ingreso) => formatearDinero(ingreso.actual, ingreso.moneda === 'COP' ? 'COP' : 'MXN'))
    .join(' · ');
}

export function MetricasGlobales() {
  const [modalActivo, setModalActivo] = useState<ModalActivo>(null);

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
        {Array.from({ length: 4 }).map((_, i) => (
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

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <TarjetaMetrica
          icono={<Store className="w-5 h-5" />}
          etiqueta="Total Salones"
          valor={data.totalSalones}
          descripcion={`${data.salonesNuevosUltimos30Dias} nuevos en los últimos 30 días`}
          colorFondo="bg-slate-100"
          colorIcono="text-slate-600"
          onClick={() => setModalActivo('total-salones')}
        />
        <TarjetaMetrica
          icono={<ShieldCheck className="w-5 h-5" />}
          etiqueta="Control de salones"
          valor={data.salonesActivos}
          descripcion={`${data.salonesSuspendidos} suspendidos`}
          colorFondo="bg-green-100"
          colorIcono="text-green-600"
          colorTexto="text-green-700"
          onClick={() => setModalActivo('control')}
        />
        <TarjetaMetrica
          icono={<CalendarDays className="w-5 h-5" />}
          etiqueta="Reservas"
          valor={data.reservasHoy}
          descripcion={`${data.reservasUltimos30Dias.toLocaleString('es-MX')} en los últimos 30 días`}
          colorFondo="bg-pink-100"
          colorIcono="text-pink-600"
          onClick={() => setModalActivo('reservas')}
        />
        <TarjetaMetrica
          icono={<Wallet className="w-5 h-5" />}
          etiqueta="Ventas"
          valor={resumirIngresos(data.ingresosPorMoneda)}
          descripcion="Ingresos por moneda"
          colorFondo="bg-emerald-100"
          colorIcono="text-emerald-700"
          onClick={() => setModalActivo('ventas')}
        />
      </div>

      {modalActivo === 'total-salones' && (
        <ModalTotalSalones onCerrar={() => setModalActivo(null)} />
      )}
      {modalActivo === 'control' && <ModalControlSalones onCerrar={() => setModalActivo(null)} />}
      {modalActivo === 'reservas' && <ModalReservas onCerrar={() => setModalActivo(null)} />}
      {modalActivo === 'ventas' && <ModalVentas onCerrar={() => setModalActivo(null)} />}
    </>
  );
}
