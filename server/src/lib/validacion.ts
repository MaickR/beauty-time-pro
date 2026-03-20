import { z } from 'zod';

export const REGEX_FECHA_ISO = /^\d{4}-\d{2}-\d{2}$/;
export const REGEX_HORA = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
export const REGEX_TELEFONO = /^[0-9()+\-\s]{7,20}$/;

export function textoSchema(campo: string, maximo: number, minimo = 1) {
  return z
    .string()
    .trim()
    .min(minimo, `${campo} debe tener al menos ${minimo} caracteres`)
    .max(maximo, `${campo} no puede superar ${maximo} caracteres`);
}

export const telefonoSchema = z
  .string()
  .trim()
  .regex(REGEX_TELEFONO, 'El teléfono debe contener entre 7 y 20 caracteres válidos');

export const fechaIsoSchema = z
  .string()
  .trim()
  .regex(REGEX_FECHA_ISO, 'La fecha debe tener formato YYYY-MM-DD');

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
