import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import type { FastifyInstance } from 'fastify';
import sharp from 'sharp';
import { prisma } from '../prismaCliente.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import { tieneAccesoAdministrativoEstudio } from '../lib/accesoEstudio.js';
import { MENSAJE_FUNCION_PRO, normalizarPlanEstudio } from '../lib/planes.js';
import { encolarCorreo } from '../lib/colaEmails.js';
import { registrarAuditoria } from '../utils/auditoria.js';
import { detectarTipoImagen } from '../utils/validarImagen.js';

const LIMITE_MENSAJES_ANUALES = 3;
const LIMITE_BYTES_IMAGEN = 2 * 1024 * 1024;
const MIME_IMAGEN_PERMITIDOS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

function obtenerAnioActual(): number {
  return new Date().getFullYear();
}

function dirImagenesMensajesMasivos(): string {
  return path.join(process.cwd(), 'uploads', 'mensajes-masivos');
}

export async function rutasMensajesMasivos(servidor: FastifyInstance): Promise<void> {
  /**
   * GET /estudio/:id/mensajes-masivos — listar mensajes y uso
   */
  servidor.get<{ Params: { id: string } }>(
    '/estudio/:id/mensajes-masivos',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const { id } = solicitud.params;

      if (!tieneAccesoAdministrativoEstudio(payload, id)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const estudio = await prisma.estudio.findUnique({
        where: { id },
        select: { plan: true, mensajesMasivosUsados: true, mensajesMasivosExtra: true },
      });

      if (!estudio) {
        return respuesta.code(404).send({ error: 'Estudio no encontrado' });
      }

      if (normalizarPlanEstudio(estudio.plan) !== 'PRO') {
        return respuesta.code(403).send({ error: MENSAJE_FUNCION_PRO });
      }

      const mensajes = await prisma.mensajeMasivo.findMany({
        where: { estudioId: id },
        orderBy: { creadoEn: 'desc' },
      });

      const limiteTotal = LIMITE_MENSAJES_ANUALES + estudio.mensajesMasivosExtra;

      return respuesta.send({
        datos: {
          mensajes,
          usados: estudio.mensajesMasivosUsados,
          limite: limiteTotal,
          extra: estudio.mensajesMasivosExtra,
        },
      });
    },
  );

  servidor.post<{ Params: { id: string } }>(
    '/estudio/:id/mensajes-masivos/imagen',
    {
      preHandler: verificarJWT,
      config: {
        rateLimit: {
          max: 20,
          timeWindow: '1 hour',
          errorResponseBuilder: () => ({
            error: 'Demasiados uploads. Espera 1 hora.',
          }),
        },
      },
    },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const { id } = solicitud.params;

      if (!tieneAccesoAdministrativoEstudio(payload, id)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const estudio = await prisma.estudio.findUnique({
        where: { id },
        select: { plan: true },
      });

      if (!estudio) {
        return respuesta.code(404).send({ error: 'Estudio no encontrado' });
      }

      if (normalizarPlanEstudio(estudio.plan) !== 'PRO') {
        return respuesta.code(403).send({ error: MENSAJE_FUNCION_PRO });
      }

      const archivo = await solicitud.file({ limits: { fileSize: LIMITE_BYTES_IMAGEN } });
      if (!archivo) {
        return respuesta.code(400).send({ error: 'No se recibió ninguna imagen' });
      }

      if (!MIME_IMAGEN_PERMITIDOS[archivo.mimetype]) {
        archivo.file.resume();
        return respuesta.code(400).send({ error: 'Solo se aceptan imágenes JPG o PNG' });
      }

      let buffer: Buffer;
      try {
        buffer = await archivo.toBuffer();
      } catch {
        return respuesta.code(400).send({ error: 'La imagen supera el límite de 2 MB' });
      }

      if (buffer.byteLength > LIMITE_BYTES_IMAGEN) {
        return respuesta.code(400).send({ error: 'La imagen supera el límite de 2 MB' });
      }

      const extensionSegura = detectarTipoImagen(buffer);
      if (!extensionSegura) {
        return respuesta.code(400).send({ error: 'El archivo no contiene una imagen válida' });
      }

      const dir = dirImagenesMensajesMasivos();
      fs.mkdirSync(dir, { recursive: true });

      const nombreArchivo = `mensaje-${id}-${randomUUID()}.jpg`;
      const imagenOptimizada = await sharp(buffer)
        .resize(1200, 1200, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 82, progressive: true })
        .toBuffer();

      fs.writeFileSync(path.join(dir, nombreArchivo), imagenOptimizada);

      return respuesta.code(201).send({
        datos: {
          imagenUrl: `/uploads/mensajes-masivos/${nombreArchivo}`,
        },
      });
    },
  );

  /**
   * POST /estudio/:id/mensajes-masivos — crear y enviar mensaje masivo
   */
  servidor.post<{
    Params: { id: string };
    Body: {
      titulo: string;
      texto: string;
      imagenUrl?: string;
    };
  }>(
    '/estudio/:id/mensajes-masivos',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null; sub: string };
      const { id } = solicitud.params;

      if (!tieneAccesoAdministrativoEstudio(payload, id)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const estudio = await prisma.estudio.findUnique({
        where: { id },
        select: {
          plan: true,
          nombre: true,
          mensajesMasivosUsados: true,
          mensajesMasivosExtra: true,
        },
      });

      if (!estudio) {
        return respuesta.code(404).send({ error: 'Estudio no encontrado' });
      }

      if (normalizarPlanEstudio(estudio.plan) !== 'PRO') {
        return respuesta.code(403).send({ error: MENSAJE_FUNCION_PRO });
      }

      const limiteTotal = LIMITE_MENSAJES_ANUALES + estudio.mensajesMasivosExtra;

      if (estudio.mensajesMasivosUsados >= limiteTotal) {
        return respuesta.code(403).send({
          error: 'Has agotado tus mensajes masivos. Contacta a soporte para adquirir envíos adicionales.',
          codigo: 'LIMITE_MENSAJES_ALCANZADO',
        });
      }

      const { titulo, texto, imagenUrl } = solicitud.body;

      if (!titulo || titulo.trim().length === 0) {
        return respuesta.code(400).send({ error: 'El título es obligatorio' });
      }

      if (!texto || texto.trim().length === 0) {
        return respuesta.code(400).send({ error: 'El texto es obligatorio' });
      }

      if (texto.length > 200) {
        return respuesta.code(400).send({ error: 'El texto no puede superar 200 caracteres' });
      }

      // Obtener clientes con email del salón
      const clientes = await prisma.cliente.findMany({
        where: {
          estudioId: id,
          email: { not: null },
        },
        select: { email: true, nombre: true },
      });

      if (clientes.length === 0) {
        return respuesta.code(400).send({
          error: 'No hay clientes con correo electrónico registrado para enviar el mensaje.',
        });
      }

      const ahora = new Date();

      // Crear el registro del mensaje masivo
      const mensaje = await prisma.mensajeMasivo.create({
        data: {
          estudioId: id,
          titulo: titulo.trim(),
          texto: texto.trim(),
          imagenUrl: imagenUrl?.trim() || null,
          fechaEnvio: ahora,
          enviado: true,
        },
      });

      // Incrementar contador de uso
      await prisma.estudio.update({
        where: { id },
        data: { mensajesMasivosUsados: { increment: 1 } },
      });

      // Construir HTML del correo
      const htmlCorreo = construirHtmlMensajeMasivo({
        titulo: titulo.trim(),
        texto: texto.trim(),
        imagenUrl: imagenUrl?.trim(),
        nombreSalon: estudio.nombre,
      });

      // Encolar correos para cada cliente
      let encolados = 0;
      for (const cliente of clientes) {
        if (cliente.email) {
          await encolarCorreo({
            destinatario: cliente.email,
            asunto: `${estudio.nombre} — ${titulo.trim()}`,
            html: htmlCorreo,
            tipoEvento: 'mensaje_masivo',
            referenciaId: mensaje.id,
            claveUnica: `masivo_${mensaje.id}_${cliente.email}`,
          });
          encolados++;
        }
      }

      // Auditoría
      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'enviar_mensaje_masivo',
        entidadTipo: 'mensaje_masivo',
        entidadId: mensaje.id,
        detalles: {
          estudioId: id,
          titulo: titulo.trim(),
          destinatarios: encolados,
          anio: obtenerAnioActual(),
          usoActual: estudio.mensajesMasivosUsados + 1,
          limiteTotal,
        },
        ip: solicitud.ip,
      });

      return respuesta.send({
        datos: {
          mensaje: 'Mensaje masivo enviado correctamente',
          destinatarios: encolados,
          id: mensaje.id,
        },
      });
    },
  );
}

function construirHtmlMensajeMasivo(params: {
  titulo: string;
  texto: string;
  imagenUrl?: string;
  nombreSalon: string;
}): string {
  const { titulo, texto, imagenUrl, nombreSalon } = params;

  const imagenHtml = imagenUrl
    ? `<img src="${imagenUrl}" alt="${titulo}" style="max-width:100%;border-radius:8px;margin-bottom:16px;" />`
    : '';

  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
      <h2 style="color:#C2185B;margin-bottom:8px;">${titulo}</h2>
      ${imagenHtml}
      <p style="font-size:16px;line-height:1.5;color:#333;">${texto}</p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
      <p style="font-size:12px;color:#999;">Sent by ${nombreSalon}</p>
    </div>
  `;
}
