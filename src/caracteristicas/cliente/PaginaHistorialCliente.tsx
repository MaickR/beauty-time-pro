import { Navigate } from 'react-router-dom';

export function PaginaHistorialCliente() {
  return <Navigate to="/cliente/perfil?vista=reservas" replace />;
}
