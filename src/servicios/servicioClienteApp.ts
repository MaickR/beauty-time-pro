import { peticion } from '../lib/clienteHTTP';
import { construirUrlArchivo } from '../utils/archivos';
import type {
  ReservaCliente,
  SalonPublico,
  SalonDetalle,
  PerfilClienteApp,
  SlotTiempo,
} from '../tipos';

interface RespuestaSalones {
  datos: SalonPublico[];
}

interface RespuestaSalon {
  datos: SalonDetalle;
}

interface RespuestaPerfil {
  datos: PerfilClienteApp;
}

interface RespuestaSlots {
  datos: { hora: string; disponible: boolean }[];
}

function normalizarSlots(
  slots: Array<{
    hora?: string;
    disponible?: boolean;
    time?: string;
    status?: SlotTiempo['status'];
  }>,
): SlotTiempo[] {
  return slots
    .map((slot) => {
      if (slot.time && slot.status) {
        return { time: slot.time, status: slot.status };
      }

      if (slot.hora) {
        return {
          time: slot.hora,
          status: slot.disponible ? 'AVAILABLE' : 'OCCUPIED',
        };
      }

      return null;
    })
    .filter((slot): slot is SlotTiempo => slot !== null);
}

function normalizarSalonPublico(salon: SalonPublico): SalonPublico {
  return {
    ...salon,
    logoUrl: construirUrlArchivo(salon.logoUrl),
  };
}

function normalizarSalonDetalle(salon: SalonDetalle): SalonDetalle {
  return {
    ...normalizarSalonPublico(salon),
    personal: salon.personal,
    servicios: salon.servicios,
    horario: salon.horario,
    festivos: salon.festivos,
  };
}

function normalizarPerfilCliente(perfil: PerfilClienteApp): PerfilClienteApp {
  const reservas = Array.isArray(perfil.reservas) ? perfil.reservas : [];
  const fidelidad = Array.isArray(perfil.fidelidad) ? perfil.fidelidad : [];

  return {
    ...perfil,
    avatarUrl: construirUrlArchivo(perfil.avatarUrl),
    reservas: reservas.map((reserva) => ({
      ...reserva,
      salon: {
        ...reserva.salon,
        logoUrl: construirUrlArchivo(reserva.salon.logoUrl),
      },
    })),
    fidelidad: fidelidad.map((item) => ({
      ...item,
      logoUrl: construirUrlArchivo(item.logoUrl),
    })),
  };
}

export async function obtenerSalonesPublicos(params?: {
  buscar?: string;
  categorias?: string[];
  pais?: 'Mexico' | 'Colombia';
}): Promise<SalonPublico[]> {
  const query = new URLSearchParams();
  if (params?.buscar) query.set('buscar', params.buscar);
  if (params?.categorias && params.categorias.length > 0) {
    query.set('categorias', params.categorias.join(','));
  }
  if (params?.pais) query.set('pais', params.pais);
  const qs = query.toString() ? `?${query.toString()}` : '';
  const res = await peticion<RespuestaSalones>(`/salones/publicos${qs}`);
  return res.datos.map(normalizarSalonPublico);
}

export async function obtenerSalonPublico(id: string): Promise<SalonDetalle> {
  const res = await peticion<RespuestaSalon>(`/salones/publicos/${id}`);
  return normalizarSalonDetalle(res.datos);
}

export async function obtenerDisponibilidad(
  salonId: string,
  personalId: string,
  fecha: string,
  duracion: number,
): Promise<SlotTiempo[]> {
  const res = await peticion<RespuestaSlots>(
    `/salones/publicos/${salonId}/disponibilidad?personalId=${personalId}&fecha=${fecha}&duracion=${duracion}`,
  );
  return normalizarSlots(res.datos);
}

export async function obtenerMiPerfil(): Promise<PerfilClienteApp> {
  const res = await peticion<RespuestaPerfil>('/mi-perfil');
  return normalizarPerfilCliente(res.datos);
}

export async function obtenerMisReservas(): Promise<ReservaCliente[]> {
  const perfil = await obtenerMiPerfil();
  return perfil.reservas;
}

export async function obtenerReservasProximas(): Promise<ReservaCliente[]> {
  const hoy = new Date().toISOString().split('T')[0] ?? '';
  const reservas = await obtenerMisReservas();
  return reservas
    .filter((reserva) => reserva.fecha >= hoy && reserva.estado !== 'cancelled')
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export async function actualizarMiPerfil(datos: {
  nombre?: string;
  apellido?: string;
  telefono?: string;
  fechaNacimiento?: string;
}): Promise<PerfilClienteApp> {
  const res = await peticion<{ datos: PerfilClienteApp }>('/mi-perfil', {
    method: 'PUT',
    body: JSON.stringify(datos),
  });
  return normalizarPerfilCliente(res.datos);
}

export async function subirAvatar(archivo: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', archivo);
  const res = await peticion<{ datos: { avatarUrl: string } }>('/mi-perfil/avatar', {
    method: 'POST',
    body: fd,
  });
  return construirUrlArchivo(res.datos.avatarUrl) ?? res.datos.avatarUrl;
}

export async function cambiarContrasena(
  contrasenaActual: string,
  contrasenaNueva: string,
): Promise<void> {
  await peticion('/mi-perfil/cambiar-contrasena', {
    method: 'POST',
    body: JSON.stringify({ contrasenaActual, contrasenaNueva }),
  });
}

export async function actualizarMiEmail(
  email: string,
): Promise<{ mensaje: string; emailPendiente: string }> {
  const res = await peticion<{ datos: { mensaje: string; emailPendiente: string } }>(
    '/perfil/email',
    {
      method: 'PUT',
      body: JSON.stringify({ email }),
    },
  );
  return res.datos;
}
