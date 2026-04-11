import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Store,
  LogOut,
  Copy,
  Link2,
  MessageCircle,
  Download,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Wallet,
  Calendar,
} from 'lucide-react';
import { formatearDinero } from '../../utils/formato';
import { usarContextoApp } from '../../contextos/ContextoApp';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';
import { usarToast } from '../../componentes/ui/ProveedorToast';
import { obtenerFechaLocalISO, obtenerEstadoSuscripcion } from '../../utils/formato';
import { AgendaDiaria } from './componentes/AgendaDiaria';
import { ModalCrearReservaManual } from './componentes/ModalCrearReservaManual';
import { GestorFestivos } from './componentes/GestorFestivos';
import { ModalBienvenidaSalon } from './componentes/ModalBienvenidaSalon';
import { ModalSuspension } from './componentes/ModalSuspension';
import { PanelNotificaciones } from './componentes/PanelNotificaciones';
import { usarNotificacionesEstudio } from './hooks/usarNotificacionesEstudio';
import { Spinner } from '../../componentes/ui/Spinner';
import { BannerNotificacionesPush } from '../../componentes/ui/BannerNotificacionesPush';
import { usarNotificacionesPush } from '../../hooks/usarNotificacionesPush';
import { env } from '../../lib/env';
import { DIAS_SEMANA } from '../../lib/constantes';
import { obtenerDefinicionPlan } from '../../lib/planes';
import { colorMasClaro } from '../../utils/color';
import { actualizarEstudio } from '../../servicios/servicioEstudios';
import type { Moneda, Estudio } from '../../tipos';

function obtenerOrigenReservas(): string {
  const origenActual = window.location.origin;
  if (/localhost|127\.0\.0\.1/.test(env.VITE_URL_API)) {
    return origenActual;
  }
  if (env.VITE_URL_PUBLICA) {
    return env.VITE_URL_PUBLICA;
  }
  return origenActual;
}

function diaTieneHorarioModificado(fecha: Date, estudio: Estudio) {
  const claveDia = DIAS_SEMANA[fecha.getDay()];
  const horarioDia = estudio.schedule?.[claveDia];
  if (!horarioDia?.isOpen) return false;

  return (estudio.staff ?? []).some((especialista) => {
    if (!especialista.active) return false;
    if (especialista.workingDays && !especialista.workingDays.includes(fecha.getDay())) {
      return true;
    }

    const inicioEspecialista = especialista.shiftStart ?? horarioDia.openTime;
    const finEspecialista = especialista.shiftEnd ?? horarioDia.closeTime;
    const tieneDescanso = Boolean(especialista.breakStart && especialista.breakEnd);

    return (
      inicioEspecialista !== horarioDia.openTime ||
      finEspecialista !== horarioDia.closeTime ||
      tieneDescanso
    );
  });
}

export function PaginaAgenda() {
  usarTituloPagina('Agenda');
  const { slug } = useParams<{ slug: string }>();
  const navegar = useNavigate();
  const { estudios, reservas, cargando, recargar } = usarContextoApp();
  const { cerrarSesion, usuario } = usarTiendaAuth();
  const { mostrarToast } = usarToast();
  const [fechaVista, setFechaVista] = useState(new Date());
  const [mostrarBienvenida, setMostrarBienvenida] = useState(true);
  const [mostrarModalCrearCita, setMostrarModalCrearCita] = useState(false);
  const [activandoPush, setActivandoPush] = useState(false);
  const [qrReserva, setQrReserva] = useState<string | null>(null);
  const push = usarNotificacionesPush();
  const estudiosDisponibles = estudios ?? [];
  const reservasDisponibles = reservas ?? [];

  const estudio = estudiosDisponibles.find((s) => s.slug === slug || s.id === slug);
  const estudioId = estudio?.id;
  const { notificaciones, marcarLeida } = usarNotificacionesEstudio(estudioId);

  useEffect(() => {
    if (!estudio?.slug || !slug || slug === estudio.slug) return;
    navegar(`/estudio/${estudio.slug}/agenda`, { replace: true });
  }, [estudio?.slug, slug, navegar]);

  const identificadorPublicoReserva = estudio?.slug?.trim() || estudio?.clientKey || null;
  const linkReservas = identificadorPublicoReserva
    ? `${obtenerOrigenReservas()}/reservar/${identificadorPublicoReserva}`
    : null;

  useEffect(() => {
    setMostrarBienvenida(Boolean(estudio?.primeraVez));
  }, [estudio?.id, estudio?.primeraVez]);

  useEffect(() => {
    if (!linkReservas) {
      setQrReserva(null);
      return;
    }

    let activo = true;
    void QRCode.toDataURL(linkReservas, { width: 360, margin: 1 }).then((url) => {
      if (activo) {
        setQrReserva(url);
      }
    });

    return () => {
      activo = false;
    };
  }, [linkReservas]);

  if (cargando)
    return (
      <div className="h-screen bg-slate-50 flex items-center justify-center">
        <Spinner tamaño="lg" />
      </div>
    );
  if (!estudio)
    return (
      <div className="h-screen bg-slate-50 flex items-center justify-center">
        <p className="text-slate-400 font-bold">Salón no encontrado.</p>
      </div>
    );

  const moneda: Moneda = estudio.country === 'Colombia' ? 'COP' : 'MXN';
  const reservasEstudio = reservasDisponibles.filter((r) => r.studioId === estudio.id);

  const ahora = new Date();
  const horaActual = ahora.getHours();
  const saludoTiempo =
    horaActual < 12 ? 'Buenos días' : horaActual < 18 ? 'Buenas tardes' : 'Buenas noches';
  const nombreSaludo = usuario?.nombre?.trim() || estudio.owner || estudio.name;
  const hoyStr = obtenerFechaLocalISO(ahora);
  const mesPrefijo = hoyStr.substring(0, 7);
  const citasHoy = reservasEstudio.filter((r) => r.date === hoyStr && r.status !== 'cancelled');
  const totalCompletadoMes = reservasEstudio
    .filter((r) => r.date.startsWith(mesPrefijo) && r.status === 'completed')
    .reduce((sum, r) => sum + (r.totalPrice ?? 0), 0);
  const especialistasActivos = (estudio.staff ?? []).filter((s) => s.active).length;
  const colorPrimario = estudio.colorPrimario ?? '#C2185B';
  const definicionPlan = obtenerDefinicionPlan(estudio.plan);
  const monedaPlan = estudio.monedaSuscripcion ?? moneda;
  const precioPlanActual = estudio.precioRenovacion ?? estudio.precioSuscripcionActual;
  const estadoSub = obtenerEstadoSuscripcion(estudio);
  const diasRestantes = estadoSub?.daysRemaining ?? 0;
  const colorDiasRestantes =
    diasRestantes > 15 ? 'text-green-400' : diasRestantes >= 8 ? 'text-yellow-300' : 'text-red-400';

  const copiarLink = () => {
    if (!linkReservas) return;
    navigator.clipboard
      .writeText(linkReservas)
      .then(() => mostrarToast({ mensaje: 'Enlace copiado al portapapeles', variante: 'exito' }));
  };

  const compartirWhatsApp = () => {
    if (!linkReservas) return;
    const mensaje = `Hola. Te comparto el link de reservas de ${estudio.name}: ${linkReservas}`;
    if (navigator.share) {
      void navigator.share({
        title: `Reservas de ${estudio.name}`,
        text: mensaje,
        url: linkReservas,
      });
      return;
    }
    const mensajeWA = encodeURIComponent(mensaje);
    window.open(`https://wa.me/?text=${mensajeWA}`, '_blank', 'noopener');
  };

  const abrirLinkReservas = () => {
    if (!identificadorPublicoReserva) return;
    window.open(`/reservar/${identificadorPublicoReserva}`, '_blank', 'noopener');
  };

  const descargarQr = () => {
    if (!qrReserva) return;
    const fecha = new Date().toLocaleDateString('es-MX', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const enlace = document.createElement('a');
    enlace.href = qrReserva;
    enlace.download = `${estudio.name.replace(/\s+/g, '_').toUpperCase()}_${fecha.replace(/\s+/g, '')}.png`;
    enlace.click();
  };

  const cambiarMes = (offset: number) => {
    setFechaVista((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };
  const primerDia = new Date(fechaVista.getFullYear(), fechaVista.getMonth(), 1).getDay();
  const diasEnMes = new Date(fechaVista.getFullYear(), fechaVista.getMonth() + 1, 0).getDate();
  const diasCalendario = Array.from({ length: 42 }, (_, i) => {
    const d = i - primerDia + 1;
    return d > 0 && d <= diasEnMes ? d : null;
  });
  const fechaSelStr = obtenerFechaLocalISO(fechaVista);

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      <BannerNotificacionesPush
        visible={push.bannerVisible}
        activando={activandoPush}
        mensaje="Activa las notificaciones para recibir avisos de nuevas citas y cancelaciones"
        onActivar={async () => {
          setActivandoPush(true);
          try {
            await push.activar();
          } finally {
            setActivandoPush(false);
          }
        }}
        onDescartar={push.descartar}
      />
      <header className="no-imprimir bg-white p-6 md:p-8 border-b border-slate-200 flex justify-between items-center sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-pink-600 p-3 rounded-2xl text-white">
            <Store />
          </div>
          <div>
            <h1 className="text-xl md:text-3xl font-black italic uppercase leading-none">
              {estudio.name}
            </h1>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">
              Portal Administrativo
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <PanelNotificaciones
            notificaciones={notificaciones}
            pais={estudio?.country ?? 'Mexico'}
            onMarcarLeida={marcarLeida}
          />
          <button
            onClick={cerrarSesion}
            aria-label="Cerrar sesión"
            className="p-3 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-400"
          >
            <LogOut />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        {/* Saludo y resumen del día */}
        <div
          className="rounded-[2.75rem] p-6 text-white shadow-lg md:p-8"
          style={{
            background: `linear-gradient(135deg, var(--color-primario), ${colorMasClaro(colorPrimario)})`,
          }}
        >
          <div className="mx-auto max-w-4xl text-center">
            <p className="text-sm font-bold opacity-80 md:text-base">
              {saludoTiempo}, {nombreSaludo}
            </p>
            <p className="mt-2 text-sm opacity-70 capitalize md:text-base">
              {ahora.toLocaleDateString('es-ES', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
          </div>
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
            <div className="rounded-[1.75rem] border border-white/20 bg-white/14 px-4 py-4 backdrop-blur-sm text-center sm:text-left">
              <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">
                Citas agendadas hoy
              </p>
              <p className="text-2xl font-black">{citasHoy.length}</p>
            </div>
            <div className="rounded-[1.75rem] border border-white/20 bg-white/14 px-4 py-4 backdrop-blur-sm text-center sm:text-left">
              <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">
                Total ganado del mes
              </p>
              <p className="text-xl font-black">{formatearDinero(totalCompletadoMes, moneda)}</p>
            </div>
            <div className="rounded-[1.75rem] border border-white/20 bg-white/14 px-4 py-4 backdrop-blur-sm text-center sm:text-left">
              <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">
                Especialistas activos
              </p>
              <p className="text-2xl font-black">{especialistasActivos}</p>
            </div>
            <div className="rounded-[1.75rem] border border-white/20 bg-white/14 px-4 py-4 backdrop-blur-sm text-center sm:text-left">
              <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">
                Plan actual
              </p>
              <p className="text-lg font-black">{definicionPlan.nombre}</p>
              <p className="text-xs font-bold opacity-90">
                {precioPlanActual
                  ? formatearDinero(precioPlanActual, monedaPlan)
                  : 'Precio no disponible'}
              </p>
            </div>
            <div className="rounded-[1.75rem] border border-white/20 bg-white/14 px-4 py-4 backdrop-blur-sm text-center sm:text-left">
              <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">
                Días para corte
              </p>
              <p className={`text-2xl font-black ${colorDiasRestantes}`}>{diasRestantes}</p>
            </div>
          </div>
        </div>

        <div className="no-imprimir flex bg-slate-200/50 p-1 rounded-2xl w-fit border border-slate-200 mx-auto md:mx-0">
          <button
            onClick={() => navegar(`/estudio/${estudio.slug || estudio.id}/agenda`)}
            className="px-4 md:px-6 py-3 rounded-xl text-[10px] md:text-xs font-black transition-all flex items-center gap-2 bg-white shadow-sm text-slate-900"
          >
            <Calendar className="w-4 h-4" /> Agenda
          </button>
          <button
            onClick={() => navegar(`/estudio/${estudio.slug || estudio.id}/admin`)}
            className="px-4 md:px-6 py-3 rounded-xl text-[10px] md:text-xs font-black transition-all flex items-center gap-2 text-slate-500 hover:text-slate-800"
          >
            <Wallet className="w-4 h-4" /> Administración
          </button>
        </div>

        {/*
          Grid aplanado: cada sección es un item directo del grid.
          - Móvil (1 col): order-N controla el orden visual.
          - Desktop (12 cols): col-span + posición explícita para la agenda.
          Orden móvil: 1=link, 2=calendario, 3=agenda, 4=festivos, 5=personal.
        */}
        <div className="grid grid-cols-1 lg:grid-cols-12 lg:items-start gap-8">
          {/* 1 — Link de reservas */}
          <div className="order-1 lg:col-span-5">
            <div className="bg-white rounded-[2.5rem] p-5 border border-slate-200 shadow-sm">
              <div className="flex items-center gap-2 mb-3">
                <Link2 className="w-4 h-4 text-pink-500" aria-hidden="true" />
                <h2 className="text-sm font-black uppercase text-slate-700 tracking-wide">
                  Link de reservas de tu salón
                </h2>
              </div>
              <p className="mb-3 text-xs text-slate-500">
                Comparte este enlace público. Ya queda listo para usar tu dominio productivo cuando
                se configure.
              </p>
              <div className="bg-slate-50 rounded-xl px-4 py-2.5 flex items-center border border-slate-100 overflow-hidden">
                <span className="text-xs font-mono text-slate-600 truncate flex-1">
                  {linkReservas}
                </span>
              </div>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={copiarLink}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-100 py-2.5 text-xs font-black text-slate-700 hover:bg-slate-200 transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" aria-hidden="true" /> Copiar enlace
                </button>
                <button
                  type="button"
                  onClick={abrirLinkReservas}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-slate-200 py-2.5 text-xs font-black text-slate-700 transition-colors hover:bg-slate-100"
                >
                  <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" /> Abrir link de reservas
                </button>
              </div>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={compartirWhatsApp}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-green-500 py-2.5 text-xs font-black text-white hover:bg-green-600 transition-colors"
                >
                  <MessageCircle className="w-3.5 h-3.5" aria-hidden="true" /> WhatsApp
                </button>
                <button
                  type="button"
                  onClick={descargarQr}
                  disabled={!qrReserva}
                  className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-slate-900 py-2.5 text-xs font-black text-white transition-colors hover:bg-black disabled:opacity-60"
                >
                  <Download className="w-3.5 h-3.5" aria-hidden="true" /> Descargar QR
                </button>
              </div>
            </div>
          </div>

          {/* 2 — Calendario */}
          <div className="order-2 lg:col-span-5">
            <div className="bg-white rounded-[3rem] p-6 md:p-8 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <button
                  onClick={() => cambiarMes(-1)}
                  aria-label="Mes anterior"
                  className="p-2 hover:bg-slate-100 rounded-full"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <h3 className="text-xl font-black italic uppercase tracking-tighter">
                  {fechaVista.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}
                </h3>
                <button
                  onClick={() => cambiarMes(1)}
                  aria-label="Mes siguiente"
                  className="p-2 hover:bg-slate-100 rounded-full"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              <div className="grid grid-cols-7 mb-4 text-center text-[10px] font-black text-slate-400 uppercase">
                {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => (
                  <div key={i}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5 md:gap-2">
                {diasCalendario.map((dia, i) => {
                  if (!dia) return <div key={i} />;
                  const dateObj = new Date(fechaVista.getFullYear(), fechaVista.getMonth(), dia);
                  const dateStr = obtenerFechaLocalISO(dateObj);
                  const seleccionado = dateStr === fechaSelStr;
                  const tieneCitas = reservasEstudio.some((b) => b.date === dateStr);
                  const claveDia = DIAS_SEMANA[dateObj.getDay()];
                  const horarioDia = estudio.schedule?.[claveDia];
                  const esFestivo = estudio.holidays?.includes(dateStr);
                  const esCierre = Boolean(esFestivo || (horarioDia && !horarioDia.isOpen));
                  const tieneHorarioModificado =
                    !esCierre && diaTieneHorarioModificado(dateObj, estudio);
                  return (
                    <div key={i} className="aspect-square flex items-center justify-center">
                      <button
                        onClick={() => setFechaVista(dateObj)}
                        className={`w-full h-full rounded-2xl font-black text-xs md:text-sm transition-all relative flex flex-col items-center justify-center ${seleccionado ? 'bg-slate-900 text-white shadow-lg scale-110 z-10' : esCierre ? 'bg-red-50 text-red-400 border border-red-100' : 'text-slate-600 hover:bg-slate-100'}`}
                        aria-label={dateStr}
                        aria-pressed={seleccionado}
                      >
                        {dia}
                        {!seleccionado && (tieneCitas || esCierre || tieneHorarioModificado) && (
                          <span className="absolute bottom-1 flex items-center gap-1">
                            {tieneCitas && (
                              <span className="h-1.5 w-1.5 rounded-full bg-pink-500" />
                            )}
                            {esCierre && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                            {tieneHorarioModificado && (
                              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
                            )}
                          </span>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-center gap-4 text-[10px] font-black uppercase tracking-wide text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-pink-500" /> Citas
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-red-500" /> Cierres
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500" /> Horario modificado
                </span>
              </div>
            </div>
          </div>

          {/* 3 — Agenda: 3ª en móvil; columna derecha (filas 1-4) en desktop */}
          <div className="order-3 lg:col-span-7 lg:col-start-6 lg:row-start-1 lg:row-end-5">
            <AgendaDiaria
              estudio={estudio}
              reservas={reservasEstudio}
              fechaVista={fechaVista}
              onCrearCitaManual={() => setMostrarModalCrearCita(true)}
            />
          </div>

          {/* 4 — Festivos */}
          <div className="order-4 lg:col-span-5">
            <GestorFestivos estudio={estudio} />
          </div>
        </div>
      </main>

      <ModalCrearReservaManual
        abierto={mostrarModalCrearCita}
        estudio={estudio}
        fechaVista={fechaVista}
        onCerrar={() => setMostrarModalCrearCita(false)}
        onReservaCreada={recargar}
      />

      {estudio.primeraVez && mostrarBienvenida && (
        <ModalBienvenidaSalon
          nombreSalon={estudio.name}
          estudioId={estudio.id}
          onCerrar={() => {
            setMostrarBienvenida(false);
            if (estudioId) {
              void actualizarEstudio(estudioId, { primeraVez: false }).catch(() => undefined);
            }
          }}
        />
      )}

      {(estudio.estado === 'suspendido' || diasRestantes <= 0) && (
        <ModalSuspension nombreSalon={estudio.name} pais={estudio.country ?? 'Mexico'} />
      )}
    </div>
  );
}
