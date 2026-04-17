import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { Home, User, LogOut, ChevronDown, Star } from 'lucide-react';
import { usarTiendaAuth } from '../../tienda/tiendaAuth';
import { obtenerMiPerfil } from '../../servicios/servicioClienteApp';
import { usarTemaSalon } from '../../hooks/usarTemaSalon';
import { usarNotificacionesPush } from '../../hooks/usarNotificacionesPush';
import { BannerNotificacionesPush } from '../ui/BannerNotificacionesPush';
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

export function NavegacionCliente() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const { usuario, cerrarSesion } = usarTiendaAuth();
  const navegar = useNavigate();
  const [activando, setActivando] = useState(false);
  const consultaPerfil = useQuery({
    queryKey: ['mi-perfil'],
    queryFn: obtenerMiPerfil,
    staleTime: 1000 * 60 * 2,
    enabled: usuario?.rol === 'cliente',
  });
  const push = usarNotificacionesPush();

  const nombre = consultaPerfil.data?.nombre ?? usuario?.nombre ?? '';
  const apellido = consultaPerfil.data?.apellido ?? '';
  const avatarUrl = consultaPerfil.data?.avatarUrl ?? null;
  const inics = nombre ? inicialesDesdeNombre(nombre) : 'U';
  const etiquetaNombre = [nombre, apellido].filter(Boolean).join(' ') || 'Mi cuenta';
  const colorCliente = consultaPerfil.data?.id
    ? (localStorage.getItem(`color_cliente_${consultaPerfil.data.id}`) ?? '#F48FB1')
    : '#F48FB1';

  usarTemaSalon(colorCliente, { restaurarAlDesmontar: true });

  // Cerrar menú al clic exterior
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
      <BannerNotificacionesPush
        visible={push.bannerVisible}
        activando={activando}
        mensaje="Activa las notificaciones para recibir recordatorios de tus citas"
        onActivar={async () => {
          setActivando(true);
          try {
            await push.activar();
          } finally {
            setActivando(false);
          }
        }}
        onDescartar={push.descartar}
      />
      {/* Header desktop */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-50 hidden md:block">
        <div className="max-w-5xl mx-auto px-8 h-16 flex items-center justify-between">
          <Link to="/cliente/inicio" className="select-none">
            <MarcaAplicacion tamano="sm" />
          </Link>

          {/* Dropdown de usuario */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuAbierto((a) => !a)}
              aria-label="Abrir menú de usuario"
              aria-expanded={menuAbierto}
              aria-haspopup="true"
              className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-slate-50 transition-colors"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Foto de perfil"
                  className="w-8 h-8 rounded-full object-cover border border-pink-100"
                />
              ) : (
                <span className="w-8 h-8 rounded-full bg-pink-100 text-pink-700 font-black text-sm flex items-center justify-center select-none">
                  {inics}
                </span>
              )}
              <span className="font-bold text-slate-800 text-sm max-w-30 truncate">
                {etiquetaNombre}
              </span>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${menuAbierto ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>

            {menuAbierto && (
              <div
                role="menu"
                aria-label="Opciones de usuario"
                className="absolute right-0 top-full mt-2 w-48 bg-white border border-slate-100 rounded-2xl shadow-xl overflow-hidden z-50"
              >
                <Link
                  to="/cliente/perfil"
                  role="menuitem"
                  onClick={() => setMenuAbierto(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 font-medium transition-colors"
                >
                  <User className="w-4 h-4 text-slate-400" aria-hidden="true" /> Mi perfil
                </Link>
                <Link
                  to="/cliente/perfil?vista=reservas"
                  role="menuitem"
                  onClick={() => setMenuAbierto(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 font-medium transition-colors"
                >
                  <Star className="w-4 h-4 text-slate-400" aria-hidden="true" /> Mis reservas
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
      </header>

      {/* Header móvil */}
      <header className="bg-white border-b border-slate-100 sticky top-0 z-50 md:hidden">
        <div className="px-4 h-14 flex items-center justify-between">
          <Link to="/cliente/inicio">
            <MarcaAplicacion tamano="sm" />
          </Link>
          <Link to="/cliente/perfil" aria-label="Mi perfil">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt="Foto de perfil"
                className="w-8 h-8 rounded-full object-cover border border-pink-100"
              />
            ) : (
              <span className="w-8 h-8 rounded-full bg-pink-100 text-pink-700 font-black text-sm flex items-center justify-center">
                {inics}
              </span>
            )}
          </Link>
        </div>
      </header>

      {/* Barra de navegación inferior (móvil) */}
      <nav
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 z-40 md:hidden"
        aria-label="Navegación principal"
      >
        <div className="flex">
          <Link
            to="/cliente/inicio"
            className="flex-1 flex flex-col items-center gap-1 py-3 text-slate-400 hover:text-pink-600 transition-colors"
          >
            <Home className="w-5 h-5" aria-hidden="true" />
            <span className="text-[10px] font-bold">Inicio</span>
          </Link>
          <Link
            to="/cliente/perfil?vista=reservas"
            className="flex-1 flex flex-col items-center gap-1 py-3 text-slate-400 hover:text-pink-600 transition-colors"
          >
            <Star className="w-5 h-5" aria-hidden="true" />
            <span className="text-[10px] font-bold">Mis reservas</span>
          </Link>
          <Link
            to="/cliente/perfil"
            className="flex-1 flex flex-col items-center gap-1 py-3 text-slate-400 hover:text-pink-600 transition-colors"
          >
            <User className="w-5 h-5" aria-hidden="true" />
            <span className="text-[10px] font-bold">Perfil</span>
          </Link>
        </div>
      </nav>
    </>
  );
}
