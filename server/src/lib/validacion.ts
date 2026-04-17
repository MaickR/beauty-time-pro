import { z } from 'zod';

export const REGEX_FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
export const REGEX_HORA = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
export const REGEX_TELEFONO = /^[0-9()+\-\s]{7,20}$/;
export const REGEX_TEXTO_SOLO_LETRAS = /^[\p{L}\p{M}\s'’-]+$/u;
export const REGEX_TELEFONO_CLIENTE = /^\d{1,10}$/;

export function textoSchema(campo: string, maximo: number, minimo = 1) {
  return z
    .string()
    .trim()
    .min(minimo, `${campo} debe tener al menos ${minimo} caracteres`)
    .max(maximo, `${campo} no puede superar ${maximo} caracteres`);
}

export function textoSoloLetrasSchema(campo: string, maximo: number, minimo = 1) {
  return textoSchema(campo, maximo, minimo).refine(
    (valor) => REGEX_TEXTO_SOLO_LETRAS.test(valor),
    `${campo} solo acepta letras`,
  );
}

export const telefonoSchema = z
  .string()
  .trim()
  .regex(REGEX_TELEFONO, 'El teléfono debe contener entre 7 y 20 caracteres válidos');

export const telefonoClienteSchema = z
  .string()
  .trim()
  .regex(REGEX_TELEFONO_CLIENTE, 'El teléfono del cliente debe usar solo números con máximo 10 dígitos');

export const fechaIsoSchema = z
  .string()
  .trim()
  .regex(REGEX_FECHA_ISO, 'La fecha debe tener formato YYYY-MM-DD');

function obtenerFechaIsoNormalizada(valor: Date | string): string | null {
  if (valor instanceof Date) {
    if (Number.isNaN(valor.getTime())) {
      return null;
    }
    return valor.toISOString().slice(0, 10);
  }

  const texto = valor.trim();
  if (!REGEX_FECHA_ISO.test(texto)) {
    return null;
  }

  const fecha = new Date(`${texto}T00:00:00`);
  if (Number.isNaN(fecha.getTime())) {
    return null;
  }

  return texto;
}

export function esFechaCumpleanosSinAnio(valor: Date | string): boolean {
  const fechaIso = obtenerFechaIsoNormalizada(valor);
  if (!fechaIso) {
    return false;
  }

  const [anioTexto, mesTexto, diaTexto] = fechaIso.split('-');
  const anio = Number(anioTexto);
  const mes = Number(mesTexto);
  const dia = Number(diaTexto);
  const fecha = new Date(anio, mes - 1, dia);

  return (
    anio === new Date().getFullYear() &&
    !Number.isNaN(fecha.getTime()) &&
    fecha.getFullYear() === anio &&
    fecha.getMonth() === mes - 1 &&
    fecha.getDate() === dia
  );
}

export const fechaCumpleanosActualSchema = fechaIsoSchema.refine(
  (valor) => esFechaCumpleanosSinAnio(valor),
  'La fecha de cumpleaños debe usar un día y mes válidos del año actual',
);

export function calcularEdadDesdeFechaNacimiento(valor: Date | string): number | null {
  const fechaIso = obtenerFechaIsoNormalizada(valor);
  if (!fechaIso || esFechaCumpleanosSinAnio(fechaIso)) {
    return null;
  }

  const nacimiento = new Date(`${fechaIso}T00:00:00`);
  const hoy = new Date();
  let edad = hoy.getFullYear() - nacimiento.getFullYear();
  const cumpleEsteAnio = new Date(hoy.getFullYear(), nacimiento.getMonth(), nacimiento.getDate());
  if (hoy < cumpleEsteAnio) {
    edad -= 1;
  }
  return edad;
}

export const horaSchema = z
  .string()
  .trim()
  .regex(REGEX_HORA, 'La hora debe tener formato HH:mm');

export const colorHexSchema = z
  .string()
  .trim()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'colorPrimario debe ser un color hex válido (#RRGGBB)');

export const emailSchema = z
  .string()
  .trim()
  .max(120, 'El email no puede superar 120 caracteres')
  .email('El email debe ser válido');

function normalizarCampoOpcional(valor: unknown) {
  if (valor === undefined) return undefined;
  if (valor === null) return null;
  if (typeof valor === 'string') {
    const limpio = valor.trim();
    return limpio === '' ? null : limpio;
  }
  return valor;
}

export function textoOpcionalONuloSchema(campo: string, maximo: number, minimo = 1) {
  return z.preprocess(
    normalizarCampoOpcional,
    z.union([textoSchema(campo, maximo, minimo), z.null()]).optional(),
  );
}

export function emailOpcionalONuloSchema(campo: string) {
  return z.preprocess(
    normalizarCampoOpcional,
    z.union([
      z.string().email(`${campo} debe ser válido`).max(120, `${campo} no puede superar 120 caracteres`),
      z.null(),
    ]).optional(),
  );
}

export const urlOpcionalSchema = z.preprocess(
  normalizarCampoOpcional,
  z.union([
    z.string().url('sitioWeb debe ser una URL válida').max(200, 'sitioWeb no puede superar 200 caracteres'),
    z.null(),
  ]).optional(),
);

export const horaOpcionalONulaSchema = z.preprocess(
  normalizarCampoOpcional,
  z.union([horaSchema, z.null()]).optional(),
);

export function obtenerMensajeValidacion(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Datos inválidos';
}
