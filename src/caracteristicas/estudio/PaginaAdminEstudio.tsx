import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
} from 'lucide-react';
import { usarContextoApp } from '../../contextos/ContextoApp';
import { usarTituloPagina } from '../../hooks/usarTituloPagina';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';
import { obtenerFechaLocalISO, formatearDinero } from '../../utils/formato';
import { CatalogoServicios } from './componentes/CatalogoServicios';
import { ConfigFidelidad } from './componentes/ConfigFidelidad';
import { DirectorioClientes } from './componentes/DirectorioClientes';
import { PerfilSalon } from './componentes/PerfilSalon';
import { Spinner } from '../../componentes/ui/Spinner';
import type { Moneda } from '../../tipos';

export function PaginaAdminEstudio() {
  usarTituloPagina('Administración');
  const { estudioId } = useParams<{ estudioId: string }>();
  const navegar = useNavigate();
  const { estudios, reservas, cargando } = usarContextoApp();
  const { cerrarSesion } = usarTiendaAuth();
  const [seccion, setSeccion] = useState<'ingresos' | 'clientes' | 'fidelidad' | 'salon'>(
    'ingresos',
  );

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

        <div className="no-imprimir flex bg-slate-100 p-1 rounded-2xl w-fit border border-slate-200">
          <button
            onClick={() => setSeccion('ingresos')}
            className={`px-4 md:px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-black transition-all flex items-center gap-2 ${seccion === 'ingresos' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <TrendingUp className="w-4 h-4" /> Ingresos
          </button>
          <button
            onClick={() => setSeccion('clientes')}
            className={`px-4 md:px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-black transition-all flex items-center gap-2 ${seccion === 'clientes' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Users className="w-4 h-4" /> Clientes
          </button>
          <button
            onClick={() => setSeccion('salon')}
            className={`px-4 md:px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-black transition-all flex items-center gap-2 ${seccion === 'salon' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Palette className="w-4 h-4" /> Mi salón
          </button>
          <button
            onClick={() => setSeccion('fidelidad')}
            className={`px-4 md:px-6 py-2.5 rounded-xl text-[10px] md:text-xs font-black transition-all flex items-center gap-2 ${seccion === 'fidelidad' ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-800'}`}
          >
            <Gift className="w-4 h-4" /> Fidelidad
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
            <ConfigFidelidad estudioId={estudio.id} />
          </>
        )}

        {seccion === 'salon' && (
          <>
            <h2 className="text-3xl font-black italic uppercase tracking-tighter">Mi Salón</h2>
            <PerfilSalon estudioId={estudio.id} />
          </>
        )}
      </main>
    </div>
  );
}
