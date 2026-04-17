# Frontend Unificado - Agenda Admin (Dueno de Salon)

Este documento consolida el frontend de la seccion Agenda del panel de estudio (dueno del salon).

## Archivos incluidos

- src/app/enrutador.tsx
- src/caracteristicas/estudio/PaginaAgenda.tsx
- src/caracteristicas/estudio/componentes/AgendaDiaria.tsx
- src/caracteristicas/estudio/componentes/ModalCrearReservaManual.tsx
- src/caracteristicas/estudio/componentes/GestorFestivos.tsx
- src/caracteristicas/estudio/componentes/MetricasSalon.tsx
- src/caracteristicas/estudio/componentes/PanelNotificaciones.tsx
- src/caracteristicas/estudio/componentes/ModalBienvenidaSalon.tsx
- src/caracteristicas/estudio/componentes/ModalSuspension.tsx
- src/caracteristicas/estudio/hooks/usarNotificacionesEstudio.ts
- src/caracteristicas/estudio/utils/metricasSalon.ts
- src/componentes/ui/BannerNotificacionesPush.tsx
- src/hooks/usarNotificacionesPush.ts
- src/componentes/ui/Spinner.tsx

---

## src/app/enrutador.tsx

```tsx
import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { GuardiaRuta } from '../caracteristicas/autenticacion/GuardiaRuta';
import { obtenerRutaPorRol, usarTiendaAuth } from '../tienda/tiendaAuth';
import { LimiteError } from '../componentes/ui/LimiteError';
import { Pagina404 } from '../componentes/ui/Pagina404';

const PaginaInicioSesion = lazy(() =>
  import('../caracteristicas/autenticacion/PaginaInicioSesion').then((m) => ({
    default: m.PaginaInicioSesion,
  })),
);
const PaginaRecuperarContrasena = lazy(() =>
  import('../caracteristicas/autenticacion/PaginaRecuperarContrasena').then((m) => ({
    default: m.PaginaRecuperarContrasena,
  })),
);
const PaginaResetContrasena = lazy(() =>
  import('../caracteristicas/autenticacion/PaginaResetContrasena').then((m) => ({
    default: m.PaginaResetContrasena,
  })),
);
const PaginaRegistroSalon = lazy(() =>
  import('../caracteristicas/autenticacion/PaginaRegistroSalon').then((m) => ({
    default: m.PaginaRegistroSalon,
  })),
);
const PaginaRegistroCliente = lazy(() =>
  import('../caracteristicas/autenticacion/PaginaRegistroCliente').then((m) => ({
    default: m.PaginaRegistroCliente,
  })),
);
const PaginaEsperaAprobacion = lazy(() =>
  import('../caracteristicas/autenticacion/PaginaEsperaAprobacion').then((m) => ({
    default: m.PaginaEsperaAprobacion,
  })),
);
const PaginaEmailEnviado = lazy(() =>
  import('../caracteristicas/autenticacion/PaginaEmailEnviado').then((m) => ({
    default: m.PaginaEmailEnviado,
  })),
);
const PaginaVerificarEmail = lazy(() =>
  import('../caracteristicas/autenticacion/PaginaVerificarEmail').then((m) => ({
    default: m.PaginaVerificarEmail,
  })),
);
const PaginaAgenda = lazy(() =>
  import('../caracteristicas/estudio/PaginaAgenda').then((m) => ({ default: m.PaginaAgenda })),
);
const PaginaAdminEstudio = lazy(() =>
  import('../caracteristicas/estudio/PaginaAdminEstudio').then((m) => ({
    default: m.PaginaAdminEstudio,
  })),
);
const PaginaMaestro = lazy(() =>
  import('../caracteristicas/maestro/PaginaMaestro').then((m) => ({ default: m.PaginaMaestro })),
);
const PaginaReserva = lazy(() =>
  import('../caracteristicas/reserva/PaginaReserva').then((m) => ({ default: m.PaginaReserva })),
);
const PaginaCancelarReserva = lazy(() =>
  import('../caracteristicas/reserva/PaginaCancelarReserva').then((m) => ({
    default: m.PaginaCancelarReserva,
  })),
);
const PaginaAgendaEmpleado = lazy(() =>
  import('../caracteristicas/empleado/PaginaAgendaEmpleado').then((m) => ({
    default: m.PaginaAgendaEmpleado,
  })),
);
const PaginaPerfilEmpleado = lazy(() =>
  import('../caracteristicas/empleado/PaginaPerfilEmpleado').then((m) => ({
    default: m.PaginaPerfilEmpleado,
  })),
);
const PaginaInicioCliente = lazy(() =>
  import('../caracteristicas/cliente/PaginaInicioCliente').then((m) => ({
    default: m.PaginaInicioCliente,
  })),
);
const PaginaPerfilCliente = lazy(() =>
  import('../caracteristicas/cliente/PaginaPerfilCliente').then((m) => ({
    default: m.PaginaPerfilCliente,
  })),
);
const PaginaHistorialCliente = lazy(() =>
  import('../caracteristicas/cliente/PaginaHistorialCliente').then((m) => ({
    default: m.PaginaHistorialCliente,
  })),
);
const PaginaDetalleSalon = lazy(() =>
  import('../caracteristicas/cliente/PaginaDetalleSalon').then((m) => ({
    default: m.PaginaDetalleSalon,
  })),
);
const PaginaReservaCliente = lazy(() =>
  import('../caracteristicas/cliente/PaginaReservaCliente').then((m) => ({
    default: m.PaginaReservaCliente,
  })),
);
const PaginaVendedor = lazy(() =>
  import('../caracteristicas/vendedor/PaginaVendedor').then((m) => ({
    default: m.PaginaVendedor,
  })),
);

function PantallaCargaRuta() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-pink-600" />
    </div>
  );
}

function RedireccionRaiz() {
  const { iniciando, rol, estudioActual, slugEstudioActual, claveClienteActual, usuario } =
    usarTiendaAuth();

  if (iniciando) {
    return <PantallaCargaRuta />;
  }

  if (!rol) {
    if (claveClienteActual) {
      return <Navigate to={`/reservar/${claveClienteActual}`} replace />;
    }
    return <Navigate to="/iniciar-sesion" replace />;
  }

  return (
    <Navigate
      to={obtenerRutaPorRol(
        rol,
        estudioActual,
        slugEstudioActual,
        claveClienteActual,
        usuario?.forzarCambioContrasena ?? false,
      )}
      replace
    />
  );
}

export function Enrutador() {
  return (
    <Suspense fallback={<PantallaCargaRuta />}>
      <Routes>
        <Route path="/" element={<RedireccionRaiz />} />
        <Route path="/iniciar-sesion" element={<PaginaInicioSesion />} />
        <Route path="/recuperar-contrasena" element={<PaginaRecuperarContrasena />} />
        <Route path="/reset-contrasena" element={<PaginaResetContrasena />} />
        <Route path="/cancelar-reserva" element={<PaginaCancelarReserva />} />
        <Route path="/registro/cliente" element={<PaginaRegistroCliente />} />
        <Route path="/registro/salon" element={<PaginaRegistroSalon />} />
        <Route path="/espera-aprobacion" element={<PaginaEsperaAprobacion />} />
        <Route path="/email-enviado" element={<PaginaEmailEnviado />} />
        <Route path="/verificar-email" element={<PaginaVerificarEmail />} />

        <Route element={<GuardiaRuta rolesPermitidos={['maestro']} />}>
          <Route
            path="/maestro"
            element={
              <LimiteError>
                <PaginaMaestro />
              </LimiteError>
            }
          />
          <Route
            path="/maestro/finanzas"
            element={
              <LimiteError>
                <PaginaMaestro />
              </LimiteError>
            }
          />
        </Route>

        <Route element={<GuardiaRuta rolesPermitidos={['supervisor']} />}>
          <Route
            path="/supervisor"
            element={
              <LimiteError>
                <PaginaMaestro />
              </LimiteError>
            }
          />
          <Route
            path="/supervisor/finanzas"
            element={
              <LimiteError>
                <PaginaMaestro />
              </LimiteError>
            }
          />
        </Route>

        <Route element={<GuardiaRuta rolesPermitidos={['vendedor']} />}>
          <Route
            path="/vendedor"
            element={
              <LimiteError>
                <PaginaVendedor />
              </LimiteError>
            }
          />
        </Route>

        <Route element={<GuardiaRuta rolesPermitidos={['dueno', 'vendedor']} />}>
          <Route
            path="/estudio/:slug/agenda"
            element={
              <LimiteError>
                <PaginaAgenda />
              </LimiteError>
            }
          />
          <Route
            path="/estudio/:slug/admin"
            element={
              <LimiteError>
                <PaginaAdminEstudio />
              </LimiteError>
            }
          />
        </Route>

        <Route path="/salones" element={<Navigate to="/" replace />} />
        <Route path="/salones/:id" element={<Navigate to="/" replace />} />
        <Route path="/salones/:id/reservar" element={<Navigate to="/" replace />} />
        <Route path="/inicio" element={<Navigate to="/cliente/inicio" replace />} />
        <Route path="/mi-perfil" element={<Navigate to="/cliente/perfil" replace />} />
        <Route path="/administracion" element={<Navigate to="/" replace />} />

        <Route element={<GuardiaRuta rolesPermitidos={['cliente']} />}>
          <Route
            path="/cliente/inicio"
            element={
              <LimiteError>
                <PaginaInicioCliente />
              </LimiteError>
            }
          />
          <Route
            path="/cliente/perfil"
            element={
              <LimiteError>
                <PaginaPerfilCliente />
              </LimiteError>
            }
          />
          <Route
            path="/cliente/historial"
            element={
              <LimiteError>
                <PaginaHistorialCliente />
              </LimiteError>
            }
          />
          <Route
            path="/cliente/salon/:id"
            element={
              <LimiteError>
                <PaginaDetalleSalon />
              </LimiteError>
            }
          />
          <Route
            path="/cliente/salon/:id/reservar"
            element={
              <LimiteError>
                <PaginaReservaCliente />
              </LimiteError>
            }
          />
        </Route>

        <Route
          path="/reservar/:claveEstudio"
          element={
            <LimiteError>
              <PaginaReserva />
            </LimiteError>
          }
        />

        <Route element={<GuardiaRuta rolesPermitidos={['empleado']} />}>
          <Route
            path="/empleado/agenda"
            element={
              <LimiteError>
                <PaginaAgendaEmpleado />
              </LimiteError>
            }
          />
          <Route
            path="/empleado/perfil"
            element={
              <LimiteError>
                <PaginaPerfilEmpleado />
              </LimiteError>
            }
          />
          <Route
            path="/empleado/cambiar-contrasena"
            element={
              <LimiteError>
                <PaginaPerfilEmpleado />
              </LimiteError>
            }
          />
        </Route>

        <Route path="*" element={<Pagina404 />} />
      </Routes>
    </Suspense>
  );
}
```

## src/caracteristicas/estudio/PaginaAgenda.tsx

```tsx
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
import { usarContextoApp } from '../../contextos/ContextoApp';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';
import { usarToast } from '../../componentes/ui/ProveedorToast';
import { obtenerFechaLocalISO } from '../../utils/formato';
import { AgendaDiaria } from './componentes/AgendaDiaria';
import { ModalCrearReservaManual } from './componentes/ModalCrearReservaManual';
import { GestorFestivos } from './componentes/GestorFestivos';
import { ModalBienvenidaSalon } from './componentes/ModalBienvenidaSalon';
import { ModalSuspension } from './componentes/ModalSuspension';
import { PanelNotificaciones } from './componentes/PanelNotificaciones';
import { MetricasSalon } from './componentes/MetricasSalon';
import { usarNotificacionesEstudio } from './hooks/usarNotificacionesEstudio';
import { Spinner } from '../../componentes/ui/Spinner';
import { BannerNotificacionesPush } from '../../componentes/ui/BannerNotificacionesPush';
import { usarNotificacionesPush } from '../../hooks/usarNotificacionesPush';
import { env } from '../../lib/env';
import { DIAS_SEMANA } from '../../lib/constantes';
import { actualizarEstudio } from '../../servicios/servicioEstudios';
import type { Estudio } from '../../tipos';

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

  const estudio = estudiosDisponibles.find(
    (s) => s.slug === slug || s.clientKey === slug || s.id === slug,
  );
  const estudioId = estudio?.id;
  const { notificaciones, marcarLeida } = usarNotificacionesEstudio(estudioId);
  const identificadorRutaPrivada = estudio?.slug?.trim() || estudio?.clientKey?.trim() || estudio?.id;

  useEffect(() => {
    if (!identificadorRutaPrivada || !slug || slug === identificadorRutaPrivada) return;
    navegar(`/estudio/${identificadorRutaPrivada}/agenda`, { replace: true });
  }, [identificadorRutaPrivada, slug, navegar]);

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

  const reservasEstudio = reservasDisponibles.filter((r) => r.studioId === estudio.id);

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
              void actualizarEstudio(estudioId, { primeraVez: false }).catch(() => {
                setMostrarBienvenida(true);
                mostrarToast({
                  mensaje: 'We could not save that this welcome guide was already seen.',
                  variante: 'error',
                });
              });
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
```

## src/caracteristicas/estudio/componentes/AgendaDiaria.tsx

```tsx
import { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  CheckCircle2,
  Phone,
  Plus,
  History,
  ChevronLeft,
  ChevronRight,
  Palette,
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { DialogoConfirmacion } from '../../../componentes/ui/DialogoConfirmacion';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { usarContextoApp } from '../../../contextos/ContextoApp';
import { formatearDinero } from '../../../utils/formato';
import {
  actualizarEstadoReserva,
  actualizarEstadoServicioReserva,
  agregarServicioAReserva,
} from '../../../servicios/servicioReservas';
import type {
  Estudio,
  Reserva,
  Moneda,
  EstadoReserva,
} from '../../../tipos';

interface PropsAgendaDiaria {
  estudio: Estudio;
  reservas: Reserva[];
  fechaVista: Date;
  onCrearCitaManual: () => void;
}

function obtenerFechaLocalISO(fecha: Date): string {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
}

function calcularHoraFin(horaInicio: string, duracionMin: number): string {
  const [h, m] = horaInicio.split(':').map(Number);
  const totalMin = (h ?? 0) * 60 + (m ?? 0) + duracionMin;
  return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
}

interface ColorBadge {
  acento: string;
  fondo: string;
  texto: string;
  punto: string;
  etiqueta: string;
}

const BADGE_ESTADO: Record<EstadoReserva, ColorBadge> = {
  pending: {
    acento: 'bg-[#E0A820]',
    fondo: 'bg-[#FEF3D0]',
    texto: 'text-[#9A6E0A]',
    punto: 'bg-[#E0A820]',
    etiqueta: 'Pendiente',
  },
  confirmed: {
    acento: 'bg-[#5B6FD4]',
    fondo: 'bg-[#E3E7FA]',
    texto: 'text-[#3440A0]',
    punto: 'bg-[#5B6FD4]',
    etiqueta: 'Confirmada',
  },
  completed: {
    acento: 'bg-[#2E9E6B]',
    fondo: 'bg-[#D4F2E4]',
    texto: 'text-[#1A6B45]',
    punto: 'bg-[#2E9E6B]',
    etiqueta: 'Finalizado',
  },
  cancelled: {
    acento: 'bg-[#C84040]',
    fondo: 'bg-[#FAE0E0]',
    texto: 'text-[#8C2020]',
    punto: 'bg-[#C84040]',
    etiqueta: 'Cancelado',
  },
  no_show: {
    acento: 'bg-[#C84040]',
    fondo: 'bg-[#FAE0E0]',
    texto: 'text-[#8C2020]',
    punto: 'bg-[#C84040]',
    etiqueta: 'No asistió',
  },
};

const COLORES_AVATAR = [
  'bg-indigo-100 text-indigo-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
] as const;

function obtenerInicialesPersonal(nombre: string): string {
  const partes = nombre
    .split(' ')
    .map((parte) => parte.trim())
    .filter(Boolean);

  if (partes.length === 0) return 'NA';
  if (partes.length === 1) return partes[0]!.slice(0, 2).toUpperCase();
  return `${partes[0]![0] ?? ''}${partes[1]![0] ?? ''}`.toUpperCase();
}

function obtenerClaseAvatar(nombre: string): string {
  const suma = Array.from(nombre).reduce((acc, caracter) => acc + caracter.charCodeAt(0), 0);
  return COLORES_AVATAR[suma % COLORES_AVATAR.length] ?? COLORES_AVATAR[0];
}

// ── Modal mini para marcar un servicio como no_show ──────────────────────────
interface PropsModalNoShow {
  nombreServicio: string;
  onConfirmar: (pin: string, motivo: string) => void;
  onCancelar: () => void;
  cargando: boolean;
  mensajeError?: string | null;
  onLimpiarError: () => void;
}

function ModalNoShow({
  nombreServicio,
  onConfirmar,
  onCancelar,
  cargando,
  mensajeError,
  onLimpiarError,
}: PropsModalNoShow) {
  const [pin, setPin] = useState('');
  const [motivo, setMotivo] = useState('');

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-no-show-titulo"
      className="fixed inset-0 z-300 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
      onKeyDown={(e) => e.key === 'Escape' && onCancelar()}
    >
      <div className="bg-white rounded-4xl p-6 max-w-sm w-full shadow-2xl">
        <h2
          id="modal-no-show-titulo"
          className="text-base font-black uppercase tracking-tight text-slate-900 mb-1"
        >
          ¿Servicio no realizado?
        </h2>
        <p className="text-xs text-slate-500 font-medium mb-5">
          <span className="font-black text-slate-700">{nombreServicio}</span> será marcado como "No
          se realizó". El total de la cita se recalculará.
        </p>
        <div className="space-y-3">
          <label className="block">
            <span className="text-[11px] font-black uppercase tracking-wide text-slate-600 block mb-1.5">
              PIN de cancelación *
            </span>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              value={pin}
              onChange={(e) => {
                onLimpiarError();
                setPin(e.target.value.replace(/\D/g, '').slice(0, 6));
              }}
              placeholder="••••"
              className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
            />
          </label>
          <label className="block">
            <span className="text-[11px] font-black uppercase tracking-wide text-slate-600 block mb-1.5">
              Motivo (opcional)
            </span>
            <input
              type="text"
              maxLength={120}
              value={motivo}
              onChange={(e) => {
                onLimpiarError();
                setMotivo(e.target.value);
              }}
              placeholder="Ej: cliente no llegó, producto sin stock…"
              className="w-full rounded-2xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 outline-none transition focus:border-pink-400 focus:ring-2 focus:ring-pink-100"
            />
          </label>
          {mensajeError && <p className="text-xs font-medium text-red-600">{mensajeError}</p>}
        </div>
        <div className="flex gap-3 mt-5">
          <button
            type="button"
            onClick={onCancelar}
            className="flex-1 py-3 bg-slate-100 text-slate-600 font-black rounded-2xl uppercase text-xs hover:bg-slate-200 transition-colors"
          >
            Volver
          </button>
          <button
            type="button"
            disabled={cargando || !pin}
            aria-busy={cargando}
            onClick={() => onConfirmar(pin, motivo)}
            className="flex-1 py-3 bg-red-600 text-white font-black rounded-2xl uppercase text-xs hover:bg-red-700 transition-colors disabled:opacity-60"
          >
            {cargando ? 'Procesando...' : 'Confirmar'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface PropsPaginadorLista {
  paginaActual: number;
  totalPaginas: number;
  onCambiar: (pagina: number) => void;
}

function PaginadorLista({ paginaActual, totalPaginas, onCambiar }: PropsPaginadorLista) {
  if (totalPaginas <= 1) return null;

  return (
    <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
      <button
        type="button"
        disabled={paginaActual === 1}
        onClick={() => onCambiar(paginaActual - 1)}
        className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition-colors hover:bg-slate-100 disabled:opacity-40"
      >
        Anterior
      </button>
      <span className="text-xs font-black uppercase tracking-wide text-slate-500">
        Página {paginaActual} de {totalPaginas}
      </span>
      <button
        type="button"
        disabled={paginaActual === totalPaginas}
        onClick={() => onCambiar(paginaActual + 1)}
        className="rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-700 shadow-sm transition-colors hover:bg-slate-100 disabled:opacity-40"
      >
        Siguiente
      </button>
    </div>
  );
}

interface PropsTarjetaCita {
  reserva: Reserva;
  moneda: Moneda;
  onCompletar: (id: string) => void;
  onCancelar: (id: string) => void;
  onNoShow: (reservaId: string, servicioId: string, nombre: string) => void;
  onAgregarServicio: (reservaId: string) => void;
}

function TarjetaCita({
  reserva: b,
  moneda,
  onCompletar,
  onCancelar,
  onNoShow,
  onAgregarServicio,
}: PropsTarjetaCita) {
  const horaFin = calcularHoraFin(b.time, b.totalDuration);
  const estaCompletada = b.status === 'completed';
  const estaCancelada = b.status === 'cancelled';
  const detallesServicio = b.serviceDetails ?? [];
  const serviciosReserva = b.services ?? [];

  const configuracionEstado = BADGE_ESTADO[b.status] ?? BADGE_ESTADO.pending;
  const esActivo = b.status === 'pending' || b.status === 'confirmed';
  const serviciosActivos =
    detallesServicio.length > 0
      ? detallesServicio.filter((servicio) => servicio.status !== 'cancelled')
      : serviciosReserva;
  const servicioPrincipal = serviciosActivos[0]?.name ?? 'Sin servicio';
  const metaServicio = `${b.totalDuration} min${serviciosActivos.length > 1 ? ` • +${serviciosActivos.length - 1} servicio(s)` : ''}`;
  const iniciales = obtenerInicialesPersonal(b.staffName || 'NA');
  const claseAvatar = obtenerClaseAvatar(b.staffName || iniciales);

  return (
    <div
      className={`relative w-full overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-[0_4px_20px_rgb(0,0,0,0.03)] transition-all duration-200 hover:shadow-md ${
        estaCancelada ? 'opacity-75' : ''
      }`}
    >
      <div className={`absolute left-0 top-0 h-1 w-full lg:h-full lg:w-1.5 ${configuracionEstado.acento}`} />

      <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:gap-8 lg:p-6 lg:pl-8">
        <div className="flex items-start justify-between lg:w-40 lg:flex-col lg:gap-3 shrink-0">
          <div className="flex flex-col">
            <span className="font-serif text-[26px] leading-none text-gray-900 tabular-nums">{b.time}</span>
            <span className="mt-1 text-xs text-gray-500">hasta {horaFin}</span>
          </div>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold tracking-wide ${configuracionEstado.fondo} ${configuracionEstado.texto}`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${configuracionEstado.punto}`} />
            {configuracionEstado.etiqueta}
          </span>
        </div>

        <div className="h-px w-full bg-gray-100 lg:hidden" />

        <div className="grid grid-cols-2 gap-4 lg:w-64 shrink-0">
          <div className="flex flex-col gap-0.5">
            <span className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">Cliente</span>
            <span className="text-sm font-bold text-gray-900">{b.clientName}</span>
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <Phone className="h-3 w-3" aria-hidden="true" />
              {b.clientPhone}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="mb-0.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">Atendida por</span>
            <div className="mt-0.5 flex items-center gap-2">
              <div
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold ${claseAvatar}`}
              >
                {iniciales}
              </div>
              <span className="text-sm font-medium text-gray-800">{b.staffName}</span>
            </div>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-between rounded-xl border border-gray-100 bg-gray-50 p-3.5">
          <div>
            <p className="text-sm font-bold text-gray-900">{servicioPrincipal}</p>
            <p className="mt-0.5 text-[11px] text-gray-500">{metaServicio}</p>
          </div>
          <span className="ml-4 font-serif text-xl font-medium text-gray-900">
            {formatearDinero(b.totalPrice, moneda)}
          </span>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2 lg:w-36 lg:flex-col">
          <button
            type="button"
            onClick={() => onAgregarServicio(b.id)}
            disabled={!esActivo}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition-all lg:w-full ${
              esActivo
                ? 'border-gray-200 text-gray-700 hover:border-[#2E9E6B] hover:bg-[#D4F2E4]/30 hover:text-[#2E9E6B]'
                : 'cursor-not-allowed border-gray-100 bg-gray-50 text-gray-300'
            }`}
          >
            <Plus size={14} /> Extra
          </button>

          {esActivo && (
            <div className="flex w-full gap-2">
              <button
                type="button"
                onClick={() => onCompletar(b.id)}
                className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-[#2E9E6B] px-3 py-2 text-xs font-bold text-white shadow-sm transition-colors hover:bg-[#258257]"
              >
                <CheckCircle2 size={14} /> Listo
              </button>
              <button
                type="button"
                onClick={() => onCancelar(b.id)}
                className="flex-1 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold text-rose-600 transition-colors hover:bg-rose-50"
              >
                Cancelar
              </button>
            </div>
          )}
        </div>
      </div>

      {(b.colorBrand ?? b.colorNumber) && (
        <div className="mx-5 mb-3 rounded-xl border border-pink-100 bg-pink-50 p-2.5 lg:mx-6 lg:ml-8">
          <p className="flex items-center gap-1 text-[10px] font-black uppercase text-pink-700">
            <Palette className="h-3 w-3" aria-hidden="true" /> Color / tono
          </p>
          <p className="mt-0.5 text-xs font-bold text-pink-900">
            {[b.colorBrand, b.colorNumber].filter(Boolean).join(' · ')}
          </p>
        </div>
      )}

      {!estaCompletada && !estaCancelada && detallesServicio.length > 0 && (
        <div className="mx-5 mb-4 space-y-1 lg:mx-6 lg:ml-8">
          {detallesServicio
            .filter(
              (servicio) =>
                servicio.status !== 'cancelled' &&
                (servicio.status === 'pending' || servicio.status === 'confirmed'),
            )
            .map((servicio) => (
              <div
                key={servicio.id ?? servicio.name}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs"
              >
                <span className="text-slate-600">{servicio.name}</span>
                <button
                  type="button"
                  onClick={() => onNoShow(b.id, servicio.id ?? '', servicio.name)}
                  className="rounded-lg bg-red-50 px-2 py-0.5 text-[9px] font-black uppercase text-red-600 transition-colors hover:bg-red-100"
                >
                  No realizó
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

// ─── Componente principal ──────────────────────────────────────────────────

export function AgendaDiaria({
  estudio,
  reservas,
  fechaVista,
  onCrearCitaManual,
}: PropsAgendaDiaria) {
  const { recargar } = usarContextoApp();
  const { mostrarToast } = usarToast();
  const reservasDisponibles = reservas ?? [];
  const personalDisponible = estudio.staff ?? [];
  const [pinCancelacion, setPinCancelacion] = useState('');
  const [tab, setTab] = useState<'agenda' | 'historial'>('agenda');
  const [especialistaTab, setEspecialistaTab] = useState<string>('todos');
  const [paginaAgenda, setPaginaAgenda] = useState(1);
  const [paginaHistorial, setPaginaHistorial] = useState(1);
  const [modoHistorial, setModoHistorial] = useState<'dia' | 'rango' | 'mes'>('mes');
  const [fechaHistorial, setFechaHistorial] = useState(() => obtenerFechaLocalISO(new Date()));
  const [rangoInicio, setRangoInicio] = useState('');
  const [rangoFin, setRangoFin] = useState('');
  const [mesHistorial, setMesHistorial] = useState(() => {
    const ahora = new Date();
    return `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}`;
  });
  const [confirmacion, setConfirmacion] = useState<{
    tipo: 'completar' | 'cancelar';
    reservaId: string;
  } | null>(null);
  const [modalNoShow, setModalNoShow] = useState<{
    reservaId: string;
    servicioId: string;
    nombre: string;
  } | null>(null);
  const [mensajeErrorNoShow, setMensajeErrorNoShow] = useState<string | null>(null);
  const [modalAdicional, setModalAdicional] = useState<string | null>(null);
  const [servicioAdicionalSeleccionado, setServicioAdicionalSeleccionado] = useState('');

  const serviciosCatalogo = estudio.selectedServices ?? [];
  const LIMITE_POR_PAGINA = 5;

  const { mutate: cambiarEstado, isPending: actualizando } = useMutation({
    mutationFn: ({ id, estado, pin }: { id: string; estado: EstadoReserva; pin?: string }) =>
      actualizarEstadoReserva(id, estado, pin),
    onSuccess: async () => {
      setPinCancelacion('');
      setConfirmacion(null);
      mostrarToast({ mensaje: 'Estado de la cita actualizado', variante: 'exito' });
      await recargar();
    },
    onError: (error: unknown) => {
      mostrarToast({
        mensaje: error instanceof Error ? error.message : 'No se pudo actualizar la cita',
        variante: 'error',
      });
    },
  });

  const { mutate: marcarNoShow, isPending: marcandoNoShow } = useMutation({
    mutationFn: ({
      reservaId,
      servicioId,
      pin,
      motivo,
    }: {
      reservaId: string;
      servicioId: string;
      pin: string;
      motivo: string;
    }) =>
      actualizarEstadoServicioReserva(reservaId, servicioId, 'no_show', pin, motivo || undefined),
    onSuccess: async () => {
      setModalNoShow(null);
      setMensajeErrorNoShow(null);
      mostrarToast({ mensaje: 'Servicio marcado como no realizado', variante: 'exito' });
      await recargar();
    },
    onError: (error: unknown) => {
      setMensajeErrorNoShow(
        error instanceof Error ? error.message : 'No se pudo marcar el servicio como no realizado',
      );
      mostrarToast({
        mensaje:
          error instanceof Error
            ? error.message
            : 'No se pudo marcar el servicio como no realizado',
        variante: 'error',
      });
    },
  });

  const { mutate: agregarAdicional, isPending: agregandoAdicional } = useMutation({
    mutationFn: ({
      reservaId,
      servicio,
    }: {
      reservaId: string;
      servicio: { nombre: string; duracion: number; precio: number; categoria?: string };
    }) => agregarServicioAReserva(reservaId, servicio),
    onSuccess: async () => {
      setModalAdicional(null);
      setServicioAdicionalSeleccionado('');
      mostrarToast({ mensaje: 'Servicio adicional agregado', variante: 'exito' });
      await recargar();
    },
    onError: (error: unknown) => {
      mostrarToast({
        mensaje:
          error instanceof Error ? error.message : 'No se pudo agregar el servicio adicional',
        variante: 'error',
      });
    },
  });

  const confirmarAccion = () => {
    if (!confirmacion) return;
    const nuevoEstatus: EstadoReserva =
      confirmacion.tipo === 'completar' ? 'completed' : 'cancelled';
    cambiarEstado({
      id: confirmacion.reservaId,
      estado: nuevoEstatus,
      pin: confirmacion.tipo === 'cancelar' ? pinCancelacion : undefined,
    });
  };

  const moneda: Moneda = estudio.country === 'Colombia' ? 'COP' : 'MXN';
  const fechaStr = obtenerFechaLocalISO(fechaVista);
  const fechaHoy = obtenerFechaLocalISO(new Date());

  useEffect(() => {
    setPaginaAgenda(1);
  }, [fechaStr, especialistaTab]);

  useEffect(() => {
    setPaginaHistorial(1);
  }, [modoHistorial, mesHistorial, fechaHistorial, rangoInicio, rangoFin]);

  useEffect(() => {
    if (fechaStr < fechaHoy) {
      setTab('historial');
      setModoHistorial('dia');
      setFechaHistorial(fechaStr);
    }
  }, [fechaStr, fechaHoy]);

  const citasDelDia = reservasDisponibles
    .filter((r) => r.studioId === estudio.id && r.status !== 'cancelled' && r.date === fechaStr)
    .sort((a, b) => a.time.localeCompare(b.time));

  const idsConCitas = [...new Set(citasDelDia.map((c) => c.staffId))];
  const especialistasConCitas = personalDisponible.filter((s) => idsConCitas.includes(s.id));

  const citasFiltradas =
    especialistaTab === 'todos'
      ? citasDelDia
      : citasDelDia.filter((c) => c.staffId === especialistaTab);

  const citasHistorial = useMemo(() => {
    const [anioH, mesH] = mesHistorial.split('-').map(Number);

    return reservasDisponibles
      .filter((r) => {
        if (r.studioId !== estudio.id) return false;
        if (r.status !== 'completed' && r.status !== 'cancelled' && r.status !== 'no_show') {
          return false;
        }

        if (modoHistorial === 'dia') {
          return r.date === fechaHistorial;
        }

        if (modoHistorial === 'rango') {
          if (!rangoInicio || !rangoFin) return false;
          return r.date >= rangoInicio && r.date <= rangoFin;
        }

        const [y, m] = r.date.split('-').map(Number);
        return y === anioH && m === mesH;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || a.time.localeCompare(b.time));
  }, [
    reservasDisponibles,
    estudio.id,
    modoHistorial,
    fechaHistorial,
    rangoInicio,
    rangoFin,
    mesHistorial,
  ]);

  const totalPaginasAgenda = Math.max(1, Math.ceil(citasFiltradas.length / LIMITE_POR_PAGINA));
  const citasAgendaPaginadas = citasFiltradas.slice(
    (paginaAgenda - 1) * LIMITE_POR_PAGINA,
    paginaAgenda * LIMITE_POR_PAGINA,
  );
  const totalPaginasHistorial = Math.max(1, Math.ceil(citasHistorial.length / LIMITE_POR_PAGINA));
  const citasHistorialPaginadas = citasHistorial.slice(
    (paginaHistorial - 1) * LIMITE_POR_PAGINA,
    paginaHistorial * LIMITE_POR_PAGINA,
  );

  const cambiarMesHistorial = (offset: number) => {
    const [y, m] = mesHistorial.split('-').map(Number);
    const nuevaFecha = new Date(y ?? 0, (m ?? 1) - 1 + offset, 1);
    setMesHistorial(
      `${nuevaFecha.getFullYear()}-${String(nuevaFecha.getMonth() + 1).padStart(2, '0')}`,
    );
  };

  return (
    <section className="bg-white rounded-[3rem] border border-slate-200 shadow-sm">
      {/* Cabecera */}
      <div className="p-6 md:p-8 border-b bg-slate-50 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 rounded-t-[3rem]">
        <div>
          <h2 className="text-2xl font-black italic uppercase flex items-center gap-3">
            <Calendar className="text-pink-600" aria-hidden="true" /> Agenda
          </h2>
          <p className="text-xs font-bold text-slate-500 mt-1">
            {fechaVista.toLocaleDateString('es-ES', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
            })}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-slate-200 rounded-xl p-0.5 gap-0.5">
            <button
              type="button"
              onClick={() => setTab('agenda')}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-colors ${tab === 'agenda' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Agenda
            </button>
            <button
              type="button"
              onClick={() => setTab('historial')}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-colors ${tab === 'historial' ? 'bg-white shadow text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <History className="w-3.5 h-3.5" aria-hidden="true" /> Historial
            </button>
          </div>
          {tab === 'agenda' && (
            <>
              <button
                type="button"
                onClick={onCrearCitaManual}
                className="inline-flex items-center gap-2 rounded-xl bg-pink-600 px-4 py-2 text-xs font-black text-white transition-colors hover:bg-pink-700"
              >
                <Plus className="h-4 w-4" aria-hidden="true" /> Crear cita manual
              </button>
              <span className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-black shrink-0">
                {citasDelDia.length} citas
              </span>
            </>
          )}
        </div>
      </div>

      {/* ── HISTORIAL ─────────────────────────────────────────────── */}
      {tab === 'historial' && (
        <div className="p-4 md:p-6 space-y-4">
          <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-3">
            <button
              type="button"
              onClick={() => setModoHistorial('dia')}
              className={`rounded-xl px-3 py-2 text-xs font-black uppercase ${modoHistorial === 'dia' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}
            >
              Fecha exacta
            </button>
            <button
              type="button"
              onClick={() => setModoHistorial('rango')}
              className={`rounded-xl px-3 py-2 text-xs font-black uppercase ${modoHistorial === 'rango' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}
            >
              Rango de fechas
            </button>
            <button
              type="button"
              onClick={() => setModoHistorial('mes')}
              className={`rounded-xl px-3 py-2 text-xs font-black uppercase ${modoHistorial === 'mes' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600'}`}
            >
              Mes completo
            </button>
          </div>

          {modoHistorial === 'dia' && (
            <label className="block rounded-2xl border border-slate-200 bg-white p-4">
              <span className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-500">
                Selecciona una fecha pasada
              </span>
              <input
                type="date"
                max={fechaHoy}
                value={fechaHistorial}
                onChange={(evento) => setFechaHistorial(evento.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800"
              />
            </label>
          )}

          {modoHistorial === 'rango' && (
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block rounded-2xl border border-slate-200 bg-white p-4">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-500">
                  Desde
                </span>
                <input
                  type="date"
                  max={fechaHoy}
                  value={rangoInicio}
                  onChange={(evento) => setRangoInicio(evento.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800"
                />
              </label>
              <label className="block rounded-2xl border border-slate-200 bg-white p-4">
                <span className="mb-2 block text-[10px] font-black uppercase tracking-wide text-slate-500">
                  Hasta
                </span>
                <input
                  type="date"
                  max={fechaHoy}
                  min={rangoInicio || undefined}
                  value={rangoFin}
                  onChange={(evento) => setRangoFin(evento.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-800"
                />
              </label>
            </div>
          )}

          {modoHistorial === 'mes' && (
            <div className="flex items-center justify-between bg-slate-50 rounded-2xl px-4 py-2 border border-slate-100">
              <button
                type="button"
                onClick={() => cambiarMesHistorial(-1)}
                aria-label="Mes anterior"
                className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm font-black capitalize text-slate-800">
                {new Date(`${mesHistorial}-01`).toLocaleDateString('es-ES', {
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
              <button
                type="button"
                onClick={() => cambiarMesHistorial(1)}
                aria-label="Mes siguiente"
                className="p-1.5 hover:bg-slate-200 rounded-lg transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {citasHistorial.length === 0 ? (
            <p className="text-center text-sm text-slate-400 italic py-8 font-bold">
              No hay citas en el historial para este filtro.
            </p>
          ) : (
            <div className="space-y-3">
              {citasHistorialPaginadas.map((b) => (
                <TarjetaCita
                  key={b.id}
                  reserva={b}
                  moneda={moneda}
                  onCompletar={(id) => setConfirmacion({ tipo: 'completar', reservaId: id })}
                  onCancelar={(id) => setConfirmacion({ tipo: 'cancelar', reservaId: id })}
                  onNoShow={(reservaId, servicioId, nombre) =>
                    setModalNoShow({ reservaId, servicioId, nombre })
                  }
                  onAgregarServicio={(reservaId) => setModalAdicional(reservaId)}
                />
              ))}
              <PaginadorLista
                paginaActual={paginaHistorial}
                totalPaginas={totalPaginasHistorial}
                onCambiar={setPaginaHistorial}
              />
            </div>
          )}
        </div>
      )}

      {/* ── AGENDA DEL DÍA ────────────────────────────────────────── */}
      {tab === 'agenda' && (
        <div className="p-4 md:p-6">
          {citasDelDia.length === 0 ? (
            <p className="text-center text-sm text-slate-400 italic py-12 font-bold">
              No hay citas para este día.
            </p>
          ) : (
            <>
              {/* Filtro por especialista */}
              {especialistasConCitas.length > 1 && (
                <div className="flex flex-wrap gap-1.5 mb-5 overflow-x-auto pb-1">
                  <button
                    type="button"
                    onClick={() => setEspecialistaTab('todos')}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-colors ${especialistaTab === 'todos' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                  >
                    Todos
                  </button>
                  {especialistasConCitas.map((esp) => (
                    <button
                      key={esp.id}
                      type="button"
                      onClick={() => setEspecialistaTab(esp.id)}
                      className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase whitespace-nowrap transition-colors ${especialistaTab === esp.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                      {esp.name}
                    </button>
                  ))}
                </div>
              )}

              {/* Lista de citas — siempre en columna única, ordenadas por hora */}
              <div className="space-y-3">
                {citasFiltradas.length === 0 ? (
                  <p className="text-center text-sm text-slate-400 italic py-8 font-bold">
                    Sin citas para este especialista hoy.
                  </p>
                ) : (
                  citasAgendaPaginadas.map((b) => (
                    <TarjetaCita
                      key={b.id}
                      reserva={b}
                      moneda={moneda}
                      onCompletar={(id) => setConfirmacion({ tipo: 'completar', reservaId: id })}
                      onCancelar={(id) => setConfirmacion({ tipo: 'cancelar', reservaId: id })}
                      onNoShow={(reservaId, servicioId, nombre) =>
                        setModalNoShow({ reservaId, servicioId, nombre })
                      }
                      onAgregarServicio={(reservaId) => setModalAdicional(reservaId)}
                    />
                  ))
                )}
              </div>
              <PaginadorLista
                paginaActual={paginaAgenda}
                totalPaginas={totalPaginasAgenda}
                onCambiar={setPaginaAgenda}
              />
            </>
          )}
        </div>
      )}

      {modalNoShow && (
        <ModalNoShow
          nombreServicio={modalNoShow.nombre}
          cargando={marcandoNoShow}
          mensajeError={mensajeErrorNoShow}
          onLimpiarError={() => setMensajeErrorNoShow(null)}
          onConfirmar={(pin, motivo) =>
            marcarNoShow({
              reservaId: modalNoShow.reservaId,
              servicioId: modalNoShow.servicioId,
              pin,
              motivo,
            })
          }
          onCancelar={() => {
            setMensajeErrorNoShow(null);
            setModalNoShow(null);
          }}
        />
      )}

      {/* ── MODAL AGREGAR ADICIONAL ──────────────────────────────── */}
      {modalAdicional && (
        <div
          className="fixed inset-0 z-210 bg-slate-950/70 p-4 backdrop-blur-sm flex items-center justify-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="titulo-adicional"
        >
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h3 id="titulo-adicional" className="text-lg font-black text-slate-900 mb-4">
              Agregar servicio adicional
            </h3>
            {serviciosCatalogo.length === 0 ? (
              <p className="text-sm text-slate-400 italic">
                No hay servicios disponibles en el catálogo.
              </p>
            ) : (
              <div className="space-y-2 max-h-60 overflow-y-auto mb-4">
                {serviciosCatalogo.map((srv) => {
                  const activo = servicioAdicionalSeleccionado === srv.name;
                  return (
                    <button
                      key={srv.name}
                      type="button"
                      onClick={() => setServicioAdicionalSeleccionado(srv.name)}
                      className={`w-full flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${
                        activo
                          ? 'border-blue-500 bg-blue-50 text-blue-700'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-blue-200'
                      }`}
                    >
                      <span className="font-bold text-sm">{srv.name}</span>
                      <span className="text-xs font-black">
                        {formatearDinero(srv.price, moneda)} · {srv.duration} min
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setModalAdicional(null);
                  setServicioAdicionalSeleccionado('');
                }}
                className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 hover:bg-slate-200 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!servicioAdicionalSeleccionado || agregandoAdicional}
                onClick={() => {
                  const srv = serviciosCatalogo.find(
                    (s) => s.name === servicioAdicionalSeleccionado,
                  );
                  if (!srv || !modalAdicional) return;
                  agregarAdicional({
                    reservaId: modalAdicional,
                    servicio: {
                      nombre: srv.name,
                      duracion: srv.duration,
                      precio: srv.price,
                    },
                  });
                }}
                className="flex-1 rounded-2xl bg-blue-600 px-4 py-3 text-sm font-black text-white hover:bg-blue-700 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {agregandoAdicional ? 'Agregando...' : 'Agregar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <DialogoConfirmacion
        abierto={!!confirmacion}
        mensaje={confirmacion?.tipo === 'completar' ? '¿Confirmar cobro?' : '¿Cancelar cita?'}
        descripcion={
          confirmacion?.tipo === 'completar'
            ? 'Se registrará el ingreso en el balance.'
            : 'La cita quedará marcada como cancelada. Ingresa el PIN del dueño para confirmar.'
        }
        etiquetaCampo={confirmacion?.tipo === 'cancelar' ? 'PIN de cancelación' : undefined}
        placeholderCampo={
          confirmacion?.tipo === 'cancelar' ? 'Ingresa el PIN del dueño' : undefined
        }
        valorCampo={confirmacion?.tipo === 'cancelar' ? pinCancelacion : undefined}
        onCambiarCampo={confirmacion?.tipo === 'cancelar' ? setPinCancelacion : undefined}
        variante={confirmacion?.tipo === 'cancelar' ? 'peligro' : 'advertencia'}
        textoConfirmar={confirmacion?.tipo === 'completar' ? 'Confirmar Cobro' : 'Cancelar Cita'}
        cargando={actualizando}
        onConfirmar={confirmarAccion}
        onCancelar={() => {
          setPinCancelacion('');
          setConfirmacion(null);
        }}
      />
    </section>
  );
}
```

## src/caracteristicas/estudio/componentes/ModalCrearReservaManual.tsx

```tsx
import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { X, CalendarDays } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { SelectorFecha } from '../../../componentes/ui/SelectorFecha';
import { usarToast } from '../../../componentes/ui/ProveedorToast';
import { DIAS_SEMANA } from '../../../lib/constantes';
import { crearReserva, obtenerDisponibilidadEstudio } from '../../../servicios/servicioReservas';
import { obtenerFechaLocalISO, formatearDinero } from '../../../utils/formato';
import type { Estudio, Moneda, Servicio } from '../../../tipos';

const esquemaFormulario = z.object({
  nombreCliente: z.string().min(2, 'Mínimo 2 caracteres'),
  telefonoCliente: z.string().regex(/^[0-9]{10}$/, '10 dígitos sin espacios'),
  fechaNacimiento: z.string().min(1, 'Selecciona una fecha'),
  email: z.string().email('Correo inválido').or(z.literal('')),
  sucursal: z.string().optional(),
  marcaTinte: z.string().optional(),
  observaciones: z.string().max(500, 'Máximo 500 caracteres').optional(),
});

type DatosFormulario = z.infer<typeof esquemaFormulario>;

interface PropsModalCrearReservaManual {
  abierto: boolean;
  estudio: Estudio;
  fechaVista: Date;
  onCerrar: () => void;
  onReservaCreada: () => void;
}

const PALABRAS_COLOR = [
  'tinte',
  'color',
  'balayage',
  'babylights',
  'canas',
  'ombré',
  'decoloración',
  'rayitos',
  'mechas',
];

export function ModalCrearReservaManual({
  abierto,
  estudio,
  fechaVista,
  onCerrar,
  onReservaCreada,
}: PropsModalCrearReservaManual) {
  const { mostrarToast } = usarToast();
  const [personalSeleccionado, setPersonalSeleccionado] = useState('');
  const [serviciosSeleccionados, setServiciosSeleccionados] = useState<Servicio[]>([]);
  const [horaSeleccionada, setHoraSeleccionada] = useState('');
  const moneda: Moneda = estudio.country === 'Colombia' ? 'COP' : 'MXN';
  const fechaStr = obtenerFechaLocalISO(fechaVista);
  const miembro = estudio.staff.find((item) => item.id === personalSeleccionado);
  const serviciosDisponibles = personalSeleccionado
    ? estudio.selectedServices.filter((servicio) => miembro?.specialties.includes(servicio.name))
    : [];
  const totalDuracion = serviciosSeleccionados.reduce(
    (total, servicio) => total + servicio.duration,
    0,
  );
  const totalPrecio = serviciosSeleccionados.reduce((total, servicio) => total + servicio.price, 0);
  const nombreDia = DIAS_SEMANA[fechaVista.getDay()]!;
  const horarioDia = estudio.schedule[nombreDia];
  const esFestivo = estudio.holidays?.includes(fechaStr) ?? false;
  const duracionConsulta = totalDuracion > 0 ? totalDuracion : 30;
  const consultaDisponibilidad = useQuery({
    queryKey: [
      'disponibilidad-estudio',
      estudio.id,
      personalSeleccionado,
      fechaStr,
      duracionConsulta,
    ],
    queryFn: () =>
      obtenerDisponibilidadEstudio(estudio.id, personalSeleccionado, fechaStr, duracionConsulta),
    enabled: Boolean(miembro && horarioDia?.isOpen && !esFestivo),
    staleTime: 30_000,
  });
  const slotsDisponibles = (consultaDisponibilidad.data ?? []).filter(
    (slot) => slot.status === 'AVAILABLE',
  );

  const formulario = useForm<DatosFormulario>({
    resolver: zodResolver(esquemaFormulario),
    defaultValues: {
      nombreCliente: '',
      telefonoCliente: '',
      fechaNacimiento: '',
      email: '',
      sucursal: estudio.branches[0] ?? '',
      marcaTinte: '',
      observaciones: '',
    },
  });

  const requiereColor = serviciosSeleccionados.some((servicio) =>
    PALABRAS_COLOR.some((palabra) => servicio.name.toLowerCase().includes(palabra)),
  );

  const mutacionCrear = useMutation({
    mutationFn: async (datos: DatosFormulario) => {
      await crearReserva({
        studioId: estudio.id,
        studioName: estudio.name,
        clientName: datos.nombreCliente,
        clientPhone: datos.telefonoCliente,
        fechaNacimiento: datos.fechaNacimiento,
        email: datos.email,
        services: serviciosSeleccionados,
        totalDuration: totalDuracion,
        totalPrice: totalPrecio,
        status: 'confirmed',
        branch: datos.sucursal ?? '',
        staffId: personalSeleccionado,
        staffName: miembro?.name ?? '',
        colorBrand: requiereColor ? datos.marcaTinte || null : null,
        colorNumber: null,
        observaciones: datos.observaciones || null,
        date: fechaStr,
        time: horaSeleccionada,
        createdAt: new Date().toISOString(),
      });
    },
    onSuccess: () => {
      mostrarToast({ mensaje: 'Cita creada correctamente', variante: 'exito' });
      formulario.reset({
        nombreCliente: '',
        telefonoCliente: '',
        fechaNacimiento: '',
        email: '',
        sucursal: estudio.branches[0] ?? '',
        marcaTinte: '',
        observaciones: '',
      });
      setPersonalSeleccionado('');
      setServiciosSeleccionados([]);
      setHoraSeleccionada('');
      onReservaCreada();
      onCerrar();
    },
    onError: (error: unknown) => {
      mostrarToast({
        mensaje: error instanceof Error ? error.message : 'No se pudo crear la cita',
        variante: 'error',
      });
    },
  });

  function alternarServicio(servicio: Servicio) {
    setServiciosSeleccionados((actuales) => {
      const existe = actuales.some((item) => item.name === servicio.name);
      return existe
        ? actuales.filter((item) => item.name !== servicio.name)
        : [...actuales, servicio];
    });
    setHoraSeleccionada('');
  }

  function cambiarPersonal(personalId: string) {
    setPersonalSeleccionado(personalId);
    setServiciosSeleccionados((actuales) => {
      const miembroSiguiente = estudio.staff.find((item) => item.id === personalId);
      if (!miembroSiguiente) return [];

      return actuales.filter((servicio) => miembroSiguiente.specialties.includes(servicio.name));
    });
    setHoraSeleccionada('');
  }

  if (!abierto) return null;

  return (
    <div
      className="fixed inset-0 z-210 bg-slate-950/70 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-crear-cita"
    >
      <div className="mx-auto flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-4xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 id="titulo-crear-cita" className="text-xl font-black text-slate-900">
              Crear cita manual
            </h2>
            <p className="mt-1 flex items-center gap-2 text-sm font-medium text-slate-500">
              <CalendarDays className="h-4 w-4 text-pink-500" aria-hidden="true" />
              {fechaVista.toLocaleDateString('es-MX', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar modal"
            className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        <form
          onSubmit={formulario.handleSubmit((datos) => mutacionCrear.mutate(datos))}
          className="grid gap-6 overflow-y-auto px-6 py-6 md:grid-cols-[1.1fr_0.9fr]"
        >
          <div className="space-y-5">
            <div>
              <label
                htmlFor="personal-manual"
                className="mb-1 block text-xs font-bold uppercase text-slate-500"
              >
                Especialista
              </label>
              <select
                id="personal-manual"
                value={personalSeleccionado}
                onChange={(evento) => cambiarPersonal(evento.target.value)}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-pink-400"
              >
                <option value="">Selecciona un especialista</option>
                {estudio.staff
                  .filter((item) => item.active)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase text-slate-500">Servicios</p>
              {serviciosDisponibles.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-400">
                  Selecciona primero un especialista.
                </p>
              ) : (
                <div className="grid gap-2">
                  {serviciosDisponibles.map((servicio) => {
                    const activo = serviciosSeleccionados.some(
                      (item) => item.name === servicio.name,
                    );
                    return (
                      <button
                        key={servicio.name}
                        type="button"
                        onClick={() => alternarServicio(servicio)}
                        className={`flex items-center justify-between rounded-2xl border px-4 py-3 text-left transition-colors ${activo ? 'border-pink-500 bg-pink-50 text-pink-700' : 'border-slate-200 bg-white text-slate-700 hover:border-pink-200'}`}
                      >
                        <span className="font-bold">{servicio.name}</span>
                        <span className="text-xs font-black">
                          {formatearDinero(servicio.price, moneda)} · {servicio.duration} min
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <p className="mb-2 text-xs font-bold uppercase text-slate-500">Horario disponible</p>
              {!horarioDia?.isOpen || esFestivo ? (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-400">
                  El salón no recibe citas en esta fecha.
                </p>
              ) : serviciosSeleccionados.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-400">
                  Selecciona servicios para ver horarios disponibles.
                </p>
              ) : consultaDisponibilidad.isLoading ? (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-400">
                  Consultando horarios disponibles...
                </p>
              ) : slotsDisponibles.length === 0 ? (
                <p className="rounded-2xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-400">
                  No hay horarios disponibles para la combinación seleccionada.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {slotsDisponibles.map((slot) => (
                    <button
                      key={slot.time}
                      type="button"
                      onClick={() => setHoraSeleccionada(slot.time)}
                      className={`rounded-xl px-4 py-2 text-sm font-black transition-colors ${horaSeleccionada === slot.time ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
                    >
                      {slot.time}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-3xl bg-pink-50 p-4 border border-pink-200">
              <p className="text-xs font-bold uppercase tracking-widest text-pink-600">Resumen</p>
              <p className="mt-2 text-sm font-medium text-slate-700">
                {serviciosSeleccionados.length} servicio(s) · {totalDuracion} min
              </p>
              <p className="mt-1 text-2xl font-black text-pink-700">
                {formatearDinero(totalPrecio, moneda)}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label
                htmlFor="nombreCliente"
                className="mb-1 block text-xs font-bold uppercase text-slate-500"
              >
                Nombre del cliente
              </label>
              <input
                id="nombreCliente"
                type="text"
                {...formulario.register('nombreCliente')}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
              {formulario.formState.errors.nombreCliente && (
                <p className="mt-1 text-xs text-red-500">
                  {formulario.formState.errors.nombreCliente.message}
                </p>
              )}
            </div>
            <div>
              <label
                htmlFor="telefonoCliente"
                className="mb-1 block text-xs font-bold uppercase text-slate-500"
              >
                Teléfono
              </label>
              <input
                id="telefonoCliente"
                type="tel"
                {...formulario.register('telefonoCliente')}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
              {formulario.formState.errors.telefonoCliente && (
                <p className="mt-1 text-xs text-red-500">
                  {formulario.formState.errors.telefonoCliente.message}
                </p>
              )}
            </div>
            <div>
              <input type="hidden" {...formulario.register('fechaNacimiento')} />
              <SelectorFecha
                etiqueta="Fecha de nacimiento"
                valor={formulario.watch('fechaNacimiento') ?? ''}
                max={new Date().toISOString().split('T')[0]}
                error={formulario.formState.errors.fechaNacimiento?.message}
                alCambiar={(valor) =>
                  formulario.setValue('fechaNacimiento', valor, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: true,
                  })
                }
              />
            </div>
            <div>
              <label
                htmlFor="email"
                className="mb-1 block text-xs font-bold uppercase text-slate-500"
              >
                Correo electrónico
              </label>
              <input
                id="email"
                type="email"
                {...formulario.register('email')}
                className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
              {formulario.formState.errors.email && (
                <p className="mt-1 text-xs text-red-500">
                  {formulario.formState.errors.email.message}
                </p>
              )}
            </div>
            {estudio.branches.length > 1 && (
              <div>
                <label
                  htmlFor="sucursal"
                  className="mb-1 block text-xs font-bold uppercase text-slate-500"
                >
                  Sucursal
                </label>
                <select
                  id="sucursal"
                  {...formulario.register('sucursal')}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                >
                  {estudio.branches.map((sucursal) => (
                    <option key={sucursal} value={sucursal}>
                      {sucursal}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {requiereColor && (
              <div>
                <label
                  htmlFor="marcaTinte"
                  className="mb-1 block text-xs font-bold uppercase text-slate-500"
                >
                  Color o tono solicitado (opcional)
                </label>
                <input
                  id="marcaTinte"
                  type="text"
                  placeholder="Ej: rubio ceniza, tinte 7.1"
                  {...formulario.register('marcaTinte')}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
                />
              </div>
            )}
            <div>
              <label
                htmlFor="observaciones"
                className="mb-1 block text-xs font-bold uppercase text-slate-500"
              >
                Notes (optional)
              </label>
              <textarea
                id="observaciones"
                rows={3}
                maxLength={500}
                placeholder="Allergies, preferences, special requests..."
                {...formulario.register('observaciones')}
                className="w-full resize-none rounded-2xl border border-slate-200 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-pink-400"
              />
              {formulario.formState.errors.observaciones && (
                <p className="mt-1 text-xs text-red-500">
                  {formulario.formState.errors.observaciones.message}
                </p>
              )}
            </div>
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onCerrar}
                className="flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm font-black text-slate-700 transition-colors hover:bg-slate-200"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={
                  mutacionCrear.isPending ||
                  !personalSeleccionado ||
                  !horaSeleccionada ||
                  serviciosSeleccionados.length === 0
                }
                className="flex-1 rounded-2xl bg-pink-600 px-4 py-3 text-sm font-black text-white transition-colors hover:bg-pink-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {mutacionCrear.isPending ? 'Guardando...' : 'Crear cita'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
```

## src/caracteristicas/estudio/componentes/GestorFestivos.tsx

```tsx
import { useState } from 'react';
import { Calendar, XCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { SelectorFecha } from '../../../componentes/ui/SelectorFecha';
import { actualizarFestivos } from '../../../servicios/servicioEstudios';
import { usarContextoApp } from '../../../contextos/ContextoApp';
import type { Estudio } from '../../../tipos';

interface PropsGestorFestivos {
  estudio: Estudio;
}

export function GestorFestivos({ estudio }: PropsGestorFestivos) {
  const [nuevaFecha, setNuevaFecha] = useState('');
  const { recargar } = usarContextoApp();

  const { mutate: guardarFestivos, isPending } = useMutation({
    mutationFn: (festivos: string[]) => actualizarFestivos(estudio.id, festivos),
    onSuccess: recargar,
  });

  const agregarFestivo = () => {
    if (!nuevaFecha) return;
    const actualizados = [...(estudio.holidays ?? []), nuevaFecha];
    guardarFestivos(actualizados);
    setNuevaFecha('');
  };

  const eliminarFestivo = (fecha: string) => {
    const actualizados = (estudio.holidays ?? []).filter((d) => d !== fecha);
    guardarFestivos(actualizados);
  };

  return (
    <div className="bg-white rounded-[3rem] p-6 md:p-8 border border-slate-200 shadow-sm">
      <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest mb-2 flex items-center gap-2">
        <Calendar className="w-4 h-4 text-pink-600" /> Gestión de horario
      </h3>
      <p className="text-[10px] text-slate-400 font-bold mb-6">
        Configura cierres del salón para bloquear reservas en fechas específicas.
      </p>

      <div className="flex flex-col sm:flex-row gap-2 mb-6">
        <div className="flex-1">
          <SelectorFecha
            etiqueta="Fecha a bloquear"
            valor={nuevaFecha}
            min={new Date().toISOString().split('T')[0]}
            alCambiar={setNuevaFecha}
          />
        </div>
        <button
          onClick={agregarFestivo}
          disabled={isPending}
          className="bg-slate-900 text-white px-6 py-3 rounded-xl text-xs font-black uppercase hover:bg-black transition-all disabled:opacity-60"
        >
          {isPending ? 'Guardando...' : 'Bloquear'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {(estudio.holidays ?? []).sort().map((h) => (
          <div
            key={h}
            className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-xl text-[10px] font-black flex items-center gap-2"
          >
            {h}
            <button
              onClick={() => eliminarFestivo(h)}
              aria-label={`Eliminar ${h}`}
              className="hover:text-red-900"
            >
              <XCircle className="w-3 h-3" />
            </button>
          </div>
        ))}
        {!estudio.holidays?.length && (
          <p className="text-xs text-slate-400 italic font-bold">No hay cierres programados.</p>
        )}
      </div>
    </div>
  );
}
```

## src/caracteristicas/estudio/componentes/MetricasSalon.tsx

```tsx
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
} from '../utils/metricasSalon';

type ModalActiva = 'citas' | 'ganancias' | 'especialistas' | 'plan' | 'corte' | null;
type PestanaFinanciera = 'dia' | 'semana' | 'mes';

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
  subtitle: string;
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
  { valor: 'pending', etiqueta: 'Pendiente' },
  { valor: 'confirmed', etiqueta: 'Confirmada' },
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

function obtenerSegmentoPeriodoExcel(periodo: PestanaFinanciera) {
  if (periodo === 'dia') return 'dia';
  if (periodo === 'semana') return 'ano';
  return 'mes';
}

function obtenerEtiquetaPeriodo(periodo: PestanaFinanciera) {
  if (periodo === 'dia') return 'Hoy';
  if (periodo === 'semana') return 'Semana';
  return 'Mes';
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
        direccion === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
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

function descargarExcel(nombreArchivo: string, nombreHoja: string, filas: Record<string, unknown>[]) {
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
          <span className="text-xs font-black text-slate-400 uppercase self-center mr-1">Estado:</span>
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
                <BotonOrdenTabla etiqueta="Cliente" activo={campoOrden === 'cliente'} direccion={direccionOrden} onClick={() => alternarOrden('cliente')} />
              </th>
              <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                <BotonOrdenTabla etiqueta="Servicio" activo={campoOrden === 'servicio'} direccion={direccionOrden} onClick={() => alternarOrden('servicio')} />
              </th>
              <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                <BotonOrdenTabla etiqueta="Empleado" activo={campoOrden === 'empleado'} direccion={direccionOrden} onClick={() => alternarOrden('empleado')} />
              </th>
              <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                <BotonOrdenTabla etiqueta="Hora" activo={campoOrden === 'hora'} direccion={direccionOrden} onClick={() => alternarOrden('hora')} />
              </th>
              <th className="text-right py-3 px-2 text-xs font-black text-slate-400 uppercase">
                <BotonOrdenTabla etiqueta="Precio Est." activo={campoOrden === 'precio'} direccion={direccionOrden} alineacion="right" onClick={() => alternarOrden('precio')} />
              </th>
              <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                <BotonOrdenTabla etiqueta="Estado" activo={campoOrden === 'estado'} direccion={direccionOrden} onClick={() => alternarOrden('estado')} />
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
          {filteredCitas.length} citas filtradas de {citas.length} totales - Pagina {paginaActual} de {totalPaginas}
        </p>
        <div className="flex items-center gap-2">
          <PaginadorTabla total={filteredCitas.length} pagina={paginaActual} onCambiarPagina={setPaginaActual} />
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
          return compararTexto(`${filaA.fecha} ${filaA.hora}`, `${filaB.fecha} ${filaB.hora}`, direccionOrden);
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
        <div className={`mb-8 grid grid-cols-1 gap-4 ${esPlanPro ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}>
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
            <span className="text-xs font-black text-slate-400 uppercase self-center mr-1">Tipo:</span>
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

            <span className="text-xs font-black text-slate-400 uppercase self-center ml-3 mr-1">Responsable:</span>
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
                  <BotonOrdenTabla etiqueta="Fecha / Hora" activo={campoOrden === 'fecha'} direccion={direccionOrden} onClick={() => alternarOrden('fecha')} />
                </th>
                <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                  <BotonOrdenTabla etiqueta="Concepto" activo={campoOrden === 'concepto'} direccion={direccionOrden} onClick={() => alternarOrden('concepto')} />
                </th>
                <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                  <BotonOrdenTabla etiqueta="Tipo" activo={campoOrden === 'tipo'} direccion={direccionOrden} onClick={() => alternarOrden('tipo')} />
                </th>
                <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                  <BotonOrdenTabla etiqueta="Responsable" activo={campoOrden === 'responsable'} direccion={direccionOrden} onClick={() => alternarOrden('responsable')} />
                </th>
                <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                  <BotonOrdenTabla etiqueta="Cliente" activo={campoOrden === 'cliente'} direccion={direccionOrden} onClick={() => alternarOrden('cliente')} />
                </th>
                <th className="text-right py-3 px-2 text-xs font-black text-slate-400 uppercase">
                  <BotonOrdenTabla etiqueta="Monto" activo={campoOrden === 'monto'} direccion={direccionOrden} alineacion="right" onClick={() => alternarOrden('monto')} />
                </th>
                <th className="text-right py-3 px-2 text-xs font-black text-slate-400 uppercase">Acumulado</th>
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
          {filasConAcumulado.length} registros - {obtenerEtiquetaPeriodo(financeTab)} - Pagina {paginaActual} de {totalPaginas}
        </p>
        <div className="flex items-center gap-2">
          <PaginadorTabla total={filasConAcumulado.length} pagina={paginaActual} onCambiarPagina={setPaginaActual} />
          <button
            type="button"
            onClick={() =>
              descargarExcel(
                `balance_${obtenerSegmentoPeriodoExcel(financeTab)}_${normalizarNombreArchivo(nombreSalon)}.xlsx`,
                `Balance ${obtenerEtiquetaPeriodo(financeTab)}`,
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
                <BotonOrdenTabla etiqueta="Especialista" activo={campoOrden === 'nombre'} direccion={direccionOrden} onClick={() => alternarOrden('nombre')} />
              </th>
              <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                <BotonOrdenTabla etiqueta="Servicios" activo={campoOrden === 'servicios'} direccion={direccionOrden} onClick={() => alternarOrden('servicios')} />
              </th>
              <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                <BotonOrdenTabla etiqueta="Jornada" activo={campoOrden === 'jornada'} direccion={direccionOrden} onClick={() => alternarOrden('jornada')} />
              </th>
              <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">
                <BotonOrdenTabla etiqueta="Almuerzo" activo={campoOrden === 'descanso'} direccion={direccionOrden} onClick={() => alternarOrden('descanso')} />
              </th>
              <th className="text-right py-3 px-2 text-xs font-black text-slate-400 uppercase">
                <BotonOrdenTabla etiqueta="Citas hoy" activo={campoOrden === 'citasHoy'} direccion={direccionOrden} alineacion="right" onClick={() => alternarOrden('citasHoy')} />
              </th>
              <th className="text-left py-3 px-2 text-xs font-black text-slate-400 uppercase">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((especialista) => (
              <tr key={especialista.id} className="border-b border-slate-50 hover:bg-slate-50">
                <td className="py-3 px-2 font-bold text-slate-900">{especialista.nombre}</td>
                <td className="py-3 px-2 text-slate-600">{especialista.servicios.join(', ')}</td>
                <td className="py-3 px-2 text-slate-700">{especialista.jornada}</td>
                <td className="py-3 px-2 text-slate-600">{especialista.descanso || 'Sin pausa definida'}</td>
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
        <p className="text-xs font-bold text-slate-500">
          {filtrados.length} especialistas activos
        </p>
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
            <p className="mt-1 font-bold text-slate-900">{formatearFechaHumana(data.plan.fechaAdquisicion)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-black uppercase text-slate-400">Proximo cobro</p>
            <p className="mt-1 font-bold text-slate-900">{formatearFechaHumana(data.plan.proximoCorte)}</p>
          </div>
        </div>

        <a
          href={data.plan.whatsapp}
          target="_blank"
          rel="noopener noreferrer"
          className="mx-auto flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-8 py-4 font-bold text-white transition-all hover:bg-emerald-600 sm:w-auto"
        >
          <Smartphone size={20} /> Hablar con Soporte {data.plan.pais === 'Colombia' ? 'Colombia' : 'Mexico'}
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
        <div className="mb-10 sm:hidden">
          <div className="mx-auto grid w-full max-w-xs grid-cols-2 gap-2">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
              <div className="text-3xl font-black leading-none tabular-nums text-slate-900">
                {tiempoRestante.dias}
              </div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Dias</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
              <div className="text-3xl font-black leading-none tabular-nums text-slate-900">
                {tiempoRestante.horas < 10 ? `0${tiempoRestante.horas}` : tiempoRestante.horas}
              </div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Horas</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
              <div className="text-3xl font-black leading-none tabular-nums text-slate-900">
                {tiempoRestante.minutos < 10 ? `0${tiempoRestante.minutos}` : tiempoRestante.minutos}
              </div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Min</div>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-2">
              <div className="text-3xl font-black leading-none tabular-nums text-slate-900">
                {tiempoRestante.segundos < 10 ? `0${tiempoRestante.segundos}` : tiempoRestante.segundos}
              </div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">Seg</div>
            </div>
          </div>
        </div>

        <div className="mb-10 hidden justify-center gap-4 sm:flex">
          <div className="flex flex-col items-center">
            <span className="text-5xl font-black text-slate-900 tabular-nums">{tiempoRestante.dias}</span>
            <span className="text-[10px] font-bold uppercase text-slate-400">Dias</span>
          </div>
          <span className="text-5xl font-light text-slate-300">:</span>
          <div className="flex flex-col items-center">
            <span className="text-5xl font-black text-slate-900 tabular-nums">
              {tiempoRestante.horas < 10 ? `0${tiempoRestante.horas}` : tiempoRestante.horas}
            </span>
            <span className="text-[10px] font-bold uppercase text-slate-400">Horas</span>
          </div>
          <span className="text-5xl font-light text-slate-300">:</span>
          <div className="flex flex-col items-center">
            <span className="text-5xl font-black text-slate-900 tabular-nums">
              {tiempoRestante.minutos < 10 ? `0${tiempoRestante.minutos}` : tiempoRestante.minutos}
            </span>
            <span className="text-[10px] font-bold uppercase text-slate-400">Min</span>
          </div>
          <span className="text-5xl font-light text-slate-300">:</span>
          <div className="flex flex-col items-center">
            <span className="text-5xl font-black text-slate-900 tabular-nums">
              {tiempoRestante.segundos < 10 ? `0${tiempoRestante.segundos}` : tiempoRestante.segundos}
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
              <p className={`text-xs leading-relaxed ${estaCercaCorte ? 'text-amber-700' : 'text-slate-600'}`}>
                Te avisaremos automaticamente cuando falten 10 dias para el corte.
              </p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function MetricasSalon({ estudioId, nombreSalon, saludo, nombreSaludo, fechaEtiqueta }: PropsMetricasSalon) {
  const [activeModal, setActiveModal] = useState<ModalActiva>(null);

  const consultaMetricas = useQuery({
    queryKey: ['estudio', estudioId, 'metricas-dashboard'],
    queryFn: () => obtenerMetricasDashboard(estudioId),
    enabled: Boolean(estudioId),
    staleTime: 5_000,
    refetchInterval: 10_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  });

  const data = consultaMetricas.data;

  return (
    <section>
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm sm:px-6 sm:py-5">
        <p className="text-sm font-semibold text-slate-600">{saludo}, {nombreSaludo}</p>
        <h1 className="mt-1 text-2xl font-black text-slate-900 sm:text-3xl">Panel de metricas del salon</h1>
        <p className="mt-2 text-sm text-slate-500">{fechaEtiqueta}</p>
        {data ? (
          <p className="mt-1 text-xs text-slate-400">
            Actualizado en tiempo real: {new Date(data.actualizadoEn).toLocaleTimeString('es-MX')}
          </p>
        ) : null}
      </div>

      <div className="mb-6 flex items-center gap-2">
        <Zap className="text-amber-500 fill-amber-500" size={20} />
        <h2 className="text-sm font-bold uppercase tracking-widest text-slate-800">Dashboard Operativo</h2>
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
              subtitle="Ganancias acumuladas"
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
```

## src/caracteristicas/estudio/componentes/PanelNotificaciones.tsx

```tsx
import { useState, useEffect, useRef } from 'react';
import { Bell, X, MessageCircle, CheckCircle2, AlertTriangle, ShieldAlert } from 'lucide-react';
import type { NotificacionEstudio } from '../hooks/usarNotificacionesEstudio';

const WHATSAPP_MEXICO = '5255641341516';
const WHATSAPP_COLOMBIA = '573006934216';

interface PropsPanelNotificaciones {
  notificaciones: NotificacionEstudio[];
  pais: string;
  onMarcarLeida: (id: string) => void;
}

function obtenerIconoTipo(tipo: NotificacionEstudio['tipo']) {
  switch (tipo) {
    case 'recordatorio_pago':
      return <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" aria-hidden="true" />;
    case 'pago_confirmado':
      return <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" aria-hidden="true" />;
    case 'suspension':
      return <ShieldAlert className="w-5 h-5 text-red-500 shrink-0" aria-hidden="true" />;
  }
}

function obtenerColorFondo(tipo: NotificacionEstudio['tipo']) {
  switch (tipo) {
    case 'recordatorio_pago':
      return 'bg-amber-50 border-amber-200';
    case 'pago_confirmado':
      return 'bg-green-50 border-green-200';
    case 'suspension':
      return 'bg-red-50 border-red-200';
  }
}

export function PanelNotificaciones({
  notificaciones,
  pais,
  onMarcarLeida,
}: PropsPanelNotificaciones) {
  const [abierto, setAbierto] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const total = notificaciones.length;
  const numeroWhatsApp = pais === 'Colombia' ? WHATSAPP_COLOMBIA : WHATSAPP_MEXICO;
  const enlaceWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent('Hola, necesito información sobre mi suscripción en Beauty Time Pro.')}`;

  useEffect(() => {
    if (!abierto) return;
    const manejarClickFuera = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    const manejarEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAbierto(false);
    };
    document.addEventListener('mousedown', manejarClickFuera);
    document.addEventListener('keydown', manejarEscape);
    return () => {
      document.removeEventListener('mousedown', manejarClickFuera);
      document.removeEventListener('keydown', manejarEscape);
    };
  }, [abierto]);

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setAbierto(!abierto)}
        aria-label={
          total > 0
            ? `${total} notificación${total !== 1 ? 'es' : ''} sin leer`
            : 'Notificaciones del sistema'
        }
        className="relative p-3 bg-amber-50 rounded-full hover:bg-amber-100 transition-colors border border-amber-200"
      >
        <Bell className="w-5 h-5 text-amber-700" />
        {total > 0 ? (
          <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black rounded-full w-5 h-5 flex items-center justify-center">
            {total > 9 ? '9+' : total}
          </span>
        ) : null}
      </button>

      {abierto && (
        <div
          role="dialog"
          aria-label="Notificaciones"
          className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-xl border border-slate-200 z-50 overflow-hidden"
        >
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <h3 className="text-sm font-black uppercase text-slate-900">Notificaciones</h3>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              aria-label="Cerrar"
              className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
            {notificaciones.length > 0 ? (
              notificaciones.map((notif) => (
                <div
                  key={notif.id}
                  className={`px-5 py-4 flex items-start gap-3 border-l-4 ${obtenerColorFondo(notif.tipo)}`}
                >
                  {obtenerIconoTipo(notif.tipo)}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-black text-slate-900">{notif.titulo}</p>
                    <p className="text-xs text-slate-600 mt-1">{notif.mensaje}</p>
                    <p className="text-[10px] text-slate-400 font-bold mt-2">
                      {new Date(notif.creadoEn).toLocaleDateString('es-MX', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onMarcarLeida(notif.id)}
                    aria-label="Marcar como leída"
                    title="Marcar como leída"
                    className="p-1 hover:bg-white/80 rounded-lg transition-colors shrink-0"
                  >
                    <X className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                </div>
              ))
            ) : (
              <div className="px-5 py-10 text-center">
                <p className="text-sm font-black text-slate-900">Todo al día</p>
                <p className="mt-2 text-xs text-slate-500">
                  No tienes notificaciones nuevas por ahora, pero esta campana siempre estará disponible para avisos del sistema.
                </p>
              </div>
            )}
          </div>

          <div className="px-5 py-4 border-t border-slate-100 bg-slate-50">
            <a
              href={enlaceWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 w-full rounded-xl bg-green-500 px-4 py-3 text-xs font-black text-white hover:bg-green-600 transition-colors"
            >
              <MessageCircle className="w-4 h-4" aria-hidden="true" />
              Contactar por WhatsApp
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
```

## src/caracteristicas/estudio/componentes/ModalBienvenidaSalon.tsx

```tsx
import { useEffect, useRef } from 'react';
import { Sparkles, CalendarDays, Users, CheckCircle2 } from 'lucide-react';
import { usarToast } from '../../../componentes/ui/ProveedorToast';

interface PropsModalBienvenidaSalon {
  nombreSalon: string;
  estudioId: string;
  onCerrar: () => void;
}

const PASOS = [
  {
    icono: <Users className="w-5 h-5 text-pink-600" aria-hidden="true" />,
    titulo: 'Añade a tu equipo',
    descripcion: 'Registra tu personal y asígnales los servicios que ofrecen.',
  },
  {
    icono: <CalendarDays className="w-5 h-5 text-pink-600" aria-hidden="true" />,
    titulo: 'Gestiona tu agenda',
    descripcion: 'Revisa citas, bloquea festivos y administra disponibilidad.',
  },
  {
    icono: <Sparkles className="w-5 h-5 text-pink-600" aria-hidden="true" />,
    titulo: 'Recibe clientes',
    descripcion: 'Comparte tu enlace de reservas y empieza a recibir citas.',
  },
];

export function ModalBienvenidaSalon({
  nombreSalon,
  estudioId,
  onCerrar,
}: PropsModalBienvenidaSalon) {
  const { mostrarToast } = usarToast();
  const botonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const manejarEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCerrar();
    };
    document.addEventListener('keydown', manejarEscape);
    botonRef.current?.focus();

    return () => {
      document.removeEventListener('keydown', manejarEscape);
    };
  }, [estudioId, onCerrar]);

  const handleEmpezar = () => {
    mostrarToast({
      mensaje: `¡Bienvenido a ${nombreSalon}! Todo listo para comenzar.`,
      variante: 'exito',
    });
    onCerrar();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-bienvenida"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
    >
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full p-8 animate-fade-in">
        {/* Cabecera */}
        <div className="flex flex-col items-center text-center mb-8">
          <div className="bg-pink-100 p-4 rounded-full mb-4">
            <Sparkles className="w-8 h-8 text-pink-600" aria-hidden="true" />
          </div>
          <h2 id="titulo-bienvenida" className="text-2xl font-black text-slate-900">
            ¡Bienvenido, <span className="text-pink-600">{nombreSalon}</span>!
          </h2>
          <p className="text-slate-500 font-medium mt-2 text-sm">
            Aquí tienes los primeros pasos para comenzar.
          </p>
        </div>

        {/* Pasos */}
        <ol className="space-y-4 mb-8" aria-label="Primeros pasos">
          {PASOS.map((paso, i) => (
            <li key={i} className="flex items-start gap-4">
              <div className="bg-pink-50 p-2 rounded-xl shrink-0">{paso.icono}</div>
              <div>
                <p className="font-bold text-slate-900 text-sm">{paso.titulo}</p>
                <p className="text-slate-500 text-xs mt-0.5">{paso.descripcion}</p>
              </div>
              <CheckCircle2
                className="w-4 h-4 text-slate-200 mt-1 shrink-0 ml-auto"
                aria-hidden="true"
              />
            </li>
          ))}
        </ol>

        {/* Acción */}
        <button
          ref={botonRef}
          onClick={handleEmpezar}
          className="w-full bg-pink-600 text-white py-4 rounded-2xl font-black text-base hover:bg-pink-700 transition-colors shadow-lg shadow-pink-200"
        >
          ¡Empezar ahora!
        </button>
      </div>
    </div>
  );
}
```

## src/caracteristicas/estudio/componentes/ModalSuspension.tsx

```tsx
import { ShieldAlert, MessageCircle } from 'lucide-react';

const WHATSAPP_MEXICO = '525564134151';
const WHATSAPP_COLOMBIA = '573006934216';

interface PropsModalSuspension {
  nombreSalon: string;
  pais: string;
}

export function ModalSuspension({ nombreSalon, pais }: PropsModalSuspension) {
  const numeroWhatsApp = pais === 'Colombia' ? WHATSAPP_COLOMBIA : WHATSAPP_MEXICO;
  const telefonoVisible = pais === 'Colombia' ? '+57 300 6934216' : '+52 55 6413 4151';
  const enlaceWhatsApp = `https://wa.me/${numeroWhatsApp}?text=${encodeURIComponent(`Hola, mi salón "${nombreSalon}" fue suspendido por falta de pago. Necesito ayuda para renovar la suscripción y reactivar la cuenta.`)}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="titulo-suspension"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/95 backdrop-blur-sm"
    >
      <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full p-8 text-center">
        <div className="bg-red-100 p-5 rounded-full inline-flex mb-6">
          <ShieldAlert className="w-10 h-10 text-red-600" aria-hidden="true" />
        </div>

        <h2 id="titulo-suspension" className="text-2xl font-black text-slate-900 uppercase">
          Suscripción suspendida
        </h2>

        <p className="text-slate-600 mt-4 text-sm leading-relaxed">
          Tu usuario fue suspendido por falta de pago en <strong>{nombreSalon}</strong>. Comunícate
          con soporte para renovar la suscripción y reactivar tu acceso.
        </p>

        <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
          Soporte {pais === 'Colombia' ? 'Colombia' : 'México'}: {telefonoVisible}
        </p>

        <div className="mt-8 space-y-3">
          <a
            href={enlaceWhatsApp}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full rounded-xl bg-green-500 px-4 py-4 text-sm font-black text-white hover:bg-green-600 transition-colors"
          >
            <MessageCircle className="w-5 h-5" aria-hidden="true" />
            Abrir WhatsApp
          </a>
        </div>

        <p className="text-[11px] text-slate-400 font-bold mt-6">
          Cuando el pago sea confirmado, el sistema reactivará la cuenta automáticamente.
        </p>
      </div>
    </div>
  );
}
```

## src/caracteristicas/estudio/hooks/usarNotificacionesEstudio.ts

```tsx
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { peticion } from '../../../lib/clienteHTTP';

export interface NotificacionEstudio {
  id: string;
  estudioId: string;
  tipo: 'recordatorio_pago' | 'pago_confirmado' | 'suspension';
  titulo: string;
  mensaje: string;
  leida: boolean;
  creadoEn: string;
}

type RespuestaNotificaciones = { datos: NotificacionEstudio[] };

export function usarNotificacionesEstudio(estudioId: string | undefined) {
  const clienteConsulta = useQueryClient();

  const consulta = useQuery({
    queryKey: ['notificaciones-estudio', estudioId],
    queryFn: () =>
      peticion<RespuestaNotificaciones>(`/estudios/${estudioId}/notificaciones`).then(
        (r) => r.datos,
      ),
    enabled: !!estudioId,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const mutacionLeer = useMutation({
    mutationFn: (notifId: string) =>
      peticion(`/estudios/${estudioId}/notificaciones/${notifId}/leer`, { method: 'PUT' }),
    onSuccess: () => {
      void clienteConsulta.invalidateQueries({
        queryKey: ['notificaciones-estudio', estudioId],
      });
    },
  });

  return {
    notificaciones: consulta.data ?? [],
    cargando: consulta.isLoading,
    marcarLeida: mutacionLeer.mutate,
  };
}
```

## src/caracteristicas/estudio/utils/metricasSalon.ts

```tsx
import type {
  CitaDashboardSalon,
  EspecialistaActivoDashboardSalon,
  FilaIngresoDashboardSalon,
} from '../../../servicios/servicioEstudios';

function normalizarTexto(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();
}

export function obtenerEtiquetaEstadoReserva(estado: string): string {
  switch (estado) {
    case 'pending':
      return 'Pendiente';
    case 'confirmed':
      return 'Confirmada';
    case 'completed':
      return 'Completada';
    case 'cancelled':
      return 'Cancelada';
    case 'no_show':
      return 'No asistió';
    case 'rescheduled':
      return 'Reagendada';
    default:
      return estado;
  }
}

export function obtenerClaseEstadoReserva(estado: string): string {
  switch (estado) {
    case 'pending':
      return 'bg-amber-100 text-amber-700';
    case 'confirmed':
      return 'bg-blue-100 text-blue-700';
    case 'completed':
      return 'bg-emerald-100 text-emerald-700';
    case 'cancelled':
      return 'bg-rose-100 text-rose-700';
    case 'no_show':
      return 'bg-slate-200 text-slate-700';
    case 'rescheduled':
      return 'bg-orange-100 text-orange-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export function filtrarCitasDashboard(
  citas: CitaDashboardSalon[],
  termino: string,
  estado: string,
) {
  const terminoNormalizado = normalizarTexto(termino);

  return citas.filter((cita) => {
    const coincideEstado = estado === 'todos' || cita.estado === estado;
    if (!coincideEstado) return false;
    if (!terminoNormalizado) return true;

    const textoBase = normalizarTexto(
      [
        cita.cliente,
        cita.telefonoCliente,
        cita.especialista,
        cita.servicioPrincipal,
        cita.servicios.join(' '),
        cita.sucursal,
        cita.hora,
      ].join(' '),
    );

    return textoBase.includes(terminoNormalizado);
  });
}

export function filtrarIngresosDashboard(
  filas: FilaIngresoDashboardSalon[],
  termino: string,
  tipo: 'todos' | 'servicio' | 'producto',
) {
  const terminoNormalizado = normalizarTexto(termino);

  return filas.filter((fila) => {
    const coincideTipo = tipo === 'todos' || fila.tipo === tipo;
    if (!coincideTipo) return false;
    if (!terminoNormalizado) return true;

    const textoBase = normalizarTexto(
      [fila.concepto, fila.cliente, fila.especialista, fila.sucursal, fila.fecha, fila.hora].join(
        ' ',
      ),
    );

    return textoBase.includes(terminoNormalizado);
  });
}

export function construirFilasAcumuladas(
  filas: FilaIngresoDashboardSalon[],
): Array<FilaIngresoDashboardSalon & { acumulado: number }> {
  let acumulado = 0;

  return filas.map((fila) => {
    acumulado += fila.total;
    return {
      ...fila,
      acumulado,
    };
  });
}

export function filtrarEspecialistasDashboard(
  especialistas: EspecialistaActivoDashboardSalon[],
  termino: string,
) {
  const terminoNormalizado = normalizarTexto(termino);
  if (!terminoNormalizado) return especialistas;

  return especialistas.filter((especialista) =>
    normalizarTexto(
      [
        especialista.nombre,
        especialista.jornada,
        especialista.descanso,
        especialista.proximaCita ?? '',
        especialista.servicios.join(' '),
      ].join(' '),
    ).includes(terminoNormalizado),
  );
}
```

## src/componentes/ui/BannerNotificacionesPush.tsx

```tsx
interface PropsBannerNotificacionesPush {
  visible: boolean;
  activando?: boolean;
  mensaje: string;
  onActivar: () => void | Promise<void>;
  onDescartar: () => void;
}

export function BannerNotificacionesPush({
  visible,
  activando = false,
  mensaje,
  onActivar,
  onDescartar,
}: PropsBannerNotificacionesPush) {
  if (!visible) return null;

  return (
    <div className="bg-pink-50 border-b border-pink-200 px-4 py-2 flex flex-col gap-2 text-sm md:flex-row md:items-center md:justify-between">
      <span className="font-medium text-slate-700">{mensaje}</span>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void onActivar()}
          disabled={activando}
          className="bg-pink-600 text-white px-3 py-1 rounded-lg text-xs font-bold disabled:opacity-60"
        >
          {activando ? 'Activando...' : 'Activar'}
        </button>
        <button
          type="button"
          onClick={onDescartar}
          className="text-slate-500 text-xs font-bold px-2 py-1"
        >
          Ahora no
        </button>
      </div>
    </div>
  );
}
```

## src/hooks/usarNotificacionesPush.ts

```tsx
import { useEffect, useMemo, useState } from 'react';
import { peticion } from '../lib/clienteHTTP';
import { usarTiendaAuth } from '../tienda/tiendaAuth';

function urlBase64AUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const base64Url = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(base64Url);
  return Uint8Array.from([...raw].map((caracter) => caracter.charCodeAt(0)));
}

async function obtenerRegistroServiceWorker() {
  if (!('serviceWorker' in navigator)) return null;

  const registroExistente = await navigator.serviceWorker.getRegistration('/sw.js');
  if (registroExistente) return registroExistente;

  return navigator.serviceWorker.register('/sw.js');
}

export function usarNotificacionesPush() {
  const usuario = usarTiendaAuth((estado) => estado.usuario);
  const [notificacionesActivas, setNotificacionesActivas] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [descartado, setDescartado] = useState(false);

  const soportadoNavegador =
    typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window;
  const contextoSeguroPush =
    typeof window !== 'undefined' &&
    (window.location.protocol === 'https:' ||
      ['localhost', '127.0.0.1'].includes(window.location.hostname));
  const soportado = soportadoNavegador && contextoSeguroPush;
  const claveUsuario = useMemo(() => {
    if (!usuario) return 'anonimo';
    return `${usuario.rol}:${usuario.email || usuario.estudioId || usuario.nombre}`;
  }, [usuario]);
  const claveDescartar = `btp_push_descartado_${claveUsuario}`;

  useEffect(() => {
    setDescartado(localStorage.getItem(claveDescartar) === '1');
  }, [claveDescartar]);

  useEffect(() => {
    if (!soportado) {
      setNotificacionesActivas(false);
      setCargando(false);
      return;
    }

    let cancelado = false;

    void (async () => {
      try {
        if (Notification.permission !== 'granted') {
          if (!cancelado) setNotificacionesActivas(false);
          return;
        }

        const registro = await navigator.serviceWorker.getRegistration('/sw.js');
        const suscripcion = await registro?.pushManager.getSubscription();
        if (!cancelado) {
          setNotificacionesActivas(Boolean(suscripcion));
        }
        // Si el navegador ya tiene suscripción, re-registrarla en el servidor
        // para el usuario actual (por si inició sesión en un dispositivo que otro
        // usuario ya había suscripto). El backend hace upsert por endpoint.
        if (suscripcion && !cancelado) {
          peticion('/push/suscribir', {
            method: 'POST',
            body: JSON.stringify(suscripcion.toJSON()),
          }).catch(() => {});
        }
      } finally {
        if (!cancelado) {
          setCargando(false);
        }
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [soportado]);

  const activar = async () => {
    if (!soportadoNavegador) return false;

    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      console.warn('[Push] Solo disponible en HTTPS');
      return false;
    }

    const registro = await obtenerRegistroServiceWorker();
    if (!registro) return false;

    const permiso = await Notification.requestPermission();
    if (permiso !== 'granted') {
      setNotificacionesActivas(false);
      return false;
    }

    const { clavePublica } = await peticion<{ clavePublica: string }>('/push/clave-publica');
    let suscripcion = await registro.pushManager.getSubscription();

    if (!suscripcion) {
      const claveAplicacion = urlBase64AUint8Array(clavePublica) as unknown as BufferSource;
      suscripcion = await registro.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: claveAplicacion,
      });
    }

    await peticion('/push/suscribir', {
      method: 'POST',
      body: JSON.stringify(suscripcion.toJSON()),
    });

    localStorage.removeItem(claveDescartar);
    setDescartado(false);
    setNotificacionesActivas(true);
    return true;
  };

  const desactivar = async () => {
    if (!soportado) return false;

    const registro = await navigator.serviceWorker.getRegistration('/sw.js');
    const suscripcion = await registro?.pushManager.getSubscription();

    if (suscripcion?.endpoint) {
      await peticion('/push/cancelar', {
        method: 'DELETE',
        body: JSON.stringify({ endpoint: suscripcion.endpoint }),
      });
    }

    await suscripcion?.unsubscribe();
    setNotificacionesActivas(false);
    return true;
  };

  const descartar = () => {
    localStorage.setItem(claveDescartar, '1');
    setDescartado(true);
  };

  return {
    activar,
    desactivar,
    descartar,
    soportado,
    cargando,
    notificacionesActivas,
    bannerVisible: soportado && !cargando && !notificacionesActivas && !descartado,
  };
}
```

## src/componentes/ui/Spinner.tsx

```tsx
interface PropsSpinner {
  tamaño?: 'sm' | 'md' | 'lg';
}

export function Spinner({ tamaño = 'md' }: PropsSpinner) {
  const clases = {
    sm: 'h-6 w-6 border-2',
    md: 'h-12 w-12 border-b-2',
    lg: 'h-16 w-16 border-b-2',
  };

  return (
    <div className="flex items-center justify-center">
      <div
        className={`animate-spin rounded-full border-pink-600 ${clases[tamaño]}`}
        aria-busy="true"
        aria-label="Cargando"
      />
    </div>
  );
}
```

