import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Store, LogOut, Key, Copy, ChevronLeft, ChevronRight, Wallet, CheckCircle2, AlertTriangle, Calendar } from 'lucide-react';
import { usarContextoApp } from '../../contextos/ContextoApp';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';
import { usarToast } from '../../componentes/ui/ProveedorToast';
import { obtenerFechaLocalISO, obtenerEstadoSuscripcion } from '../../utils/formato';
import { AgendaDiaria } from './componentes/AgendaDiaria';
import { PanelPersonal } from './componentes/PanelPersonal';
import { GestorFestivos } from './componentes/GestorFestivos';
import { ProximasReservas } from './componentes/ProximasReservas';
import { Spinner } from '../../componentes/ui/Spinner';
import type { Moneda } from '../../tipos';

export function PaginaAgenda() {
  usarTituloPagina('Agenda');
  const { estudioId } = useParams<{ estudioId: string }>();
  const navegar = useNavigate();
  const { estudios, reservas, cargando } = usarContextoApp();
  const { cerrarSesion } = usarTiendaAuth();
  const { mostrarToast } = usarToast();
  const [fechaVista, setFechaVista] = useState(new Date());

  const estudio = estudios.find((s) => s.id === estudioId);

  if (cargando) return <div className="h-screen bg-slate-50 flex items-center justify-center"><Spinner tamaño="lg" /></div>;
  if (!estudio) return <div className="h-screen bg-slate-50 flex items-center justify-center"><p className="text-slate-400 font-bold">Studio no encontrado.</p></div>;

  const moneda: Moneda = estudio.country === 'Colombia' ? 'COP' : 'MXN';
  const reservasEstudio = reservas.filter((r) => r.studioId === estudio.id);
  const subStatus = obtenerEstadoSuscripcion(estudio);
  const subPrecio = moneda === 'COP' ? '$200,000 COP' : '$1,000 MXN';

  const cambiarMes = (offset: number) => {
    setFechaVista((prev) => new Date(prev.getFullYear(), prev.getMonth() + offset, 1));
  };
  const primerDia = new Date(fechaVista.getFullYear(), fechaVista.getMonth(), 1).getDay();
  const diasEnMes = new Date(fechaVista.getFullYear(), fechaVista.getMonth() + 1, 0).getDate();
  const diasCalendario = Array.from({ length: 42 }, (_, i) => { const d = i - primerDia + 1; return d > 0 && d <= diasEnMes ? d : null; });
  const fechaSelStr = obtenerFechaLocalISO(fechaVista);

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-20">
      <header className="bg-white p-6 md:p-8 border-b border-slate-200 flex justify-between items-center sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-pink-600 p-3 rounded-2xl text-white"><Store /></div>
          <div>
            <h1 className="text-xl md:text-3xl font-black italic uppercase leading-none">{estudio.name}</h1>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-1">Portal Administrativo</p>
          </div>
        </div>
        <button onClick={cerrarSesion} aria-label="Cerrar sesión" className="p-3 bg-slate-100 rounded-full hover:bg-slate-200 text-slate-400"><LogOut /></button>
      </header>

      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        <div className="flex bg-slate-200/50 p-1 rounded-2xl w-fit border border-slate-200 mx-auto md:mx-0">
          <button onClick={() => navegar(`/estudio/${estudio.id}/agenda`)} className="px-4 md:px-6 py-3 rounded-xl text-[10px] md:text-xs font-black transition-all flex items-center gap-2 bg-white shadow-sm text-slate-900">
            <Calendar className="w-4 h-4" /> Agenda & Personal
          </button>
          <button onClick={() => navegar(`/estudio/${estudio.id}/admin`)} className="px-4 md:px-6 py-3 rounded-xl text-[10px] md:text-xs font-black transition-all flex items-center gap-2 text-slate-500 hover:text-slate-800">
            <Wallet className="w-4 h-4" /> Administración
          </button>
        </div>

        {subStatus?.status === 'ACTIVE' && (
          <div className="bg-green-50 rounded-2xl p-4 text-green-800 text-xs flex items-center gap-2 border border-green-200">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <span><span className="font-black uppercase">Suscripción Activa.</span> Día de corte: {subStatus.cutDay} de cada mes.</span>
          </div>
        )}
        {(subStatus?.status === 'WARNING' || subStatus?.status === 'OVERDUE') && (
          <div className={`border-2 p-6 rounded-[2rem] flex items-start gap-6 ${subStatus.status === 'OVERDUE' ? 'bg-red-50 border-red-400' : 'bg-yellow-50 border-yellow-400'}`}>
            <div className={`p-4 rounded-full text-white shrink-0 ${subStatus.status === 'OVERDUE' ? 'bg-red-500' : 'bg-yellow-400'}`}><AlertTriangle className="w-8 h-8" /></div>
            <div>
              <h4 className={`font-black uppercase text-xl mb-1 ${subStatus.status === 'OVERDUE' ? 'text-red-800' : 'text-yellow-800'}`}>{subStatus.status === 'OVERDUE' ? 'Suscripción Vencida' : 'Aviso de Renovación'}</h4>
              <p className={`text-sm font-medium ${subStatus.status === 'OVERDUE' ? 'text-red-900' : 'text-yellow-900'}`}>Tu membresía {subStatus.status === 'OVERDUE' ? 'venció el' : 'vence el'} <strong>{subStatus.dueDateStr}</strong>. Deposita <strong>{subPrecio}</strong> a la cuenta asignada.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-8">
            <div className="bg-slate-900 rounded-[2.5rem] p-6 text-white shadow-xl flex items-center justify-between gap-4 border border-slate-800">
              <div><h2 className="text-sm font-black italic uppercase flex items-center gap-2"><Key className="text-pink-500 w-4 h-4" /> Clave Clientes</h2></div>
              <div className="bg-slate-800 px-4 py-2 rounded-xl font-mono font-black text-sm text-purple-400 border border-slate-700 flex items-center gap-3">
                {estudio.clientKey}
                <button onClick={() => { navigator.clipboard.writeText(estudio.clientKey).then(() => mostrarToast('Clave copiada al portapapeles')); }} aria-label="Copiar clave de clientes" className="text-slate-400 hover:text-white"><Copy className="w-4 h-4" /></button>
              </div>
            </div>

            <div className="bg-white rounded-[3rem] p-6 md:p-8 border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <button onClick={() => cambiarMes(-1)} aria-label="Mes anterior" className="p-2 hover:bg-slate-100 rounded-full"><ChevronLeft className="w-5 h-5" /></button>
                <h3 className="text-xl font-black italic uppercase tracking-tighter">{fechaVista.toLocaleString('es-ES', { month: 'long', year: 'numeric' })}</h3>
                <button onClick={() => cambiarMes(1)} aria-label="Mes siguiente" className="p-2 hover:bg-slate-100 rounded-full"><ChevronRight className="w-5 h-5" /></button>
              </div>
              <div className="grid grid-cols-7 mb-4 text-center text-[10px] font-black text-slate-400 uppercase">
                {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => <div key={i}>{d}</div>)}
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
                      <button onClick={() => setFechaVista(dateObj)} className={`w-full h-full rounded-2xl font-black text-xs md:text-sm transition-all relative flex flex-col items-center justify-center ${seleccionado ? 'bg-slate-900 text-white shadow-lg scale-110 z-10' : esFestivo ? 'bg-red-50 text-red-400 border border-red-100' : 'text-slate-600 hover:bg-slate-100'}`} aria-label={dateStr} aria-pressed={seleccionado}>
                        {dia}
                        {tieneCitas && !seleccionado && <span className={`absolute bottom-1 w-1.5 h-1.5 rounded-full ${esFestivo ? 'bg-red-400' : 'bg-pink-500'}`} />}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <GestorFestivos estudio={estudio} />
            <PanelPersonal estudio={estudio} reservas={reservasEstudio} fechaVista={fechaVista} />
          </div>

          <div className="lg:col-span-7 space-y-8">
            <AgendaDiaria estudio={estudio} reservas={reservasEstudio} fechaVista={fechaVista} />
            <ProximasReservas reservas={reservasEstudio.filter((b) => b.date >= obtenerFechaLocalISO(new Date()))} moneda={moneda} />
          </div>
        </div>
      </main>
    </div>
  );
}
