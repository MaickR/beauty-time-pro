import type { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { z } from 'zod';
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

      const estudio = await prisma.estudio.findUnique({
        where: { id },
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          direccion: true,
          telefono: true,
          emailContacto: true,
          plan: true,
          colorPrimario: true,
          logoUrl: true,
        },
      });
      if (!estudio) return respuesta.code(404).send({ error: 'Estudio no encontrado' });

      return respuesta.send({ datos: estudio });
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

      const estudio = await prisma.estudio.update({
        where: { id },
        data: {
          ...(nombre !== undefined && { nombre }),
          ...(descripcion !== undefined && { descripcion }),
          ...(direccion !== undefined && { direccion }),
          ...(telefono !== undefined && { telefono }),
          ...(emailContacto !== undefined && { emailContacto }),
          ...(colorPrimario !== undefined && { colorPrimario }),
        },
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          direccion: true,
          telefono: true,
          emailContacto: true,
          plan: true,
          colorPrimario: true,
          logoUrl: true,
        },
      });

      return respuesta.send({ datos: estudio });
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
