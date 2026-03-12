import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Camera, Lock, Star, Calendar, ChevronRight, Loader2 } from 'lucide-react';
import { NavegacionCliente } from '../../componentes/diseno/NavegacionCliente';
import { DialogoConfirmacion } from '../../componentes/ui/DialogoConfirmacion';
import { Spinner } from '../../componentes/ui/Spinner';
import { SelectorFecha } from '../../componentes/ui/SelectorFecha';
import { usarPerfilCliente } from './hooks/usarPerfilCliente';
import type { ReservaCliente, FidelidadSalon } from '../../tipos';

// ── Helpers ──────────────────────────────────────────────────────────────────
function inicialesDesdeNombre(n: string, a: string) {
  return (n[0] ?? '') + (a[0] ?? '');
}

function badgeEstado(estado: string) {
  const clases: Record<string, string> = {
    pending: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    confirmed: 'bg-blue-50 text-blue-700 border-blue-200',
    completed: 'bg-green-50 text-green-700 border-green-200',
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

// ── Sección Avatar ───────────────────────────────────────────────────────────
function SeccionAvatar({
  avatarUrl,
  nombre,
  apellido,
  email,
  onCambiar,
}: {
  avatarUrl: string | null;
  nombre: string;
  apellido: string;
  email: string;
  onCambiar: (f: File) => void;
}) {
  const refInput = useRef<HTMLInputElement>(null);
  const inics = inicialesDesdeNombre(nombre, apellido).toUpperCase();

  return (
    <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm flex items-center gap-5">
      <div className="relative shrink-0">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt="Foto de perfil"
            className="w-20 h-20 rounded-full object-cover"
          />
        ) : (
          <div
            className="w-20 h-20 rounded-full bg-pink-100 text-pink-700 font-black text-2xl flex items-center justify-center"
            aria-hidden="true"
          >
            {inics}
          </div>
        )}
        <button
          onClick={() => refInput.current?.click()}
          aria-label="Cambiar foto de perfil"
          className="absolute bottom-0 right-0 w-7 h-7 rounded-full bg-pink-600 text-white flex items-center justify-center shadow-md hover:bg-pink-700 transition-colors"
        >
          <Camera className="w-3.5 h-3.5" aria-hidden="true" />
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
      <div>
        <p className="font-black text-slate-900 text-lg">
          {nombre} {apellido}
        </p>
        <p className="text-sm text-slate-500">{email}</p>
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
            return (
              <div
                key={r.id}
                className="bg-white border border-slate-100 rounded-2xl p-4 shadow-sm flex items-center gap-4"
              >
                <div
                  className="w-10 h-10 rounded-full text-white font-black text-sm flex items-center justify-center shrink-0"
                  style={{ backgroundColor: r.salon.colorPrimario ?? '#C2185B' }}
                  aria-hidden="true"
                >
                  {(r.salon.nombre[0] ?? '').toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm text-slate-900 truncate">{r.salon.nombre}</p>
                  <p className="text-xs text-slate-500">
                    {r.especialista.nombre} · {r.fecha} {r.horaInicio}
                  </p>
                  <p className="text-xs text-slate-400 truncate">
                    {r.servicios.map((s) => s.name).join(', ')}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${clase}`}
                  >
                    {etiqueta}
                  </span>
                  {pestana === 'proximas' && r.estado !== 'cancelled' && (
                    <Link
                      to={`/cancelar-reserva/${r.id}/${r.tokenCancelacion}`}
                      className="text-[10px] font-bold text-red-500 hover:text-red-700 flex items-center gap-0.5"
                    >
                      Cancelar <ChevronRight className="w-3 h-3" aria-hidden="true" />
                    </Link>
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
  const vistaActiva = ubicacion.hash === '#reservas' ? 'reservas' : 'perfil';
  const pestanaReservasInicial = ubicacion.hash === '#reservas' ? 'proximas' : 'historial';

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

    navegar('/inicio');
  }

  function confirmarSalida() {
    setDialogoSalidaAbierto(false);
    navegar('/inicio');
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
        {vistaActiva === 'perfil' && (
          <SeccionReservas reservas={reservas} pestanaInicial={pestanaReservasInicial} />
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
