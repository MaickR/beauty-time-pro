import { useState, useRef, useEffect, useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, Bell, DollarSign, ShieldAlert } from 'lucide-react';
import { peticion } from '../../../lib/clienteHTTP';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { Tooltip } from '../../../componentes/ui/Tooltip';
import {
  formatearDinero,
  formatearPais,
  formatearPlan,
  obtenerEstadoSuscripcion,
  obtenerMonedaPorPais,
  formatearFechaHumana,
} from '../../../utils/formato';
import type { Estudio, EstadoSuscripcion } from '../../../tipos';

const REGISTROS_POR_PAGINA = 10;
const RETRASO_BUSQUEDA = 300;
const UMBRAL_RECORDATORIO = 10;

const PAISES_FILTRO = ['Todos', 'Mexico', 'Colombia'] as const;
const FILTROS_COBRO = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'pendientes_pago', etiqueta: 'Pendientes de pago' },
] as const;

interface PropsPanelFinanciero {
  estudios: Estudio[];
  onAbrirPago: (estudio: Estudio) => void;
  onRecargar: () => void;
}

export function PanelFinanciero({ estudios, onAbrirPago, onRecargar }: PropsPanelFinanciero) {
  const { mostrarToast } = usarToast();
  const clienteConsulta = useQueryClient();
  const [busqueda, setBusqueda] = useState('');
  const [busquedaAplicada, setBusquedaAplicada] = useState('');
  const [filtroPais, setFiltroPais] = useState<string>('Todos');
  const [filtroCobro, setFiltroCobro] = useState<(typeof FILTROS_COBRO)[number]['valor']>('todos');
  const [pagina, setPagina] = useState(1);
  const temporizadorRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    clearTimeout(temporizadorRef.current);
    temporizadorRef.current = setTimeout(() => {
      setBusquedaAplicada(busqueda);
      setPagina(1);
    }, RETRASO_BUSQUEDA);
    return () => clearTimeout(temporizadorRef.current);
  }, [busqueda]);

  const cambiarPais = (pais: string) => {
    setFiltroPais(pais);
    setPagina(1);
  };

  const cambiarFiltroCobro = (valor: (typeof FILTROS_COBRO)[number]['valor']) => {
    setFiltroCobro(valor);
    setPagina(1);
  };

  const refrescarDatos = () => {
    onRecargar();
    void clienteConsulta.invalidateQueries({ queryKey: ['admin'] });
  };

  const mutacionRecordatorio = useMutation({
    mutationFn: (estudioId: string) =>
      peticion<{ datos: { mensaje: string } }>(`/admin/salones/${estudioId}/recordatorio`, {
        method: 'POST',
      }),
    onSuccess: (res) => mostrarToast({ mensaje: res.datos.mensaje, variante: 'exito' }),
    onError: (err: Error) => mostrarToast({ mensaje: err.message, variante: 'error' }),
  });

  const mutacionSuspension = useMutation({
    mutationFn: (estudioId: string) =>
      peticion<{ datos: { mensaje: string } }>(`/admin/salones/${estudioId}/aviso-suspension`, {
        method: 'POST',
      }),
    onSuccess: (res) => {
      mostrarToast({ mensaje: res.datos.mensaje, variante: 'exito' });
      refrescarDatos();
    },
    onError: (err: Error) => mostrarToast({ mensaje: err.message, variante: 'error' }),
  });

  const { filtrados, totalPaginas, paginados } = useMemo(() => {
    let resultado = [...estudios];
    if (filtroPais !== 'Todos') resultado = resultado.filter((e) => e.country === filtroPais);
    if (filtroCobro === 'pendientes_pago') {
      resultado = resultado.filter((estudio) => {
        const sub = obtenerEstadoSuscripcion(estudio);
        return Boolean(sub && sub.daysRemaining < 0);
      });
    }
    if (busquedaAplicada) {
      const termino = busquedaAplicada.toLowerCase();
      resultado = resultado.filter((e) => e.name.toLowerCase().includes(termino));
    }
    resultado.sort((a, b) => {
      const fA = a.paidUntil || a.subscriptionStart || '9999-12-31';
      const fB = b.paidUntil || b.subscriptionStart || '9999-12-31';
      return fA.localeCompare(fB);
    });
    const total = Math.ceil(resultado.length / REGISTROS_POR_PAGINA) || 1;
    const inicio = (pagina - 1) * REGISTROS_POR_PAGINA;
    return {
      filtrados: resultado,
      totalPaginas: total,
      paginados: resultado.slice(inicio, inicio + REGISTROS_POR_PAGINA),
    };
  }, [estudios, filtroCobro, filtroPais, busquedaAplicada, pagina]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por nombre de salón..."
            className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-pink-500/30 focus:border-pink-400"
          />
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          {PAISES_FILTRO.map((p) => (
            <button
              key={p}
              onClick={() => cambiarPais(p)}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${filtroPais === p ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {formatearPais(p)}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200">
          {FILTROS_COBRO.map((filtro) => (
            <button
              key={filtro.valor}
              onClick={() => cambiarFiltroCobro(filtro.valor)}
              className={`px-4 py-2 rounded-lg text-xs font-black uppercase transition-all ${filtroCobro === filtro.valor ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {filtro.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        <TarjetasMovil
          estudios={paginados}
          mutacionRecordatorio={mutacionRecordatorio}
          mutacionSuspension={mutacionSuspension}
          onAbrirPago={onAbrirPago}
        />
        <TablaEscritorio
          estudios={paginados}
          mutacionRecordatorio={mutacionRecordatorio}
          mutacionSuspension={mutacionSuspension}
          onAbrirPago={onAbrirPago}
        />
      </div>

      {totalPaginas > 1 && (
        <div className="flex items-center justify-between px-2">
          <p className="text-xs font-bold text-slate-500">
            {filtrados.length} salones — Página {pagina} de {totalPaginas}
          </p>
          <div className="flex gap-2">
            <button
              disabled={pagina <= 1}
              onClick={() => setPagina(pagina - 1)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-black disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              Anterior
            </button>
            <button
              disabled={pagina >= totalPaginas}
              onClick={() => setPagina(pagina + 1)}
              className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-black disabled:opacity-40 hover:bg-slate-50 transition-colors"
            >
              Siguiente
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Helpers de renderizado ─────────────────────────────────────────────── */

type MutacionAccion = ReturnType<typeof useMutation<{ datos: { mensaje: string } }, Error, string>>;

interface PropsSubTabla {
  estudios: Estudio[];
  mutacionRecordatorio: MutacionAccion;
  mutacionSuspension: MutacionAccion;
  onAbrirPago: (estudio: Estudio) => void;
}

function obtenerDatosEstudio(estudio: Estudio) {
  const sub = obtenerEstadoSuscripcion(estudio);
  const moneda = estudio.monedaSuscripcion ?? obtenerMonedaPorPais(estudio.country);
  const precioActual = estudio.precioSuscripcionActual ?? estudio.precioRenovacion ?? 0;
  const precioProximo = estudio.precioSuscripcionProximo ?? null;
  const fechaCambio = estudio.fechaAplicacionPrecioProximo ?? null;
  const tieneCambioProgramado = Boolean(
    precioProximo && fechaCambio && precioActual > 0 && precioProximo !== precioActual,
  );
  const puedeRecordar = sub ? sub.daysRemaining <= UMBRAL_RECORDATORIO : false;
  const estaSuspendido = estudio.estado === 'suspendido' || estudio.estado === 'bloqueado';
  return {
    sub,
    moneda,
    precioActual,
    precioProximo,
    fechaCambio,
    tieneCambioProgramado,
    puedeRecordar,
    estaSuspendido,
  };
}

function EtiquetaVigencia({ sub }: { sub: EstadoSuscripcion | null }) {
  if (!sub) return <span className="text-xs text-slate-400 italic">Sin suscripción</span>;
  const color =
    sub.daysRemaining < 0
      ? 'text-red-600'
      : sub.daysRemaining <= 5
        ? 'text-yellow-600'
        : 'text-green-600';
  const texto =
    sub.daysRemaining < 0
      ? `Vencido hace ${Math.abs(sub.daysRemaining)} día${Math.abs(sub.daysRemaining) !== 1 ? 's' : ''}`
      : `${sub.daysRemaining} día${sub.daysRemaining !== 1 ? 's' : ''} restantes`;
  return (
    <div>
      <p className={`text-sm font-black ${color}`}>{texto}</p>
      <p className="text-[10px] font-bold text-slate-500 mt-1">Corte: {sub.dueDateStr}</p>
    </div>
  );
}

function TarjetasMovil({
  estudios,
  mutacionRecordatorio,
  mutacionSuspension,
  onAbrirPago,
}: PropsSubTabla) {
  return (
    <div className="divide-y divide-slate-100 lg:hidden">
      {estudios.length === 0 && (
        <p className="py-10 text-center text-sm font-bold italic text-slate-400">
          No se encontraron salones.
        </p>
      )}
      {estudios.map((e) => {
        const {
          sub,
          moneda,
          precioActual,
          precioProximo,
          fechaCambio,
          tieneCambioProgramado,
          puedeRecordar,
          estaSuspendido,
        } = obtenerDatosEstudio(e);
        return (
          <div key={e.id} className="flex flex-col gap-3 px-5 py-5">
            <div>
              <p className="font-black uppercase text-slate-900">{e.name}</p>
              <p className="text-[10px] font-bold uppercase text-slate-500">
                {formatearPais(e.country)} · {moneda}
              </p>
            </div>
            <EtiquetaVigencia sub={sub} />
            <p className="text-sm font-bold text-slate-700">
              {formatearPlan(e.plan)} · {formatearDinero(precioActual, moneda)}/mes
            </p>
            {tieneCambioProgramado && precioProximo && fechaCambio && (
              <p className="text-xs font-medium text-slate-500">
                Próximo precio: {formatearDinero(precioProximo, moneda)} desde{' '}
                {formatearFechaHumana(fechaCambio)}
              </p>
            )}
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => mutacionRecordatorio.mutate(e.id)}
                disabled={!puedeRecordar || mutacionRecordatorio.isPending}
                title={puedeRecordar ? 'Recordatorio' : 'Disponible solo 10 días antes del corte'}
                className="rounded-xl border border-amber-200 bg-amber-50 px-2 py-3 text-[10px] font-black uppercase text-amber-800 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1 text-center transition-colors"
              >
                <Bell className="w-3 h-3" />
                {mutacionRecordatorio.isPending ? 'Enviando' : 'Recordar'}
              </button>
              <button
                onClick={() => onAbrirPago(e)}
                title="Registrar pago"
                className="rounded-xl bg-slate-900 px-2 py-3 text-[10px] font-black uppercase text-white shadow-sm hover:bg-black active:scale-95 flex flex-col items-center justify-center gap-1 text-center transition-all"
              >
                <DollarSign className="w-3 h-3" />
                Pagar
              </button>
              <button
                onClick={() => mutacionSuspension.mutate(e.id)}
                disabled={estaSuspendido || mutacionSuspension.isPending}
                title={estaSuspendido ? 'Salón ya suspendido' : 'Suspensión'}
                className="rounded-xl border border-red-200 bg-red-50 px-2 py-3 text-[10px] font-black uppercase text-red-700 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed flex flex-col items-center justify-center gap-1 text-center transition-colors"
              >
                <ShieldAlert className="w-3 h-3" />
                {mutacionSuspension.isPending ? 'Procesando' : 'Suspender'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TablaEscritorio({
  estudios,
  mutacionRecordatorio,
  mutacionSuspension,
  onAbrirPago,
}: PropsSubTabla) {
  return (
    <>
      <table className="hidden w-full text-left lg:table">
        <thead className="bg-slate-50">
          <tr>
            <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">Salón</th>
            <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">Vigencia</th>
            <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase">Plan</th>
            <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase text-right">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {estudios.map((e) => {
            const {
              sub,
              moneda,
              precioActual,
              precioProximo,
              fechaCambio,
              tieneCambioProgramado,
              puedeRecordar,
              estaSuspendido,
            } = obtenerDatosEstudio(e);
            return (
              <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-5">
                  <p className="font-black text-slate-900 uppercase">{e.name}</p>
                  <p className="text-[10px] text-slate-500 font-bold mt-1">
                    {formatearPais(e.country)} · {moneda}
                  </p>
                </td>
                <td className="px-6 py-5">
                  <EtiquetaVigencia sub={sub} />
                </td>
                <td className="px-6 py-5">
                  <p className="text-sm font-black text-slate-900">{formatearPlan(e.plan)}</p>
                  <p className="text-xs text-slate-500 mt-1">
                    {formatearDinero(precioActual, moneda)}/mes
                  </p>
                  {tieneCambioProgramado && precioProximo && fechaCambio && (
                    <p className="mt-2 text-[11px] font-medium text-slate-500">
                      Próximo: {formatearDinero(precioProximo, moneda)} desde{' '}
                      {formatearFechaHumana(fechaCambio)}
                    </p>
                  )}
                </td>
                <td className="px-6 py-5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <Tooltip texto="Recordar">
                      <button
                        onClick={() => mutacionRecordatorio.mutate(e.id)}
                        disabled={!puedeRecordar || mutacionRecordatorio.isPending}
                        aria-label="Enviar recordatorio"
                        title={
                          puedeRecordar
                            ? 'Enviar recordatorio'
                            : 'Solo disponible 10 días antes del corte'
                        }
                        className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800 hover:bg-amber-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <Bell className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                    <Tooltip texto="Pagar">
                      <button
                        onClick={() => onAbrirPago(e)}
                        aria-label="Registrar pago"
                        title="Registrar pago"
                        className="rounded-xl bg-slate-900 px-3 py-2 text-white hover:bg-black transition-all shadow-sm active:scale-95"
                      >
                        <DollarSign className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                    <Tooltip texto="Suspender">
                      <button
                        onClick={() => mutacionSuspension.mutate(e.id)}
                        disabled={estaSuspendido || mutacionSuspension.isPending}
                        aria-label="Suspender salón"
                        title={estaSuspendido ? 'Salón ya suspendido' : 'Suspender salón'}
                        className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-red-700 hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                      >
                        <ShieldAlert className="w-3.5 h-3.5" />
                      </button>
                    </Tooltip>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {estudios.length === 0 && (
        <p className="hidden lg:block text-center py-10 text-slate-400 font-bold italic">
          No se encontraron salones.
        </p>
      )}
    </>
  );
}
