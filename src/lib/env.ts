/**
 * Validación de variables de entorno — Beauty Time Pro
 *
 * Todas las variables de entorno pasan por Zod antes de ser usadas.
 * Si falta una variable requerida, la app lanza un error descriptivo
 * al arrancar en lugar de fallar silenciosamente en runtime.
 *
 * Uso: import { env } from '@/lib/env';
 */
import { z } from 'zod';

const esquemaEntorno = z
  .object({
    // ── API REST (Fastify + MySQL) ─────────────────────────────────────────
    VITE_URL_API: z
      .string()
      .url('VITE_URL_API debe ser una URL válida (ej: http://localhost:3000)'),

    // ── Modo de ejecución ─────────────────────────────────────────────────
    MODE: z.enum(['development', 'production', 'test']).optional(),
    DEV: z.boolean().optional(),
    PROD: z.boolean().optional(),
  })
  .superRefine((datos, contexto) => {
    if (datos.PROD) {
      if (
        !datos.VITE_URL_API.startsWith('https://') ||
        /localhost|127\.0\.0\.1/.test(datos.VITE_URL_API)
      ) {
        contexto.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['VITE_URL_API'],
          message: 'VITE_URL_API debe usar HTTPS y no puede apuntar a localhost en producción',
        });
      }
    }
  });

const resultado = esquemaEntorno.safeParse(import.meta.env);

if (!resultado.success) {
  console.error('❌ Variables de entorno inválidas:', resultado.error.flatten().fieldErrors);
  throw new Error(
    'Configuración de entorno inválida. Revisa el archivo .env.example y crea tu .env.local.',
  );
}

export const env = resultado.data;

/** URL base de la API REST — shorthand conveniente */
export const urlApi = env.VITE_URL_API;
