import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import {
  ShieldCheck,
  LogOut,
  Store,
  PlusCircle,
  PieChart,
  Users,
  Database,
  ClipboardList,
} from 'lucide-react';
import { usarContextoApp } from '../../contextos/ContextoApp';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';
import { usarToast } from '../../componentes/ui/ProveedorToast';
import { usarFormularioEstudio, confirmarPago } from './hooks/usarFormularioEstudio';
import { DirectorioAcceso } from './componentes/DirectorioAcceso';
import { SolicitudesCancelacion } from './componentes/SolicitudesCancelacion';
import { ModalPago } from './componentes/ModalPago';
import { ModalEstudio } from './componentes/ModalEstudio';
import { GestionAdmins } from './componentes/GestionAdmins';
import { MetricasGlobales } from './componentes/MetricasGlobales';
import { PanelFinanciero } from './componentes/PanelFinanciero';
import { BaseClientes } from './componentes/BaseClientes';
import { PreregistrosAdmin } from './componentes/PreregistrosAdmin';
import { PanelPreciosPlanes } from './componentes/PanelPreciosPlanes';
import type { Estudio } from '../../tipos';

type TabMaestro =
  | 'directorio'
  | 'estado-cuenta'
  | 'administradores'
  | 'preregistros'
  | 'base-datos';

export function PaginaMaestro() {
  const ubicacion = useLocation();
  const { estudios, recargar } = usarContextoApp();
  const { cerrarSesion, usuario } = usarTiendaAuth();
  const { mostrarToast } = usarToast();
  const clienteConsulta = useQueryClient();
  const [pagoEstudio, setPagoEstudio] = useState<Estudio | null>(null);
  const [tabActiva, setTabActiva] = useState<TabMaestro>('directorio');
  const hook = usarFormularioEstudio();

  const esMaestro = usuario?.rol === 'maestro';
  const esSupervisor = usuario?.rol === 'supervisor';
  const ps = usuario?.permisosSupervisor;
  const rutaBasePanel = esSupervisor ? '/supervisor' : '/maestro';
  const tituloDocumento = esSupervisor ? 'Panel Supervisor' : 'Panel Maestro';
  const tituloCabecera = esSupervisor ? 'Panel Supervisor' : 'Mike Master';
  const subtituloCabecera = esSupervisor ? 'Acceso por permisos asignados' : 'Administrador Global';
  const tituloSeccionDirectorio = esSupervisor ? 'Panel Supervisor' : 'Panel Administrativo';
  const descripcionSeccionDirectorio = esSupervisor
    ? 'Gestión operativa según los permisos asignados por el administrador maestro'
    : 'Control total de salones, personal, servicios y citas';

  usarTituloPagina(tituloDocumento);

  const puedeVerMetricas =
    usuario?.esMaestroTotal ||
    usuario?.permisos.verMetricas ||
    (esSupervisor && (ps?.verTotalSalones || ps?.verReservas || ps?.verVentas));
  const puedeAprobarSalones =
    usuario?.esMaestroTotal ||
    usuario?.permisos.aprobarSalones ||
    (esSupervisor && (ps?.verControlSalones || ps?.activarSalones || ps?.verPreregistros));
  const puedeGestionarPagos =
    usuario?.esMaestroTotal ||
    usuario?.permisos.gestionarPagos ||
    (esSupervisor && (ps?.verControlCobros || ps?.accionRecordatorio || ps?.accionRegistroPago));
  const puedeCrearAdmins = esMaestro && (usuario?.esMaestroTotal || usuario?.permisos.crearAdmins);
  const puedeSuspenderSalones =
    usuario?.esMaestroTotal ||
    usuario?.permisos.suspenderSalones ||
    (esSupervisor && ps?.accionSuspension);
  const puedeVerDirectorio =
    puedeAprobarSalones ||
    puedeSuspenderSalones ||
    (esSupervisor && (ps?.verDirectorio || ps?.editarDirectorio));
  const puedeVerPreregistros =
    usuario?.esMaestroTotal ||
    usuario?.permisos.aprobarSalones ||
    (esSupervisor && ps?.verPreregistros);

  const tabsDisponibles: TabMaestro[] = [
    ...(puedeVerDirectorio ? ['directorio' as const] : []),
    ...(puedeGestionarPagos ? ['estado-cuenta' as const] : []),
    ...(puedeCrearAdmins ? ['administradores' as const] : []),
    ...(puedeVerPreregistros ? ['preregistros' as const] : []),
    ...(puedeVerMetricas ? ['base-datos' as const] : []),
  ];

  useEffect(() => {
    if (ubicacion.pathname === `${rutaBasePanel}/finanzas` && puedeGestionarPagos) {
      setTabActiva('estado-cuenta');
      return;
    }

    if (!tabsDisponibles.includes(tabActiva) && tabsDisponibles.length > 0) {
      setTabActiva(tabsDisponibles[0]);
    }
  }, [puedeGestionarPagos, rutaBasePanel, tabActiva, tabsDisponibles, ubicacion.pathname]);

  const manejarConfirmarPago = async (monto: number, moneda: 'MXN' | 'COP') => {
    if (!pagoEstudio) return;
    await confirmarPago(
      pagoEstudio,
      monto,
      moneda,
      (msg) => {
        recargar();
        void clienteConsulta.invalidateQueries({ queryKey: ['admin', 'metricas'] });
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
            <h2 className="text-xl font-black italic text-slate-900 uppercase">{tituloCabecera}</h2>
            <p className="text-[10px] font-black text-pink-600 uppercase tracking-widest">
              {subtituloCabecera}
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
          <nav className="no-imprimir flex bg-slate-100 p-1 rounded-2xl mb-8 border border-slate-200 flex-wrap gap-1 justify-center md:justify-start">
            {tabsDisponibles.includes('directorio') && (
              <button
                onClick={() => setTabActiva('directorio')}
                className={`px-6 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${tabActiva === 'directorio' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <Store className="w-4 h-4" /> {tituloSeccionDirectorio}
              </button>
            )}
            {tabsDisponibles.includes('estado-cuenta') && (
              <button
                onClick={() => setTabActiva('estado-cuenta')}
                className={`px-6 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${tabActiva === 'estado-cuenta' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <PieChart className="w-4 h-4" /> Control de cobros
              </button>
            )}
            {tabsDisponibles.includes('administradores') && (
              <button
                onClick={() => setTabActiva('administradores')}
                className={`px-6 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${tabActiva === 'administradores' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <Users className="w-4 h-4" /> Colaboradores
              </button>
            )}
            {tabsDisponibles.includes('preregistros') && (
              <button
                onClick={() => setTabActiva('preregistros')}
                className={`px-6 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${tabActiva === 'preregistros' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <ClipboardList className="w-4 h-4" /> Pre-registros
              </button>
            )}
            {tabsDisponibles.includes('base-datos') && (
              <button
                onClick={() => setTabActiva('base-datos')}
                className={`px-6 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 ${tabActiva === 'base-datos' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
              >
                <Database className="w-4 h-4" /> Base de Datos
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
            {puedeVerMetricas && (
              <>
                <h2 className="text-2xl font-black text-slate-900 mb-5">Métricas</h2>
                <MetricasGlobales />
              </>
            )}
            <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6 mb-8">
              <div>
                <h1 className="text-4xl font-black italic uppercase tracking-tighter">
                  {tituloSeccionDirectorio}
                </h1>
                <p className="text-slate-500 font-medium">{descripcionSeccionDirectorio}</p>
              </div>
              {puedeSuspenderSalones && (
                <button
                  onClick={hook.abrirModalAlta}
                  className="no-imprimir bg-pink-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl flex items-center justify-center gap-2 hover:bg-pink-700 transition-all"
                >
                  <PlusCircle /> Registrar nuevo salón
                </button>
              )}
            </div>

            <div className="space-y-12">
              {puedeGestionarPagos && <SolicitudesCancelacion />}

              {puedeSuspenderSalones && <DirectorioAcceso />}

              {esMaestro && puedeGestionarPagos && <PanelPreciosPlanes onActualizado={recargar} />}
            </div>
          </>
        )}

        {tabActiva === 'estado-cuenta' && tabsDisponibles.includes('estado-cuenta') && (
          <>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter mb-8">
              Control de cobros
            </h1>
            <PanelFinanciero
              estudios={estudios}
              onAbrirPago={setPagoEstudio}
              onRecargar={recargar}
            />
          </>
        )}

        {tabActiva === 'administradores' && tabsDisponibles.includes('administradores') && (
          <GestionAdmins />
        )}

        {tabActiva === 'preregistros' && tabsDisponibles.includes('preregistros') && (
          <PreregistrosAdmin />
        )}

        {tabActiva === 'base-datos' && tabsDisponibles.includes('base-datos') && <BaseClientes />}
      </main>

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
          confirmacionAlta={hook.confirmacionAlta}
          catalogoProps={{
            alternarServicio: hook.alternarServicio,
            actualizarCampoServicio: hook.actualizarCampoServicio,
            agregarServicioPersonalizado: hook.agregarServicioPersonalizado,
            entradaServicioPersonalizado: hook.entradaServicioPersonalizado,
            setEntradaServicioPersonalizado: hook.setEntradaServicioPersonalizado,
          }}
          onAgregarPersonal={hook.agregarPersonal}
          onRegenerarContrasenaDueno={hook.regenerarContrasenaDueno}
          onDescartarBorrador={hook.descartarBorrador}
          onEnviar={(e) => hook.enviarFormulario(e, recargar, mostrarToast, mostrarToast)}
          onCerrar={hook.cerrarModal}
        />
      )}
    </div>
  );
}
