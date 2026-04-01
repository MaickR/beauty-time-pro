import type { FastifyInstance } from 'fastify';
import { prisma } from '../prismaCliente.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import { MENSAJE_FUNCION_PRO, normalizarPlanEstudio } from '../lib/planes.js';
import { encolarCorreo } from '../lib/colaEmails.js';
import { registrarAuditoria } from '../utils/auditoria.js';

const LIMITE_MENSAJES_ANUALES = 3;

function tieneAccesoAdminEstudio(payload: { rol: string; estudioId: string | null }, estudioId: string): boolean {
  return payload.rol === 'maestro' || (payload.rol === 'dueno' && payload.estudioId === estudioId);
}

function obtenerAnioActual(): number {
  return new Date().getFullYear();
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

      if (!tieneAccesoAdminEstudio(payload, id)) {
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

      if (!tieneAccesoAdminEstudio(payload, id)) {
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
