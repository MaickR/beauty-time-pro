import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ShieldCheck, LogOut, Store, PlusCircle, PieChart, Users } from 'lucide-react';
import { usarContextoApp } from '../../contextos/ContextoApp';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';
import { usarToast } from '../../componentes/ui/ProveedorToast';
import { usarFormularioEstudio, confirmarPago } from './hooks/usarFormularioEstudio';
import { DirectorioEstudios } from './componentes/DirectorioEstudios';
import { SolicitudesPendientes } from './componentes/SolicitudesPendientes';
import { SolicitudesCancelacion } from './componentes/SolicitudesCancelacion';
import { HistorialSalones } from './componentes/HistorialSalones';
import { VisorReservas } from './componentes/VisorReservas';
import { ModalPago } from './componentes/ModalPago';
import { ModalEstudio } from './componentes/ModalEstudio';
import { GestionAdmins } from './componentes/GestionAdmins';
import { MetricasGlobales } from './componentes/MetricasGlobales';
import { PanelFinanciero } from './componentes/PanelFinanciero';
import type { Estudio } from '../../tipos';

type TabMaestro = 'directorio' | 'estado-cuenta' | 'administradores';

export function PaginaMaestro() {
  usarTituloPagina('Panel Maestro');
  const ubicacion = useLocation();
  const { estudios, reservas, pagos, recargar } = usarContextoApp();
  const { cerrarSesion, usuario } = usarTiendaAuth();
  const { mostrarToast } = usarToast();
  const [verReservasEstudio, setVerReservasEstudio] = useState<Estudio | null>(null);
  const [pagoEstudio, setPagoEstudio] = useState<Estudio | null>(null);
  const [tabActiva, setTabActiva] = useState<TabMaestro>('directorio');
  const hook = usarFormularioEstudio();

  const puedeVerMetricas = usuario?.esMaestroTotal || usuario?.permisos.verMetricas;
  const puedeAprobarSalones = usuario?.esMaestroTotal || usuario?.permisos.aprobarSalones;
  const puedeGestionarPagos = usuario?.esMaestroTotal || usuario?.permisos.gestionarPagos;
  const puedeCrearAdmins = usuario?.esMaestroTotal || usuario?.permisos.crearAdmins;
  const puedeSuspenderSalones = usuario?.esMaestroTotal || usuario?.permisos.suspenderSalones;

  const tabsDisponibles: TabMaestro[] = [
    ...(puedeVerMetricas || puedeAprobarSalones || puedeSuspenderSalones
      ? ['directorio' as const]
      : []),
    ...(puedeGestionarPagos ? ['estado-cuenta' as const] : []),
    ...(puedeCrearAdmins ? ['administradores' as const] : []),
  ];

  useEffect(() => {
    if (ubicacion.pathname === '/maestro/finanzas' && puedeGestionarPagos) {
      setTabActiva('estado-cuenta');
      return;
    }

    if (!tabsDisponibles.includes(tabActiva) && tabsDisponibles.length > 0) {
      setTabActiva(tabsDisponibles[0]);
    }
  }, [puedeGestionarPagos, tabActiva, tabsDisponibles, ubicacion.pathname]);

  const manejarConfirmarPago = async (monto: number, moneda: 'MXN' | 'COP') => {
    if (!pagoEstudio) return;
    await confirmarPago(
      pagoEstudio,
      monto,
      moneda,
      (msg) => {
        mostrarToast(msg);
        setPagoEstudio(null);
      },
      (msg) => mostrarToast(msg),
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      <header className="no-imprimir bg-white border-b border-slate-200 px-8 py-6 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="bg-slate-950 p-2 rounded-xl">
            <ShieldCheck className="text-pink-500" />
          </div>
          <div>
            <h2 className="text-xl font-black italic text-slate-900 uppercase">Mike Master</h2>
            <p className="text-[10px] font-black text-pink-600 uppercase tracking-widest">
              Administrador Global
            </p>
          </div>
        </div>
        <button
          onClick={cerrarSesion}
          aria-label="Cerrar sesión"
          className="p-3 bg-slate-100 rounded-full hover:bg-red-50 hover:text-red-500 transition-all"
        >
          <LogOut />
        </button>
      </header>

      <main className="max-w-7xl mx-auto p-8">
        {tabsDisponibles.length > 0 && (
          <nav className="no-imprimir flex bg-slate-200/50 p-1 rounded-2xl w-fit mb-8 border border-slate-200 flex-wrap gap-1">
            {tabsDisponibles.includes('directorio') && (
              <button
                onClick={() => setTabActiva('directorio')}
                className={`px-6 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${tabActiva === 'directorio' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <Store className="w-4 h-4" /> Directorio de Red
              </button>
            )}
            {tabsDisponibles.includes('estado-cuenta') && (
              <button
                onClick={() => setTabActiva('estado-cuenta')}
                className={`px-6 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${tabActiva === 'estado-cuenta' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <PieChart className="w-4 h-4" /> Estado de Cuenta
              </button>
            )}
            {tabsDisponibles.includes('administradores') && (
              <button
                onClick={() => setTabActiva('administradores')}
                className={`px-6 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${tabActiva === 'administradores' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <Users className="w-4 h-4" /> Administradores
              </button>
            )}
          </nav>
        )}

        {tabsDisponibles.length === 0 && (
          <div className="rounded-3xl border border-slate-200 bg-white px-6 py-8 text-center">
            <h1 className="text-2xl font-black text-slate-900">No tienes secciones asignadas</h1>
            <p className="mt-2 text-sm font-medium text-slate-500">
              Contacta al administrador principal.
            </p>
          </div>
        )}

        {tabActiva === 'directorio' && tabsDisponibles.includes('directorio') && (
          <>
            {puedeVerMetricas && <MetricasGlobales />}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6 mb-8">
              <div>
                <h1 className="text-4xl font-black italic uppercase tracking-tighter">
                  Directorio de Red
                </h1>
                <p className="text-slate-500 font-medium">
                  Control total de studios, personal, servicios y citas
                </p>
              </div>
              {puedeSuspenderSalones && (
                <button
                  onClick={hook.abrirModalAlta}
                  className="no-imprimir bg-pink-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl flex items-center gap-2 hover:bg-pink-700 transition-all"
                >
                  <PlusCircle /> Registrar nuevo salón
                </button>
              )}
            </div>

            <div className="space-y-12">
              {puedeAprobarSalones && <SolicitudesPendientes />}
              {puedeGestionarPagos && <SolicitudesCancelacion />}
              {puedeSuspenderSalones && <HistorialSalones />}

              {puedeSuspenderSalones && (
                <section aria-labelledby="titulo-directorio">
                  <h2 id="titulo-directorio" className="text-2xl font-black text-slate-900 mb-5">
                    Directorio legacy
                  </h2>
                  <DirectorioEstudios
                    estudios={estudios}
                    reservas={reservas}
                    onEditar={hook.abrirModalEdicion}
                    onVerReservas={setVerReservasEstudio}
                    onAbrirPago={setPagoEstudio}
                  />
                </section>
              )}
            </div>
          </>
        )}

        {tabActiva === 'estado-cuenta' && tabsDisponibles.includes('estado-cuenta') && (
          <>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter mb-8">
              Estado de Cuenta
            </h1>
            <PanelFinanciero estudios={estudios} pagos={pagos} onAbrirPago={setPagoEstudio} />
          </>
        )}

        {tabActiva === 'administradores' && tabsDisponibles.includes('administradores') && (
          <GestionAdmins />
        )}
      </main>

      {verReservasEstudio && (
        <VisorReservas
          estudio={verReservasEstudio}
          reservas={reservas.filter((r) => r.studioId === verReservasEstudio.id)}
          onCerrar={() => setVerReservasEstudio(null)}
        />
      )}

      {pagoEstudio && (
        <ModalPago
          estudio={pagoEstudio}
          onCerrar={() => setPagoEstudio(null)}
          onConfirmar={manejarConfirmarPago}
        />
      )}

      {hook.modoModal && puedeSuspenderSalones && (
        <ModalEstudio
          modo={hook.modoModal}
          formulario={hook.formulario}
          setFormulario={hook.setFormulario}
          catalogoProps={{
            alternarServicio: hook.alternarServicio,
            actualizarCampoServicio: hook.actualizarCampoServicio,
            agregarServicioPersonalizado: hook.agregarServicioPersonalizado,
            entradaServicioPersonalizado: hook.entradaServicioPersonalizado,
            setEntradaServicioPersonalizado: hook.setEntradaServicioPersonalizado,
          }}
          onAgregarPersonal={hook.agregarPersonal}
          onEnviar={(e) =>
            hook.enviarFormulario(
              e,
              () => {
                hook.cerrarModal();
                recargar();
              },
              mostrarToast,
            )
          }
          onCerrar={hook.cerrarModal}
        />
      )}
    </div>
  );
}
