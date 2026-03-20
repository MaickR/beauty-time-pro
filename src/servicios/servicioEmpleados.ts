import { peticion } from '../lib/clienteHTTP';
import type { EmpleadoAccesoInfo, ReservaEmpleado, PerfilEmpleado } from '../tipos';

interface RespuestaAcceso {
  datos: EmpleadoAccesoInfo | null;
}
interface RespuestaCrearAcceso {
  datos: EmpleadoAccesoInfo;
}
interface RespuestaReservas {
  datos: ReservaEmpleado[];
}
interface RespuestaPerfil {
  datos: PerfilEmpleado;
}
interface RespuestaMensaje {
  datos: { mensaje: string };
}

export async function obtenerAccesoPersonal(
  estudioId: string,
  personalId: string,
): Promise<EmpleadoAccesoInfo | null> {
  const respuesta = await peticion<RespuestaAcceso>(
    `/estudio/${estudioId}/personal/${personalId}/acceso`,
  );
  return respuesta.datos;
}

export async function crearAccesoEmpleado(
  estudioId: string,
  personalId: string,
  datos: { email: string; contrasena: string; forzarCambioContrasena?: boolean },
): Promise<EmpleadoAccesoInfo> {
  const respuesta = await peticion<RespuestaCrearAcceso>(
    `/estudio/${estudioId}/personal/${personalId}/crear-acceso`,
    { method: 'POST', body: JSON.stringify(datos) },
  );
  return respuesta.datos;
}

export async function actualizarAccesoEmpleado(
  estudioId: string,
  personalId: string,
  activo: boolean,
): Promise<EmpleadoAccesoInfo> {
  const respuesta = await peticion<RespuestaCrearAcceso>(
    `/estudio/${estudioId}/personal/${personalId}/acceso`,
    { method: 'PUT', body: JSON.stringify({ activo }) },
  );
  return respuesta.datos;
}

export async function eliminarAccesoEmpleado(estudioId: string, personalId: string): Promise<void> {
  await peticion<RespuestaMensaje>(`/estudio/${estudioId}/personal/${personalId}/acceso`, {
    method: 'DELETE',
  });
}

export async function obtenerMiAgenda(fecha?: string): Promise<ReservaEmpleado[]> {
  const qs = fecha ? `?fecha=${fecha}` : '';
  const respuesta = await peticion<RespuestaReservas>(`/empleados/mi-agenda${qs}`);
  return respuesta.datos;
}

export async function obtenerMiAgendaMes(mes: string): Promise<ReservaEmpleado[]> {
  const respuesta = await peticion<RespuestaReservas>(`/empleados/mi-agenda-mes?mes=${mes}`);
  return respuesta.datos;
}

export async function actualizarEstadoReservaEmpleado(
  reservaId: string,
  estado: 'confirmed' | 'completed',
): Promise<ReservaEmpleado> {
  const respuesta = await peticion<{ datos: ReservaEmpleado }>(
    `/empleados/reservas/${reservaId}/estado`,
    {
      method: 'PUT',
      body: JSON.stringify({ estado }),
    },
  );
  return respuesta.datos;
}

export async function obtenerMiPerfilEmpleado(): Promise<PerfilEmpleado> {
  const respuesta = await peticion<RespuestaPerfil>('/empleados/mi-perfil');
  return respuesta.datos;
}

export async function cambiarContrasenaEmpleado(
  contrasenaActual: string,
  contrasenaNueva: string,
): Promise<void> {
  await peticion<RespuestaMensaje>('/empleados/cambiar-contrasena', {
    method: 'POST',
    body: JSON.stringify({ contrasenaActual, contrasenaNueva }),
  });
}
