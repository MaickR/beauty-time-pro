import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, Check, Clock, Calendar, User, Tag, Loader2 } from 'lucide-react';
import { obtenerSalonPublico } from '../../servicios/servicioClienteApp';
import { NavegacionCliente } from '../../componentes/diseno/NavegacionCliente';
import { Spinner } from '../../componentes/ui/Spinner';
import { usarToast } from '../../componentes/ui/ProveedorToast';
import { obtenerFechaLocalISO } from '../../utils/formato';
import { DIAS_SEMANA } from '../../lib/constantes';
import { usarFlujoReservaCliente } from './hooks/usarFlujoReservaCliente';
import type { SalonDetalle, Servicio, SlotTiempo } from '../../tipos';

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
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
  seleccionados,
  onAlternar,
  onSiguiente,
}: {
  salon: SalonDetalle;
  seleccionados: Servicio[];
  onAlternar: (s: Servicio) => void;
  onSiguiente: () => void;
}) {
  const totalDuracion = seleccionados.reduce((a, s) => a + s.duration, 0);
  const totalPrecio = seleccionados.reduce((a, s) => a + s.price, 0);
  const color = salon.colorPrimario ?? '#C2185B';

  return (
    <section aria-labelledby="titulo-servicios">
      <h2 id="titulo-servicios" className="font-black text-lg text-slate-900 mb-4">
        Elige los servicios
      </h2>
      <ul className="space-y-2 mb-6">
        {salon.servicios.map((s) => {
          const activo = seleccionados.some((sel) => sel.name === s.name);
          return (
            <li key={s.name}>
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
                    ${s.price.toLocaleString('es-MX')}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {seleccionados.length > 0 && (
        <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between mb-4">
          <div className="text-sm text-slate-600">
            <span className="font-bold text-slate-900">{seleccionados.length}</span> servicio
            {seleccionados.length > 1 ? 's' : ''} · {totalDuracion} min
          </div>
          {totalPrecio > 0 && (
            <span className="font-black text-slate-900">
              ${totalPrecio.toLocaleString('es-MX')}
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
  const primerDia = new Date(
    fechaSeleccionada.getFullYear(),
    fechaSeleccionada.getMonth(),
    1,
  ).getDay();
  const diasEnMes = new Date(
    fechaSeleccionada.getFullYear(),
    fechaSeleccionada.getMonth() + 1,
    0,
  ).getDate();
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
        <p className="text-center font-bold text-slate-700 mb-4 capitalize">
          {fechaSeleccionada.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
        </p>
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
            const dateObj = new Date(
              fechaSeleccionada.getFullYear(),
              fechaSeleccionada.getMonth(),
              dia,
            );
            const dStr = obtenerFechaLocalISO(dateObj);
            const esPasado = dateObj < hoy;
            const nombreDia = DIAS_SEMANA[dateObj.getDay()];
            const turno = salon.horario?.[nombreDia];
            const estaCerrado = turno ? !turno.isOpen : false;
            const esFestivo = salon.festivos.includes(dStr);
            const deshabilitado = esPasado || estaCerrado || esFestivo;
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
                aria-label={`${dia} de ${fechaSeleccionada.toLocaleString('es-ES', { month: 'long' })}${deshabilitado ? ', no disponible' : ''}`}
                aria-pressed={seleccionado}
              >
                {dia}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Selector de Hora ─────────────────────────────────────────────────────────
function PasoHora({
  slots,
  cargando,
  horaSeleccionada,
  color,
  onSeleccionar,
}: {
  slots: SlotTiempo[];
  cargando: boolean;
  horaSeleccionada: string;
  color: string;
  onSeleccionar: (h: string) => void;
}) {
  return (
    <section aria-labelledby="titulo-hora">
      <h2
        id="titulo-hora"
        className="font-black text-lg text-slate-900 mb-4 flex items-center gap-2"
      >
        <Clock className="w-5 h-5" aria-hidden="true" /> Elige el horario
      </h2>
      {cargando ? (
        <div className="flex justify-center py-12">
          <Spinner tamaño="md" />
        </div>
      ) : slots.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-3xl">
          <p className="font-bold text-slate-500">No hay horarios disponibles para este día</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
          {slots.map((s) => (
            <button
              key={s.time}
              disabled={s.status !== 'AVAILABLE'}
              onClick={() => onSeleccionar(s.time)}
              className={`py-3 rounded-2xl font-bold text-sm border-2 transition-all ${
                s.status !== 'AVAILABLE'
                  ? 'border-slate-100 bg-slate-50 text-slate-300 cursor-not-allowed line-through'
                  : horaSeleccionada === s.time
                    ? 'text-white shadow-md border-transparent'
                    : 'border-slate-200 text-slate-700 hover:border-pink-300 bg-white'
              }`}
              style={
                horaSeleccionada === s.time && s.status === 'AVAILABLE'
                  ? { backgroundColor: color }
                  : undefined
              }
              aria-pressed={horaSeleccionada === s.time}
            >
              {s.time}
            </button>
          ))}
        </div>
      )}
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
  precioTotal,
  enviando,
  onConfirmar,
}: {
  salon: SalonDetalle;
  personalId: string;
  servicios: Servicio[];
  fecha: Date;
  hora: string;
  precioTotal: number;
  enviando: boolean;
  onConfirmar: () => void;
}) {
  const especialista = salon.personal.find((p) => p.id === personalId);
  const color = salon.colorPrimario ?? '#C2185B';
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
          </div>
        </div>
        <div className="flex items-start gap-3">
          <Tag className="w-5 h-5 text-slate-400 mt-0.5" aria-hidden="true" />
          <div className="flex-1">
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wide mb-1">
              Servicios
            </p>
            {servicios.map((s) => (
              <div key={s.name} className="flex justify-between text-sm">
                <span className="text-slate-800">{s.name}</span>
                {s.price > 0 && (
                  <span className="font-bold text-slate-600">
                    ${s.price.toLocaleString('es-MX')}
                  </span>
                )}
              </div>
            ))}
            {precioTotal > 0 && (
              <div className="flex justify-between text-sm font-black mt-2 pt-2 border-t border-slate-100">
                <span>Total</span>
                <span>${precioTotal.toLocaleString('es-MX')}</span>
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
          onClick={() => navegar('/mi-perfil#reservas')}
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
  const { id } = useParams<{ id: string }>();
  const { mostrarToast } = usarToast();

  const { data: salon, isLoading } = useQuery<SalonDetalle>({
    queryKey: ['salon-publico', id],
    queryFn: () => obtenerSalonPublico(id!),
    enabled: !!id,
  });

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
                navegar(`/salones/${salon.id}`);
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
            seleccionados={flujo.serviciosSeleccionados}
            onAlternar={flujo.alternarServicio}
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
          <PasoHora
            slots={flujo.slots}
            cargando={flujo.cargandoSlots}
            horaSeleccionada={flujo.horaSeleccionada}
            color={color}
            onSeleccionar={flujo.seleccionarHora}
          />
        )}
        {flujo.paso === 'confirmar' && (
          <PasoConfirmar
            salon={salon}
            personalId={flujo.personalId}
            servicios={flujo.serviciosSeleccionados}
            fecha={flujo.fechaSeleccionada}
            hora={flujo.horaSeleccionada}
            precioTotal={flujo.precioTotal}
            enviando={flujo.enviando}
            onConfirmar={() => flujo.enviarReserva(mostrarError)}
          />
        )}
        {flujo.paso === 'exitosa' && (
          <PasoExitosa
            salon={salon}
            fecha={flujo.fechaSeleccionada}
            hora={flujo.horaSeleccionada}
            onNuevaReserva={() => {
              void 0;
              window.location.reload();
            }}
          />
        )}
      </main>
    </div>
  );
}
