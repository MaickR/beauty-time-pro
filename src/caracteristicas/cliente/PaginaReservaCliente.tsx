import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, Check, Calendar, User, Tag, Loader2 } from 'lucide-react';
import { obtenerSalonPublicoPorIdentificador } from '../../servicios/servicioClienteApp';
import { NavegacionCliente } from '../../componentes/diseno/NavegacionCliente';
import {
  formatearMetodoPagoReserva,
  obtenerOpcionesMetodosPagoReserva,
} from '../../lib/metodosPagoReserva';
import { Spinner } from '../../componentes/ui/Spinner';
import { usarToast } from '../../componentes/ui/ProveedorToast';
import { SelectorProductosPublicos } from '../reserva/componentes/SelectorProductosPublicos';
import { SelectorEspecialistaHorario } from '../reserva/componentes/SelectorEspecialistaHorario';
import { obtenerExcepcionDisponibilidadAplicada } from '../../lib/disponibilidadExcepciones';
import { formatearDinero, obtenerFechaLocalISO } from '../../utils/formato';
import { DIAS_SEMANA } from '../../lib/constantes';
import { usarFlujoReservaCliente } from './hooks/usarFlujoReservaCliente';
import {
  construirRutaReservaSalonCliente,
  construirRutaSalonCliente,
} from './utils/rutasSalonCliente';
import { obtenerServiciosPorEspecialista } from './utils/servicios-especialista';
import type {
  MetodoPagoReserva,
  ProductoAdicionalReserva,
  ProductoPublicoReserva,
  SalonDetalle,
  Servicio,
} from '../../tipos';

function formatearDuracionAproximada(duracion: number): string {
  const horas = Math.floor(duracion / 60);
  const minutos = duracion % 60;

  if (horas === 0) {
    return `${duracion} min`;
  }

  if (minutos === 0) {
    return `${horas} h`;
  }

  return `${horas} h ${minutos} min`;
}

function iniciales(nombre: string) {
  return nombre
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

// ── Selector de Especialista ─────────────────────────────────────────────────
function PasoEspecialista({
  salon,
  onSeleccionar,
}: {
  salon: SalonDetalle;
  onSeleccionar: (id: string) => void;
}) {
  return (
    <section aria-labelledby="titulo-especialista">
      <h2 id="titulo-especialista" className="font-black text-lg text-slate-900 mb-4">
        Elige tu especialista
      </h2>
      <p className="mb-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        Elige a tu especialista de preferencia. Antes de confirmar, el sistema volverá a validar la
        disponibilidad real para la fecha, duración y servicios seleccionados.
      </p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
        {salon.personal.map((p) => (
          <button
            key={p.id}
            onClick={() => onSeleccionar(p.id)}
            className="bg-white border-2 border-slate-100 rounded-2xl p-4 text-left hover:border-pink-300 hover:shadow-md transition-all"
          >
            <div
              className="w-10 h-10 rounded-full text-white font-black text-sm flex items-center justify-center mb-2"
              style={{ backgroundColor: salon.colorPrimario ?? '#C2185B' }}
              aria-hidden="true"
            >
              {iniciales(p.nombre)}
            </div>
            <p className="font-bold text-slate-900 text-sm">{p.nombre}</p>
            <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">
              {Array.isArray(p.especialidades) ? (p.especialidades as string[]).join(', ') : ''}
            </p>
          </button>
        ))}
      </div>
    </section>
  );
}

// ── Selector de Servicios ────────────────────────────────────────────────────
function PasoServicios({
  salon,
  personalId,
  seleccionados,
  productosSeleccionados,
  observaciones,
  onAlternar,
  onAlternarProducto,
  onActualizarCantidadProducto,
  onCambiarObservaciones,
  onSiguiente,
}: {
  salon: SalonDetalle;
  personalId: string;
  seleccionados: Servicio[];
  productosSeleccionados: ProductoAdicionalReserva[];
  observaciones: string;
  onAlternar: (s: Servicio) => void;
  onAlternarProducto: (producto: ProductoPublicoReserva) => void;
  onActualizarCantidadProducto: (productoId: string, cantidad: number) => void;
  onCambiarObservaciones: (observaciones: string) => void;
  onSiguiente: () => void;
}) {
  const totalDuracion = seleccionados.reduce((a, s) => a + s.duration, 0);
  const totalPrecio = seleccionados.reduce((a, s) => a + s.price, 0);
  const totalProductos = productosSeleccionados.reduce((a, producto) => a + producto.total, 0);
  const color = salon.colorPrimario ?? '#C2185B';
  const moneda = salon.pais === 'Colombia' ? 'COP' : 'MXN';
  const serviciosDisponibles = obtenerServiciosPorEspecialista(salon, personalId);
  const especialista = salon.personal.find((persona) => persona.id === personalId);

  return (
    <section aria-labelledby="titulo-servicios">
      <h2 id="titulo-servicios" className="font-black text-lg text-slate-900 mb-4">
        Elige los servicios
      </h2>
      {especialista && (
        <p className="mb-4 rounded-2xl border border-pink-100 bg-pink-50 px-4 py-3 text-sm font-medium text-pink-700">
          Estás viendo solo los servicios habilitados para {especialista.nombre}.
        </p>
      )}
      <ul className="space-y-2 mb-6">
        {serviciosDisponibles.map((s, indiceServicio) => {
          const activo = seleccionados.some((sel) => sel.name === s.name);
          return (
            <li key={`${s.name}-${indiceServicio}`}>
              <button
                onClick={() => onAlternar(s)}
                className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all ${
                  activo
                    ? 'border-pink-400 bg-pink-50'
                    : 'border-slate-100 bg-white hover:border-slate-200'
                }`}
                aria-pressed={activo}
              >
                <span
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${
                    activo ? 'border-pink-500 bg-pink-500' : 'border-slate-300'
                  }`}
                  aria-hidden="true"
                >
                  {activo && <Check className="w-3 h-3 text-white" />}
                </span>
                <span className="flex-1 font-medium text-sm text-slate-800">{s.name}</span>
                <span className="text-xs text-slate-400">{s.duration} min</span>
                {s.price > 0 && (
                  <span className="text-xs font-bold" style={{ color }}>
                    {formatearDinero(s.price, moneda)}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>

      {serviciosDisponibles.length === 0 && (
        <div className="mb-6 rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm font-medium text-slate-500">
          Este especialista no tiene servicios habilitados para reserva en este momento.
        </div>
      )}

      {salon.plan === 'PRO' && salon.productos.length > 0 && (
        <div className="mb-6">
          <SelectorProductosPublicos
            productos={salon.productos}
            productosSeleccionados={productosSeleccionados}
            moneda={moneda}
            onAlternarProducto={onAlternarProducto}
            onActualizarCantidad={onActualizarCantidadProducto}
          />
        </div>
      )}

      <div className="mb-6 rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Notas opcionales
          </p>
          <h3 className="mt-2 text-lg font-black text-slate-900">Detalles para tu servicio</h3>
          <p className="mt-2 text-sm text-slate-600">
            Si necesitas indicar una preferencia, sensibilidad o detalle especial, puedes escribirlo
            aquí.
          </p>
        </div>
        <textarea
          value={observaciones}
          onChange={(evento) => onCambiarObservaciones(evento.target.value.slice(0, 240))}
          rows={4}
          maxLength={240}
          className="mt-4 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-pink-300 focus:bg-white"
          placeholder="Ej: prefiero atención silenciosa, piel sensible o cualquier detalle que el salón deba tener en cuenta."
        />
        <p className="mt-2 text-right text-xs font-semibold text-slate-400">
          {observaciones.length}/240
        </p>
      </div>

      {seleccionados.length > 0 && (
        <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between mb-4">
          <div className="text-sm text-slate-600">
            <span className="font-bold text-slate-900">{seleccionados.length}</span> servicio
            {seleccionados.length > 1 ? 's' : ''} · {totalDuracion} min
          </div>
          {(totalPrecio > 0 || totalProductos > 0) && (
            <span className="font-black text-slate-900">
              {formatearDinero(totalPrecio + totalProductos, moneda)}
            </span>
          )}
        </div>
      )}
      <button
        disabled={seleccionados.length === 0}
        onClick={onSiguiente}
        className="w-full py-4 rounded-2xl font-black text-white disabled:opacity-40 transition-opacity"
        style={{ backgroundColor: color }}
      >
        Continuar
      </button>
    </section>
  );
}

// ── Selector de Fecha ────────────────────────────────────────────────────────
function PasoFecha({
  salon,
  fechaSeleccionada,
  onSeleccionar,
}: {
  salon: SalonDetalle;
  fechaSeleccionada: Date;
  onSeleccionar: (d: Date) => void;
}) {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const [mesVisible, setMesVisible] = useState(
    new Date(fechaSeleccionada.getFullYear(), fechaSeleccionada.getMonth(), 1),
  );

  useEffect(() => {
    setMesVisible(new Date(fechaSeleccionada.getFullYear(), fechaSeleccionada.getMonth(), 1));
  }, [fechaSeleccionada]);

  const inicioMesActual = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const puedeRetrocederMes = mesVisible > inicioMesActual;
  const primerDia = new Date(mesVisible.getFullYear(), mesVisible.getMonth(), 1).getDay();
  const diasEnMes = new Date(mesVisible.getFullYear(), mesVisible.getMonth() + 1, 0).getDate();
  const celdas = Array.from({ length: 42 }, (_, i) => {
    const d = i - primerDia + 1;
    return d > 0 && d <= diasEnMes ? d : null;
  });
  const fechaStr = obtenerFechaLocalISO(fechaSeleccionada);

  return (
    <section aria-labelledby="titulo-fecha">
      <h2
        id="titulo-fecha"
        className="font-black text-lg text-slate-900 mb-4 flex items-center gap-2"
      >
        <Calendar className="w-5 h-5" aria-hidden="true" /> Elige la fecha
      </h2>
      <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() =>
              puedeRetrocederMes
                ? setMesVisible(new Date(mesVisible.getFullYear(), mesVisible.getMonth() - 1, 1))
                : undefined
            }
            disabled={!puedeRetrocederMes}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-pink-200 hover:text-pink-600 disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Ir al mes anterior"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          </button>
          <p className="text-center font-bold text-slate-700 capitalize">
            {mesVisible.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
          </p>
          <button
            type="button"
            onClick={() =>
              setMesVisible(new Date(mesVisible.getFullYear(), mesVisible.getMonth() + 1, 1))
            }
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-pink-200 hover:text-pink-600"
            aria-label="Ir al mes siguiente"
          >
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center mb-2">
          {['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'].map((d) => (
            <div key={d} className="text-xs font-bold text-slate-400 py-1">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {celdas.map((dia, i) => {
            if (!dia) return <div key={i} />;
            const dateObj = new Date(mesVisible.getFullYear(), mesVisible.getMonth(), dia);
            const dStr = obtenerFechaLocalISO(dateObj);
            const esPasado = dateObj < hoy;
            const nombreDia = DIAS_SEMANA[dateObj.getDay()];
            const turno = salon.horario?.[nombreDia];
            const estaCerrado = turno ? !turno.isOpen : false;
            const esFestivo = salon.festivos.includes(dStr);
            const excepcionDisponibilidad = obtenerExcepcionDisponibilidadAplicada({
              excepciones: salon.availabilityExceptions,
              fecha: dStr,
              sucursal: salon.nombre,
            });
            const esCierreEspecial = excepcionDisponibilidad?.tipo === 'cerrado';
            const tieneHorarioModificado = excepcionDisponibilidad?.tipo === 'horario_modificado';
            const deshabilitado = esPasado || estaCerrado || esFestivo || esCierreEspecial;
            const seleccionado = dStr === fechaStr;
            return (
              <button
                key={i}
                disabled={deshabilitado}
                onClick={() => onSeleccionar(dateObj)}
                className={`aspect-square rounded-xl text-sm font-bold transition-all ${
                  seleccionado
                    ? 'bg-pink-600 text-white shadow-md'
                    : deshabilitado
                      ? 'text-slate-200 cursor-not-allowed'
                      : 'hover:bg-pink-50 text-slate-700 hover:text-pink-600'
                }`}
                aria-label={`${dia} de ${mesVisible.toLocaleString('es-ES', { month: 'long' })}${deshabilitado ? ', no disponible' : ''}`}
                aria-pressed={seleccionado}
              >
                {dia}
                {!seleccionado &&
                  (esFestivo || estaCerrado || esCierreEspecial || tieneHorarioModificado) && (
                    <span className="mt-1 flex items-center gap-1">
                      {(esFestivo || estaCerrado || esCierreEspecial) && (
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                      )}
                      {!esFestivo &&
                        !estaCerrado &&
                        !esCierreEspecial &&
                        tieneHorarioModificado && (
                          <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                        )}
                    </span>
                  )}
              </button>
            );
          })}
        </div>
        <div className="mt-4 flex items-center justify-center gap-4 text-[10px] font-black uppercase tracking-wide text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500" /> Cierre
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-blue-500" /> Horario modificado
          </span>
        </div>
      </div>
    </section>
  );
}

// ── Confirmación ─────────────────────────────────────────────────────────────
function PasoConfirmar({
  salon,
  personalId,
  servicios,
  fecha,
  hora,
  duracionTotal,
  precioTotal,
  totalProductos,
  metodosPagoDisponibles,
  metodoPago,
  productosSeleccionados,
  observaciones,
  onSeleccionarMetodoPago,
  enviando,
  onConfirmar,
}: {
  salon: SalonDetalle;
  personalId: string;
  servicios: Servicio[];
  fecha: Date;
  hora: string;
  duracionTotal: number;
  precioTotal: number;
  totalProductos: number;
  metodosPagoDisponibles: Array<{ valor: MetodoPagoReserva; etiqueta: string }>;
  metodoPago: MetodoPagoReserva;
  productosSeleccionados: ProductoAdicionalReserva[];
  observaciones: string;
  onSeleccionarMetodoPago: (metodoPago: MetodoPagoReserva) => void;
  enviando: boolean;
  onConfirmar: () => void;
}) {
  const especialista = salon.personal.find((p) => p.id === personalId);
  const color = salon.colorPrimario ?? '#C2185B';
  const moneda = salon.pais === 'Colombia' ? 'COP' : 'MXN';
  const fechaFormateada = fecha.toLocaleDateString('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <section aria-labelledby="titulo-confirmar">
      <h2 id="titulo-confirmar" className="font-black text-lg text-slate-900 mb-4">
        Confirma tu reserva
      </h2>
      <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm space-y-4 mb-6">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-50">
          <User className="w-5 h-5 text-slate-400" aria-hidden="true" />
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Especialista</p>
            <p className="font-bold text-slate-900">{especialista?.nombre ?? '—'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 pb-3 border-b border-slate-50">
          <Calendar className="w-5 h-5 text-slate-400" aria-hidden="true" />
          <div>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wide">Fecha y hora</p>
            <p className="font-bold text-slate-900 capitalize">
              {fechaFormateada} · {hora}
            </p>
            <p className="text-xs font-semibold text-slate-500">
              Dirección: {salon.direccion ?? salon.nombre}
            </p>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Duración aproximada
            </p>
            <p className="mt-1 text-sm font-black text-slate-900">
              {formatearDuracionAproximada(duracionTotal)}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">
              Método de pago
            </p>
            <p className="mt-1 text-sm font-black text-slate-900">
              {formatearMetodoPagoReserva(metodoPago)}
            </p>
          </div>
        </div>
        <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-400">
              Selecciona cómo pagarás en el salón
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Este método queda registrado en tu reserva para que puedas consultarlo después.
            </p>
          </div>
          <div
            className="grid grid-cols-1 gap-2 sm:grid-cols-2"
            role="radiogroup"
            aria-label="Método de pago"
          >
            {metodosPagoDisponibles.map((opcion) => {
              const activo = opcion.valor === metodoPago;

              return (
                <button
                  key={opcion.valor}
                  type="button"
                  onClick={() => onSeleccionarMetodoPago(opcion.valor)}
                  className={`rounded-2xl border px-4 py-3 text-left text-sm font-black transition-colors ${
                    activo
                      ? 'border-pink-300 bg-pink-50 text-pink-700'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-pink-200'
                  }`}
                  aria-pressed={activo}
                >
                  {opcion.etiqueta}
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Tag className="w-5 h-5 text-slate-400 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wide mb-1">
              Servicios
            </p>
            {servicios.map((s, indiceServicio) => (
              <div key={`${s.name}-${indiceServicio}`} className="flex justify-between text-sm">
                <span className="text-slate-800">{s.name}</span>
                {s.price > 0 && (
                  <span className="font-bold text-slate-600">
                    {formatearDinero(s.price, moneda)}
                  </span>
                )}
              </div>
            ))}
            {productosSeleccionados.length > 0 && (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">
                  Productos
                </p>
                <div className="space-y-2">
                  {productosSeleccionados.map((producto) => (
                    <div key={producto.id} className="flex justify-between text-sm">
                      <span className="text-slate-800">
                        {producto.nombre} x{producto.cantidad}
                      </span>
                      <span className="font-bold text-slate-600">
                        {formatearDinero(producto.total, moneda)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {observaciones.trim() ? (
              <div className="mt-3 border-t border-slate-100 pt-3">
                <p className="mb-2 text-xs font-black uppercase tracking-wide text-slate-400">
                  Notas del cliente
                </p>
                <p className="text-sm text-slate-700">{observaciones}</p>
              </div>
            ) : null}
            {(precioTotal > 0 || totalProductos > 0) && (
              <div className="mt-2 flex justify-between border-t border-slate-100 pt-2 text-sm font-black text-slate-900">
                <span>Total estimado</span>
                <span>{formatearDinero(precioTotal + totalProductos, moneda)}</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <button
        onClick={onConfirmar}
        disabled={enviando}
        className="w-full py-4 rounded-2xl font-black text-white flex items-center justify-center gap-2 disabled:opacity-60 transition-opacity"
        style={{ backgroundColor: color }}
      >
        {enviando ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" /> Reservando…
          </>
        ) : (
          'Confirmar reserva'
        )}
      </button>
    </section>
  );
}

// ── Reserva Exitosa ──────────────────────────────────────────────────────────
function PasoExitosa({
  salon,
  fecha,
  hora,
  onNuevaReserva,
}: {
  salon: SalonDetalle;
  fecha: Date;
  hora: string;
  onNuevaReserva: () => void;
}) {
  const navegar = useNavigate();
  const color = salon.colorPrimario ?? '#C2185B';
  return (
    <div className="text-center py-8">
      <div
        className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 text-white"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      >
        <Check className="w-10 h-10" />
      </div>
      <h2 className="text-2xl font-black text-slate-900 mb-2">¡Reserva confirmada!</h2>
      <p className="text-slate-500 mb-1 capitalize">
        {fecha.toLocaleDateString('es-MX', { weekday: 'long', day: 'numeric', month: 'long' })}
      </p>
      <p className="text-slate-500 mb-8">
        {hora} · {salon.nombre}
      </p>
      <div className="flex flex-col gap-3 max-w-xs mx-auto">
        <button
          onClick={() => navegar('/cliente/perfil?vista=reservas')}
          className="py-3 rounded-2xl font-black text-white"
          style={{ backgroundColor: color }}
        >
          Ver mis reservas
        </button>
        <button
          onClick={onNuevaReserva}
          className="py-3 rounded-2xl font-bold text-slate-600 bg-slate-100"
        >
          Nueva reserva
        </button>
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export function PaginaReservaCliente() {
  const { identificador } = useParams<{ identificador: string }>();
  const navegar = useNavigate();
  const { mostrarToast } = usarToast();

  const { data: salon, isLoading } = useQuery<SalonDetalle>({
    queryKey: ['salon-publico', identificador],
    queryFn: () => obtenerSalonPublicoPorIdentificador(identificador!),
    enabled: !!identificador,
  });

  useEffect(() => {
    if (!salon?.slug || !identificador || salon.slug === identificador) {
      return;
    }

    navegar(construirRutaReservaSalonCliente(salon), { replace: true });
  }, [identificador, navegar, salon]);

  if (isLoading || !salon) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Spinner tamaño="lg" />
      </div>
    );
  }

  return (
    <ContenidoReserva
      salon={salon}
      mostrarError={(m) => mostrarToast({ mensaje: m, variante: 'error' })}
    />
  );
}

function ContenidoReserva({
  salon,
  mostrarError,
}: {
  salon: SalonDetalle;
  mostrarError: (m: string) => void;
}) {
  const navegar = useNavigate();
  const flujo = usarFlujoReservaCliente(salon);
  const color = salon.colorPrimario ?? '#C2185B';
  const metodosPagoDisponibles = obtenerOpcionesMetodosPagoReserva(salon.metodosPagoReserva);

  useEffect(() => {
    if ((salon.sucursales?.length ?? 0) === 1 && !flujo.sucursalSeleccionada) {
      flujo.seleccionarSucursal(salon.sucursales?.[0] ?? '');
    }
  }, [salon.id, salon.sucursales, flujo.sucursalSeleccionada]);

  const PASOS_TITULO: Record<string, string> = {
    especialista: 'Especialista',
    servicios: 'Servicios',
    fecha: 'Fecha',
    hora: 'Hora',
    confirmar: 'Confirmar',
  };

  const pasoActualIdx = ['especialista', 'servicios', 'fecha', 'hora', 'confirmar'].indexOf(
    flujo.paso,
  );

  return (
    <div className="min-h-screen bg-slate-50 pb-10">
      <NavegacionCliente />

      {/* Cabecera del salón */}
      <div className="bg-white border-b border-slate-100 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <button
            onClick={() => {
              if (flujo.paso === 'especialista' || flujo.paso === 'exitosa')
                navegar(construirRutaSalonCliente(salon));
              else flujo.retroceder();
            }}
            aria-label="Volver"
          >
            <ChevronLeft className="w-6 h-6 text-slate-500" aria-hidden="true" />
          </button>
          <div
            className="w-8 h-8 rounded-full text-white font-black text-xs flex items-center justify-center shrink-0"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          >
            {salon.nombre[0]?.toUpperCase()}
          </div>
          <div>
            <p className="font-black text-slate-900 text-sm">{salon.nombre}</p>
            {flujo.paso !== 'exitosa' && (
              <p className="text-xs text-slate-400">{PASOS_TITULO[flujo.paso]}</p>
            )}
          </div>
        </div>
        {/* Indicador de progreso */}
        {flujo.paso !== 'exitosa' && pasoActualIdx >= 0 && (
          <div className="max-w-2xl mx-auto mt-3 flex gap-1">
            {[0, 1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="flex-1 h-1 rounded-full transition-all"
                style={{ backgroundColor: i <= pasoActualIdx ? color : '#e2e8f0' }}
              />
            ))}
          </div>
        )}
      </div>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {flujo.paso === 'especialista' && (
          <PasoEspecialista salon={salon} onSeleccionar={flujo.seleccionarPersonal} />
        )}
        {flujo.paso === 'servicios' && (
          <PasoServicios
            salon={salon}
            personalId={flujo.personalId}
            seleccionados={flujo.serviciosSeleccionados}
            productosSeleccionados={flujo.productosSeleccionados}
            observaciones={flujo.observaciones}
            onAlternar={flujo.alternarServicio}
            onAlternarProducto={flujo.alternarProducto}
            onActualizarCantidadProducto={flujo.actualizarCantidadProducto}
            onCambiarObservaciones={flujo.actualizarObservaciones}
            onSiguiente={flujo.irAFecha}
          />
        )}
        {flujo.paso === 'fecha' && (
          <PasoFecha
            salon={salon}
            fechaSeleccionada={flujo.fechaSeleccionada}
            onSeleccionar={flujo.seleccionarFecha}
          />
        )}
        {flujo.paso === 'hora' && (
          <SelectorEspecialistaHorario
            salonId={salon.id}
            sucursalSeleccionada={flujo.sucursalSeleccionada}
            fecha={obtenerFechaLocalISO(flujo.fechaSeleccionada)}
            totalDuracion={flujo.duracionTotal}
            serviciosSeleccionados={flujo.serviciosSeleccionados}
            personalSeleccionado={flujo.personalId}
            horaSeleccionada={flujo.horaSeleccionada}
            onSeleccionar={flujo.seleccionarEspecialistaYHora}
          />
        )}
        {flujo.paso === 'confirmar' && (
          <PasoConfirmar
            salon={salon}
            personalId={flujo.personalId}
            servicios={flujo.serviciosSeleccionados}
            fecha={flujo.fechaSeleccionada}
            hora={flujo.horaSeleccionada}
            duracionTotal={flujo.duracionTotal}
            precioTotal={flujo.precioTotal}
            totalProductos={flujo.totalProductos}
            metodosPagoDisponibles={metodosPagoDisponibles}
            metodoPago={flujo.metodoPago}
            productosSeleccionados={flujo.productosSeleccionados}
            observaciones={flujo.observaciones}
            onSeleccionarMetodoPago={flujo.seleccionarMetodoPago}
            enviando={flujo.enviando}
            onConfirmar={() => flujo.enviarReserva(mostrarError)}
          />
        )}
        {flujo.paso === 'exitosa' && (
          <PasoExitosa
            salon={salon}
            fecha={flujo.fechaSeleccionada}
            hora={flujo.horaSeleccionada}
            onNuevaReserva={flujo.reiniciar}
          />
        )}
      </main>
    </div>
  );
}
