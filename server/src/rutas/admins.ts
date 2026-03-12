import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { prisma } from '../prismaCliente.js';
import { esEmailAdminProtegido, verificarJWT } from '../middleware/autenticacion.js';
import { requierePermiso } from '../middleware/verificarPermiso.js';
import { registrarAuditoria } from '../utils/auditoria.js';

function esAdminProtegido(admin: { email: string }): boolean {
  return esEmailAdminProtegido(admin.email);
}

async function obtenerAdminObjetivo(id: string) {
  return prisma.usuario.findUnique({
    where: { id },
    select: { id: true, email: true, nombre: true, rol: true, activo: true },
  });
}

function normalizarPermisos(
  permisos: {
    aprobarSalones?: boolean;
    gestionarPagos?: boolean;
    crearAdmins?: boolean;
    verAuditLog?: boolean;
    verMetricas?: boolean;
    suspenderSalones?: boolean;
    esMaestroTotal?: boolean;
  } | undefined,
) {
  const permisosBase = {
    aprobarSalones: permisos?.aprobarSalones ?? false,
    gestionarPagos: permisos?.gestionarPagos ?? false,
    crearAdmins: permisos?.crearAdmins ?? false,
    verAuditLog: permisos?.verAuditLog ?? false,
    verMetricas: permisos?.verMetricas ?? false,
    suspenderSalones: permisos?.suspenderSalones ?? false,
    esMaestroTotal: permisos?.esMaestroTotal ?? false,
  };

  if (permisosBase.esMaestroTotal) {
    return {
      aprobarSalones: true,
      gestionarPagos: true,
      crearAdmins: true,
      verAuditLog: true,
      verMetricas: true,
      suspenderSalones: true,
      esMaestroTotal: true,
    };
  }

  return permisosBase;
}

export async function rutasAdmins(servidor: FastifyInstance): Promise<void> {
  /**
   * GET /admin/admins — Lista todos los admins/maestros
   */
  servidor.get(
    '/admin/admins',
    { preHandler: [verificarJWT, requierePermiso('crearAdmins')] },
    async (_solicitud, respuesta) => {
      const admins = await prisma.usuario.findMany({
        where: { rol: 'maestro' },
        select: {
          id: true,
          email: true,
          nombre: true,
          activo: true,
          creadoEn: true,
          ultimoAcceso: true,
          permisos: {
            select: {
              aprobarSalones: true,
              gestionarPagos: true,
              crearAdmins: true,
              verAuditLog: true,
              verMetricas: true,
              suspenderSalones: true,
              esMaestroTotal: true,
            },
          },
        },
        orderBy: { creadoEn: 'asc' },
      });

      return respuesta.send({
        datos: admins.map((admin) => ({
          ...admin,
          protegido: esAdminProtegido(admin),
        })),
      });
    },
  );

  /**
   * POST /admin/admins — Crear nuevo admin
   */
  servidor.post<{
    Body: {
      email: string;
      nombre: string;
      contrasena: string;
      permisos?: {
        aprobarSalones?: boolean;
        gestionarPagos?: boolean;
        crearAdmins?: boolean;
        verAuditLog?: boolean;
        verMetricas?: boolean;
        suspenderSalones?: boolean;
        esMaestroTotal?: boolean;
      };
    };
  }>(
    '/admin/admins',
    { preHandler: [verificarJWT, requierePermiso('crearAdmins')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string };
      const { email, nombre, contrasena, permisos } = solicitud.body;

      if (!email || !nombre || !contrasena) {
        return respuesta.code(400).send({ error: 'email, nombre y contrasena son requeridos' });
      }

      const existente = await prisma.usuario.findUnique({
        where: { email: email.trim().toLowerCase() },
        select: { id: true },
      });

      if (existente) {
        return respuesta.code(409).send({ error: 'El correo ya está registrado' });
      }

      const hashContrasena = await bcrypt.hash(contrasena, 12);

      const nuevoAdmin = await prisma.usuario.create({
        data: {
          email: email.trim().toLowerCase(),
          nombre: nombre.trim(),
          hashContrasena,
          rol: 'maestro',
          activo: true,
          emailVerificado: true,
        },
      });

      await prisma.permisosMaestro.create({
        data: {
          usuarioId: nuevoAdmin.id,
          ...normalizarPermisos(permisos),
        },
      });

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'crear_admin',
        entidadTipo: 'usuario',
        entidadId: nuevoAdmin.id,
        detalles: { email: nuevoAdmin.email, nombre: nuevoAdmin.nombre },
        ip: solicitud.ip,
      });

      return respuesta.code(201).send({
        datos: { mensaje: 'Admin creado correctamente', id: nuevoAdmin.id },
      });
    },
  );

  /**
   * PUT /admin/admins/:id/permisos — Actualizar permisos de un admin
   */
  servidor.put<{
    Params: { id: string };
    Body: {
      aprobarSalones?: boolean;
      gestionarPagos?: boolean;
      crearAdmins?: boolean;
      verAuditLog?: boolean;
      verMetricas?: boolean;
      suspenderSalones?: boolean;
      esMaestroTotal?: boolean;
    };
  }>(
    '/admin/admins/:id/permisos',
    { preHandler: [verificarJWT, requierePermiso('crearAdmins')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string };
      const { id } = solicitud.params;

      const admin = await obtenerAdminObjetivo(id);

      if (!admin || admin.rol !== 'maestro') {
        return respuesta.code(404).send({ error: 'Admin no encontrado' });
      }

      if (id === payload.sub) {
        return respuesta.code(403).send({ error: 'No puedes modificar tu propia cuenta desde este panel.' });
      }

      if (esAdminProtegido(admin)) {
        return respuesta.code(403).send({ error: 'Este administrador no puede ser modificado ni eliminado.' });
      }

      const permisosActualizados = await prisma.permisosMaestro.upsert({
        where: { usuarioId: id },
        create: {
          usuarioId: id,
          ...normalizarPermisos(solicitud.body),
        },
        update: normalizarPermisos(solicitud.body),
      });

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'actualizar_permisos',
        entidadTipo: 'usuario',
        entidadId: id,
        detalles: solicitud.body as Record<string, unknown>,
        ip: solicitud.ip,
      });

      return respuesta.send({ datos: permisosActualizados });
    },
  );

  /**
   * PUT /admin/admins/:id/desactivar — Desactivar un admin
   */
  servidor.put<{ Params: { id: string } }>(
    '/admin/admins/:id/desactivar',
    { preHandler: [verificarJWT, requierePermiso('crearAdmins')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string };
      const { id } = solicitud.params;

      const admin = await obtenerAdminObjetivo(id);

      if (!admin || admin.rol !== 'maestro') {
        return respuesta.code(404).send({ error: 'Admin no encontrado' });
      }

      if (id === payload.sub) {
        return respuesta.code(403).send({ error: 'No puedes modificar tu propia cuenta desde este panel.' });
      }

      if (esAdminProtegido(admin)) {
        return respuesta.code(403).send({ error: 'Este administrador no puede ser modificado ni eliminado.' });
      }

      await prisma.usuario.update({
        where: { id },
        data: { activo: false },
      });

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'desactivar_admin',
        entidadTipo: 'usuario',
        entidadId: id,
        ip: solicitud.ip,
      });

      return respuesta.send({ datos: { mensaje: 'Admin desactivado correctamente' } });
    },
  );

  servidor.put<{ Params: { id: string } }>(
    '/admin/admins/:id/activar',
    { preHandler: [verificarJWT, requierePermiso('crearAdmins')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string };
      const { id } = solicitud.params;

      const admin = await obtenerAdminObjetivo(id);

      if (!admin || admin.rol !== 'maestro') {
        return respuesta.code(404).send({ error: 'Admin no encontrado' });
      }

      if (id === payload.sub) {
        return respuesta.code(403).send({ error: 'No puedes modificar tu propia cuenta desde este panel.' });
      }

      if (esAdminProtegido(admin)) {
        return respuesta.code(403).send({ error: 'Este administrador no puede ser modificado ni eliminado.' });
      }

      await prisma.usuario.update({
        where: { id },
        data: { activo: true },
      });

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'activar_admin',
        entidadTipo: 'usuario',
        entidadId: id,
        ip: solicitud.ip,
      });

      return respuesta.send({ datos: { mensaje: 'Admin activado correctamente' } });
    },
  );

  servidor.delete<{ Params: { id: string } }>(
    '/admin/admins/:id',
    { preHandler: [verificarJWT, requierePermiso('crearAdmins')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string };
      const { id } = solicitud.params;

      const admin = await obtenerAdminObjetivo(id);

      if (!admin || admin.rol !== 'maestro') {
        return respuesta.code(404).send({ error: 'Admin no encontrado' });
      }

      if (id === payload.sub) {
        return respuesta.code(403).send({ error: 'No puedes modificar tu propia cuenta desde este panel.' });
      }

      if (esAdminProtegido(admin)) {
        return respuesta.code(403).send({ error: 'Este administrador no puede ser modificado ni eliminado.' });
      }

      await prisma.usuario.delete({ where: { id } });

      return respuesta.send({ datos: { mensaje: 'Admin eliminado definitivamente' } });
    },
  );

  /**
   * GET /admin/admins/historial — Log de auditoría global
   */
  servidor.get<{ Querystring: { pagina?: string; limite?: string } }>(
    '/admin/admins/historial',
    { preHandler: [verificarJWT, requierePermiso('verAuditLog')] },
    async (solicitud, respuesta) => {
      const pagina = Math.max(1, parseInt(solicitud.query.pagina ?? '1'));
      const limite = Math.min(50, parseInt(solicitud.query.limite ?? '20'));
      const saltar = (pagina - 1) * limite;

      const [registros, total] = await Promise.all([
        prisma.auditLog.findMany({
          skip: saltar,
          take: limite,
          orderBy: { creadoEn: 'desc' },
          select: {
            id: true,
            accion: true,
            entidadTipo: true,
            entidadId: true,
            detalles: true,
            ip: true,
            creadoEn: true,
            usuario: { select: { nombre: true, email: true } },
          },
        }),
        prisma.auditLog.count(),
      ]);

      return respuesta.send({ datos: { registros, total, pagina, limite } });
    },
  );
}

