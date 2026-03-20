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
  CheckCircle2,
  AlertTriangle,
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
import { PanelPersonal } from './componentes/PanelPersonal';
import { GestorFestivos } from './componentes/GestorFestivos';
import { ModalBienvenidaSalon } from './componentes/ModalBienvenidaSalon';
import { Spinner } from '../../componentes/ui/Spinner';
import { BannerNotificacionesPush } from '../../componentes/ui/BannerNotificacionesPush';
import { usarNotificacionesPush } from '../../hooks/usarNotificacionesPush';
import { env } from '../../lib/env';
import { colorMasClaro } from '../../utils/color';
import type { Moneda } from '../../tipos';

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
  const { estudioId } = useParams<{ estudioId: string }>();
  const navegar = useNavigate();
  const { estudios, reservas, cargando, recargar } = usarContextoApp();
  const { cerrarSesion, usuario } = usarTiendaAuth();
  const { mostrarToast } = usarToast();
  const [fechaVista, setFechaVista] = useState(new Date());
  const [mostrarBienvenida, setMostrarBienvenida] = useState(() => {
    if (!estudioId) return true;
    return localStorage.getItem(`bienvenida_salon_${estudioId}`) !== 'visto';
  });
  const [mostrarModalCrearCita, setMostrarModalCrearCita] = useState(false);
  const [activandoPush, setActivandoPush] = useState(false);
  const [qrReserva, setQrReserva] = useState<string | null>(null);
  const push = usarNotificacionesPush();
  const estudiosDisponibles = estudios ?? [];
  const reservasDisponibles = reservas ?? [];

  const estudio = estudiosDisponibles.find((s) => s.id === estudioId);

  const linkReservas = estudio ? `${obtenerOrigenReservas()}/reservar/${estudio.clientKey}` : null;

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
        <p className="text-slate-400 font-bold">Studio no encontrado.</p>
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
  const citasHoy = reservasEstudio.filter((r) => r.date === hoyStr && r.status !== 'cancelled');
  const totalEstimadoHoy = citasHoy.reduce((sum, r) => sum + r.totalPrice, 0);
  const especialistasActivos = (estudio.staff ?? []).filter((s) => s.active).length;
  const colorPrimario = estudio.colorPrimario ?? '#C2185B';

  const copiarLink = () => {
    if (!linkReservas) return;
    navigator.clipboard
      .writeText(linkReservas)
      .then(() => mostrarToast({ mensaje: 'Enlace copiado al portapapeles', variante: 'exito' }));
  };

  const compartirWhatsApp = () => {
    if (!linkReservas) return;
    const mensajeWA = encodeURIComponent(`Reserva tu cita en ${estudio.name}: ${linkReservas}`);
    window.open(`https://wa.me/?text=${mensajeWA}`, '_blank', 'noopener');
  };

  const abrirLinkReservas = () => {
    window.open(`/reservar/${estudio.clientKey}`, '_blank', 'noopener');
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
  const subStatus = obtenerEstadoSuscripcion(estudio);
  const subPrecio = moneda === 'COP' ? '$200,000 COP' : '$1,000 MXN';

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
        <button
          onClick={cerrarSesion}
          aria-label="Cerrar sesión"
          className="p-3 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-400"
        >
          <LogOut />
        </button>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        {/* Saludo y resumen del día */}
        <div
          className="rounded-[2.5rem] p-6 text-white shadow-lg md:p-8"
          style={{
            background: `linear-gradient(135deg, var(--color-primario), ${colorMasClaro(colorPrimario)})`,
          }}
        >
          <div>
            <p className="text-sm font-bold opacity-80">
              {saludoTiempo}, {nombreSaludo}
            </p>
            <h2 className="text-2xl md:text-3xl font-black uppercase leading-tight mt-1">
              {estudio.name}
            </h2>
            <p className="mt-2 text-sm opacity-70 capitalize">
              {ahora.toLocaleDateString('es-ES', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
              })}
            </p>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <div className="bg-white/20 rounded-2xl px-5 py-3 min-w-27.5 backdrop-blur-sm">
              <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">
                Citas hoy
              </p>
              <p className="text-2xl font-black">{citasHoy.length}</p>
            </div>
            <div className="bg-white/20 rounded-2xl px-5 py-3 min-w-32.5 backdrop-blur-sm">
              <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">
                Total estimado
              </p>
              <p className="text-xl font-black">{formatearDinero(totalEstimadoHoy, moneda)}</p>
            </div>
            <div className="bg-white/20 rounded-2xl px-5 py-3 min-w-27.5 backdrop-blur-sm">
              <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest">
                Especialistas
              </p>
              <p className="text-2xl font-black">{especialistasActivos}</p>
            </div>
          </div>
        </div>

        <div className="no-imprimir flex bg-slate-200/50 p-1 rounded-2xl w-fit border border-slate-200 mx-auto md:mx-0">
          <button
            onClick={() => navegar(`/estudio/${estudio.id}/agenda`)}
            className="px-4 md:px-6 py-3 rounded-xl text-[10px] md:text-xs font-black transition-all flex items-center gap-2 bg-white shadow-sm text-slate-900"
          >
            <Calendar className="w-4 h-4" /> Agenda & Personal
          </button>
          <button
            onClick={() => navegar(`/estudio/${estudio.id}/admin`)}
            className="px-4 md:px-6 py-3 rounded-xl text-[10px] md:text-xs font-black transition-all flex items-center gap-2 text-slate-500 hover:text-slate-800"
          >
            <Wallet className="w-4 h-4" /> Administración
          </button>
        </div>

        {subStatus?.status === 'ACTIVE' && (
          <div className="bg-green-50 rounded-2xl p-4 text-green-800 text-xs flex items-center gap-2 border border-green-200">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <span>
              <span className="font-black uppercase">Suscripción Activa.</span> Día de corte:{' '}
              {subStatus.cutDay} de cada mes.
            </span>
          </div>
        )}
        {(subStatus?.status === 'WARNING' || subStatus?.status === 'OVERDUE') && (
          <div
            className={`border-2 p-6 rounded-4xl flex items-start gap-6 ${subStatus.status === 'OVERDUE' ? 'bg-red-50 border-red-400' : 'bg-yellow-50 border-yellow-400'}`}
          >
            <div
              className={`p-4 rounded-full text-white shrink-0 ${subStatus.status === 'OVERDUE' ? 'bg-red-500' : 'bg-yellow-400'}`}
            >
              <AlertTriangle className="w-8 h-8" />
            </div>
            <div>
              <h4
                className={`font-black uppercase text-xl mb-1 ${subStatus.status === 'OVERDUE' ? 'text-red-800' : 'text-yellow-800'}`}
              >
                {subStatus.status === 'OVERDUE' ? 'Suscripción Vencida' : 'Aviso de Renovación'}
              </h4>
              <p
                className={`text-sm font-medium ${subStatus.status === 'OVERDUE' ? 'text-red-900' : 'text-yellow-900'}`}
              >
                Tu membresía {subStatus.status === 'OVERDUE' ? 'venció el' : 'vence el'}{' '}
                <strong>{subStatus.dueDateStr}</strong>. Deposita <strong>{subPrecio}</strong> a la
                cuenta asignada.
              </p>
            </div>
          </div>
        )}

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
                  const esFestivo = estudio.holidays?.includes(dateStr);
                  return (
                    <div key={i} className="aspect-square flex items-center justify-center">
                      <button
                        onClick={() => setFechaVista(dateObj)}
                        className={`w-full h-full rounded-2xl font-black text-xs md:text-sm transition-all relative flex flex-col items-center justify-center ${seleccionado ? 'bg-slate-900 text-white shadow-lg scale-110 z-10' : esFestivo ? 'bg-red-50 text-red-400 border border-red-100' : 'text-slate-600 hover:bg-slate-100'}`}
                        aria-label={dateStr}
                        aria-pressed={seleccionado}
                      >
                        {dia}
                        {tieneCitas && !seleccionado && (
                          <span
                            className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${esFestivo ? 'bg-red-400' : 'bg-pink-500'}`}
                          />
                        )}
                      </button>
                    </div>
                  );
                })}
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

          {/* 5 — Personal */}
          <div className="order-5 lg:col-span-5">
            <PanelPersonal estudio={estudio} reservas={reservasEstudio} fechaVista={fechaVista} />
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
            if (estudioId) localStorage.setItem(`bienvenida_salon_${estudioId}`, 'visto');
            setMostrarBienvenida(false);
          }}
        />
      )}
    </div>
  );
}
