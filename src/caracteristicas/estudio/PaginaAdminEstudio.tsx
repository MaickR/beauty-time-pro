import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Store,
  LogOut,
  Calendar,
  Wallet,
  DollarSign,
  PieChart,
  TrendingUp,
  Users,
  Palette,
  Gift,
  CreditCard,
} from 'lucide-react';
import { usarContextoApp } from '../../contextos/ContextoApp';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';
import { obtenerFechaLocalISO, formatearDinero } from '../../utils/formato';
import { CatalogoServicios } from './componentes/CatalogoServicios';
import { ConfigFidelidad } from './componentes/ConfigFidelidad';
import { DirectorioClientes } from './componentes/DirectorioClientes';
import { PerfilSalon } from './componentes/PerfilSalon';
import { FormularioPinCancelacion } from './componentes/FormularioPinCancelacion';
import { Spinner } from '../../componentes/ui/Spinner';
import { BannerNotificacionesPush } from '../../componentes/ui/BannerNotificacionesPush';
import { usarNotificacionesPush } from '../../hooks/usarNotificacionesPush';
import { usarToast } from '../../componentes/ui/ProveedorToast';
import { ModalSolicitudCancelacion } from './componentes/ModalSolicitudCancelacion';
import { retirarSolicitudCancelacion } from '../../servicios/servicioSuscripcion';
import type { Moneda } from '../../tipos';
import { obtenerDefinicionPlan } from '../../lib/planes';

export function PaginaAdminEstudio() {
  usarTituloPagina('Administración');
  const { estudioId } = useParams<{ estudioId: string }>();
  const navegar = useNavigate();
  const { estudios, reservas, cargando, recargar } = usarContextoApp();
  const { cerrarSesion } = usarTiendaAuth();
  const { mostrarToast } = usarToast();
  const clienteConsulta = useQueryClient();
  const [seccion, setSeccion] = useState<
    'ingresos' | 'clientes' | 'fidelidad' | 'salon' | 'suscripcion'
  >('ingresos');
  const [activandoPush, setActivandoPush] = useState(false);
  const [mostrarModalCancelacion, setMostrarModalCancelacion] = useState(false);
  const push = usarNotificacionesPush();

  const mutRetirar = useMutation({
    mutationFn: (id: string) => retirarSolicitudCancelacion(id),
    onSuccess: () => {
      mostrarToast({ mensaje: 'Solicitud de cancelación retirada', variante: 'exito' });
      void clienteConsulta.invalidateQueries({ queryKey: ['contexto', 'app'] });
      recargar();
    },
    onError: (err: Error) => mostrarToast({ mensaje: err.message, variante: 'error' }),
  });

  const estudio = estudios.find((s) => s.id === estudioId);

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
  const definicionPlan = obtenerDefinicionPlan(estudio.plan);
  const reservasEstudio = reservas.filter((r) => r.studioId === estudio.id);
  const hoySrt = obtenerFechaLocalISO(new Date());
  const mesPrefijo = hoySrt.substring(0, 7);
  const anoPrefijo = hoySrt.substring(0, 4);
  const completadas = reservasEstudio.filter((b) => b.status === 'completed');
  const totalHoy = completadas
    .filter((b) => b.date === hoySrt)
    .reduce((acc, b) => acc + (b.totalPrice ?? 0), 0);
  const totalMes = completadas
    .filter((b) => b.date.startsWith(mesPrefijo))
    .reduce((acc, b) => acc + (b.totalPrice ?? 0), 0);
  const totalAno = completadas
    .filter((b) => b.date.startsWith(anoPrefijo))
    .reduce((acc, b) => acc + (b.totalPrice ?? 0), 0);

  const tarjetas = [
    {
      titulo: 'Ingresos Hoy',
      monto: totalHoy,
      icono: DollarSign,
      color: 'bg-green-100 text-green-700',
    },
    {
      titulo: 'Ingresos Mes',
      monto: totalMes,
      icono: PieChart,
      color: 'bg-blue-100 text-blue-700',
    },
    {
      titulo: 'Ingresos Año',
      monto: totalAno,
      icono: TrendingUp,
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
        <button
          onClick={cerrarSesion}
          aria-label="Cerrar sesión"
          className="p-3 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-400"
        >
          <LogOut />
        </button>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        <div className="no-imprimir flex bg-slate-200/50 p-1 rounded-2xl w-fit border border-slate-200 mx-auto md:mx-0">
          <button
            onClick={() => navegar(`/estudio/${estudio.id}/agenda`)}
            className="px-4 md:px-6 py-3 rounded-xl text-[10px] md:text-xs font-black transition-all flex items-center gap-2 text-slate-500 hover:text-slate-800"
          >
            <Calendar className="w-4 h-4" /> Agenda & Personal
          </button>
          <button
            onClick={() => navegar(`/estudio/${estudio.id}/admin`)}
            className="px-4 md:px-6 py-3 rounded-xl text-[10px] md:text-xs font-black transition-all flex items-center gap-2 bg-white shadow-sm text-slate-900"
          >
            <Wallet className="w-4 h-4" /> Administración
          </button>
        </div>

        <div className="no-imprimir flex flex-wrap gap-1 bg-slate-100 p-1 rounded-2xl w-full sm:w-fit border border-slate-200">
          <button
            onClick={() => setSeccion('ingresos')}
            className={`flex-1 sm:flex-none px-3 sm:px-4 md:px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-black transition-all flex items-center justify-center gap-1.5 ${seccion === 'ingresos' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <TrendingUp className="w-4 h-4 shrink-0" /> Ingresos
          </button>
          <button
            onClick={() => setSeccion('clientes')}
            className={`flex-1 sm:flex-none px-3 sm:px-4 md:px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-black transition-all flex items-center justify-center gap-1.5 ${seccion === 'clientes' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Users className="w-4 h-4 shrink-0" /> Clientes
          </button>
          <button
            onClick={() => setSeccion('salon')}
            className={`flex-1 sm:flex-none px-3 sm:px-4 md:px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-black transition-all flex items-center justify-center gap-1.5 ${seccion === 'salon' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Palette className="w-4 h-4 shrink-0" /> Mi salón
          </button>
          <button
            onClick={() => setSeccion('fidelidad')}
            className={`flex-1 sm:flex-none px-3 sm:px-4 md:px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-black transition-all flex items-center justify-center gap-1.5 ${seccion === 'fidelidad' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Gift className="w-4 h-4 shrink-0" /> Fidelidad
          </button>
          <button
            onClick={() => setSeccion('suscripcion')}
            className={`flex-1 sm:flex-none px-3 sm:px-4 md:px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-black transition-all flex items-center justify-center gap-1.5 ${seccion === 'suscripcion' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <CreditCard className="w-4 h-4 shrink-0" /> Suscripción
          </button>
        </div>

        {seccion === 'ingresos' && (
          <>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter">
              Estadísticas de Ingresos
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
            <h2 className="text-3xl font-black italic uppercase tracking-tighter">Fidelidad</h2>
            <ConfigFidelidad estudioId={estudio.id} plan={estudio.plan} />
          </>
        )}

        {seccion === 'salon' && (
          <>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter">Mi Salón</h2>
            <PerfilSalon estudioId={estudio.id} />
            <FormularioPinCancelacion
              estudioId={estudio.id}
              pinConfigurado={estudio.pinCancelacionConfigurado ?? false}
            />
          </>
        )}

        {seccion === 'suscripcion' && (
          <>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter">Suscripción</h2>

            <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm p-8 max-w-lg">
              <div className="flex items-center gap-4 mb-6">
                <div className="bg-pink-100 p-3 rounded-2xl text-pink-600">
                  <CreditCard className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-xs font-black text-slate-400 uppercase tracking-widest">
                    Plan activo
                  </p>
                  <p className="text-xl font-black text-slate-900">
                    {definicionPlan.nombre}{' '}
                    <span className="text-pink-600">· vence el {estudio.paidUntil}</span>
                  </p>
                </div>
              </div>

              <div className="mb-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-widest text-slate-500">
                  Límites del plan
                </p>
                <ul className="mt-3 space-y-2 text-sm font-medium text-slate-600">
                  <li>
                    Servicios activos:{' '}
                    <span className="font-black text-slate-900">
                      {definicionPlan.maxServicios === null
                        ? 'Ilimitados'
                        : `Hasta ${definicionPlan.maxServicios}`}
                    </span>
                  </li>
                  <li>
                    Fidelidad:{' '}
                    <span className="font-black text-slate-900">
                      {definicionPlan.fidelidad ? 'Incluida' : 'Solo disponible en Pro'}
                    </span>
                  </li>
                </ul>
              </div>

              {estudio.cancelacionSolicitada ? (
                <div className="space-y-4">
                  <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
                    <p className="text-sm font-black text-amber-800 uppercase tracking-wide mb-1">
                      Solicitud de cancelación pendiente
                    </p>
                    {estudio.fechaSolicitudCancelacion && (
                      <p className="text-xs text-amber-700">
                        Enviada el{' '}
                        {new Date(estudio.fechaSolicitudCancelacion).toLocaleDateString('es-MX', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </p>
                    )}
                    {estudio.motivoCancelacion && (
                      <p className="text-xs text-amber-700 mt-1">
                        Motivo: {estudio.motivoCancelacion}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => mutRetirar.mutate(estudio.id)}
                    disabled={mutRetirar.isPending}
                    aria-busy={mutRetirar.isPending}
                    className="w-full py-3 bg-slate-100 text-slate-700 font-black rounded-2xl uppercase text-xs hover:bg-slate-200 transition-colors disabled:opacity-60"
                  >
                    {mutRetirar.isPending ? 'Procesando...' : 'Retirar solicitud de cancelación'}
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Si deseas dar de baja tu salón, puedes enviar una solicitud de cancelación.
                    Permanecerá activo hasta la fecha de vencimiento.
                  </p>
                  <button
                    onClick={() => setMostrarModalCancelacion(true)}
                    className="w-full py-3 bg-red-50 text-red-700 border border-red-200 font-black rounded-2xl uppercase text-xs hover:bg-red-100 transition-colors"
                  >
                    Solicitar cancelación de suscripción
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <ModalSolicitudCancelacion
        abierto={mostrarModalCancelacion}
        estudioId={estudio.id}
        fechaVencimiento={estudio.paidUntil}
        alCerrar={() => setMostrarModalCancelacion(false)}
        alConfirmar={() => {
          setMostrarModalCancelacion(false);
          recargar();
        }}
      />
    </div>
  );
}
