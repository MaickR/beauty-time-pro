import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
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
import type { Moneda } from '../../tipos';

export function PaginaAdminEstudio() {
  usarTituloPagina('Administración');
  const { slug } = useParams<{ slug: string }>();
  const navegar = useNavigate();
  const { estudios, reservas, cargando } = usarContextoApp();
  const { cerrarSesion } = usarTiendaAuth();
  const [seccion, setSeccion] = useState<
    'ingresos' | 'clientes' | 'fidelidad' | 'salon' | 'equipo' | 'productos' | 'contacto'
  >('ingresos');
  const [subseccionSalon, setSubseccionSalon] = useState<'perfil' | 'horario'>('perfil');
  const [activandoPush, setActivandoPush] = useState(false);
  const push = usarNotificacionesPush();
  const estudio = estudios.find((s) => s.slug === slug || s.clientKey === slug || s.id === slug);
  const estudioId = estudio?.id;
  const { notificaciones, marcarLeida } = usarNotificacionesEstudio(estudioId);
  const identificadorRutaPrivada = estudio?.slug?.trim() || estudio?.clientKey?.trim() || estudio?.id;

  useEffect(() => {
    if (!identificadorRutaPrivada || !slug || slug === identificadorRutaPrivada) return;
    navegar(`/estudio/${identificadorRutaPrivada}/admin`, { replace: true });
  }, [identificadorRutaPrivada, slug, navegar]);

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
            <h2 className="text-3xl font-black italic uppercase tracking-tighter">
              Resumen de ingresos
            </h2>

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
                  Ordena la información general del salón y la gestión de horario en espacios separados.
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
                      Mantén aquí la programación operativa para que la agenda y la reserva pública respeten estos límites.
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
        <ModalSuspension nombreSalon={estudio.name} pais={estudio.country ?? 'Mexico'} />
      )}
    </div>
  );
}
