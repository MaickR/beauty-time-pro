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
const PaginaBienvenida = lazy(() =>
  import('../caracteristicas/autenticacion/PaginaBienvenida').then((m) => ({
    default: m.PaginaBienvenida,
  })),
);
const PaginaRegistroSalon = lazy(() =>
  import('../caracteristicas/autenticacion/PaginaRegistroSalon').then((m) => ({
    default: m.PaginaRegistroSalon,
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

function PantallaCargaRuta() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50">
      <div className="h-12 w-12 animate-spin rounded-full border-b-2 border-pink-600" />
    </div>
  );
}

function RedireccionRaiz() {
  const { iniciando, rol, estudioActual, claveClienteActual, usuario } = usarTiendaAuth();

  if (iniciando) {
    return <PantallaCargaRuta />;
  }

  if (!rol) {
    if (claveClienteActual) {
      return <Navigate to={`/reservar/${claveClienteActual}`} replace />;
    }
    return <PaginaBienvenida />;
  }

  return (
    <Navigate
      to={obtenerRutaPorRol(
        rol,
        estudioActual,
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
        <Route path="/cancelar-reserva/:reservaId/:token" element={<PaginaCancelarReserva />} />
        <Route path="/registro/cliente" element={<Navigate to="/" replace />} />
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

        <Route element={<GuardiaRuta rolesPermitidos={['dueno']} />}>
          <Route
            path="/estudio/:estudioId/agenda"
            element={
              <LimiteError>
                <PaginaAgenda />
              </LimiteError>
            }
          />
          <Route
            path="/estudio/:estudioId/admin"
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
        <Route path="/inicio" element={<Navigate to="/" replace />} />
        <Route path="/mi-perfil" element={<Navigate to="/" replace />} />
        <Route path="/administracion" element={<Navigate to="/" replace />} />

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
