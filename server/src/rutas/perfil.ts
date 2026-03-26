import type { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { z } from 'zod';
import type { Prisma } from '../generated/prisma/client.js';
import { construirSelectDesdeColumnas, obtenerColumnasTabla } from '../lib/compatibilidadEsquema.js';
import { normalizarPlanEstudio } from '../lib/planes.js';
import { prisma } from '../prismaCliente.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import { detectarTipoImagen } from '../utils/validarImagen.js';
import { colorHexSchema, emailOpcionalONuloSchema, obtenerMensajeValidacion, telefonoSchema, textoOpcionalONuloSchema, textoSchema } from '../lib/validacion.js';

const MIME_PERMITIDOS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};
const LIMITE_BYTES = 2 * 1024 * 1024; // 2 MB

const esquemaPerfil = z.object({
  nombre: textoSchema('nombre', 120).optional(),
  descripcion: textoOpcionalONuloSchema('descripcion', 500),
  direccion: textoOpcionalONuloSchema('direccion', 180),
  telefono: z.union([z.literal(''), telefonoSchema]).optional(),
  emailContacto: emailOpcionalONuloSchema('emailContacto'),
  colorPrimario: colorHexSchema.optional(),
}).strict().refine((datos) => Object.keys(datos).length > 0, {
  message: 'Debes enviar al menos un campo para actualizar',
});

function dirLogos(): string {
  return path.join(process.cwd(), 'uploads', 'logos');
}

function serializarPerfilCompat(
  estudio: Record<string, unknown> & { id: string },
): {
  id: string;
  nombre: string;
  descripcion: string | null;
  direccion: string | null;
  telefono: string;
  emailContacto: string | null;
  plan: 'STANDARD' | 'PRO';
  colorPrimario: string;
  logoUrl: string | null;
} {
  return {
    id: estudio.id,
    nombre: typeof estudio.nombre === 'string' ? estudio.nombre : '',
    descripcion: typeof estudio.descripcion === 'string' ? estudio.descripcion : null,
    direccion: typeof estudio.direccion === 'string' ? estudio.direccion : null,
    telefono: typeof estudio.telefono === 'string' ? estudio.telefono : '',
    emailContacto: typeof estudio.emailContacto === 'string' ? estudio.emailContacto : null,
    plan: normalizarPlanEstudio(typeof estudio.plan === 'string' ? estudio.plan : null),
    colorPrimario: typeof estudio.colorPrimario === 'string' ? estudio.colorPrimario : '#EC4899',
    logoUrl: typeof estudio.logoUrl === 'string' ? estudio.logoUrl : null,
  };
}

export async function rutasPerfil(servidor: FastifyInstance): Promise<void> {
  // GET /estudio/:id/perfil
  servidor.get<{ Params: { id: string } }>(
    '/estudio/:id/perfil',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const { id } = solicitud.params;
      if (payload.rol !== 'maestro' && payload.estudioId !== id) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const columnasEstudios = await obtenerColumnasTabla('estudios');
      const selectPerfil = construirSelectDesdeColumnas(columnasEstudios, [
        'id',
        'nombre',
        'descripcion',
        'direccion',
        'telefono',
        'emailContacto',
        'plan',
        'colorPrimario',
        'logoUrl',
      ]) as Prisma.EstudioSelect;

      const estudio = await prisma.estudio.findUnique({
        where: { id },
        select: selectPerfil,
      });
      if (!estudio) return respuesta.code(404).send({ error: 'Estudio no encontrado' });

      return respuesta.send({ datos: serializarPerfilCompat(estudio as Record<string, unknown> & { id: string }) });
    },
  );

  // PUT /estudio/:id/perfil
  servidor.put<{
    Params: { id: string };
    Body: {
      nombre?: string;
      descripcion?: string;
      direccion?: string;
      telefono?: string;
      emailContacto?: string;
      colorPrimario?: string;
    };
  }>(
    '/estudio/:id/perfil',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const { id } = solicitud.params;
      if (payload.rol !== 'maestro' && payload.estudioId !== id) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const resultado = esquemaPerfil.safeParse(solicitud.body);
      if (!resultado.success) {
        return respuesta.code(400).send({ error: obtenerMensajeValidacion(resultado.error) });
      }

      const { nombre, descripcion, direccion, telefono, emailContacto, colorPrimario } = resultado.data;

      const columnasEstudios = await obtenerColumnasTabla('estudios');
      const datosActualizacion: Prisma.EstudioUpdateInput = {
        ...(nombre !== undefined && columnasEstudios.has('nombre') && { nombre }),
        ...(descripcion !== undefined && columnasEstudios.has('descripcion') && { descripcion }),
        ...(direccion !== undefined && columnasEstudios.has('direccion') && { direccion }),
        ...(telefono !== undefined && columnasEstudios.has('telefono') && { telefono }),
        ...(emailContacto !== undefined && columnasEstudios.has('emailContacto') && { emailContacto }),
        ...(colorPrimario !== undefined && columnasEstudios.has('colorPrimario') && { colorPrimario }),
      };

      const selectPerfil = construirSelectDesdeColumnas(columnasEstudios, [
        'id',
        'nombre',
        'descripcion',
        'direccion',
        'telefono',
        'emailContacto',
        'plan',
        'colorPrimario',
        'logoUrl',
      ]) as Prisma.EstudioSelect;

      const estudio = await prisma.estudio.update({
        where: { id },
        data: datosActualizacion,
        select: selectPerfil,
      });

      return respuesta.send({ datos: serializarPerfilCompat(estudio as Record<string, unknown> & { id: string }) });
    },
  );

  // POST /estudio/:id/logo
  servidor.post<{ Params: { id: string } }>(
    '/estudio/:id/logo',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const { id } = solicitud.params;
      if (payload.rol !== 'maestro' && payload.estudioId !== id) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const archivo = await solicitud.file({ limits: { fileSize: LIMITE_BYTES } });
      if (!archivo) {
        return respuesta.code(400).send({ error: 'No se recibió ningún archivo' });
      }

      const extension = MIME_PERMITIDOS[archivo.mimetype];
      if (!extension) {
        archivo.file.resume();
        return respuesta.code(400).send({ error: 'Solo se aceptan imágenes JPG o PNG' });
      }

      let buffer: Buffer;
      try {
        buffer = await archivo.toBuffer();
      } catch {
        return respuesta.code(400).send({ error: 'El archivo supera el límite de 2 MB' });
      }

      if (buffer.byteLength > LIMITE_BYTES) {
        return respuesta.code(400).send({ error: 'El archivo supera el límite de 2 MB' });
      }

      const extensionSegura = detectarTipoImagen(buffer);
      if (!extensionSegura) {
        return respuesta.code(400).send({ error: 'El archivo no contiene una imagen válida' });
      }

      const dir = dirLogos();
      fs.mkdirSync(dir, { recursive: true });

      // Eliminar logo anterior del estudio si existe
      const estudioActual = await prisma.estudio.findUnique({
        where: { id },
        select: { logoUrl: true },
      });
      if (estudioActual?.logoUrl) {
        const rutaAnterior = path.join(process.cwd(), 'uploads', estudioActual.logoUrl.replace('/uploads/', ''));
        fs.rmSync(rutaAnterior, { force: true });
      }

      const nombreArchivo = `estudio-${id}.jpg`;
      const imagenOptimizada = await sharp(buffer)
        .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();
      fs.writeFileSync(path.join(dir, nombreArchivo), imagenOptimizada);

      const logoUrl = `/uploads/logos/${nombreArchivo}`;
      await prisma.estudio.update({ where: { id }, data: { logoUrl } });

      return respuesta.code(201).send({ datos: { logoUrl } });
    },
  );
}
