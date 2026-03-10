import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, LogOut, Store, PlusCircle, PieChart } from 'lucide-react';
import { usarContextoApp } from '../../contextos/ContextoApp';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';
import { usarToast } from '../../componentes/ui/ProveedorToast';
import { usarFormularioEstudio, confirmarPago } from './hooks/usarFormularioEstudio';
import { DirectorioEstudios } from './componentes/DirectorioEstudios';
import { VisorReservas } from './componentes/VisorReservas';
import { ModalPago } from './componentes/ModalPago';
import { ModalEstudio } from './componentes/ModalEstudio';
import type { Estudio } from '../../tipos';

export function PaginaMaestro() {
  usarTituloPagina('Panel Maestro');
  const navegar = useNavigate();
  const { estudios, reservas, recargar } = usarContextoApp();
  const { cerrarSesion } = usarTiendaAuth();
  const { mostrarToast } = usarToast();
  const [verReservasEstudio, setVerReservasEstudio] = useState<Estudio | null>(null);
  const [pagoEstudio, setPagoEstudio] = useState<Estudio | null>(null);
  const hook = usarFormularioEstudio();

  const manejarConfirmarPago = async (monto: number, moneda: 'MXN' | 'COP') => {
    if (!pagoEstudio) return;
    await confirmarPago(
      pagoEstudio, monto, moneda,
      (msg) => { mostrarToast(msg); setPagoEstudio(null); },
      (msg) => mostrarToast(msg),
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20 font-sans">
      <header className="bg-white border-b border-slate-200 px-8 py-6 flex justify-between items-center sticky top-0 z-40">
        <div className="flex items-center gap-4">
          <div className="bg-slate-950 p-2 rounded-xl"><ShieldCheck className="text-pink-500" /></div>
          <div>
            <h2 className="text-xl font-black italic text-slate-900 uppercase">Mike Master</h2>
            <p className="text-[10px] font-black text-pink-600 uppercase tracking-widest">Administrador Global</p>
          </div>
        </div>
        <button onClick={cerrarSesion} aria-label="Cerrar sesión" className="p-3 bg-slate-100 rounded-full hover:bg-red-50 hover:text-red-500 transition-all"><LogOut /></button>
      </header>

      <main className="max-w-7xl mx-auto p-8">
        <div className="flex bg-slate-200/50 p-1 rounded-2xl w-fit mb-8 border border-slate-200">
          <button onClick={() => navegar('/maestro')} className="px-6 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 bg-white shadow-sm text-slate-900">
            <Store className="w-4 h-4" /> Directorio de Red
          </button>
          <button onClick={() => navegar('/maestro/finanzas')} className="px-6 py-3 rounded-xl text-xs font-black transition-all flex items-center gap-2 text-slate-500 hover:text-slate-800">
            <PieChart className="w-4 h-4" /> Estado de Cuenta
          </button>
        </div>

        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-6 mb-8">
          <div>
            <h1 className="text-4xl font-black italic uppercase tracking-tighter">Directorio de Red</h1>
            <p className="text-slate-500 font-medium">Control total de studios, personal, servicios y citas</p>
          </div>
          <button onClick={hook.abrirModalAlta} className="bg-pink-600 text-white px-8 py-4 rounded-2xl font-black shadow-xl flex items-center gap-2 hover:bg-pink-700 transition-all">
            <PlusCircle /> DAR DE ALTA STUDIO
          </button>
        </div>

        <DirectorioEstudios
          estudios={estudios}
          reservas={reservas}
          onEditar={hook.abrirModalEdicion}
          onVerReservas={setVerReservasEstudio}
          onAbrirPago={setPagoEstudio}
        />
      </main>

      {verReservasEstudio && (
        <VisorReservas
          estudio={verReservasEstudio}
          reservas={reservas.filter((r) => r.studioId === verReservasEstudio.id)}
          onCerrar={() => setVerReservasEstudio(null)}
        />
      )}

      {pagoEstudio && (
        <ModalPago estudio={pagoEstudio} onCerrar={() => setPagoEstudio(null)} onConfirmar={manejarConfirmarPago} />
      )}

      {hook.modoModal && (
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
          onEnviar={(e) => hook.enviarFormulario(e, () => { hook.cerrarModal(); recargar(); }, mostrarToast)}
          onCerrar={hook.cerrarModal}
        />
      )}
    </div>
  );
}
