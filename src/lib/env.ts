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

const entornoCrudo = { ...import.meta.env } as Record<string, unknown>;

const esEntornoLocal =
  entornoCrudo.MODE === 'development' || entornoCrudo.MODE === 'test' || entornoCrudo.DEV === true;

if (esEntornoLocal) {
  const valorApi =
    typeof entornoCrudo.VITE_URL_API === 'string' ? entornoCrudo.VITE_URL_API.trim() : '';

  if (!valorApi) {
    entornoCrudo.VITE_URL_API = 'http://localhost:3000';
    console.warn(
      '⚠️ VITE_URL_API no estaba definida. Se usa http://localhost:3000 para desarrollo local.',
    );
  }
}

const esquemaEntorno = z
  .object({
    // ── API REST (Fastify + MySQL) ─────────────────────────────────────────
    VITE_URL_API: z
      .string()
      .url('VITE_URL_API debe ser una URL válida (ej: http://localhost:3000)'),
    VITE_URL_PUBLICA: z.string().url('VITE_URL_PUBLICA debe ser una URL válida').optional(),

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

const resultado = esquemaEntorno.safeParse(entornoCrudo);

if (!resultado.success) {
  console.error('❌ Variables de entorno inválidas:', resultado.error.flatten().fieldErrors);
  throw new Error(
    'Configuración de entorno inválida. Revisa el archivo .env.example y crea tu .env.local.',
  );
}

export const env = resultado.data;

/** URL base de la API REST — shorthand conveniente */
export const urlApi = env.VITE_URL_API;
