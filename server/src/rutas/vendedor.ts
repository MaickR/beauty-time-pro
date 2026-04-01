import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../prismaCliente.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import { obtenerMensajeValidacion, textoSchema, telefonoSchema } from '../lib/validacion.js';

// ─── Helpers ─────────────────────────────────────────────────────────────
function soloVendedor(payload: { rol: string }): boolean {
  return payload.rol === 'vendedor';
}

// ─── Schemas ─────────────────────────────────────────────────────────────
const esquemaPreregistro = z.object({
  nombreSalon: textoSchema('nombreSalon', 120),
  propietario: textoSchema('propietario', 120),
  emailPropietario: z.string().trim().max(120).email('Email inválido'),
  telefonoPropietario: telefonoSchema,
  pais: z.enum(['Mexico', 'Colombia']),
  direccion: textoSchema('direccion', 180).optional().transform((v) => v ?? null),
  descripcion: z.string().trim().max(500).optional().transform((v) => v ?? null),
  categorias: z.string().trim().max(240).optional().transform((v) => v ?? null),
  plan: z.enum(['STANDARD', 'PRO']).optional().default('STANDARD'),
  notas: z.string().trim().max(500).optional().transform((v) => v ?? null),
});

// ─── Plugin de rutas ─────────────────────────────────────────────────────
export async function rutasVendedor(servidor: FastifyInstance) {
  /**
   * GET /vendedor/mis-preregistros — Lista los preregistros creados por el vendedor
   */
  servidor.get(
    '/vendedor/mis-preregistros',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string };
      if (!soloVendedor(payload)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const preregistros = await prisma.preregistroSalon.findMany({
        where: { vendedorId: payload.sub },
        orderBy: { creadoEn: 'desc' },
        select: {
          id: true,
          nombreSalon: true,
          propietario: true,
          emailPropietario: true,
          telefonoPropietario: true,
          pais: true,
          direccion: true,
          categorias: true,
          plan: true,
          estado: true,
          motivoRechazo: true,
          estudioCreadoId: true,
          notas: true,
          creadoEn: true,
        },
      });

      return respuesta.send({ datos: preregistros });
    },
  );

  /**
   * POST /vendedor/preregistro — Crea un nuevo preregistro de salón
   */
  servidor.post<{
    Body: {
      nombreSalon: string;
      propietario: string;
      emailPropietario: string;
      telefonoPropietario: string;
      pais: string;
      direccion?: string;
      descripcion?: string;
      categorias?: string;
      plan?: string;
      notas?: string;
    };
  }>(
    '/vendedor/preregistro',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string };
      if (!soloVendedor(payload)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const resultado = esquemaPreregistro.safeParse(solicitud.body);
      if (!resultado.success) {
        return respuesta.code(400).send({ error: obtenerMensajeValidacion(resultado.error) });
      }

      const datos = resultado.data;

      // Verificar que no exista un preregistro pendiente con el mismo email
      const existente = await prisma.preregistroSalon.findFirst({
        where: {
          emailPropietario: datos.emailPropietario.toLowerCase(),
          estado: 'pendiente',
        },
      });
      if (existente) {
        return respuesta.code(409).send({
          error: 'There is already a pending pre-registration with this email.',
        });
      }

      const preregistro = await prisma.preregistroSalon.create({
        data: {
          vendedorId: payload.sub,
          nombreSalon: datos.nombreSalon,
          propietario: datos.propietario,
          emailPropietario: datos.emailPropietario.toLowerCase(),
          telefonoPropietario: datos.telefonoPropietario,
          pais: datos.pais,
          direccion: datos.direccion,
          descripcion: datos.descripcion,
          categorias: datos.categorias,
          plan: datos.plan,
          notas: datos.notas,
        },
      });

      return respuesta.code(201).send({
        datos: {
          id: preregistro.id,
          nombreSalon: preregistro.nombreSalon,
          estado: preregistro.estado,
        },
      });
    },
  );

  /**
   * GET /vendedor/mis-salones — Salones asociados al vendedor (aprobados/activos)
   */
  servidor.get(
    '/vendedor/mis-salones',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string };
      if (!soloVendedor(payload)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const salones = await prisma.estudio.findMany({
        where: { vendedorId: payload.sub },
        select: {
          id: true,
          nombre: true,
          propietario: true,
          plan: true,
          pais: true,
          estado: true,
          activo: true,
          inicioSuscripcion: true,
          fechaVencimiento: true,
          creadoEn: true,
          _count: { select: { reservas: true } },
        },
        orderBy: { creadoEn: 'desc' },
      });

      return respuesta.send({
        datos: salones.map((s) => ({
          id: s.id,
          nombre: s.nombre,
          propietario: s.propietario,
          plan: s.plan,
          pais: s.pais,
          estado: s.estado,
          activo: s.activo,
          inicioSuscripcion: s.inicioSuscripcion,
          fechaVencimiento: s.fechaVencimiento,
          totalReservas: s._count.reservas,
          creadoEn: s.creadoEn.toISOString(),
        })),
      });
    },
  );

  /**
   * GET /vendedor/resumen — Métricas rápidas del vendedor
   */
  servidor.get(
    '/vendedor/resumen',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string };
      if (!soloVendedor(payload)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const [totalPreregistros, pendientes, aprobados, rechazados, totalSalones, salonesActivos] =
        await Promise.all([
          prisma.preregistroSalon.count({ where: { vendedorId: payload.sub } }),
          prisma.preregistroSalon.count({ where: { vendedorId: payload.sub, estado: 'pendiente' } }),
          prisma.preregistroSalon.count({ where: { vendedorId: payload.sub, estado: 'aprobado' } }),
          prisma.preregistroSalon.count({ where: { vendedorId: payload.sub, estado: 'rechazado' } }),
          prisma.estudio.count({ where: { vendedorId: payload.sub } }),
          prisma.estudio.count({ where: { vendedorId: payload.sub, activo: true, estado: 'aprobado' } }),
        ]);

      return respuesta.send({
        datos: {
          totalPreregistros,
          pendientes,
          aprobados,
          rechazados,
          totalSalones,
          salonesActivos,
        },
      });
    },
  );
}
