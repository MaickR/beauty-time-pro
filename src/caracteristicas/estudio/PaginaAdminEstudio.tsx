import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Store,
  LogOut,
  Calendar,
  Wallet,
  DollarSign,
  TrendingUp,
  Users,
  Palette,
  Gift,
  HelpCircle,
  ShoppingBag,
  CalendarRange,
  CalendarCheck,
  BarChart3,
} from 'lucide-react';
import { usarContextoApp } from '../../contextos/ContextoApp';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';
import { obtenerFechaLocalISO, formatearDinero } from '../../utils/formato';
import { CatalogoServicios } from './componentes/CatalogoServicios';
import { ConfigFidelidad } from './componentes/ConfigFidelidad';
import { MensajesMasivos } from './componentes/MensajesMasivos';
import { PanelProductos } from './componentes/PanelProductos';
import { DirectorioClientes } from './componentes/DirectorioClientes';
import { PerfilSalon } from './componentes/PerfilSalon';
import { PanelMiEquipo } from './componentes/PanelMiEquipo';
import { SeccionContacto } from './componentes/SeccionContacto';
import { Spinner } from '../../componentes/ui/Spinner';
import { BannerNotificacionesPush } from '../../componentes/ui/BannerNotificacionesPush';
import { usarNotificacionesPush } from '../../hooks/usarNotificacionesPush';
import { ModalSuspension } from './componentes/ModalSuspension';
import { PanelNotificaciones } from './componentes/PanelNotificaciones';
import { usarNotificacionesEstudio } from './hooks/usarNotificacionesEstudio';
import { GestorFestivos } from './componentes/GestorFestivos';
import type { Moneda, Reserva, Personal, Servicio } from '../../tipos';

type FiltroSeguimientoIngresos = 'hoy' | 'semana' | 'mes' | 'historico';

interface FilaSeguimientoIngresos {
  idPersonal: string;
  nombrePersonal: string;
  citasCompletadas: number;
  ventasTotales: number;
  comisionesTotales: number;
}

function calcularComisionServicios(
  reserva: Reserva,
  personal: Personal | undefined,
): { montoComision: number; serviciosContabilizados: number } {
  const porcentajeBase = personal?.commissionBasePercentage ?? 0;
  const comisionPorServicio = personal?.serviceCommissionPercentages ?? {};

  const serviciosFuente: Servicio[] =
    reserva.serviceDetails && reserva.serviceDetails.length > 0
      ? reserva.serviceDetails.map((servicioDetalle) => ({
          name: servicioDetalle.name,
          duration: servicioDetalle.duration,
          price: servicioDetalle.price,
          category: servicioDetalle.category,
        }))
      : reserva.services;

  if (serviciosFuente.length === 0) {
    return {
      montoComision: Math.round(((reserva.totalPrice ?? 0) * porcentajeBase) / 100),
      serviciosContabilizados: 0,
    };
  }

  const montoComision = serviciosFuente.reduce((acumulado, servicio) => {
    const porcentajeServicio = comisionPorServicio[servicio.name] ?? porcentajeBase;
    return acumulado + Math.round(((servicio.price ?? 0) * porcentajeServicio) / 100);
  }, 0);

  return { montoComision, serviciosContabilizados: serviciosFuente.length };
}

export function PaginaAdminEstudio() {
  usarTituloPagina('Administración');
  const { slug } = useParams<{ slug: string }>();
  const navegar = useNavigate();
  const { estudios, reservas, cargando } = usarContextoApp();
  const { cerrarSesion, usuario } = usarTiendaAuth();
  const [seccion, setSeccion] = useState<
    'ingresos' | 'clientes' | 'fidelidad' | 'salon' | 'equipo' | 'productos' | 'contacto'
  >('ingresos');
  const [filtroSeguimientoIngresos, setFiltroSeguimientoIngresos] =
    useState<FiltroSeguimientoIngresos>('mes');
  const [subseccionSalon, setSubseccionSalon] = useState<'perfil' | 'horario'>('perfil');
  const [activandoPush, setActivandoPush] = useState(false);
  const push = usarNotificacionesPush();
  const estudio = estudios.find((s) => s.slug === slug || s.clientKey === slug || s.id === slug);
  const estudioId = estudio?.id;
  const { notificaciones, marcarLeida } = usarNotificacionesEstudio(estudioId);
  const identificadorRutaPrivada =
    estudio?.slug?.trim() || estudio?.clientKey?.trim() || estudio?.id;

  // Navegar una sola vez si la URL usa clientKey/id en lugar del slug.
  // Usar ref para no repetir la navegación en cada refetch de datos.
  const navegacionRealizadaRef = useRef(false);
  useEffect(() => {
    if (navegacionRealizadaRef.current) return;
    if (!identificadorRutaPrivada || !slug) return;
    if (slug === identificadorRutaPrivada) {
      navegacionRealizadaRef.current = true;
      return;
    }
    navegacionRealizadaRef.current = true;
    navegar(`/estudio/${identificadorRutaPrivada}/admin`, { replace: true });
  }, [identificadorRutaPrivada, slug, navegar]);

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

  const moneda: Moneda = estudio.country === 'Colombia' ? 'COP' : 'MXN';
  const reservasEstudio = reservas.filter((r) => r.studioId === estudio.id);
  const hoySrt = obtenerFechaLocalISO(new Date());
  const mesPrefijo = hoySrt.substring(0, 7);
  const completadas = reservasEstudio.filter((b) => b.status === 'completed');
  const totalHoy = completadas
    .filter((b) => b.date === hoySrt)
    .reduce((acc, b) => acc + (b.totalPrice ?? 0), 0);
  const totalMes = completadas
    .filter((b) => b.date.startsWith(mesPrefijo))
    .reduce((acc, b) => acc + (b.totalPrice ?? 0), 0);
  const totalSemana = completadas
    .filter((b) => {
      const fechaReserva = new Date(`${b.date}T00:00:00`);
      const fechaHoy = new Date(`${hoySrt}T00:00:00`);
      const diferenciaDias = Math.floor((fechaHoy.getTime() - fechaReserva.getTime()) / 86400000);
      return diferenciaDias >= 0 && diferenciaDias < 7;
    })
    .reduce((acc, b) => acc + (b.totalPrice ?? 0), 0);

  const reservasFiltradasSeguimiento = completadas.filter((reserva) => {
    if (filtroSeguimientoIngresos === 'historico') return true;

    if (filtroSeguimientoIngresos === 'hoy') {
      return reserva.date === hoySrt;
    }

    if (filtroSeguimientoIngresos === 'mes') {
      return reserva.date.startsWith(mesPrefijo);
    }

    const fechaReserva = new Date(`${reserva.date}T00:00:00`);
    const fechaHoy = new Date(`${hoySrt}T00:00:00`);
    const diferenciaDias = Math.floor((fechaHoy.getTime() - fechaReserva.getTime()) / 86400000);
    return diferenciaDias >= 0 && diferenciaDias < 7;
  });

  const seguimientoPorPersonal = reservasFiltradasSeguimiento.reduce<
    Map<string, FilaSeguimientoIngresos>
  >((acumulado, reserva) => {
    const personal = estudio.staff.find((persona) => persona.id === reserva.staffId);
    const idPersonal = reserva.staffId || 'sin-personal';
    const nombrePersonal = personal?.name || reserva.staffName || 'Sin asignar';
    const registroActual = acumulado.get(idPersonal) ?? {
      idPersonal,
      nombrePersonal,
      citasCompletadas: 0,
      ventasTotales: 0,
      comisionesTotales: 0,
    };
    const resumenComision = calcularComisionServicios(reserva, personal);

    acumulado.set(idPersonal, {
      ...registroActual,
      citasCompletadas: registroActual.citasCompletadas + 1,
      ventasTotales: registroActual.ventasTotales + (reserva.totalPrice ?? 0),
      comisionesTotales: registroActual.comisionesTotales + resumenComision.montoComision,
    });

    return acumulado;
  }, new Map<string, FilaSeguimientoIngresos>());

  const filasSeguimientoIngresos = Array.from(seguimientoPorPersonal.values()).sort(
    (a, b) => b.ventasTotales - a.ventasTotales,
  );

  const totalVentasSeguimiento = reservasFiltradasSeguimiento.reduce(
    (acumulado, reserva) => acumulado + (reserva.totalPrice ?? 0),
    0,
  );

  const totalComisionesSeguimiento = filasSeguimientoIngresos.reduce(
    (acumulado, fila) => acumulado + fila.comisionesTotales,
    0,
  );

  const ticketPromedioSeguimiento =
    reservasFiltradasSeguimiento.length > 0
      ? Math.round(totalVentasSeguimiento / reservasFiltradasSeguimiento.length)
      : 0;

  const tarjetas = [
    {
      titulo: 'Ventas del día',
      monto: totalHoy,
      icono: DollarSign,
      color: 'bg-green-100 text-green-700',
    },
    {
      titulo: 'Ventas de la semana',
      monto: totalSemana,
      icono: CalendarRange,
      color: 'bg-blue-100 text-blue-700',
    },
    {
      titulo: 'Ventas del mes',
      monto: totalMes,
      icono: CalendarCheck,
      color: 'bg-pink-100 text-pink-700',
    },
  ];

  const volverPanelVendedor = () => {
    navegar('/vendedor');
  };

  const manejarCerrarSesion = async () => {
    await cerrarSesion();
    navegar('/iniciar-sesion', { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      <BannerNotificacionesPush
        visible={push.bannerVisible}
        activando={activandoPush}
        mensaje="Activa las notificaciones para recibir avisos de nuevas citas y cambios en tu agenda"
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
        <div className="no-imprimir -mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
          <div className="mx-auto inline-flex min-w-max gap-1 rounded-2xl border border-slate-200 bg-slate-200/50 p-1 md:mx-0">
            <button
              onClick={() => navegar(`/estudio/${identificadorRutaPrivada}/agenda`)}
              className="inline-flex items-center gap-2 rounded-xl px-4 py-3 text-[10px] font-black text-slate-500 transition-all hover:text-slate-800 md:px-6 md:text-xs"
            >
              <Calendar className="h-4 w-4" /> Agenda
            </button>
            <button
              onClick={() => navegar(`/estudio/${identificadorRutaPrivada}/admin`)}
              className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-3 text-[10px] font-black text-slate-900 shadow-sm transition-all md:px-6 md:text-xs"
            >
              <Wallet className="h-4 w-4" /> Administración
            </button>
          </div>
        </div>

        <div className="no-imprimir -mx-4 overflow-x-auto px-4 pb-2 md:mx-0 md:px-0">
          <div className="inline-flex min-w-max gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1">
            <button
              onClick={() => setSeccion('ingresos')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[10px] font-black transition-all md:px-6 md:text-xs ${seccion === 'ingresos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <TrendingUp className="h-4 w-4 shrink-0" /> Ingresos
            </button>
            <button
              onClick={() => setSeccion('clientes')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[10px] font-black transition-all md:px-6 md:text-xs ${seccion === 'clientes' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <Users className="h-4 w-4 shrink-0" /> Clientes
            </button>
            <button
              onClick={() => setSeccion('salon')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[10px] font-black transition-all md:px-6 md:text-xs ${seccion === 'salon' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <Palette className="h-4 w-4 shrink-0" /> Mi salón
            </button>
            <button
              onClick={() => setSeccion('equipo')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[10px] font-black transition-all md:px-6 md:text-xs ${seccion === 'equipo' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <Users className="h-4 w-4 shrink-0" /> Mi equipo
            </button>
            <button
              onClick={() => setSeccion('productos')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[10px] font-black transition-all md:px-6 md:text-xs ${seccion === 'productos' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <ShoppingBag className="h-4 w-4 shrink-0" /> Productos
            </button>
            <button
              onClick={() => setSeccion('fidelidad')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[10px] font-black transition-all md:px-6 md:text-xs ${seccion === 'fidelidad' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <Gift className="h-4 w-4 shrink-0" /> Beneficios
            </button>
            <button
              onClick={() => setSeccion('contacto')}
              className={`inline-flex items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-[10px] font-black transition-all md:px-6 md:text-xs ${seccion === 'contacto' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              <HelpCircle className="h-4 w-4 shrink-0" /> Soporte
            </button>
          </div>
        </div>

        {seccion === 'ingresos' && (
          <>
            <div className="space-y-4">
              <div>
                <h2 className="text-3xl font-black italic uppercase tracking-tighter">
                  Resumen de ingresos
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Consulta ventas generales y seguimiento de comisiones por integrante del equipo.
                </p>
              </div>

              <div className="no-imprimir -mx-4 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
                <div className="inline-flex min-w-max gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1">
                  {(
                    [
                      { valor: 'hoy', etiqueta: 'Hoy' },
                      { valor: 'semana', etiqueta: 'Semana' },
                      { valor: 'mes', etiqueta: 'Mes' },
                      { valor: 'historico', etiqueta: 'Histórico' },
                    ] as const
                  ).map((opcion) => (
                    <button
                      key={opcion.valor}
                      type="button"
                      onClick={() => setFiltroSeguimientoIngresos(opcion.valor)}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all md:text-xs ${
                        filtroSeguimientoIngresos === opcion.valor
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      <BarChart3 className="h-4 w-4" /> {opcion.etiqueta}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {tarjetas.map(({ titulo, monto, icono: Icono, color }) => (
                <div
                  key={titulo}
                  className="bg-white rounded-[2.5rem] p-8 border border-slate-200 shadow-sm"
                >
                  <div
                    className={`${color} w-12 h-12 rounded-2xl flex items-center justify-center mb-4`}
                  >
                    <Icono className="w-6 h-6" />
                  </div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    {titulo}
                  </p>
                  <p className="text-3xl font-black mt-1 tracking-tighter">
                    {formatearDinero(monto, moneda)}
                  </p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Ventas filtradas
                </p>
                <p className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                  {formatearDinero(totalVentasSeguimiento, moneda)}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Comisiones estimadas
                </p>
                <p className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                  {formatearDinero(totalComisionesSeguimiento, moneda)}
                </p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Ticket promedio
                </p>
                <p className="mt-1 text-2xl font-black tracking-tight text-slate-900">
                  {formatearDinero(ticketPromedioSeguimiento, moneda)}
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="border-b border-slate-100 px-5 py-4">
                <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Seguimiento por colaborador
                </p>
                <h3 className="text-xl font-black tracking-tight text-slate-900">
                  Ventas y comisiones
                </h3>
              </div>

              {filasSeguimientoIngresos.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm font-bold text-slate-500">
                    No hay reservas completadas en este filtro.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-5 py-3 text-left text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Colaborador
                        </th>
                        <th className="px-5 py-3 text-right text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Citas
                        </th>
                        <th className="px-5 py-3 text-right text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Ventas
                        </th>
                        <th className="px-5 py-3 text-right text-[11px] font-black uppercase tracking-widest text-slate-500">
                          Comisión
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {filasSeguimientoIngresos.map((fila) => (
                        <tr key={fila.idPersonal}>
                          <td className="px-5 py-3 text-sm font-bold text-slate-800">
                            {fila.nombrePersonal}
                          </td>
                          <td className="px-5 py-3 text-right text-sm font-semibold text-slate-600">
                            {fila.citasCompletadas}
                          </td>
                          <td className="px-5 py-3 text-right text-sm font-semibold text-slate-800">
                            {formatearDinero(fila.ventasTotales, moneda)}
                          </td>
                          <td className="px-5 py-3 text-right text-sm font-black text-slate-900">
                            {formatearDinero(fila.comisionesTotales, moneda)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <CatalogoServicios estudio={estudio} />
          </>
        )}

        {seccion === 'clientes' && (
          <>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter">
              Directorio de Clientes
            </h2>
            <DirectorioClientes estudioId={estudio.id} />
          </>
        )}

        {seccion === 'fidelidad' && (
          <>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter">Beneficios</h2>
            <ConfigFidelidad estudioId={estudio.id} plan={estudio.plan} />
            <MensajesMasivos estudioId={estudio.id} plan={estudio.plan} />
          </>
        )}

        {seccion === 'salon' && (
          <>
            <div className="space-y-4">
              <div>
                <h2 className="text-3xl font-black italic uppercase tracking-tighter">Mi Salón</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Ordena la información general del salón y la gestión de horario en espacios
                  separados.
                </p>
              </div>

              <div className="no-imprimir -mx-4 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
                <div className="inline-flex min-w-max gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setSubseccionSalon('perfil')}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all md:text-xs ${subseccionSalon === 'perfil' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    <Palette className="h-4 w-4" /> Perfil
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubseccionSalon('horario')}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-[10px] font-black uppercase tracking-widest transition-all md:text-xs ${subseccionSalon === 'horario' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    <CalendarRange className="h-4 w-4" /> Horario
                  </button>
                </div>
              </div>
            </div>

            {subseccionSalon === 'perfil' ? (
              <PerfilSalon estudioId={estudio.id} />
            ) : (
              <div className="space-y-4">
                <div className="rounded-4xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
                  <div className="max-w-2xl space-y-2">
                    <p className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-400">
                      Gestión de horario
                    </p>
                    <h3 className="text-2xl font-black tracking-tight text-slate-900">
                      Horarios, descansos y festivos del salón
                    </h3>
                    <p className="text-sm text-slate-500">
                      Mantén aquí la programación operativa para que la agenda y la reserva pública
                      respeten estos límites.
                    </p>
                  </div>
                </div>
                <GestorFestivos estudio={estudio} />
              </div>
            )}
          </>
        )}

        {seccion === 'equipo' && (
          <>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter">Mi equipo</h2>
            <PanelMiEquipo estudio={estudio} />
          </>
        )}

        {seccion === 'productos' && (
          <>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter">Productos</h2>
            <PanelProductos estudioId={estudio.id} moneda={moneda} plan={estudio.plan} />
          </>
        )}

        {seccion === 'contacto' && <SeccionContacto estudio={estudio} />}
      </main>

      {estudio.estado === 'suspendido' && (
        <ModalSuspension
          nombreSalon={estudio.name}
          pais={estudio.country ?? 'Mexico'}
          onSalir={manejarSalidaPorSuspension}
        />
      )}
    </div>
  );
}
