/**
 * Validación de variables de entorno del servidor — Beauty Time Pro
 *
 * Se ejecuta al arrancar la aplicación. Si falta alguna variable
 * requerida el proceso termina con un mensaje descriptivo.
 */
import 'dotenv/config';
import { z } from 'zod';
import { esPatronOrigenFrontendValido } from './origenesFrontend.js';

function esPlaceholder(valor: string | undefined): boolean {
  if (!valor) {
    return false;
  }

  const normalizado = valor.trim().toLowerCase();
  return ['changeme', 'change-me', 'secret', 'secreto', 'demo', 'test', '1234567890123456'].includes(normalizado);
}

const esquemaEntorno = z
  .object({
    DATABASE_URL: z.string().min(1, 'DATABASE_URL es requerida'),
    JWT_SECRETO: z.string().min(16, 'JWT_SECRETO debe tener al menos 16 caracteres'),
    VAPID_PUBLIC_KEY: z.string().min(1, 'VAPID_PUBLIC_KEY es requerida'),
    VAPID_PRIVATE_KEY: z.string().min(1, 'VAPID_PRIVATE_KEY es requerida'),
    PUERTO: z.coerce.number().int().positive().default(3000),
    ENTORNO: z.enum(['development', 'production', 'test']).default('development'),
    CLAVE_MAESTRO: z.string().trim().min(12, 'CLAVE_MAESTRO debe tener al menos 12 caracteres').optional(),
    JWT_EXPIRA_EN: z.string().default('15m'),
    JWT_REFRESH_EXPIRA_EN: z.string().default('7d'),
    ADMINS_PROTEGIDOS: z.string().default(''),
    DEMO_CLAVE_DUENO: z.string().trim().min(8).optional(),
    RESEND_API_KEY: z.string().optional(),
    EMAIL_REMITENTE: z.string().optional(),
    FRONTEND_URL: z.string().url('FRONTEND_URL debe ser una URL válida'),
    FRONTEND_ORIGENES_PERMITIDOS: z.string().default(''),
  })
  .superRefine((datos, contexto) => {
    const origenesPermitidos = datos.FRONTEND_ORIGENES_PERMITIDOS.split(',')
      .map((valor) => valor.trim())
      .filter(Boolean);

    for (const origen of origenesPermitidos) {
      if (!esPatronOrigenFrontendValido(origen)) {
        contexto.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['FRONTEND_ORIGENES_PERMITIDOS'],
          message:
            'FRONTEND_ORIGENES_PERMITIDOS debe usar URLs absolutas o patrones tipo https://mi-app-git-*.vercel.app',
        });
        break;
      }
    }

    if (datos.ENTORNO === 'production') {
      if (!datos.RESEND_API_KEY) {
        contexto.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['RESEND_API_KEY'],
          message: 'RESEND_API_KEY es requerida en producción',
        });
      }

      if (!datos.EMAIL_REMITENTE) {
        contexto.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['EMAIL_REMITENTE'],
          message: 'EMAIL_REMITENTE es requerida en producción',
        });
      }

      if (esPlaceholder(datos.JWT_SECRETO)) {
        contexto.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['JWT_SECRETO'],
          message: 'JWT_SECRETO no puede usar un valor placeholder en producción',
        });
      }

      if (esPlaceholder(datos.VAPID_PUBLIC_KEY) || esPlaceholder(datos.VAPID_PRIVATE_KEY)) {
        contexto.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['VAPID_PUBLIC_KEY'],
          message: 'Las claves VAPID no pueden usar valores placeholder en producción',
        });
      }

      if (datos.CLAVE_MAESTRO && esPlaceholder(datos.CLAVE_MAESTRO)) {
        contexto.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['CLAVE_MAESTRO'],
          message: 'CLAVE_MAESTRO no puede usar un valor placeholder en producción',
        });
      }

      if (!datos.FRONTEND_URL.startsWith('https://') || /localhost|127\.0\.0\.1/.test(datos.FRONTEND_URL)) {
        contexto.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['FRONTEND_URL'],
          message: 'FRONTEND_URL debe usar HTTPS y no puede apuntar a localhost en producción',
        });
      }

      for (const origen of origenesPermitidos) {
        if (!origen.startsWith('https://') || /localhost|127\.0\.0\.1/.test(origen)) {
          contexto.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['FRONTEND_ORIGENES_PERMITIDOS'],
            message:
              'FRONTEND_ORIGENES_PERMITIDOS solo puede contener orígenes HTTPS públicos en producción',
          });
          break;
        }
      }
    }

    if (datos.EMAIL_REMITENTE && !z.string().email().safeParse(datos.EMAIL_REMITENTE).success) {
      contexto.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['EMAIL_REMITENTE'],
        message: 'EMAIL_REMITENTE debe ser un email válido',
      });
    }
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
