import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../prismaCliente.js';
import { verificarJWT } from '../middleware/autenticacion.js';

function generarContrasenaAleatoria(): string {
  const chars = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  // Garantizar al menos una mayúscula y un número
  result += 'ABCDEFGH'[Math.floor(Math.random() * 8)];
  result += '23456789'[Math.floor(Math.random() * 8)];
  for (let i = 0; i < 8; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export async function rutasAdmin(servidor: FastifyInstance): Promise<void> {
  /**
   * GET /admin/salones — lista todos los estudios con su usuario y último acceso
   */
  servidor.get(
    '/admin/salones',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const estudios = await prisma.estudio.findMany({
        include: {
          usuarios: {
            where: { rol: 'dueno' },
            select: { id: true, email: true, nombre: true, ultimoAcceso: true, activo: true },
            take: 1,
          },
        },
        orderBy: { creadoEn: 'asc' },
      });

      return respuesta.send({ datos: estudios });
    },
  );

  /**
   * POST /admin/salones — crea estudio + usuario dueño en transacción
   */
  servidor.post<{
    Body: {
      nombreSalon: string;
      nombreAdmin: string;
      email: string;
      contrasena: string;
      telefono?: string;
      pais?: string;
    };
  }>(
    '/admin/salones',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { nombreSalon, nombreAdmin, email, contrasena, telefono = '', pais = 'Mexico' } =
        solicitud.body;

      if (!nombreSalon || !nombreAdmin || !email || !contrasena) {
        return respuesta.code(400).send({
          error: 'Campos requeridos: nombreSalon, nombreAdmin, email, contrasena',
        });
      }

      const emailNorm = email.trim().toLowerCase();
      const existente = await prisma.usuario.findUnique({ where: { email: emailNorm } });
      if (existente) {
        return respuesta.code(409).send({ error: 'Ya existe un usuario con ese email' });
      }

      const hashContrasena = await bcrypt.hash(contrasena, 12);

      // Generar claves únicas automáticamente
      const BASE = nombreSalon.toUpperCase().replace(/\s+/g, '').slice(0, 8);
      const sufijo = crypto.randomBytes(3).toString('hex').toUpperCase();
      const claveDueno = `${BASE}${sufijo}`;
      const claveCliente = `${BASE}CLI${sufijo}`;

      const ahora = new Date();
      const vencimiento = new Date(ahora);
      vencimiento.setMonth(vencimiento.getMonth() + 1);

      const formatearFecha = (d: Date) => d.toISOString().split('T')[0]!;

      const diasSemana = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
      const horario = Object.fromEntries(
        diasSemana.map((dia) => [dia, { isOpen: dia !== 'Domingo', openTime: '09:00', closeTime: '19:00' }]),
      );

      const [estudio] = await prisma.$transaction(async (tx) => {
        const nuevoEstudio = await tx.estudio.create({
          data: {
            nombre: nombreSalon,
            propietario: nombreAdmin,
            telefono,
            pais,
            sucursales: [nombreSalon],
            claveDueno,
            claveCliente,
            inicioSuscripcion: formatearFecha(ahora),
            fechaVencimiento: formatearFecha(vencimiento),
            horario,
            servicios: [],
            serviciosCustom: [],
            festivos: [],
          },
        });

        const nuevoUsuario = await tx.usuario.create({
          data: {
            email: emailNorm,
            hashContrasena,
            nombre: nombreAdmin,
            rol: 'dueno',
            estudioId: nuevoEstudio.id,
          },
        });

        return [nuevoEstudio, nuevoUsuario];
      });

      return respuesta.code(201).send({ datos: estudio });
    },
  );

  /**
   * PUT /admin/salones/:id/suspender — activa o desactiva el acceso
   */
  servidor.put<{ Params: { id: string } }>(
    '/admin/salones/:id/suspender',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { id } = solicitud.params;

      const usuario = await prisma.usuario.findFirst({
        where: { estudioId: id, rol: 'dueno' },
      });

      if (!usuario) {
        return respuesta.code(404).send({ error: 'Usuario dueño no encontrado para este salón' });
      }

      const actualizado = await prisma.usuario.update({
        where: { id: usuario.id },
        data: { activo: !usuario.activo },
      });

      return respuesta.send({
        datos: { activo: actualizado.activo, mensaje: actualizado.activo ? 'Cuenta activada' : 'Cuenta suspendida' },
      });
    },
  );

  /**
   * PUT /admin/salones/:id/reset-contrasena — genera contraseña temporal y la devuelve
   */
  servidor.put<{ Params: { id: string } }>(
    '/admin/salones/:id/reset-contrasena',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { id } = solicitud.params;

      const usuario = await prisma.usuario.findFirst({
        where: { estudioId: id, rol: 'dueno' },
      });

      if (!usuario) {
        return respuesta.code(404).send({ error: 'Usuario dueño no encontrado para este salón' });
      }

      const contrasenaTemporal = generarContrasenaAleatoria();
      const nuevoHash = await bcrypt.hash(contrasenaTemporal, 12);

      await prisma.usuario.update({
        where: { id: usuario.id },
        data: { hashContrasena: nuevoHash },
      });

      // Se devuelve la contraseña en texto plano UNA sola vez — el frontend la muestra y no la almacena
      return respuesta.send({
        datos: { contrasenaTemporal, email: usuario.email },
      });
    },
  );
}
