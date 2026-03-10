/**
 * Validación de variables de entorno del servidor — Beauty Time Pro
 *
 * Se ejecuta al arrancar la aplicación. Si falta alguna variable
 * requerida el proceso termina con un mensaje descriptivo.
 */
import 'dotenv/config';
import { z } from 'zod';

const esquemaEntorno = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es requerida'),
  JWT_SECRETO: z.string().min(16, 'JWT_SECRETO debe tener al menos 16 caracteres'),
  PUERTO: z.coerce.number().int().positive().default(3000),
  ENTORNO: z.enum(['development', 'production', 'test']).default('development'),
  CLAVE_MAESTRO: z.string().min(1).default('MIKEMASTER'),
  JWT_EXPIRA_EN: z.string().default('15m'),
  JWT_REFRESH_EXPIRA_EN: z.string().default('7d'),
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY es requerida'),
  EMAIL_REMITENTE: z.string().email('EMAIL_REMITENTE debe ser un email válido'),
  FRONTEND_URL: z.string().url('FRONTEND_URL debe ser una URL válida'),
});

const resultado = esquemaEntorno.safeParse(process.env);

if (!resultado.success) {
  console.error('❌ Variables de entorno del servidor inválidas:');
  for (const [campo, mensajes] of Object.entries(resultado.error.flatten().fieldErrors)) {
    console.error(`   ${campo}: ${(mensajes as string[]).join(', ')}`);
  }
  process.exit(1);
}

export const env = resultado.data;
