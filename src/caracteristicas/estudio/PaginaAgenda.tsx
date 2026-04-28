import { useCallback, useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Store,
  LogOut,
  Copy,
  Link2,
  MessageCircle,
  Download,
  ExternalLink,
  Wallet,
  Calendar,
  Users,
  X,
} from 'lucide-react';
import { usarContextoApp } from '../../contextos/ContextoApp';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';
import { usarToast } from '../../componentes/ui/ProveedorToast';
import { BotonIconoAccion } from '../../componentes/ui/BotonIconoAccion';
import { CalendarioEstadoSalon } from '../../componentes/ui/CalendarioEstadoSalon';
import { AgendaDiaria } from './componentes/AgendaDiaria';
import { ModalCrearReservaManual } from './componentes/ModalCrearReservaManual';
import { ModalBienvenidaSalon } from './componentes/ModalBienvenidaSalon';
import { ModalSuspension } from './componentes/ModalSuspension';
import { PanelNotificaciones } from './componentes/PanelNotificaciones';
import { MetricasSalon } from './componentes/MetricasSalon';
import { usarNotificacionesEstudio } from './hooks/usarNotificacionesEstudio';
import { Spinner } from '../../componentes/ui/Spinner';
import { BannerNotificacionesPush } from '../../componentes/ui/BannerNotificacionesPush';
import { usarNotificacionesPush } from '../../hooks/usarNotificacionesPush';
import { env } from '../../lib/env';
import { actualizarEstudio } from '../../servicios/servicioEstudios';
import { normalizarFechaReservaAgenda } from './utils/estadoCalendarioAgenda';

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

export function PaginaAgenda() {
  usarTituloPagina('Agenda');
  const { slug } = useParams<{ slug: string }>();
  const navegar = useNavigate();
  const { estudios, reservas, cargando, recargar } = usarContextoApp();
  const { cerrarSesion, usuario } = usarTiendaAuth();
  const { mostrarToast } = usarToast();
  const [fechaVista, setFechaVista] = useState(new Date());
  const [mostrarBienvenida, setMostrarBienvenida] = useState(true);
  const [bannerEspecialistaDismisado, setBannerEspecialistaDismisado] = useState(false);
  const [mostrarModalCrearCita, setMostrarModalCrearCita] = useState(false);
  const [activandoPush, setActivandoPush] = useState(false);
  const [qrReserva, setQrReserva] = useState<string | null>(null);
  const push = usarNotificacionesPush();
  const estudiosDisponibles = estudios ?? [];
  const reservasDisponibles = reservas ?? [];

  const estudio = estudiosDisponibles.find(
    (s) => s.slug === slug || s.clientKey === slug || s.id === slug,
  );
  const estudioId = estudio?.id;
  const { notificaciones, marcarLeida } = usarNotificacionesEstudio(estudioId);
  const identificadorRutaPrivada =
    estudio?.slug?.trim() || estudio?.clientKey?.trim() || estudio?.id;

  const navegacionAgendaRef = useRef(false);
  useEffect(() => {
    if (navegacionAgendaRef.current) return;
    if (!identificadorRutaPrivada || !slug) return;
    if (slug === identificadorRutaPrivada) {
      navegacionAgendaRef.current = true;
      return;
    }
    navegacionAgendaRef.current = true;
    navegar(`/estudio/${identificadorRutaPrivada}/agenda`, { replace: true });
  }, [identificadorRutaPrivada, slug, navegar]);

  const identificadorPublicoReserva = estudio?.slug?.trim() || estudio?.clientKey || null;
  const linkReservas = identificadorPublicoReserva
    ? `${obtenerOrigenReservas()}/reservar/${identificadorPublicoReserva}`
    : null;

  useEffect(() => {
    if (!estudio?.id) return;
    const clave = `btp_especialista_aviso_${estudio.id}`;
    if (sessionStorage.getItem(clave)) {
      setBannerEspecialistaDismisado(true);
    }
  }, [estudio?.id]);

  useEffect(() => {
    if (!estudio?.id || !estudio?.primeraVez) {
      setMostrarBienvenida(false);
      return;
    }
    const claveSession = `btp_bienvenida_vista_${estudio.id}`;
    if (sessionStorage.getItem(claveSession)) {
      setMostrarBienvenida(false);
      return;
    }
    setMostrarBienvenida(true);
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

  const manejarCerrarSesion = useCallback(async () => {
    await cerrarSesion();
    navegar('/iniciar-sesion', { replace: true });
  }, [cerrarSesion, navegar]);

  const manejarSalidaPorSuspension = useCallback(async () => {
    const mensajeSuspension =
      'Tu salon esta suspendido por falta de pago. Contacta soporte para reactivar tu acceso.';
    await cerrarSesion();
    navegar(
      `/iniciar-sesion?codigo=SALON_SUSPENDIDO&mensaje=${encodeURIComponent(mensajeSuspension)}`,
      {
        replace: true,
      },
    );
  }, [cerrarSesion, navegar]);

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

  const reservasEstudio = reservasDisponibles.filter((r) => r.studioId === estudio.id);

  const sinEspecialistas = (estudio.staff?.length ?? 0) === 0;
  const mostrarBannerEspecialista = sinEspecialistas && !bannerEspecialistaDismisado;

  const descartarBannerEspecialista = () => {
    sessionStorage.setItem(`btp_especialista_aviso_${estudio.id}`, '1');
    setBannerEspecialistaDismisado(true);
  };

  const ahora = new Date();
  const horaActual = ahora.getHours();
  const saludoTiempo =
    horaActual < 12 ? 'Buenos días' : horaActual < 18 ? 'Buenas tardes' : 'Buenas noches';
  const nombreSaludo = usuario?.nombre?.trim() || estudio.owner || estudio.name;
  const diasRestantes = Math.max(
    0,
    Math.ceil(
      (new Date(`${estudio.paidUntil}T23:59:59`).getTime() - new Date().getTime()) /
        (1000 * 60 * 60 * 24),
    ),
  );

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

  const volverPanelVendedor = () => {
    navegar('/vendedor');
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

  const fechasConCitasSalon = Array.from(
    new Set(
      reservasEstudio
        .filter((reserva) => reserva.status !== 'cancelled')
        .map((reserva) => normalizarFechaReservaAgenda(reserva.date)),
    ),
  );

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
          {usuario?.rol === 'vendedor' && (
            <button
              onClick={volverPanelVendedor}
              className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-800 transition hover:bg-sky-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver al panel vendedor
            </button>
          )}
          <PanelNotificaciones
            notificaciones={notificaciones}
            pais={estudio?.country ?? 'Mexico'}
            onMarcarLeida={marcarLeida}
          />
          <button
            onClick={() => {
              void manejarCerrarSesion();
            }}
            aria-label="Cerrar sesión"
            className="p-3 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-400"
          >
            <LogOut />
          </button>
        </div>
      </header>

      <main className="max-w-7xl 2xl:max-w-screen-2xl mx-auto p-4 md:p-8 space-y-8">
        <MetricasSalon
          estudioId={estudio.id}
          nombreSalon={estudio.name}
          saludo={saludoTiempo}
          nombreSaludo={nombreSaludo}
          fechaEtiqueta={ahora.toLocaleDateString('es-ES', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
          })}
        />

        {mostrarBannerEspecialista && (
          <div className="flex items-start gap-4 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 shadow-sm">
            <div className="rounded-xl bg-amber-100 p-2 text-amber-600 shrink-0">
              <Users className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-amber-900">Add your first specialist</p>
              <p className="mt-1 text-xs text-amber-700">
                Your salon doesn't have any specialists yet. Add one so clients can book
                appointments.
              </p>
              <button
                type="button"
                onClick={() => navegar(`/estudio/${identificadorRutaPrivada}/admin#equipo`)}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-600 px-4 py-2 text-xs font-black text-white transition hover:bg-amber-700"
              >
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                Go to team
              </button>
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={descartarBannerEspecialista}
              className="shrink-0 rounded-xl p-1.5 text-amber-500 transition hover:bg-amber-100 hover:text-amber-700"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        <div className="no-imprimir flex bg-slate-200/50 p-1 rounded-2xl w-fit border border-slate-200 mx-auto md:mx-0">
          <button
            onClick={() => navegar(`/estudio/${identificadorRutaPrivada}/agenda`)}
            className="px-4 md:px-6 py-3 rounded-xl text-[10px] md:text-xs font-black transition-all flex items-center gap-2 bg-white shadow-sm text-slate-900"
          >
            <Calendar className="w-4 h-4" /> Agenda
          </button>
          <button
            onClick={() => navegar(`/estudio/${identificadorRutaPrivada}/admin`)}
            className="px-4 md:px-6 py-3 rounded-xl text-[10px] md:text-xs font-black transition-all flex items-center gap-2 text-slate-500 hover:text-slate-800"
          >
            <Wallet className="w-4 h-4" /> Administración
          </button>
        </div>

        {/*
          Grid aplanado: cada sección es un item directo del grid.
          - Móvil (1 col): order-N controla el orden visual.
          - Desktop (12 cols): col-span + posición explícita para la agenda.
          Orden móvil: 1=link, 2=calendario, 3=agenda.
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
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <BotonIconoAccion
                  descripcion="Copiar enlace de reservas"
                  icono={<Copy className="h-4 w-4" aria-hidden="true" />}
                  onClick={copiarLink}
                />
                <BotonIconoAccion
                  descripcion="Abrir link de reservas"
                  icono={<ExternalLink className="h-4 w-4" aria-hidden="true" />}
                  onClick={abrirLinkReservas}
                />
                <BotonIconoAccion
                  descripcion="Enviar link por WhatsApp"
                  icono={<MessageCircle className="h-4 w-4" aria-hidden="true" />}
                  onClick={compartirWhatsApp}
                  tono="exito"
                />
                <BotonIconoAccion
                  descripcion="Descargar código QR"
                  icono={<Download className="h-4 w-4" aria-hidden="true" />}
                  onClick={descargarQr}
                  disabled={!qrReserva}
                  className="bg-slate-900 text-white hover:border-slate-900 hover:bg-black hover:text-white"
                />
                <p className="min-w-full text-[11px] font-medium text-slate-500 sm:min-w-0 sm:flex-1">
                  Toca o enfoca cada icono para ver la acción antes de ejecutarla.
                </p>
              </div>
            </div>
          </div>

          {/* 2 — Calendario */}
          <div className="order-2 lg:col-span-5">
            <CalendarioEstadoSalon
              estudio={estudio}
              fechaSeleccionada={fechaVista}
              alCambiarFecha={setFechaVista}
              fechasConCitas={fechasConCitasSalon}
              mostrarCitas
              etiquetaCitas="Citas"
              titulo="Calendario"
            />
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
              sessionStorage.setItem(`btp_bienvenida_vista_${estudioId}`, '1');
              void actualizarEstudio(estudioId, { primeraVez: false }).catch(() => {
                mostrarToast({
                  mensaje: 'No se pudo guardar que esta guia de bienvenida ya fue vista.',
                  variante: 'error',
                });
              });
            }
          }}
        />
      )}

      {(estudio.estado === 'suspendido' || diasRestantes <= 0) && (
        <ModalSuspension
          nombreSalon={estudio.name}
          pais={estudio.country ?? 'Mexico'}
          onSalir={manejarSalidaPorSuspension}
        />
      )}
    </div>
  );
}
