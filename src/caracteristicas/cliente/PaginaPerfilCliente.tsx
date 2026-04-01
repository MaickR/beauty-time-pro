import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Camera, Lock, Star, Calendar, ChevronRight, Loader2, Mail, Palette } from 'lucide-react';
import { NavegacionCliente } from '../../componentes/diseno/NavegacionCliente';
import { DialogoConfirmacion } from '../../componentes/ui/DialogoConfirmacion';
import { Spinner } from '../../componentes/ui/Spinner';
import { SelectorFecha } from '../../componentes/ui/SelectorFecha';
import { usarTemaSalon } from '../../hooks/usarTemaSalon';
import { usarNotificacionesPush } from '../../hooks/usarNotificacionesPush';
import { usarPerfilCliente } from './hooks/usarPerfilCliente';
import { formatearDinero } from '../../utils/formato';
import type { Pais, ReservaCliente, FidelidadSalon } from '../../tipos';

// ── Helpers ──────────────────────────────────────────────────────────────────
function inicialesDesdeNombre(n: string, a: string) {
  return (n[0] ?? '') + (a[0] ?? '');
}

function badgeEstado(estado: string) {
  const clases: Record<string, string> = {
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    confirmed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    completed: 'bg-slate-100 text-slate-700 border-slate-200',
    cancelled: 'bg-red-50 text-red-700 border-red-200',
  };
  const etiquetas: Record<string, string> = {
    pending: 'Pendiente',
    confirmed: 'Confirmada',
    completed: 'Completada',
    cancelled: 'Cancelada',
  };
  return {
    clase: clases[estado] ?? 'bg-slate-50 text-slate-500 border-slate-200',
    etiqueta: etiquetas[estado] ?? estado,
  };
}

const COLORES_CLIENTE = [
  '#F48FB1',
  '#CE93D8',
  '#80DEEA',
  '#A5D6A7',
  '#FFF176',
  '#FFCC80',
  '#EF9A9A',
  '#90CAF9',
  '#B2DFDB',
  '#E1BEE7',
];

function formatearPais(pais: Pais): string {
  return pais === 'Mexico' ? 'México' : 'Colombia';
}

function formatearFechaReservaNatural(fecha: string, horaInicio: string): string {
  const fechaHora = new Date(`${fecha}T${horaInicio}:00`);
  return new Intl.DateTimeFormat('es-MX', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
    .format(fechaHora)
    .replace(',', ' ·')
    .replace(/^./, (texto) => texto.toUpperCase());
}

function puedeCancelarReserva(reserva: ReservaCliente): boolean {
  if (!['pending', 'confirmed'].includes(reserva.estado)) {
    return false;
  }

  const fechaHora = new Date(`${reserva.fecha}T${reserva.horaInicio}:00`).getTime();
  return fechaHora - Date.now() > 2 * 60 * 60 * 1000;
}

// ── Sección Avatar ───────────────────────────────────────────────────────────
function SeccionAvatar({
  avatarUrl,
  nombre,
  apellido,
  email,
  pais,
  onCambiar,
}: {
  avatarUrl: string | null;
  nombre: string;
  apellido: string;
  email: string;
  pais: Pais;
  onCambiar: (f: File) => void;
}) {
  const refInput = useRef<HTMLInputElement>(null);
  const inics = inicialesDesdeNombre(nombre, apellido).toUpperCase();

  return (
    <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-sm flex flex-col items-center text-center gap-4">
      <div className="relative shrink-0">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Foto de perfil"
            loading="lazy"
            className="w-24 h-24 rounded-full object-cover"
          />
        ) : (
          <div
            className="w-24 h-24 rounded-full bg-pink-100 text-pink-700 font-black text-3xl flex items-center justify-center"
            aria-hidden="true"
          >
            {inics}
          </div>
        )}
        <button
          type="button"
          onClick={() => refInput.current?.click()}
          aria-label="Cambiar foto de perfil"
          className="mt-3 inline-flex items-center gap-1 rounded-full border border-pink-200 bg-pink-50 px-3 py-1.5 text-xs font-bold text-pink-700 hover:bg-pink-100 transition-colors"
        >
          <Camera className="w-3.5 h-3.5" aria-hidden="true" /> Editar foto
        </button>
        <input
          ref={refInput}
          type="file"
          accept="image/jpeg,image/jpg,image/png"
          className="sr-only"
          aria-hidden="true"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onCambiar(f);
          }}
        />
      </div>
      <div className="space-y-1">
        <p className="text-lg font-semibold text-slate-900">
          {nombre} {apellido}
        </p>
        <p className="text-sm text-slate-500">{email}</p>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-400">
          Cliente en {formatearPais(pais)}
        </p>
      </div>
    </div>
  );
}

// ── Sección Fidelidad ────────────────────────────────────────────────────────
function SeccionFidelidad({
  fidelidad,
  mensajeVacio,
}: {
  fidelidad: FidelidadSalon[];
  mensajeVacio?: string | null;
}) {
  const fidelidadActiva = fidelidad.filter((item) => item.activo);

  if (fidelidadActiva.length === 0) {
    return (
      <section aria-labelledby="titulo-fidelidad">
        <h2
          id="titulo-fidelidad"
          className="font-black text-slate-900 text-lg mb-3 flex items-center gap-2"
        >
          <Star className="w-5 h-5 text-pink-600" aria-hidden="true" /> Programa de fidelidad
        </h2>
        <div className="bg-white border border-dashed border-slate-200 rounded-3xl p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-500">
            <Star className="w-7 h-7" aria-hidden="true" />
          </div>
          <p className="font-bold text-slate-900">
            {mensajeVacio ??
              'Aún no tienes puntos de fidelidad. ¡Reserva tu primera cita para empezar a acumular!'}
          </p>
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="titulo-fidelidad">
      <h2
        id="titulo-fidelidad"
        className="font-black text-slate-900 text-lg mb-3 flex items-center gap-2"
      >
        <Star className="w-5 h-5 text-pink-600" aria-hidden="true" /> Programa de fidelidad
      </h2>
      <div className="space-y-3">
        {fidelidadActiva.map((f) => {
          const porcentaje = Math.min(
            100,
            Math.round((f.visitasAcumuladas / f.visitasRequeridas) * 100),
          );
          const tieneRecompensa = f.recompensasGanadas > f.recompensasUsadas;
          return (
            <div
              key={f.estudioId}
              className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="font-bold text-sm" style={{ color: f.colorPrimario ?? '#C2185B' }}>
                  {f.nombreSalon}
                </p>
                {tieneRecompensa && (
                  <span className="text-xs font-bold px-2 py-1 bg-green-50 text-green-700 rounded-full border border-green-200">
                    🎁 ¡Recompensa disponible!
                  </span>
                )}
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2 mb-1.5">
                <div
                  className="h-2 rounded-full transition-all"
                  style={{ width: `${porcentaje}%`, backgroundColor: f.colorPrimario ?? '#C2185B' }}
                  role="progressbar"
                  aria-valuenow={f.visitasAcumuladas}
                  aria-valuemin={0}
                  aria-valuemax={f.visitasRequeridas}
                  aria-label={`${f.visitasAcumuladas} de ${f.visitasRequeridas} visitas`}
                />
              </div>
              <p className="text-xs text-slate-500">
                {f.visitasAcumuladas} / {f.visitasRequeridas} visitas · {f.descripcionRecompensa}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
}

// ── Sección Reservas ─────────────────────────────────────────────────────────
function SeccionReservas({
  reservas,
  pestanaInicial = 'proximas',
}: {
  reservas: ReservaCliente[];
  pestanaInicial?: 'proximas' | 'historial';
}) {
  const [pestana, setPestana] = useState<'proximas' | 'historial'>(pestanaInicial);
  const hoy = new Date().toISOString().split('T')[0]!;
  const proximas = reservas
    .filter((r) => r.fecha >= hoy && r.estado !== 'cancelled')
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const historial = reservas
    .filter((r) => r.fecha < hoy || r.estado === 'cancelled')
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
  const lista = pestana === 'proximas' ? proximas : historial;

  useEffect(() => {
    setPestana(pestanaInicial);
  }, [pestanaInicial]);

  return (
    <section id="reservas" aria-labelledby="titulo-reservas">
      <h2
        id="titulo-reservas"
        className="font-black text-slate-900 text-lg mb-3 flex items-center gap-2"
      >
        <Calendar className="w-5 h-5 text-pink-600" aria-hidden="true" /> Mis reservas
      </h2>
      <div className="flex gap-2 mb-4">
        {(['proximas', 'historial'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setPestana(t)}
            className={`px-4 py-2 rounded-xl text-sm font-bold transition-colors ${pestana === t ? 'bg-pink-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:border-pink-300'}`}
          >
            {t === 'proximas' ? `Próximas (${proximas.length})` : `Historial (${historial.length})`}
          </button>
        ))}
      </div>
      {lista.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center">
          <p className="text-slate-400 font-bold">
            No hay reservas {pestana === 'proximas' ? 'próximas' : 'en el historial'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {lista.map((r) => {
            const { clase, etiqueta } = badgeEstado(r.estado);
            const cancelable = puedeCancelarReserva(r);
            return (
              <div
                key={r.id}
                className="bg-white border border-slate-100 rounded-3xl p-5 shadow-sm"
              >
                <div className="space-y-4">
                  {/* Fila principal: info + precio */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1 space-y-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-lg font-black text-slate-900">{r.salon.nombre}</p>
                        <span
                          className={`inline-flex items-center rounded-full border px-3 py-1.5 text-sm font-black ${clase}`}
                        >
                          {etiqueta}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-slate-600">
                        {formatearFechaReservaNatural(r.fecha, r.horaInicio)}
                      </p>
                      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
                        <span>Especialista: {r.especialista.nombre}</span>
                        {r.especialista.eliminado && (
                          <span className="inline-flex items-center rounded-full border border-amber-200 bg-amber-50 px-2 py-1 text-[11px] font-black uppercase tracking-wide text-amber-700">
                            Especialista eliminado
                          </span>
                        )}
                      </div>
                      <ul className="space-y-1 text-sm text-slate-500">
                        {r.servicios.map((servicio) => (
                          <li key={`${r.id}-${servicio.name}`} className="flex items-start gap-2">
                            <span className="mt-1 h-1.5 w-1.5 rounded-full bg-slate-300 shrink-0" />
                            <span>{servicio.name}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <p className="shrink-0 text-sm font-black text-slate-900">
                      {formatearDinero(r.precioTotal)}
                    </p>
                  </div>
                  {/* Fila footer: botón cancelar o aviso */}
                  {cancelable && (
                    <div className="border-t border-slate-100 pt-3">
                      <Link
                        to={`/cancelar-reserva?id=${r.id}&t=${r.tokenCancelacion}`}
                        className="inline-flex w-full items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-black text-red-700 hover:bg-red-100 transition-colors sm:w-auto"
                      >
                        Cancelar cita
                      </Link>
                    </div>
                  )}
                  {pestana === 'proximas' &&
                    !cancelable &&
                    ['pending', 'confirmed'].includes(r.estado) && (
                      <div className="border-t border-slate-100 pt-3">
                        <p className="text-xs text-slate-400">
                          La cancelación solo está disponible con más de 2 horas de anticipación.
                        </p>
                      </div>
                    )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SeccionApariencia({
  clienteId,
  colorSeleccionado,
  onSeleccionar,
}: {
  clienteId: string;
  colorSeleccionado: string;
  onSeleccionar: (color: string) => void;
}) {
  return (
    <section
      className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm"
      aria-labelledby="titulo-apariencia"
    >
      <div className="flex items-center gap-2 mb-4">
        <Palette className="w-5 h-5 text-pink-600" aria-hidden="true" />
        <h2 id="titulo-apariencia" className="font-black text-slate-900">
          Apariencia
        </h2>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        Elige un color para personalizar la interfaz del cliente en este dispositivo.
      </p>
      <div className="flex flex-wrap gap-2">
        {COLORES_CLIENTE.map((color) => (
          <button
            key={color}
            type="button"
            aria-label={`Seleccionar color ${color} para tu perfil`}
            aria-pressed={colorSeleccionado === color}
            onClick={() => {
              localStorage.setItem(`color_cliente_${clienteId}`, color);
              onSeleccionar(color);
            }}
            className="h-10 w-10 rounded-full border-2 transition-transform hover:scale-105"
            style={{
              backgroundColor: color,
              borderColor: colorSeleccionado === color ? '#1e293b' : 'transparent',
              outline: colorSeleccionado === color ? '2px solid #1e293b' : '2px solid transparent',
              outlineOffset: '2px',
            }}
          />
        ))}
      </div>
    </section>
  );
}

// ── Sección Contraseña ───────────────────────────────────────────────────────
function SeccionContrasena({
  form,
  onGuardar,
  guardando,
}: {
  form: ReturnType<typeof usarPerfilCliente>['formContrasena'];
  onGuardar: () => void;
  guardando: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  return (
    <section aria-labelledby="titulo-contrasena">
      <button
        id="titulo-contrasena"
        onClick={() => setAbierto((a) => !a)}
        className="w-full flex items-center justify-between bg-white border border-slate-100 rounded-2xl px-5 py-4 text-sm font-bold text-slate-800 hover:bg-slate-50 transition-colors shadow-sm"
        aria-expanded={abierto}
      >
        <span className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-slate-400" aria-hidden="true" /> Cambiar contraseña
        </span>
        <ChevronRight
          className={`w-4 h-4 text-slate-400 transition-transform ${abierto ? 'rotate-90' : ''}`}
          aria-hidden="true"
        />
      </button>
      {abierto && (
        <div
          className="bg-white border border-slate-100 rounded-2xl mt-1 p-5 shadow-sm space-y-3"
          role="form"
          aria-label="Formulario cambiar contraseña"
        >
          {[
            { campo: 'contrasenaActual' as const, label: 'Contraseña actual' },
            { campo: 'contrasenaNueva' as const, label: 'Nueva contraseña' },
            { campo: 'confirmar' as const, label: 'Confirmar contraseña' },
          ].map(({ campo, label }) => (
            <div key={campo}>
              <label htmlFor={campo} className="block text-xs font-bold text-slate-600 mb-1">
                {label}
              </label>
              <input
                id={campo}
                type="password"
                {...form.register(campo)}
                className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                aria-describedby={form.formState.errors[campo] ? `${campo}-error` : undefined}
              />
              {form.formState.errors[campo] && (
                <p id={`${campo}-error`} className="text-xs text-red-500 mt-1" role="alert">
                  {form.formState.errors[campo]?.message}
                </p>
              )}
            </div>
          ))}
          <button
            onClick={onGuardar}
            disabled={guardando}
            className="w-full bg-pink-600 text-white rounded-xl py-3 text-sm font-black hover:bg-pink-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {guardando ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Guardando…
              </>
            ) : (
              'Actualizar contraseña'
            )}
          </button>
        </div>
      )}
    </section>
  );
}

function SeccionNotificaciones() {
  const [procesando, setProcesando] = useState(false);
  const push = usarNotificacionesPush();

  return (
    <section
      aria-labelledby="titulo-notificaciones"
      className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm"
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 id="titulo-notificaciones" className="font-black text-slate-900">
            Notificaciones
          </h2>
          <p className="text-sm text-slate-500 mt-1">
            Recibe recordatorios y cambios de tus citas directamente en el navegador.
          </p>
        </div>
        <button
          type="button"
          disabled={!push.soportado || procesando}
          onClick={async () => {
            setProcesando(true);
            try {
              if (push.notificacionesActivas) {
                await push.desactivar();
              } else {
                await push.activar();
              }
            } finally {
              setProcesando(false);
            }
          }}
          className={`min-w-28 rounded-xl px-4 py-2 text-sm font-black transition-colors disabled:opacity-60 ${push.notificacionesActivas ? 'bg-slate-900 text-white' : 'bg-pink-600 text-white'}`}
        >
          {procesando ? 'Procesando...' : push.notificacionesActivas ? 'Desactivar' : 'Activar'}
        </button>
      </div>
      {!push.soportado && (
        <p className="text-xs text-amber-600 mt-3 font-bold">
          Este navegador no soporta notificaciones push web.
        </p>
      )}
    </section>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────
export function PaginaPerfilCliente() {
  const navegar = useNavigate();
  const ubicacion = useLocation();
  const {
    consulta,
    consultaReservas,
    formPerfil,
    formContrasena,
    mutarPerfil,
    mutarEmail,
    mutarContrasena,
    cambiarAvatar,
    guardarPerfil,
    notificacion,
  } = usarPerfilCliente();
  const { data: perfil, isLoading, isError } = consulta;
  const reservas = consultaReservas.data ?? perfil?.reservas ?? [];
  const fechaNacimiento = formPerfil.watch('fechaNacimiento') ?? '';
  const [dialogoSalidaAbierto, setDialogoSalidaAbierto] = useState(false);
  const [confirmacionGuardadoVisible, setConfirmacionGuardadoVisible] = useState(false);
  const [emailNuevo, setEmailNuevo] = useState('');
  const [colorCliente, setColorCliente] = useState('#F48FB1');
  const vistaActiva = ubicacion.hash === '#reservas' ? 'reservas' : 'perfil';
  const pestanaReservasInicial = ubicacion.hash === '#reservas' ? 'proximas' : 'historial';

  useEffect(() => {
    if (!perfil) {
      return;
    }

    setEmailNuevo(perfil.emailPendiente ?? perfil.email);
    const colorGuardado = localStorage.getItem(`color_cliente_${perfil.id}`);
    setColorCliente(colorGuardado ?? '#F48FB1');
  }, [perfil]);

  usarTemaSalon(colorCliente);

  useEffect(() => {
    if (!confirmacionGuardadoVisible) {
      return undefined;
    }

    const temporizador = window.setTimeout(() => setConfirmacionGuardadoVisible(false), 4000);
    return () => window.clearTimeout(temporizador);
  }, [confirmacionGuardadoVisible]);

  async function manejarGuardadoPerfil(datos: Parameters<typeof guardarPerfil>[0]) {
    await guardarPerfil(datos);
    setConfirmacionGuardadoVisible(true);
  }

  function volverAlInicio() {
    if (formPerfil.formState.isDirty) {
      setDialogoSalidaAbierto(true);
      return;
    }

    navegar('/cliente/inicio');
  }

  function confirmarSalida() {
    setDialogoSalidaAbierto(false);
    navegar('/cliente/inicio');
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Spinner tamaño="lg" />
      </div>
    );
  }
  if (isError || !perfil) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-500 font-bold">No se pudo cargar el perfil</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28 md:pb-10">
      {(notificacion || confirmacionGuardadoVisible) && (
        <div className="pointer-events-none fixed right-4 top-4 z-50 w-full max-w-sm px-4 md:px-0">
          <div
            className={`rounded-2xl border px-5 py-4 text-sm font-bold shadow-2xl ${
              (notificacion?.variante ?? 'exito') === 'exito'
                ? 'border-green-200 bg-green-600 text-white shadow-green-600/20'
                : (notificacion?.variante ?? 'exito') === 'error'
                  ? 'border-red-200 bg-red-600 text-white shadow-red-600/20'
                  : 'border-slate-200 bg-slate-950 text-white shadow-slate-950/20'
            }`}
            role="status"
            aria-live="polite"
          >
            {notificacion?.mensaje ?? 'Perfil actualizado'}
          </div>
        </div>
      )}
      <NavegacionCliente />
      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <button
          type="button"
          onClick={volverAlInicio}
          className="text-sm font-black text-slate-600 hover:text-pink-600 transition-colors"
        >
          ← Volver al inicio
        </button>

        <section className="bg-white border border-slate-100 rounded-3xl p-2 shadow-sm">
          <div className="grid grid-cols-2 gap-2">
            <Link
              to="/mi-perfil"
              className={`rounded-2xl px-4 py-3 text-sm font-black text-center transition-colors ${vistaActiva === 'perfil' ? 'bg-pink-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Mi perfil
            </Link>
            <Link
              to="/mi-perfil#reservas"
              className={`rounded-2xl px-4 py-3 text-sm font-black text-center transition-colors ${vistaActiva === 'reservas' ? 'bg-pink-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              Mis reservas
            </Link>
          </div>
        </section>

        {vistaActiva === 'perfil' && (
          <SeccionAvatar
            avatarUrl={perfil.avatarUrl}
            nombre={perfil.nombre}
            apellido={perfil.apellido}
            email={perfil.email}
            pais={perfil.pais}
            onCambiar={cambiarAvatar}
          />
        )}

        {vistaActiva === 'reservas' && (
          <section className="bg-pink-50 border border-pink-100 rounded-3xl p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-pink-600 mb-2">
              Vista activa
            </p>
            <h1 className="text-2xl font-black text-slate-900">Tus reservas y cancelaciones</h1>
            <p className="text-sm text-slate-600 mt-1">
              Desde aquí puedes revisar tus próximas citas, abrir tu historial y cancelar una
              reserva activa sin salir de tu panel.
            </p>
          </section>
        )}

        {vistaActiva === 'reservas' && (
          <SeccionReservas reservas={reservas} pestanaInicial={pestanaReservasInicial} />
        )}

        {vistaActiva === 'perfil' && (
          <section
            aria-labelledby="titulo-datos"
            className="bg-white border border-slate-100 rounded-3xl p-6 shadow-sm"
          >
            <h2 id="titulo-datos" className="font-black text-slate-900 mb-4">
              Mis datos
            </h2>
            <form
              onSubmit={formPerfil.handleSubmit(manejarGuardadoPerfil)}
              className="space-y-3"
              aria-label="Editar datos personales"
            >
              {[
                { campo: 'nombre' as const, label: 'Nombre', type: 'text' },
                { campo: 'apellido' as const, label: 'Apellido', type: 'text' },
                { campo: 'telefono' as const, label: 'Teléfono', type: 'tel' },
              ].map(({ campo, label, type }) => (
                <div key={campo}>
                  <label htmlFor={campo} className="block text-xs font-bold text-slate-600 mb-1">
                    {label}
                  </label>
                  <input
                    id={campo}
                    type={type}
                    {...formPerfil.register(campo)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                    aria-describedby={
                      formPerfil.formState.errors[campo] ? `${campo}-error` : undefined
                    }
                  />
                  {formPerfil.formState.errors[campo] && (
                    <p id={`${campo}-error`} className="text-xs text-red-500 mt-1" role="alert">
                      {formPerfil.formState.errors[campo]?.message}
                    </p>
                  )}
                </div>
              ))}
              <div>
                <input type="hidden" {...formPerfil.register('fechaNacimiento')} />
                <SelectorFecha
                  etiqueta="Fecha de nacimiento"
                  valor={fechaNacimiento}
                  max={new Date().toISOString().split('T')[0]}
                  error={formPerfil.formState.errors.fechaNacimiento?.message}
                  alCambiar={(valor) =>
                    formPerfil.setValue('fechaNacimiento', valor, {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: true,
                    })
                  }
                />
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Mail className="w-4 h-4 text-pink-600" aria-hidden="true" />
                  <p className="text-sm font-black text-slate-800">Correo de acceso</p>
                </div>
                <label
                  htmlFor="email-actualizacion"
                  className="block text-xs font-bold text-slate-600"
                >
                  Nuevo correo electrónico
                </label>
                <input
                  id="email-actualizacion"
                  type="email"
                  value={emailNuevo}
                  onChange={(evento) => setEmailNuevo(evento.target.value)}
                  className="w-full border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                />
                <p className="text-xs text-slate-500">
                  Tu correo actual seguirá funcionando hasta que confirmes el nuevo enlace enviado.
                </p>
                {perfil.emailPendiente && (
                  <p className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    Cambio pendiente: {perfil.emailPendiente}
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => mutarEmail.mutate(emailNuevo)}
                  disabled={
                    mutarEmail.isPending ||
                    !emailNuevo.trim() ||
                    emailNuevo.trim() === perfil.emailPendiente ||
                    emailNuevo.trim() === perfil.email
                  }
                  className="w-full rounded-xl border border-pink-200 bg-pink-50 px-4 py-3 text-sm font-black text-pink-700 transition-colors hover:bg-pink-100 disabled:opacity-60"
                >
                  {mutarEmail.isPending ? 'Enviando verificación...' : 'Actualizar email'}
                </button>
              </div>
              <button
                type="submit"
                disabled={mutarPerfil.isPending}
                className="w-full bg-pink-600 text-white rounded-xl py-3 text-sm font-black hover:bg-pink-700 transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {mutarPerfil.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> Guardando…
                  </>
                ) : (
                  'Guardar cambios'
                )}
              </button>
            </form>
          </section>
        )}

        {vistaActiva === 'perfil' && <SeccionNotificaciones />}

        {vistaActiva === 'perfil' && (
          <SeccionApariencia
            clienteId={perfil.id}
            colorSeleccionado={colorCliente}
            onSeleccionar={setColorCliente}
          />
        )}

        {vistaActiva === 'perfil' && (
          <SeccionContrasena
            form={formContrasena}
            onGuardar={formContrasena.handleSubmit((d) => mutarContrasena.mutate(d))}
            guardando={mutarContrasena.isPending}
          />
        )}

        {vistaActiva === 'perfil' && (
          <SeccionFidelidad fidelidad={perfil.fidelidad} mensajeVacio={perfil.mensajeFidelidad} />
        )}
      </main>

      <DialogoConfirmacion
        abierto={dialogoSalidaAbierto}
        mensaje="Tienes cambios sin guardar. ¿Salir de todas formas?"
        textoCancelar="Seguir editando"
        textoConfirmar="Salir"
        onCancelar={() => setDialogoSalidaAbierto(false)}
        onConfirmar={confirmarSalida}
      />
    </div>
  );
}
