import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { GuardiaRuta } from '../caracteristicas/autenticacion/GuardiaRuta';
import { obtenerRutaPorRol, usarTiendaAuth } from '../tienda/tiendaAuth';
import { LimiteError } from '../componentes/ui/LimiteError';
import { Pagina404 } from '../componentes/ui/Pagina404';

const PaginaInicioSesion = lazy(() =>
  import('../caracteristicas/autenticacion/PaginaInicioSesion').then((m) => ({
    default: m.PaginaInicioSesion,
  })),
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
const PaginaRegistroSalon = lazy(() =>
  import('../caracteristicas/autenticacion/PaginaRegistroSalon').then((m) => ({
    default: m.PaginaRegistroSalon,
  })),
);
const PaginaRegistroCliente = lazy(() =>
  import('../caracteristicas/autenticacion/PaginaRegistroCliente').then((m) => ({
    default: m.PaginaRegistroCliente,
  })),
);
const PaginaEsperaAprobacion = lazy(() =>
  import('../caracteristicas/autenticacion/PaginaEsperaAprobacion').then((m) => ({
    default: m.PaginaEsperaAprobacion,
  })),
);
const PaginaEmailEnviado = lazy(() =>
  import('../caracteristicas/autenticacion/PaginaEmailEnviado').then((m) => ({
    default: m.PaginaEmailEnviado,
  })),
);
const PaginaVerificarEmail = lazy(() =>
  import('../caracteristicas/autenticacion/PaginaVerificarEmail').then((m) => ({
    default: m.PaginaVerificarEmail,
  })),
);
const PaginaAgenda = lazy(() =>
  import('../caracteristicas/estudio/PaginaAgenda').then((m) => ({ default: m.PaginaAgenda })),
);
const PaginaAdminEstudio = lazy(() =>
  import('../caracteristicas/estudio/PaginaAdminEstudio').then((m) => ({
    default: m.PaginaAdminEstudio,
  })),
);
const PaginaMaestro = lazy(() =>
  import('../caracteristicas/maestro/PaginaMaestro').then((m) => ({ default: m.PaginaMaestro })),
);
const PaginaReserva = lazy(() =>
  import('../caracteristicas/reserva/PaginaReserva').then((m) => ({ default: m.PaginaReserva })),
);
const PaginaCancelarReserva = lazy(() =>
  import('../caracteristicas/reserva/PaginaCancelarReserva').then((m) => ({
    default: m.PaginaCancelarReserva,
  })),
);
const PaginaAgendaEmpleado = lazy(() =>
  import('../caracteristicas/empleado/PaginaAgendaEmpleado').then((m) => ({
    default: m.PaginaAgendaEmpleado,
  })),
);
const PaginaPerfilEmpleado = lazy(() =>
  import('../caracteristicas/empleado/PaginaPerfilEmpleado').then((m) => ({
    default: m.PaginaPerfilEmpleado,
  })),
);
const PaginaInicioCliente = lazy(() =>
  import('../caracteristicas/cliente/PaginaInicioCliente').then((m) => ({
    default: m.PaginaInicioCliente,
  })),
);
const PaginaPerfilCliente = lazy(() =>
  import('../caracteristicas/cliente/PaginaPerfilCliente').then((m) => ({
    default: m.PaginaPerfilCliente,
  })),
);
const PaginaHistorialCliente = lazy(() =>
  import('../caracteristicas/cliente/PaginaHistorialCliente').then((m) => ({
    default: m.PaginaHistorialCliente,
  })),
);
const PaginaDetalleSalon = lazy(() =>
  import('../caracteristicas/cliente/PaginaDetalleSalon').then((m) => ({
    default: m.PaginaDetalleSalon,
  })),
);
const PaginaReservaCliente = lazy(() =>
  import('../caracteristicas/cliente/PaginaReservaCliente').then((m) => ({
    default: m.PaginaReservaCliente,
  })),
);
const PaginaVendedor = lazy(() =>
  import('../caracteristicas/vendedor/PaginaVendedor').then((m) => ({
    default: m.PaginaVendedor,
  })),
);

function PantallaCargaRuta() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-pink-600" />
    </div>
  );
}

function RedireccionRaiz() {
  const { iniciando, rol, estudioActual, slugEstudioActual, claveClienteActual, usuario } =
    usarTiendaAuth();

  if (iniciando) {
    return <PantallaCargaRuta />;
  }

  if (!rol) {
    if (claveClienteActual) {
      return <Navigate to={`/reservar/${claveClienteActual}`} replace />;
    }
    return <Navigate to="/iniciar-sesion" replace />;
  }

  return (
    <Navigate
      to={obtenerRutaPorRol(
        rol,
        estudioActual,
        slugEstudioActual,
        claveClienteActual,
        usuario?.forzarCambioContrasena ?? false,
      )}
      replace
    />
  );
}

export function Enrutador() {
  return (
    <Suspense fallback={<PantallaCargaRuta />}>
      <Routes>
        <Route path="/" element={<RedireccionRaiz />} />
        <Route path="/iniciar-sesion" element={<PaginaInicioSesion />} />
        <Route path="/recuperar-contrasena" element={<PaginaRecuperarContrasena />} />
        <Route path="/reset-contrasena" element={<PaginaResetContrasena />} />
        <Route path="/cancelar-reserva" element={<PaginaCancelarReserva />} />
        <Route path="/registro/cliente" element={<PaginaRegistroCliente />} />
        <Route path="/registro/salon" element={<PaginaRegistroSalon />} />
        <Route path="/espera-aprobacion" element={<PaginaEsperaAprobacion />} />
        <Route path="/email-enviado" element={<PaginaEmailEnviado />} />
        <Route path="/verificar-email" element={<PaginaVerificarEmail />} />

        <Route element={<GuardiaRuta rolesPermitidos={['maestro']} />}>
          <Route
            path="/maestro"
            element={
              <LimiteError>
                <PaginaMaestro />
              </LimiteError>
            }
          />
          <Route
            path="/maestro/finanzas"
            element={
              <LimiteError>
                <PaginaMaestro />
              </LimiteError>
            }
          />
        </Route>

        <Route element={<GuardiaRuta rolesPermitidos={['supervisor']} />}>
          <Route
            path="/supervisor"
            element={
              <LimiteError>
                <PaginaMaestro />
              </LimiteError>
            }
          />
          <Route
            path="/supervisor/finanzas"
            element={
              <LimiteError>
                <PaginaMaestro />
              </LimiteError>
            }
          />
        </Route>

        <Route element={<GuardiaRuta rolesPermitidos={['vendedor']} />}>
          <Route
            path="/vendedor"
            element={
              <LimiteError>
                <PaginaVendedor />
              </LimiteError>
            }
          />
        </Route>

        <Route element={<GuardiaRuta rolesPermitidos={['dueno', 'vendedor']} />}>
          <Route
            path="/estudio/:slug/agenda"
            element={
              <LimiteError>
                <PaginaAgenda />
              </LimiteError>
            }
          />
          <Route
            path="/estudio/:slug/admin"
            element={
              <LimiteError>
                <PaginaAdminEstudio />
              </LimiteError>
            }
          />
        </Route>

        <Route path="/salones" element={<Navigate to="/" replace />} />
        <Route path="/salones/:id" element={<Navigate to="/" replace />} />
        <Route path="/salones/:id/reservar" element={<Navigate to="/" replace />} />
        <Route path="/inicio" element={<Navigate to="/cliente/inicio" replace />} />
        <Route path="/mi-perfil" element={<Navigate to="/cliente/perfil" replace />} />
        <Route path="/administracion" element={<Navigate to="/" replace />} />

        <Route element={<GuardiaRuta rolesPermitidos={['cliente']} />}>
          <Route
            path="/cliente/inicio"
            element={
              <LimiteError>
                <PaginaInicioCliente />
              </LimiteError>
            }
          />
          <Route
            path="/cliente/perfil"
            element={
              <LimiteError>
                <PaginaPerfilCliente />
              </LimiteError>
            }
          />
          <Route
            path="/cliente/historial"
            element={
              <LimiteError>
                <PaginaHistorialCliente />
              </LimiteError>
            }
          />
          <Route
            path="/cliente/salon/:identificador"
            element={
              <LimiteError>
                <PaginaDetalleSalon />
              </LimiteError>
            }
          />
          <Route
            path="/cliente/salon/:identificador/reservar"
            element={
              <LimiteError>
                <PaginaReservaCliente />
              </LimiteError>
            }
          />
        </Route>

        <Route
          path="/reservar/:claveEstudio"
          element={
            <LimiteError>
              <PaginaReserva />
            </LimiteError>
          }
        />

        <Route element={<GuardiaRuta rolesPermitidos={['empleado']} />}>
          <Route
            path="/empleado/agenda"
            element={
              <LimiteError>
                <PaginaAgendaEmpleado />
              </LimiteError>
            }
          />
          <Route
            path="/empleado/perfil"
            element={
              <LimiteError>
                <PaginaPerfilEmpleado />
              </LimiteError>
            }
          />
          <Route
            path="/empleado/cambiar-contrasena"
            element={
              <LimiteError>
                <PaginaPerfilEmpleado />
              </LimiteError>
            }
          />
        </Route>

        <Route path="*" element={<Pagina404 />} />
      </Routes>
    </Suspense>
  );
}
