import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { GuardiaRuta } from '../caracteristicas/autenticacion/GuardiaRuta';
import { obtenerRutaPorRol, usarTiendaAuth } from '../tienda/tiendaAuth';
import { LimiteError } from '../componentes/ui/LimiteError';

const PaginaInicioSesion = lazy(() =>
  import('../caracteristicas/autenticacion/PaginaInicioSesion').then((m) => ({ default: m.PaginaInicioSesion })),
);
const PaginaRecuperarContrasena = lazy(() =>
  import('../caracteristicas/autenticacion/PaginaRecuperarContrasena').then((m) => ({
    default: m.PaginaRecuperarContrasena,
  })),
);
const PaginaResetContrasena = lazy(() =>
  import('../caracteristicas/autenticacion/PaginaResetContrasena').then((m) => ({
    default: m.PaginaResetContrasena,
  })),
);
const PaginaAgenda = lazy(() =>
  import('../caracteristicas/estudio/PaginaAgenda').then((m) => ({ default: m.PaginaAgenda })),
);
const PaginaAdminEstudio = lazy(() =>
  import('../caracteristicas/estudio/PaginaAdminEstudio').then((m) => ({ default: m.PaginaAdminEstudio })),
);
const PaginaFinanzasMaestro = lazy(() =>
  import('../caracteristicas/maestro/PaginaFinanzasMaestro').then((m) => ({ default: m.PaginaFinanzasMaestro })),
);
const PaginaMaestro = lazy(() =>
  import('../caracteristicas/maestro/PaginaMaestro').then((m) => ({ default: m.PaginaMaestro })),
);
const PaginaReserva = lazy(() =>
  import('../caracteristicas/reserva/PaginaReserva').then((m) => ({ default: m.PaginaReserva })),
);
const PaginaCancelarReserva = lazy(() =>
  import('../caracteristicas/reserva/PaginaCancelarReserva').then((m) => ({ default: m.PaginaCancelarReserva })),
);

function PantallaCargaRuta() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-pink-600" />
    </div>
  );
}

function RedireccionRaiz() {
  const { iniciando, rol, estudioActual, claveClienteActual } = usarTiendaAuth();

  if (iniciando) {
    return <PantallaCargaRuta />;
  }

  return <Navigate to={obtenerRutaPorRol(rol, estudioActual, claveClienteActual)} replace />;
}

export function Enrutador() {
  return (
    <Suspense fallback={<PantallaCargaRuta />}>
    <Routes>
      <Route path="/" element={<RedireccionRaiz />} />
      <Route path="/iniciar-sesion" element={<PaginaInicioSesion />} />
      <Route path="/recuperar-contrasena" element={<PaginaRecuperarContrasena />} />
      <Route path="/reset-contrasena" element={<PaginaResetContrasena />} />
      <Route path="/cancelar-reserva/:reservaId/:token" element={<PaginaCancelarReserva />} />

      <Route element={<GuardiaRuta rolesPermitidos={['maestro']} />}>
        <Route path="/maestro" element={<LimiteError><PaginaMaestro /></LimiteError>} />
        <Route path="/maestro/finanzas" element={<LimiteError><PaginaFinanzasMaestro /></LimiteError>} />
      </Route>

      <Route element={<GuardiaRuta rolesPermitidos={['dueno']} />}>
        <Route path="/estudio/:estudioId/agenda" element={<LimiteError><PaginaAgenda /></LimiteError>} />
        <Route path="/estudio/:estudioId/admin" element={<LimiteError><PaginaAdminEstudio /></LimiteError>} />
      </Route>

      <Route element={<GuardiaRuta rolesPermitidos={['cliente']} />}>
        <Route path="/reserva/:claveCliente" element={<LimiteError><PaginaReserva /></LimiteError>} />
      </Route>

      <Route path="*" element={<RedireccionRaiz />} />
    </Routes>
    </Suspense>
  );
}