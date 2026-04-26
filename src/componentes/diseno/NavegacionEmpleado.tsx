import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { CalendarDays, User, LogOut, ChevronDown } from 'lucide-react';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';
import { obtenerMiPerfilEmpleado } from '../../servicios/servicioEmpleados';
import { PanelNotificaciones } from '../../caracteristicas/estudio/componentes/PanelNotificaciones';
import { usarNotificacionesEstudio } from '../../caracteristicas/estudio/hooks/usarNotificacionesEstudio';
import { MarcaAplicacion } from '../ui/MarcaAplicacion';

function inicialesDesdeNombre(nombre: string): string {
  return nombre
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();
}

export function NavegacionEmpleado() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { usuario, cerrarSesion } = usarTiendaAuth();
  const navegar = useNavigate();

  const consultaPerfil = useQuery({
    queryKey: ['mi-perfil-empleado'],
    queryFn: obtenerMiPerfilEmpleado,
    staleTime: 1000 * 60 * 5,
    enabled: usuario?.rol === 'empleado',
  });

  const nombre = consultaPerfil.data?.nombre ?? usuario?.nombre ?? '';
  const nombreSalon = consultaPerfil.data?.estudio.nombre ?? '';
  const estudioId = consultaPerfil.data?.estudio.id;
  const paisSalon = consultaPerfil.data?.estudio.pais ?? 'Mexico';
  const inics = nombre ? inicialesDesdeNombre(nombre) : 'E';
  const { notificaciones, marcarLeida } = usarNotificacionesEstudio(estudioId);

  useEffect(() => {
    function manejarClicExterior(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAbierto(false);
      }
    }
    if (menuAbierto) document.addEventListener('mousedown', manejarClicExterior);
    return () => document.removeEventListener('mousedown', manejarClicExterior);
  }, [menuAbierto]);

  const handleCerrarSesion = async () => {
    setMenuAbierto(false);
    await cerrarSesion();
    navegar('/iniciar-sesion');
  };

  return (
    <>
      {/* Header desktop */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-50 hidden md:block">
        <div className="max-w-5xl mx-auto px-8 h-16 flex items-center justify-between">
          <MarcaAplicacion tamano="sm" subtitulo={nombreSalon || undefined} />

          <div className="flex items-center gap-3">
            <PanelNotificaciones
              notificaciones={notificaciones}
              pais={paisSalon}
              onMarcarLeida={marcarLeida}
            />

            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setMenuAbierto((a) => !a)}
                aria-label="Abrir menú de empleado"
                aria-expanded={menuAbierto}
                aria-haspopup="true"
                className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <span className="flex h-8 w-8 select-none items-center justify-center rounded-full bg-rose-100 text-sm font-black text-rose-700">
                  {inics}
                </span>
                <span className="font-bold text-slate-800 text-sm max-w-30 truncate">
                  {nombre || 'Empleado'}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-400 transition-transform ${menuAbierto ? 'rotate-180' : ''}`}
                  aria-hidden="true"
                />
              </button>

              {menuAbierto && (
                <div
                  role="menu"
                  aria-label="Opciones de empleado"
                  className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden z-50"
                >
                  <Link
                    to="/empleado/perfil"
                    role="menuitem"
                    onClick={() => setMenuAbierto(false)}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 font-medium transition-colors"
                  >
                    <User className="w-4 h-4 text-slate-400" aria-hidden="true" /> Mi perfil
                  </Link>
                  <hr className="border-slate-100 mx-3" />
                  <button
                    role="menuitem"
                    onClick={handleCerrarSesion}
                    className="flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 font-medium w-full text-left transition-colors"
                  >
                    <LogOut className="w-4 h-4" aria-hidden="true" /> Cerrar sesión
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Header móvil */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-50 md:hidden">
        <div className="px-4 h-14 flex items-center justify-between">
          <MarcaAplicacion tamano="sm" subtitulo={nombreSalon || undefined} />
          <div className="flex items-center gap-2">
            <PanelNotificaciones
              notificaciones={notificaciones}
              pais={paisSalon}
              onMarcarLeida={marcarLeida}
            />
            <Link to="/empleado/perfil" aria-label="Mi perfil">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-100 text-sm font-black text-rose-700">
                {inics}
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Barra de navegación inferior (móvil) */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-40 md:hidden"
        aria-label="Navegación de empleado"
      >
        <div className="flex">
          <Link
            to="/empleado/agenda"
            className="flex flex-1 flex-col items-center gap-1 py-3 text-slate-400 transition-colors hover:text-rose-700"
          >
            <CalendarDays className="w-5 h-5" aria-hidden="true" />
            <span className="text-[10px] font-bold">Mi agenda</span>
          </Link>
          <Link
            to="/empleado/perfil"
            className="flex flex-1 flex-col items-center gap-1 py-3 text-slate-400 transition-colors hover:text-rose-700"
          >
            <User className="w-5 h-5" aria-hidden="true" />
            <span className="text-[10px] font-bold">Mi perfil</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
