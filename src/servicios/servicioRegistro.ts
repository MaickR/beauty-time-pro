import { URL_BASE } from '../lib/clienteHTTP';
import type { Servicio, ServicioPersonalizado, TurnoTrabajo, Pais } from '../tipos';

export class ErrorServicioRegistro extends Error {
  codigo?: string;
  campos?: Record<string, string>;
  segundosRestantes?: number;

  constructor(
    mensaje: string,
    codigo?: string,
    opciones?: {
      campos?: Record<string, string>;
      segundosRestantes?: number;
    },
  ) {
    super(mensaje);
    this.name = 'ErrorServicioRegistro';
    this.codigo = codigo;
    this.campos = opciones?.campos;
    this.segundosRestantes = opciones?.segundosRestantes;
  }
}

interface RespuestaRegistroCliente {
  datos: {
    mensaje: string;
    clienteId?: string;
    email?: string;
    enlaceVerificacion?: string;
    expiraEn?: string;
    reenviarEnSegundos?: number;
  };
}

export interface ResultadoRegistro {
  mensaje: string;
  clienteId?: string;
  email?: string;
  enlaceVerificacion?: string;
  expiraEn?: string;
  reenviarEnSegundos?: number;
}

interface DatosRegistroCliente {
  email: string;
  contrasena: string;
  nombreCompleto: string;
  fechaNacimiento?: string;
  pais: Pais;
  ciudad?: string;
  telefono?: string;
}

interface DatosRegistroSalon {
  email: string;
  contrasena: string;
  nombre: string;
  apellido: string;
  nombreSalon: string;
  descripcion?: string;
  direccion: string;
  telefono: string;
  sitioWeb?: string;
  pais: Pais;
  sucursales: string[];
  horario: Record<string, TurnoTrabajo>;
  servicios: Servicio[];
  serviciosCustom?: ServicioPersonalizado[];
  personal: Array<{
    nombre: string;
    especialidades: string[];
    horaInicio: string;
    horaFin: string;
    descansoInicio?: string | null;
    descansoFin?: string | null;
  }>;
  horarioApertura?: string;
  horarioCierre?: string;
  diasAtencion?: string;
  numeroEspecialistas?: number;
  categorias?: string;
  colorPrimario?: string;
}

interface RespuestaDisponibilidad {
  disponible: boolean;
}

interface RespuestaErrorPublica {
  error?: string;
  codigo?: string;
  campos?: Record<string, string>;
  segundosRestantes?: number;
}

async function peticionPublica<T>(ruta: string, body: unknown): Promise<T> {
  const respuesta = await fetch(`${URL_BASE}${ruta}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = (await respuesta.json()) as T & RespuestaErrorPublica;
  if (!respuesta.ok) {
    throw new ErrorServicioRegistro(json.error ?? `Error ${respuesta.status}`, json.codigo, {
      campos: json.campos,
      segundosRestantes: json.segundosRestantes,
    });
  }
  return json;
}

export async function registrarCliente(datos: DatosRegistroCliente): Promise<ResultadoRegistro> {
  const resultado = await peticionPublica<RespuestaRegistroCliente>('/registro/cliente', datos);
  return resultado.datos;
}

export async function verificarEmailCliente(datos: {
  token: string;
}): Promise<{ mensaje: string }> {
  const resultado = await peticionPublica<RespuestaRegistroCliente>(
    '/registro/verificar-email',
    datos,
  );
  return { mensaje: resultado.datos.mensaje };
}

export async function registrarSalon(datos: DatosRegistroSalon): Promise<ResultadoRegistro> {
  const resultado = await peticionPublica<RespuestaRegistroCliente>('/registro/salon', datos);
  return resultado.datos;
}

export async function verificarDisponibilidadEmail(email: string): Promise<boolean> {
  const respuesta = await peticionPublica<RespuestaDisponibilidad>(
    '/registro/verificar-disponibilidad',
    { email },
  );
  return respuesta.disponible;
}
