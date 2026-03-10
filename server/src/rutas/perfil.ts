import type { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import { prisma } from '../prismaCliente.js';
import { verificarJWT } from '../middleware/autenticacion.js';

const MIME_PERMITIDOS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const LIMITE_BYTES = 2 * 1024 * 1024; // 2 MB

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

      const { nombre, descripcion, direccion, telefono, emailContacto, colorPrimario } = solicitud.body;

      // Validar formato de color hexadecimal si se envía
      if (colorPrimario !== undefined && !/^#[0-9A-Fa-f]{6}$/.test(colorPrimario)) {
        return respuesta.code(400).send({ error: 'colorPrimario debe ser un color hex válido (#RRGGBB)' });
      }

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
        return respuesta.code(400).send({ error: 'Solo se aceptan imágenes JPG, PNG o WebP' });
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

      const nombreArchivo = `estudio-${id}.${extension}`;
      fs.writeFileSync(path.join(dir, nombreArchivo), buffer);

      const logoUrl = `/uploads/logos/${nombreArchivo}`;
      await prisma.estudio.update({ where: { id }, data: { logoUrl } });

      return respuesta.code(201).send({ datos: { logoUrl } });
    },
  );
}
