import { z } from 'zod';

export const DOMINIOS_CLIENTE_PERMITIDOS = [
  'gmail.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'yahoo.com',
] as const;

export const MENSAJE_DOMINIO_CLIENTE =
  'Usa un correo personal con dominio @gmail.com, @outlook.com, @hotmail.com, @icloud.com o @yahoo.com';
export const MENSAJE_CONTRASENA_CLIENTE =
  'Usa al menos 8 caracteres con mayúscula, minúscula, número y carácter especial';

const REGEX_TEXTO_SOLO_LETRAS = /^[\p{L}\p{M}\s'’-]+$/u;
const REGEX_CONTRASENA_SEGURA = /^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/;

function obtenerAnioActual(): number {
  return new Date().getFullYear();
}

function normalizarEspacios(valor: string): string {
  return valor.replace(/\s+/g, ' ').trimStart();
}

export function limpiarTextoSoloLetras(valor: string): string {
  return normalizarEspacios(valor.replace(/[^\p{L}\p{M}\s'’-]/gu, ''));
}

export function limpiarTelefonoCliente(valor: string): string {
  return valor.replace(/\D/g, '').slice(0, 10);
}

export function limpiarCorreoCliente(valor: string): string {
  return valor.replace(/\s+/g, '').toLowerCase();
}

export function esDominioClientePermitido(email: string): boolean {
  const dominio = limpiarCorreoCliente(email).split('@')[1];
  return (
    dominio !== undefined &&
    DOMINIOS_CLIENTE_PERMITIDOS.includes(dominio as (typeof DOMINIOS_CLIENTE_PERMITIDOS)[number])
  );
}

export function esCumpleanosActualValido(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    return false;
  }

  const [anioTexto, mesTexto, diaTexto] = valor.split('-');
  const anio = Number(anioTexto);
  const mes = Number(mesTexto);
  const dia = Number(diaTexto);

  if (anio !== obtenerAnioActual()) {
    return false;
  }

  const fecha = new Date(anio, mes - 1, dia);
  return (
    !Number.isNaN(fecha.getTime()) &&
    fecha.getFullYear() === anio &&
    fecha.getMonth() === mes - 1 &&
    fecha.getDate() === dia
  );
}

export function formatearCumpleanos(valor: string): string {
  if (!esCumpleanosActualValido(valor)) {
    return 'Selecciona cumpleaños';
  }

  return new Date(`${valor}T12:00:00`).toLocaleDateString('es-MX', {
    day: 'numeric',
    month: 'long',
  });
}

export function obtenerCumpleanosIso(fecha: Date): string {
  const anio = obtenerAnioActual();
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const dia = String(fecha.getDate()).padStart(2, '0');
  return `${anio}-${mes}-${dia}`;
}

export function obtenerFechaCumpleanos(valor: string): Date | undefined {
  if (!esCumpleanosActualValido(valor)) {
    return undefined;
  }

  const [anio, mes, dia] = valor.split('-').map(Number);
  return new Date(anio, (mes ?? 1) - 1, dia ?? 1);
}

export function obtenerRequisitosContrasenaCliente(contrasena: string) {
  return {
    longitudMinima: contrasena.length >= 8,
    tieneMayuscula: /[A-Z]/.test(contrasena),
    tieneMinuscula: /[a-z]/.test(contrasena),
    tieneNumero: /[0-9]/.test(contrasena),
    tieneEspecial: /[^A-Za-z0-9]/.test(contrasena),
  };
}

export function obtenerFortalezaContrasenaCliente(contrasena: string) {
  const requisitos = obtenerRequisitosContrasenaCliente(contrasena);
  const cumplidos = Object.values(requisitos).filter(Boolean).length;

  if (cumplidos <= 2) {
    return { nivel: cumplidos, etiqueta: 'Débil', color: 'bg-red-500', texto: 'text-red-700' };
  }

  if (cumplidos <= 4) {
    return {
      nivel: cumplidos,
      etiqueta: 'En progreso',
      color: 'bg-orange-500',
      texto: 'text-orange-700',
    };
  }

  return {
    nivel: cumplidos,
    etiqueta: 'Aceptable',
    color: 'bg-green-500',
    texto: 'text-green-700',
  };
}

function textoSoloLetrasSchema(campo: string, maximo: number, minimo = 1) {
  return z
    .string()
    .trim()
    .min(minimo, `Ingresa ${campo}`)
    .max(maximo, `Máximo ${maximo} caracteres`)
    .refine((valor) => REGEX_TEXTO_SOLO_LETRAS.test(valor), `El campo ${campo} solo acepta letras`);
}

export const esquemaCorreoCliente = z.object({
  email: z
    .string()
    .trim()
    .email('Ingresa un correo válido')
    .refine(esDominioClientePermitido, MENSAJE_DOMINIO_CLIENTE),
});

export const esquemaRegistroCliente = z
  .object({
    nombreCompleto: textoSoloLetrasSchema('nombre completo', 120, 3),
    email: z
      .string()
      .trim()
      .email('Ingresa un correo válido')
      .refine(esDominioClientePermitido, MENSAJE_DOMINIO_CLIENTE),
    telefono: z
      .string()
      .trim()
      .regex(/^\d{1,10}$/, 'Usa solo números, máximo 10 dígitos')
      .optional()
      .or(z.literal('')),
    ciudad: z
      .string()
      .trim()
      .max(80, 'Máximo 80 caracteres')
      .refine(
        (valor) => valor.length === 0 || REGEX_TEXTO_SOLO_LETRAS.test(valor),
        'La ciudad solo acepta texto',
      )
      .optional()
      .or(z.literal('')),
    pais: z.enum(['Mexico', 'Colombia']),
    fechaNacimiento: z.string().optional().or(z.literal('')),
    contrasena: z
      .string()
      .min(8, MENSAJE_CONTRASENA_CLIENTE)
      .refine((valor) => REGEX_CONTRASENA_SEGURA.test(valor), MENSAJE_CONTRASENA_CLIENTE),
    confirmarContrasena: z.string(),
    aceptaTerminos: z
      .boolean()
      .refine((valor) => valor, 'Debes aceptar los términos para continuar'),
  })
  .refine((datos) => datos.contrasena === datos.confirmarContrasena, {
    path: ['confirmarContrasena'],
    message: 'Las contraseñas no coinciden',
  });

export type CamposRegistroCliente = z.infer<typeof esquemaRegistroCliente>;
export type CamposCorreoCliente = z.infer<typeof esquemaCorreoCliente>;
