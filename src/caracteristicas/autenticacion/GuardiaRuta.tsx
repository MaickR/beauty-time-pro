import { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { usarToast } from '../../componentes/ui/ProveedorToast';
import { obtenerRutaPorRol, type RolUsuario, usarTiendaAuth } from '../../tienda/tiendaAuth';

interface PropsGuardiaRuta {
  rolesPermitidos: RolUsuario[];
}

export function GuardiaRuta({ rolesPermitidos }: PropsGuardiaRuta) {
  const ubicacion = useLocation();
  const { mostrarToast } = usarToast();
  const { iniciando, rol, estudioActual, claveClienteActual } = usarTiendaAuth();
  const yaMostroToast = useRef(false);

  useEffect(() => {
    if (!iniciando && !rol && !yaMostroToast.current) {
      yaMostroToast.current = true;
      mostrarToast('Debes iniciar sesión para continuar');
    }
  }, [iniciando, mostrarToast, rol]);

  if (iniciando) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-pink-600" />
      </div>
    );
  }

  if (!rol) {
    return <Navigate to="/iniciar-sesion" replace state={{ desde: ubicacion.pathname }} />;
  }

  if (!rolesPermitidos.includes(rol)) {
    return <Navigate to={obtenerRutaPorRol(rol, estudioActual, claveClienteActual)} replace />;
  }

  return <Outlet />;
}