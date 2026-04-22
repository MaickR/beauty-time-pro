import { peticion } from '../lib/clienteHTTP';
import {
  combinarExcepcionesDisponibilidad,
  normalizarExcepcionesDisponibilidad,
} from '../lib/disponibilidadExcepciones';
import { normalizarMetodosPagoReserva } from '../lib/metodosPagoReserva';
import { construirUrlArchivo } from '../utils/archivos';
import type {
  ReservaCliente,
  SalonPublico,
  SalonDetalle,
  PerfilClienteApp,
  PerfilClienteReservaPublica,
  SlotTiempo,
  DisponibilidadEspecialista,
} from '../tipos';

interface RespuestaSalones {
  datos: SalonPublico[];
}

interface RespuestaSalon {
  datos: SalonDetalle;
}

interface RespuestaAccesoSalon {
  datos: SalonDetalle;
}

interface RespuestaPerfil {
  datos: PerfilClienteApp;
}

interface RespuestaPerfilReservaPublica {
  datos: PerfilClienteReservaPublica;
}

interface RespuestaAccesoPrincipalCliente {
  datos: {
    encontrado: boolean;
    estudioId?: string;
    nombreSalon?: string;
    slug?: string | null;
    claveCliente?: string;
  };
}

interface RespuestaSlots {
  datos: Array<{
    hora?: string;
    disponible?: boolean;
    time?: string;
    status?: SlotTiempo['status'];
  }>;
}

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const REGEX_CUID = /^c[a-z0-9]{20,}$/i;

function pareceIdSalon(valor: string): boolean {
  return REGEX_UUID.test(valor) || REGEX_CUID.test(valor);
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
    slug: salon.slug,
    estudioPrincipalId: salon.estudioPrincipalId ?? null,
    permiteReservasPublicas: salon.permiteReservasPublicas ?? true,
    sucursales: Array.isArray(salon.sucursales) ? salon.sucursales : [],
    sedesReservables: Array.isArray(salon.sedesReservables) ? salon.sedesReservables : [],
    plan: salon.plan,
    personal: salon.personal,
    servicios: salon.servicios,
    productos: Array.isArray(salon.productos) ? salon.productos : [],
    metodosPagoReserva: normalizarMetodosPagoReserva(
      (salon as unknown as Record<string, unknown>)['metodosPagoReserva'],
    ),
    horario: salon.horario,
    festivos: salon.festivos,
    availabilityExceptions: combinarExcepcionesDisponibilidad(
      Array.isArray(salon.festivos) ? salon.festivos : [],
      normalizarExcepcionesDisponibilidad(
        (salon as unknown as Record<string, unknown>)['excepcionesDisponibilidad'],
      ),
    ),
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

export async function obtenerSalonPublicoPorIdentificador(
  identificador: string,
): Promise<SalonDetalle> {
  const identificadorLimpio = identificador.trim();

  if (pareceIdSalon(identificadorLimpio)) {
    try {
      return await obtenerSalonPublico(identificadorLimpio);
    } catch {
      return obtenerSalonPublicoPorClave(identificadorLimpio);
    }
  }

  return obtenerSalonPublicoPorClave(identificadorLimpio);
}

export async function obtenerSalonPublicoPorClave(clave: string): Promise<SalonDetalle> {
  const res = await peticion<RespuestaAccesoSalon>(
    `/salones/publicos/clave/${encodeURIComponent(clave.trim())}`,
  );
  return normalizarSalonDetalle(res.datos);
}

export async function obtenerDisponibilidad(
  salonId: string,
  personalId: string,
  fecha: string,
  duracion: number,
  sucursal?: string,
): Promise<SlotTiempo[]> {
  const parametros = new URLSearchParams({
    personalId,
    fecha,
    duracion: String(duracion),
  });

  if (sucursal?.trim()) {
    parametros.set('sucursal', sucursal.trim());
  }

  const res = await peticion<RespuestaSlots>(
    `/salones/publicos/${salonId}/disponibilidad?${parametros.toString()}`,
  );
  return normalizarSlots(res.datos);
}

export async function obtenerDisponibilidadCompleta(
  salonId: string,
  fecha: string,
  duracion: number,
  opciones?: { sucursal?: string; servicios?: string[] },
): Promise<DisponibilidadEspecialista[]> {
  const parametros = new URLSearchParams({
    fecha,
    duracion: String(duracion),
  });

  if (opciones?.sucursal?.trim()) {
    parametros.set('sucursal', opciones.sucursal.trim());
  }

  if (opciones?.servicios && opciones.servicios.length > 0) {
    parametros.set('servicios', opciones.servicios.map((servicio) => servicio.trim()).join(','));
  }

  const res = await peticion<{ especialistas: DisponibilidadEspecialista[] }>(
    `/salones/publicos/${salonId}/disponibilidad-completa?${parametros.toString()}`,
  );
  return res.especialistas;
}

export async function obtenerPerfilClienteReservaPublica(
  salonId: string,
  email: string,
): Promise<PerfilClienteReservaPublica> {
  const res = await peticion<RespuestaPerfilReservaPublica>(
    `/salones/publicos/${salonId}/cliente-por-email?email=${encodeURIComponent(email.trim())}`,
  );
  return res.datos;
}

export async function obtenerMiPerfil(): Promise<PerfilClienteApp> {
  const res = await peticion<RespuestaPerfil>('/mi-perfil');
  return normalizarPerfilCliente(res.datos);
}

export async function obtenerAccesoPrincipalCliente(): Promise<{
  encontrado: boolean;
  estudioId: string | null;
  nombreSalon: string | null;
  slug: string | null;
  claveCliente: string | null;
}> {
  const res = await peticion<RespuestaAccesoPrincipalCliente>('/clientes-app/acceso-principal');

  if (!res.datos.encontrado) {
    return {
      encontrado: false,
      estudioId: null,
      nombreSalon: null,
      slug: null,
      claveCliente: null,
    };
  }

  return {
    encontrado: true,
    estudioId: res.datos.estudioId ?? null,
    nombreSalon: res.datos.nombreSalon ?? null,
    slug: res.datos.slug ?? null,
    claveCliente: res.datos.claveCliente ?? null,
  };
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

export async function cancelarMiReserva(reservaId: string): Promise<{ cancelada: boolean }> {
  const res = await peticion<{ datos: { cancelada: boolean } }>(
    `/clientes-app/reservas/${reservaId}/cancelar`,
    { method: 'POST' },
  );
  return res.datos;
}

export async function reagendarMiReserva(
  reservaId: string,
  datos: { fecha: string; horaInicio: string },
): Promise<{ id: string; fecha: string; horaInicio: string; reagendada: boolean }> {
  const res = await peticion<{
    datos: { id: string; fecha: string; horaInicio: string; reagendada: boolean };
  }>(`/clientes-app/reservas/${reservaId}/reagendar`, {
    method: 'POST',
    body: JSON.stringify(datos),
  });
  return res.datos;
}
