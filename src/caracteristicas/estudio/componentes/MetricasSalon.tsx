import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Bell,
  Calendar,
  ChevronDown,
  ChevronUp,
  Clock,
  CreditCard,
  DollarSign,
  Download,
  Search,
  Smartphone,
  Star,
  Users,
  X,
  Zap,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  obtenerMetricasDashboard,
  type CitaDashboardSalon,
  type MetricasDashboardSalon,
} from '../../../servicios/servicioEstudios';
import { formatearDinero, formatearFechaHumana } from '../../../utils/formato';
import { EsqueletoTarjeta } from '../../../componentes/ui/Esqueleto';
import {
  construirFilasAcumuladas,
  filtrarCitasDashboard,
  filtrarEspecialistasDashboard,
  filtrarIngresosDashboard,
  obtenerClaseEstadoReserva,
  obtenerEtiquetaEstadoReserva,
  obtenerEtiquetaPeriodoFinanciero,
  obtenerSegmentoPeriodoFinancieroArchivo,
  type PeriodoFinancieroDashboardSalon,
} from '../utils/metricasSalon';

type ModalActiva = 'citas' | 'ganancias' | 'especialistas' | 'plan' | 'corte' | null;
type PestanaFinanciera = PeriodoFinancieroDashboardSalon;

interface PropsMetricasSalon {
  estudioId: string;
  nombreSalon: string;
  saludo: string;
  nombreSaludo: string;
  fechaEtiqueta: string;
}

interface PropsStatCard {
  title: string;
  value: string | number;
  subtitle: ReactNode;
  color: string;
  icon: ReactNode;
  onClick: () => void;
}

interface PropsModal {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

const ESTADO_CITAS = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'pending', etiqueta: 'Confirmada' },
  { valor: 'confirmed', etiqueta: 'Confirmada' },
  { valor: 'working', etiqueta: 'Trabajando' },
  { valor: 'completed', etiqueta: 'Completada' },
  { valor: 'cancelled', etiqueta: 'Cancelada' },
] as const;

const TAMANO_PAGINA = 5;

type DireccionOrden = 'asc' | 'desc';
type CampoOrdenCitas = 'cliente' | 'servicio' | 'empleado' | 'hora' | 'precio' | 'estado';
type CampoOrdenIngresos = 'fecha' | 'concepto' | 'tipo' | 'responsable' | 'cliente' | 'monto';
type CampoOrdenEspecialistas = 'nombre' | 'servicios' | 'jornada' | 'descanso' | 'citasHoy';

function normalizarNombreArchivo(valor: string) {
  return (
    valor
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'salon'
  );
}

function compararTexto(valorA: string, valorB: string, direccion: DireccionOrden) {
  const resultado = valorA.localeCompare(valorB, 'es', { sensitivity: 'base' });
  return direccion === 'asc' ? resultado : -resultado;
}

function compararNumero(valorA: number, valorB: number, direccion: DireccionOrden) {
  const resultado = valorA - valorB;
  return direccion === 'asc' ? resultado : -resultado;
}

function BotonOrdenTabla({
  etiqueta,
  activo,
  direccion,
  onClick,
  alineacion = 'left',
}: {
  etiqueta: string;
  activo: boolean;
  direccion: DireccionOrden;
  onClick: () => void;
  alineacion?: 'left' | 'right';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 ${alineacion === 'right' ? 'justify-end w-full' : ''}`}
    >
      <span>{etiqueta}</span>
      {activo ? (
        direccion === 'asc' ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )
      ) : (
        <span className="text-[11px]">↕</span>
      )}
    </button>
  );
}

function PaginadorTabla({
  total,
  pagina,
  onCambiarPagina,
}: {
  total: number;
  pagina: number;
  onCambiarPagina: (pagina: number) => void;
}) {
  const totalPaginas = Math.max(1, Math.ceil(total / TAMANO_PAGINA));

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => onCambiarPagina(Math.max(1, pagina - 1))}
        disabled={pagina <= 1}
        className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold disabled:opacity-40"
      >
        Anterior
      </button>
      <button
        type="button"
        onClick={() => onCambiarPagina(Math.min(totalPaginas, pagina + 1))}
        disabled={pagina >= totalPaginas}
        className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-bold disabled:opacity-40"
      >
        Siguiente
      </button>
    </div>
  );
}

function calcularTiempoRestante(
  fechaHoraObjetivo: string,
  corteActual: MetricasDashboardSalon['corte'],
) {
  const fechaObjetivo = new Date(fechaHoraObjetivo);
  if (Number.isNaN(fechaObjetivo.getTime())) {
    return {
      ...corteActual,
      segundos: 0,
    };
  }

  const diferenciaMs = fechaObjetivo.getTime() - Date.now();
  const totalSegundos = Math.max(0, Math.floor(diferenciaMs / 1000));
  const totalMinutos = Math.floor(totalSegundos / 60);
  const dias = Math.floor(totalMinutos / (60 * 24));
  const horas = Math.floor((totalMinutos % (60 * 24)) / 60);
  const minutos = totalMinutos % 60;
  const segundos = totalSegundos % 60;

  return {
    ...corteActual,
    dias,
    horas,
    minutos,
    segundos,
    totalMinutos,
    vencido: totalSegundos <= 0,
  };
}

function Modal({ isOpen, onClose, title, children }: PropsModal) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-200 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-modal-metricas"
      onClick={onClose}
      onKeyDown={(evento) => evento.key === 'Escape' && onClose()}
    >
      <div
        className="bg-white rounded-3xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl"
        onClick={(evento) => evento.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 id="titulo-modal-metricas" className="text-lg font-black text-slate-900 uppercase">
            {title}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="p-2 rounded-full hover:bg-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto">{children}</div>
      </div>
    </div>
  );
}

function StatCard({ title, value, subtitle, color, icon, onClick }: PropsStatCard) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bg-white rounded-2xl p-5 border border-slate-100 shadow-sm flex flex-col items-center text-center gap-3 hover:border-pink-300 hover:shadow-md transition-all cursor-pointer w-full"
    >
      <div
        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-white ${color}`}
      >
        {icon}
      </div>
      <div className="min-w-0 w-full">
        <p className="text-sm font-bold text-slate-400 uppercase tracking-wider">{title}</p>
        <p className="text-2xl font-black text-center text-slate-900">{value}</p>
        <p className="mt-1 text-xs font-medium text-slate-500">{subtitle}</p>
      </div>
    </button>
  );
}

function descargarExcel(
  nombreArchivo: string,
  nombreHoja: string,
  filas: Record<string, unknown>[],
) {
  const hoja = XLSX.utils.json_to_sheet(filas);
  const libro = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(libro, hoja, nombreHoja);
  XLSX.writeFile(libro, nombreArchivo);
}

function ModalCitasHoy({
  abierta,
  onCerrar,
  citas,
  moneda,
  nombreSalon,
}: {
  abierta: boolean;
  onCerrar: () => void;
  citas: CitaDashboardSalon[];
  moneda: string;
  nombreSalon: string;
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [estadoFiltro, setEstadoFiltro] = useState('todos');
  const [paginaActual, setPaginaActual] = useState(1);
  const [campoOrden, setCampoOrden] = useState<CampoOrdenCitas>('hora');
  const [direccionOrden, setDireccionOrden] = useState<DireccionOrden>('asc');
  const searchTermDeferred = useDeferredValue(searchTerm);

  const filteredCitas = useMemo(() => {
    const filtradas = filtrarCitasDashboard(citas, searchTermDeferred, estadoFiltro);

    return [...filtradas].sort((citaA, citaB) => {
      switch (campoOrden) {
        case 'cliente':
          return compararTexto(citaA.cliente, citaB.cliente, direccionOrden);
        case 'servicio':
          return compararTexto(citaA.servicioPrincipal, citaB.servicioPrincipal, direccionOrden);
        case 'empleado':
          return compararTexto(citaA.especialista, citaB.especialista, direccionOrden);
        case 'precio':
          return compararNumero(citaA.precioEstimado, citaB.precioEstimado, direccionOrden);
        case 'estado':
          return compararTexto(
            obtenerEtiquetaEstadoReserva(citaA.estado),
            obtenerEtiquetaEstadoReserva(citaB.estado),
            direccionOrden,
          );
        case 'hora':
        default:
          return compararTexto(citaA.hora, citaB.hora, direccionOrden);
      }
    });
  }, [campoOrden, citas, direccionOrden, estadoFiltro, searchTermDeferred]);

  const totalPaginas = Math.max(1, Math.ceil(filteredCitas.length / TAMANO_PAGINA));
  const citasPaginadas = filteredCitas.slice(
    (paginaActual - 1) * TAMANO_PAGINA,
    paginaActual * TAMANO_PAGINA,
  );

  const alternarOrden = (campo: CampoOrdenCitas) => {
    setPaginaActual(1);
    if (campoOrden === campo) {
      setDireccionOrden((valorActual) => (valorActual === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setCampoOrden(campo);
    setDireccionOrden('asc');
  };

  return (
    <Modal isOpen={abierta} onClose={onCerrar} title="CITAS AGENDADAS HOY">
      {/* Filtros */}
      <div className="px-6 py-4 border-b border-slate-100 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar por cliente, empleado o servicio..."
            value={searchTerm}
            onChange={(evento) => setSearchTerm(evento.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-pink-500 outline-none"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-black text-slate-400 uppercase self-center mr-1">
            Estado:
          </span>
          {ESTADO_CITAS.map((estado) => (
            <button
              key={estado.valor}
              type="button"
              onClick={() => {
                setEstadoFiltro(estado.valor);
                setPaginaActual(1);
              }}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                estadoFiltro === estado.valor
                  ? 'bg-pink-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {estado.etiqueta}
            </button>
          ))}
          {filteredCitas.length > 0 ? (
            <span className="ml-auto text-sm font-black text-pink-600">
              {filteredCitas.length} citas
            </span>
          ) : null}
        </div>
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                <BotonOrdenTabla
                  etiqueta="Cliente"
                  activo={campoOrden === 'cliente'}
                  direccion={direccionOrden}
                  onClick={() => alternarOrden('cliente')}
                />
              </th>
              <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                <BotonOrdenTabla
                  etiqueta="Servicio"
                  activo={campoOrden === 'servicio'}
                  direccion={direccionOrden}
                  onClick={() => alternarOrden('servicio')}
                />
              </th>
              <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                <BotonOrdenTabla
                  etiqueta="Empleado"
                  activo={campoOrden === 'empleado'}
                  direccion={direccionOrden}
                  onClick={() => alternarOrden('empleado')}
                />
              </th>
              <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                <BotonOrdenTabla
                  etiqueta="Hora"
                  activo={campoOrden === 'hora'}
                  direccion={direccionOrden}
                  onClick={() => alternarOrden('hora')}
                />
              </th>
              <th className="text-right py-3 px-2 text-xs font-black text-slate-400 uppercase">
                <BotonOrdenTabla
                  etiqueta="Precio Est."
                  activo={campoOrden === 'precio'}
                  direccion={direccionOrden}
                  alineacion="right"
                  onClick={() => alternarOrden('precio')}
                />
              </th>
              <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                <BotonOrdenTabla
                  etiqueta="Estado"
                  activo={campoOrden === 'estado'}
                  direccion={direccionOrden}
                  onClick={() => alternarOrden('estado')}
                />
              </th>
            </tr>
          </thead>
          <tbody>
            {citasPaginadas.map((cita) => (
              <tr key={cita.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="py-3 px-2">
                  <div className="font-bold text-slate-900">{cita.cliente}</div>
                  <div className="text-xs text-slate-400">{cita.telefonoCliente}</div>
                </td>
                <td className="py-3 px-2 font-medium text-slate-700">{cita.servicioPrincipal}</td>
                <td className="py-3 px-2">
                  <div className="flex items-center gap-2">
                    <div className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-[10px] font-black text-blue-600">
                      {cita.especialista[0]}
                    </div>
                    <span className="text-slate-700">{cita.especialista}</span>
                  </div>
                </td>
                <td className="py-3 px-2 font-semibold text-indigo-600">
                  {cita.hora} - {cita.horaFin}
                </td>
                <td className="py-3 px-2 text-right font-mono text-emerald-600">
                  {formatearDinero(cita.precioEstimado, moneda)}
                </td>
                <td className="py-3 px-2">
                  <span
                    className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${obtenerClaseEstadoReserva(cita.estado)}`}
                  >
                    {obtenerEtiquetaEstadoReserva(cita.estado)}
                  </span>
                </td>
              </tr>
            ))}
            {filteredCitas.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">
                  No hay citas para los filtros actuales
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Pie con exportar */}
      <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-bold text-slate-500">
          {filteredCitas.length} citas filtradas de {citas.length} totales - Pagina {paginaActual}{' '}
          de {totalPaginas}
        </p>
        <div className="flex items-center gap-2">
          <PaginadorTabla
            total={filteredCitas.length}
            pagina={paginaActual}
            onCambiarPagina={setPaginaActual}
          />
          <button
            type="button"
            onClick={() =>
              descargarExcel(
                `citas_de_hoy_${normalizarNombreArchivo(nombreSalon)}.xlsx`,
                'Citas hoy',
                filteredCitas.map((cita) => ({
                  Cliente: cita.cliente,
                  Telefono: cita.telefonoCliente,
                  Servicio: cita.servicios.join(', '),
                  Empleado: cita.especialista,
                  Hora: `${cita.hora} - ${cita.horaFin}`,
                  Estado: obtenerEtiquetaEstadoReserva(cita.estado),
                  Precio: formatearDinero(cita.precioEstimado, moneda),
                })),
              )
            }
            className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
          >
            <Download className="w-3.5 h-3.5" /> Exportar Excel
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ModalGanancias({
  abierta,
  onCerrar,
  data,
  nombreSalon,
}: {
  abierta: boolean;
  onCerrar: () => void;
  data: MetricasDashboardSalon;
  nombreSalon: string;
}) {
  const [financeTab, setFinanceTab] = useState<PestanaFinanciera>('mes');
  const [searchTerm, setSearchTerm] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'servicio' | 'producto'>('todos');
  const [especialistaFiltro, setEspecialistaFiltro] = useState('todos');
  const [paginaActual, setPaginaActual] = useState(1);
  const [campoOrden, setCampoOrden] = useState<CampoOrdenIngresos>('fecha');
  const [direccionOrden, setDireccionOrden] = useState<DireccionOrden>('desc');

  const searchDeferred = useDeferredValue(searchTerm);
  const filasBase = data.ingresos[financeTab].filas;
  const especialistasFiltro = useMemo(() => {
    const unicos = Array.from(
      new Set(
        filasBase
          .map((fila) => fila.especialista)
          .filter((valor): valor is string => Boolean(valor && valor.trim().length > 0)),
      ),
    );

    return unicos.sort((a, b) => a.localeCompare(b, 'es'));
  }, [filasBase]);

  const filasFiltradas = filtrarIngresosDashboard(filasBase, searchDeferred, tipoFiltro).filter(
    (fila) => especialistaFiltro === 'todos' || fila.especialista === especialistaFiltro,
  );

  const filasOrdenadas = useMemo(() => {
    return [...filasFiltradas].sort((filaA, filaB) => {
      switch (campoOrden) {
        case 'concepto':
          return compararTexto(filaA.concepto, filaB.concepto, direccionOrden);
        case 'tipo':
          return compararTexto(filaA.tipo, filaB.tipo, direccionOrden);
        case 'responsable':
          return compararTexto(filaA.especialista || '', filaB.especialista || '', direccionOrden);
        case 'cliente':
          return compararTexto(filaA.cliente || '', filaB.cliente || '', direccionOrden);
        case 'monto':
          return compararNumero(filaA.total, filaB.total, direccionOrden);
        case 'fecha':
        default:
          return compararTexto(
            `${filaA.fecha} ${filaA.hora}`,
            `${filaB.fecha} ${filaB.hora}`,
            direccionOrden,
          );
      }
    });
  }, [campoOrden, direccionOrden, filasFiltradas]);

  const filasConAcumulado = construirFilasAcumuladas(filasOrdenadas);
  const totalServicios = filasFiltradas
    .filter((fila) => fila.tipo === 'servicio')
    .reduce((acumulado, fila) => acumulado + fila.total, 0);
  const totalProductos = filasFiltradas
    .filter((fila) => fila.tipo === 'producto')
    .reduce((acumulado, fila) => acumulado + fila.total, 0);
  const totalNeto = filasFiltradas.reduce((acumulado, fila) => acumulado + fila.total, 0);
  const esPlanPro = data.plan.actual === 'PRO';
  const totalPaginas = Math.max(1, Math.ceil(filasConAcumulado.length / TAMANO_PAGINA));
  const filasPaginadas = filasConAcumulado.slice(
    (paginaActual - 1) * TAMANO_PAGINA,
    paginaActual * TAMANO_PAGINA,
  );

  const alternarOrden = (campo: CampoOrdenIngresos) => {
    setPaginaActual(1);
    if (campoOrden === campo) {
      setDireccionOrden((valorActual) => (valorActual === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setCampoOrden(campo);
    setDireccionOrden(campo === 'fecha' ? 'desc' : 'asc');
  };

  return (
    <Modal isOpen={abierta} onClose={onCerrar} title="INGRESOS DEL SALON">
      <div className="px-6 pt-4 pb-2 border-b border-slate-100">
        <div className="flex gap-1">
          {(['dia', 'semana', 'mes'] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setFinanceTab(tab);
                setPaginaActual(1);
              }}
              className={`px-5 py-2 rounded-t-lg text-xs font-bold uppercase transition-all ${
                financeTab === tab
                  ? 'bg-pink-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab === 'dia' ? 'Hoy' : tab}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-5">
        <div
          className={`mb-8 grid grid-cols-1 gap-4 ${esPlanPro ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}
        >
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
            <p className="mb-1 text-[10px] font-bold uppercase text-emerald-600">Total Servicios</p>
            <h5 className="text-2xl font-black text-emerald-700">
              {formatearDinero(totalServicios, data.plan.moneda)}
            </h5>
          </div>

          {esPlanPro ? (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="mb-1 text-[10px] font-bold uppercase text-blue-600">Venta Productos</p>
              <h5 className="text-2xl font-black text-blue-700">
                {formatearDinero(totalProductos, data.plan.moneda)}
              </h5>
            </div>
          ) : null}

          <div className="flex items-center justify-between rounded-2xl bg-slate-900 p-4 text-white">
            <div>
              <p className="mb-1 text-[10px] font-bold uppercase text-slate-400">Total Neto</p>
              <h5 className="text-2xl font-black text-white">
                {formatearDinero(totalNeto, data.plan.moneda)}
              </h5>
            </div>
            <Download className="opacity-20" size={24} />
          </div>
        </div>

        <div className="mb-4 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar concepto, responsable o cliente..."
              value={searchTerm}
              onChange={(evento) => {
                setSearchTerm(evento.target.value);
                setPaginaActual(1);
              }}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-pink-500 outline-none"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black text-slate-400 uppercase self-center mr-1">
              Tipo:
            </span>
            {(['todos', 'servicio', 'producto'] as const).map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() => {
                  setTipoFiltro(tipo);
                  setPaginaActual(1);
                }}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  tipoFiltro === tipo
                    ? 'bg-pink-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tipo === 'todos' ? 'Todos' : tipo === 'servicio' ? 'Servicio' : 'Producto'}
              </button>
            ))}

            <span className="text-xs font-black text-slate-400 uppercase self-center ml-3 mr-1">
              Responsable:
            </span>
            <select
              value={especialistaFiltro}
              onChange={(evento) => {
                setEspecialistaFiltro(evento.target.value);
                setPaginaActual(1);
              }}
              className="px-3 py-1 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-pink-500 outline-none"
            >
              <option value="todos">Todos</option>
              {especialistasFiltro.map((especialista) => (
                <option key={especialista} value={especialista}>
                  {especialista}
                </option>
              ))}
            </select>

            {filasConAcumulado.length > 0 ? (
              <span className="ml-auto text-sm font-black text-pink-600">
                {filasConAcumulado.length} movimientos
              </span>
            ) : null}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-190 text-sm">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                  <BotonOrdenTabla
                    etiqueta="Fecha / Hora"
                    activo={campoOrden === 'fecha'}
                    direccion={direccionOrden}
                    onClick={() => alternarOrden('fecha')}
                  />
                </th>
                <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                  <BotonOrdenTabla
                    etiqueta="Concepto"
                    activo={campoOrden === 'concepto'}
                    direccion={direccionOrden}
                    onClick={() => alternarOrden('concepto')}
                  />
                </th>
                <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                  <BotonOrdenTabla
                    etiqueta="Tipo"
                    activo={campoOrden === 'tipo'}
                    direccion={direccionOrden}
                    onClick={() => alternarOrden('tipo')}
                  />
                </th>
                <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                  <BotonOrdenTabla
                    etiqueta="Responsable"
                    activo={campoOrden === 'responsable'}
                    direccion={direccionOrden}
                    onClick={() => alternarOrden('responsable')}
                  />
                </th>
                <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                  <BotonOrdenTabla
                    etiqueta="Cliente"
                    activo={campoOrden === 'cliente'}
                    direccion={direccionOrden}
                    onClick={() => alternarOrden('cliente')}
                  />
                </th>
                <th className="text-right py-3 px-2 text-xs font-black text-slate-400 uppercase">
                  <BotonOrdenTabla
                    etiqueta="Monto"
                    activo={campoOrden === 'monto'}
                    direccion={direccionOrden}
                    alineacion="right"
                    onClick={() => alternarOrden('monto')}
                  />
                </th>
                <th className="text-right py-3 px-2 text-xs font-black text-slate-400 uppercase">
                  Acumulado
                </th>
              </tr>
            </thead>
            <tbody>
              {filasPaginadas.map((fila) => (
                <tr key={fila.id} className="border-b border-slate-50 hover:bg-slate-50">
                  <td className="py-3 px-2 text-xs font-medium text-slate-500">
                    {formatearFechaHumana(fila.fecha)}
                    <br />
                    <span className="opacity-70">{fila.hora}</span>
                  </td>
                  <td className="py-3 px-2 font-bold text-slate-900">{fila.concepto}</td>
                  <td className="py-3 px-2">
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-black uppercase ${fila.tipo === 'servicio' ? 'bg-indigo-100 text-indigo-700' : 'bg-rose-100 text-rose-700'}`}
                    >
                      {fila.tipo === 'servicio' ? 'Servicio' : 'Producto'}
                    </span>
                  </td>
                  <td className="py-3 px-2 text-slate-600">{fila.especialista || 'Sistema'}</td>
                  <td className="py-3 px-2 text-slate-600">{fila.cliente || 'N/A'}</td>
                  <td className="py-3 px-2 text-right font-mono font-bold text-emerald-600">
                    +{formatearDinero(fila.total, data.plan.moneda)}
                  </td>
                  <td className="py-3 px-2 text-right font-mono font-bold text-slate-900">
                    {formatearDinero(fila.acumulado, data.plan.moneda)}
                  </td>
                </tr>
              ))}
              {filasConAcumulado.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-400 font-bold">
                    No hay movimientos para este periodo
                  </td>
                </tr>
              ) : null}
            </tbody>
            {filasConAcumulado.length > 0 ? (
              <tfoot>
                <tr className="border-t border-slate-200">
                  <td className="py-3 px-2 text-xs font-black uppercase text-slate-500" colSpan={6}>
                    Total acumulado del periodo filtrado
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-sm font-black text-slate-900">
                    {formatearDinero(totalNeto, data.plan.moneda)}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-bold text-slate-500">
          {filasConAcumulado.length} registros - {obtenerEtiquetaPeriodoFinanciero(financeTab)} -
          Pagina {paginaActual} de {totalPaginas}
        </p>
        <div className="flex items-center gap-2">
          <PaginadorTabla
            total={filasConAcumulado.length}
            pagina={paginaActual}
            onCambiarPagina={setPaginaActual}
          />
          <button
            type="button"
            onClick={() =>
              descargarExcel(
                `balance_${obtenerSegmentoPeriodoFinancieroArchivo(financeTab)}_${normalizarNombreArchivo(nombreSalon)}.xlsx`,
                `Balance ${obtenerEtiquetaPeriodoFinanciero(financeTab)}`,
                filasConAcumulado.map((fila) => ({
                  Fecha: formatearFechaHumana(fila.fecha),
                  Hora: fila.hora,
                  Concepto: fila.concepto,
                  Tipo: fila.tipo,
                  Responsable: fila.especialista,
                  Cliente: fila.cliente,
                  Monto: formatearDinero(fila.total, data.plan.moneda),
                  Acumulado: formatearDinero(fila.acumulado, data.plan.moneda),
                })),
              )
            }
            className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
          >
            <Download className="w-3.5 h-3.5" /> Exportar Excel
          </button>
        </div>
      </div>
    </Modal>
  );
}

function ModalEspecialistas({
  abierta,
  onCerrar,
  especialistas,
}: {
  abierta: boolean;
  onCerrar: () => void;
  especialistas: MetricasDashboardSalon['especialistasActivos'];
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [campoOrden, setCampoOrden] = useState<CampoOrdenEspecialistas>('nombre');
  const [direccionOrden, setDireccionOrden] = useState<DireccionOrden>('asc');
  const searchDeferred = useDeferredValue(searchTerm);
  const filtrados = useMemo(() => {
    const base = filtrarEspecialistasDashboard(especialistas, searchDeferred);

    return [...base].sort((especialistaA, especialistaB) => {
      switch (campoOrden) {
        case 'servicios':
          return compararTexto(
            especialistaA.servicios.join(', '),
            especialistaB.servicios.join(', '),
            direccionOrden,
          );
        case 'jornada':
          return compararTexto(especialistaA.jornada, especialistaB.jornada, direccionOrden);
        case 'descanso':
          return compararTexto(especialistaA.descanso, especialistaB.descanso, direccionOrden);
        case 'citasHoy':
          return compararNumero(especialistaA.citasHoy, especialistaB.citasHoy, direccionOrden);
        case 'nombre':
        default:
          return compararTexto(especialistaA.nombre, especialistaB.nombre, direccionOrden);
      }
    });
  }, [campoOrden, direccionOrden, especialistas, searchDeferred]);

  const alternarOrden = (campo: CampoOrdenEspecialistas) => {
    if (campoOrden === campo) {
      setDireccionOrden((valorActual) => (valorActual === 'asc' ? 'desc' : 'asc'));
      return;
    }

    setCampoOrden(campo);
    setDireccionOrden('asc');
  };

  return (
    <Modal isOpen={abierta} onClose={onCerrar} title="Especialistas Activos">
      {/* Filtros */}
      <div className="px-6 py-4 border-b border-slate-100">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Buscar especialista por nombre o servicio..."
            value={searchTerm}
            onChange={(evento) => setSearchTerm(evento.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:ring-2 focus:ring-pink-500 outline-none"
          />
        </div>
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-auto px-6 py-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                <BotonOrdenTabla
                  etiqueta="Especialista"
                  activo={campoOrden === 'nombre'}
                  direccion={direccionOrden}
                  onClick={() => alternarOrden('nombre')}
                />
              </th>
              <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                <BotonOrdenTabla
                  etiqueta="Servicios"
                  activo={campoOrden === 'servicios'}
                  direccion={direccionOrden}
                  onClick={() => alternarOrden('servicios')}
                />
              </th>
              <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                <BotonOrdenTabla
                  etiqueta="Jornada"
                  activo={campoOrden === 'jornada'}
                  direccion={direccionOrden}
                  onClick={() => alternarOrden('jornada')}
                />
              </th>
              <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                <BotonOrdenTabla
                  etiqueta="Almuerzo"
                  activo={campoOrden === 'descanso'}
                  direccion={direccionOrden}
                  onClick={() => alternarOrden('descanso')}
                />
              </th>
              <th className="text-right py-3 px-2 text-xs font-black text-slate-400 uppercase">
                <BotonOrdenTabla
                  etiqueta="Citas hoy"
                  activo={campoOrden === 'citasHoy'}
                  direccion={direccionOrden}
                  alineacion="right"
                  onClick={() => alternarOrden('citasHoy')}
                />
              </th>
              <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((especialista) => (
              <tr key={especialista.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="py-3 px-2 font-bold text-slate-900">{especialista.nombre}</td>
                <td className="py-3 px-2 text-slate-600">{especialista.servicios.join(', ')}</td>
                <td className="py-3 px-2 text-slate-700">{especialista.jornada}</td>
                <td className="py-3 px-2 text-slate-600">
                  {especialista.descanso || 'Sin pausa definida'}
                </td>
                <td className="py-3 px-2 text-right font-bold text-indigo-600">
                  {especialista.citasHoy}
                </td>
                <td className="py-3 px-2">
                  <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-100 text-emerald-700">
                    <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Activo
                  </span>
                </td>
              </tr>
            ))}
            {filtrados.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-slate-400 font-bold">
                  No se encontraron especialistas
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {/* Pie con exportar */}
      <div className="flex flex-col gap-3 border-t border-slate-200 px-6 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs font-bold text-slate-500">{filtrados.length} especialistas activos</p>
        <button
          type="button"
          onClick={() =>
            descargarExcel(
              'especialistas-activos.xlsx',
              'Especialistas',
              filtrados.map((especialista) => ({
                Nombre: especialista.nombre,
                Servicios: especialista.servicios.join(', '),
                Jornada: especialista.jornada,
                Almuerzo: especialista.descanso || 'Sin pausa definida',
                CitasHoy: especialista.citasHoy,
              })),
            )
          }
          className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700"
        >
          <Download className="w-3.5 h-3.5" /> Exportar Excel
        </button>
      </div>
    </Modal>
  );
}

function ModalPlanActual({
  abierta,
  onCerrar,
  data,
}: {
  abierta: boolean;
  onCerrar: () => void;
  data: MetricasDashboardSalon;
}) {
  return (
    <Modal isOpen={abierta} onClose={onCerrar} title="Configuracion de Membresia">
      <div className="px-6 py-8 text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 text-indigo-600">
          <Star size={40} fill="currentColor" />
        </div>

        <h4 className="mb-2 text-2xl font-black text-slate-900">
          Tu Plan es: <span className="text-indigo-600">{data.plan.nombre}</span>
        </h4>
        <p className="mx-auto mb-8 max-w-sm text-sm text-slate-500">
          Disfrutas de funciones avanzadas de gestion, control financiero y seguimiento operativo.
        </p>

        <div className="mx-auto mb-10 grid max-w-lg grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase text-slate-400">Suscrito el</p>
            <p className="mt-1 font-bold text-slate-900">
              {formatearFechaHumana(data.plan.fechaAdquisicion)}
            </p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase text-slate-400">Proximo cobro</p>
            <p className="mt-1 font-bold text-slate-900">
              {formatearFechaHumana(data.plan.proximoCorte)}
            </p>
          </div>
        </div>

        <a
          href={data.plan.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="mx-auto flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-8 py-4 font-bold text-white transition-all hover:bg-emerald-600 sm:w-auto"
        >
          <Smartphone size={20} /> Hablar con Soporte{' '}
          {data.plan.pais === 'Colombia' ? 'Colombia' : 'Mexico'}
        </a>
      </div>
    </Modal>
  );
}

function ModalCuentaRegresiva({
  abierta,
  onCerrar,
  data,
}: {
  abierta: boolean;
  onCerrar: () => void;
  data: MetricasDashboardSalon;
}) {
  const [tiempoRestante, setTiempoRestante] = useState(() =>
    calcularTiempoRestante(data.corte.fechaHoraObjetivo, data.corte),
  );

  useEffect(() => {
    if (!abierta) {
      return;
    }

    setTiempoRestante(calcularTiempoRestante(data.corte.fechaHoraObjetivo, data.corte));

    const intervalo = window.setInterval(() => {
      setTiempoRestante(calcularTiempoRestante(data.corte.fechaHoraObjetivo, data.corte));
    }, 1000);

    return () => window.clearInterval(intervalo);
  }, [abierta, data.corte.fechaHoraObjetivo]);

  const estaCercaCorte = tiempoRestante.dias <= 10;

  return (
    <Modal isOpen={abierta} onClose={onCerrar} title="DIAS RESTANTES DE SUSCRIPCION">
      <div className="px-6 py-10 text-center">
        <p className="mb-6 text-sm font-bold text-slate-500">Tiempo restante para renovacion:</p>
        <div className="mb-10 flex justify-center gap-4">
          <div className="flex flex-col">
            <span className="text-5xl font-black text-slate-900">{tiempoRestante.dias}</span>
            <span className="text-[10px] font-bold uppercase text-slate-400">Dias</span>
          </div>
          <span className="text-5xl font-light text-slate-300">:</span>
          <div className="flex flex-col">
            <span className="text-5xl font-black text-slate-900">
              {tiempoRestante.horas < 10 ? `0${tiempoRestante.horas}` : tiempoRestante.horas}
            </span>
            <span className="text-[10px] font-bold uppercase text-slate-400">Horas</span>
          </div>
          <span className="text-5xl font-light text-slate-300">:</span>
          <div className="flex flex-col">
            <span className="text-5xl font-black text-slate-900">
              {tiempoRestante.minutos < 10 ? `0${tiempoRestante.minutos}` : tiempoRestante.minutos}
            </span>
            <span className="text-[10px] font-bold uppercase text-slate-400">Min</span>
          </div>
          <span className="text-5xl font-light text-slate-300">:</span>
          <div className="flex flex-col">
            <span className="text-5xl font-black text-slate-900">
              {tiempoRestante.segundos < 10
                ? `0${tiempoRestante.segundos}`
                : tiempoRestante.segundos}
            </span>
            <span className="text-[10px] font-bold uppercase text-slate-400">Seg</span>
          </div>
        </div>

        <div
          className={`mx-auto max-w-md rounded-2xl p-6 ${
            estaCercaCorte
              ? 'border border-amber-100 bg-amber-50'
              : 'border border-slate-200 bg-slate-50'
          }`}
        >
          <div className="flex items-start gap-4 text-left">
            <div
              className={`rounded-lg p-2 ${
                estaCercaCorte ? 'bg-amber-100 text-amber-600' : 'bg-slate-200 text-slate-600'
              }`}
            >
              <Bell size={20} />
            </div>
            <div>
              <p
                className={`mb-1 text-sm font-bold ${
                  estaCercaCorte ? 'text-amber-800' : 'text-slate-700'
                }`}
              >
                Recordatorio del Sistema
              </p>
              <p
                className={`text-xs leading-relaxed ${estaCercaCorte ? 'text-amber-700' : 'text-slate-600'}`}
              >
                Te avisaremos automaticamente cuando falten 10 dias para el corte.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function MetricasSalon({
  estudioId,
  nombreSalon,
  saludo,
  nombreSaludo,
  fechaEtiqueta,
}: PropsMetricasSalon) {
  const [activeModal, setActiveModal] = useState<ModalActiva>(null);

  const consultaMetricas = useQuery({
    queryKey: ['estudio', estudioId, 'metricas-dashboard'],
    queryFn: () => obtenerMetricasDashboard(estudioId),
    enabled: Boolean(estudioId),
    staleTime: 30_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });

  const data = consultaMetricas.data;

  return (
    <section>
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:px-6 sm:py-5">
        <p className="text-sm font-semibold text-slate-600">
          {saludo}, {nombreSaludo}
        </p>
        <h1 className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">
          Panel de metricas del salon
        </h1>
        <p className="mt-2 text-sm text-slate-500">{fechaEtiqueta}</p>
      </div>

      <div className="mb-6 flex items-center gap-2">
        <Zap className="text-amber-500 fill-amber-500" size={20} />
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-800">
          Dashboard Operativo
        </h2>
      </div>

      {consultaMetricas.isLoading ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, indice) => (
            <EsqueletoTarjeta key={indice} className="h-36 rounded-2xl" />
          ))}
        </div>
      ) : consultaMetricas.isError || !data ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-4 text-sm font-semibold text-red-700">
          No se pudieron cargar las metricas del salon.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
            <StatCard
              title="CITAS AGENDADAS HOY"
              value={data.resumen.citasAgendadasHoy}
              icon={<Calendar size={20} />}
              color="bg-blue-600"
              onClick={() => setActiveModal('citas')}
              subtitle="Agendamientos del dia"
            />
            <StatCard
              title="INGRESOS DEL SALON"
              value={formatearDinero(data.ingresos.mes.total, data.plan.moneda)}
              icon={<DollarSign size={20} />}
              color="bg-emerald-600"
              onClick={() => setActiveModal('ganancias')}
              subtitle={
                <span className="block space-y-0.5 text-[11px] font-semibold text-slate-500">
                  <span className="block">
                    Hoy: {formatearDinero(data.ingresos.dia.total, data.plan.moneda)}
                  </span>
                  <span className="block">
                    Semana: {formatearDinero(data.ingresos.semana.total, data.plan.moneda)}
                  </span>
                  <span className="block">
                    Mes: {formatearDinero(data.ingresos.mes.total, data.plan.moneda)}
                  </span>
                </span>
              }
            />
            <StatCard
              title="ESPECIALISTAS"
              value={data.resumen.especialistasActivos}
              icon={<Users size={20} />}
              color="bg-purple-600"
              onClick={() => setActiveModal('especialistas')}
              subtitle="Staff activo ahora"
            />
            <StatCard
              title="PLAN ACTUAL"
              value={data.plan.nombre}
              icon={<CreditCard size={20} />}
              color="bg-orange-600"
              onClick={() => setActiveModal('plan')}
              subtitle={data.plan.actual === 'PRO' ? 'Beneficios Pro Activos' : 'Standard'}
            />
            <StatCard
              title="DIAS RESTANTES DE SUSCRIPCION"
              value={data.corte.dias}
              icon={<Clock size={20} />}
              color="bg-rose-600"
              onClick={() => setActiveModal('corte')}
              subtitle="Dias restantes"
            />
          </div>

          <ModalCitasHoy
            abierta={activeModal === 'citas'}
            onCerrar={() => setActiveModal(null)}
            citas={data.citasHoy}
            moneda={data.plan.moneda}
            nombreSalon={nombreSalon}
          />

          <ModalGanancias
            abierta={activeModal === 'ganancias'}
            onCerrar={() => setActiveModal(null)}
            data={data}
            nombreSalon={nombreSalon}
          />

          <ModalEspecialistas
            abierta={activeModal === 'especialistas'}
            onCerrar={() => setActiveModal(null)}
            especialistas={data.especialistasActivos}
          />

          <ModalPlanActual
            abierta={activeModal === 'plan'}
            onCerrar={() => setActiveModal(null)}
            data={data}
          />

          <ModalCuentaRegresiva
            abierta={activeModal === 'corte'}
            onCerrar={() => setActiveModal(null)}
            data={data}
          />
        </>
      )}
    </section>
  );
}
