import type { FastifyInstance } from 'fastify';
import crypto from 'node:crypto';
import { prisma } from '../prismaCliente.js';
import { esEmailAdminProtegido, verificarJWT } from '../middleware/autenticacion.js';
import { requierePermiso } from '../middleware/verificarPermiso.js';
import { revocarSesionesPorSujeto } from '../lib/sesionesAuth.js';
import { registrarAuditoria } from '../utils/auditoria.js';
import { esEmailColaboradorValido } from '../utils/validarEmail.js';
import { generarHashContrasena } from '../utils/contrasenas.js';

const ROLES_COLABORADOR = ['maestro', 'supervisor', 'vendedor'] as const;
type RolColaborador = (typeof ROLES_COLABORADOR)[number];

function esRolColaboradorValido(valor: string): valor is RolColaborador {
  return (ROLES_COLABORADOR as readonly string[]).includes(valor);
}

function esAdminProtegido(admin: { email: string }): boolean {
  return esEmailAdminProtegido(admin.email);
}

function limpiarNombreColaborador(valor: string): string {
  return valor.normalize('NFC').replace(/[^\p{L}\p{M}\s'’-]/gu, '').replace(/\s+/g, ' ').trim();
}

function esNombreColaboradorValido(valor: string): boolean {
  return /^[\p{L}\p{M}\s'’-]{2,}$/u.test(limpiarNombreColaborador(valor));
}

async function obtenerColaboradorObjetivo(id: string) {
  return prisma.usuario.findUnique({
    where: { id },
    select: { id: true, email: true, nombre: true, rol: true, activo: true },
  });
}

/** Genera una contraseña segura con crypto */
export function generarContrasenaSegura(longitud = 16): string {
  const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%&*';
  const bytes = crypto.randomBytes(longitud);
  let resultado = '';
  for (let i = 0; i < longitud; i++) {
    resultado += caracteres[bytes[i]! % caracteres.length];
  }
  return resultado;
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

function normalizarPermisosSupervisor(
  permisosSupervisor:
    | {
        verTotalSalones?: boolean;
        verControlSalones?: boolean;
        verReservas?: boolean;
        verVentas?: boolean;
        verDirectorio?: boolean;
        editarDirectorio?: boolean;
        verControlCobros?: boolean;
        accionRecordatorio?: boolean;
        accionRegistroPago?: boolean;
        accionSuspension?: boolean;
        activarSalones?: boolean;
        verPreregistros?: boolean;
      }
    | undefined,
) {
  return {
    verTotalSalones: permisosSupervisor?.verTotalSalones ?? false,
    verControlSalones: permisosSupervisor?.verControlSalones ?? false,
    verReservas: permisosSupervisor?.verReservas ?? false,
    verVentas: permisosSupervisor?.verVentas ?? false,
    verDirectorio: permisosSupervisor?.verDirectorio ?? false,
    editarDirectorio: permisosSupervisor?.editarDirectorio ?? false,
    verControlCobros: permisosSupervisor?.verControlCobros ?? false,
    accionRecordatorio: permisosSupervisor?.accionRecordatorio ?? false,
    accionRegistroPago: permisosSupervisor?.accionRegistroPago ?? false,
    accionSuspension: permisosSupervisor?.accionSuspension ?? false,
    activarSalones: permisosSupervisor?.activarSalones ?? false,
    verPreregistros: permisosSupervisor?.verPreregistros ?? false,
  };
}

export async function rutasAdmins(servidor: FastifyInstance): Promise<void> {
  /**
   * GET /admin/admins — Lista todos los colaboradores (admins, supervisores, vendedores)
   */
  servidor.get(
    '/admin/admins',
    { preHandler: [verificarJWT, requierePermiso('crearAdmins')] },
    async (_solicitud, respuesta) => {
      const colaboradores = await prisma.usuario.findMany({
        where: { rol: { in: ['maestro', 'supervisor', 'vendedor'] } },
        select: {
          id: true,
          email: true,
          nombre: true,
          rol: true,
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
          permisosSupervisor: {
            select: {
              verTotalSalones: true,
              verControlSalones: true,
              verReservas: true,
              verVentas: true,
              verDirectorio: true,
              editarDirectorio: true,
              verControlCobros: true,
              accionRecordatorio: true,
              accionRegistroPago: true,
              accionSuspension: true,
              activarSalones: true,
              verPreregistros: true,
            },
          },
        },
        orderBy: [{ activo: 'desc' }, { creadoEn: 'asc' }],
      });

      return respuesta.send({
        datos: colaboradores.map((col) => ({
          ...col,
          protegido: esAdminProtegido(col),
        })),
      });
    },
  );

  /**
   * POST /admin/admins — Crear nuevo colaborador (admin, supervisor o vendedor)
   */
  servidor.post<{
    Body: {
      email: string;
      nombre: string;
      contrasena: string;
      cargo: string;
      permisos?: {
        aprobarSalones?: boolean;
        gestionarPagos?: boolean;
        crearAdmins?: boolean;
        verAuditLog?: boolean;
        verMetricas?: boolean;
        suspenderSalones?: boolean;
        esMaestroTotal?: boolean;
      };
      permisosSupervisor?: {
        verTotalSalones?: boolean;
        verControlSalones?: boolean;
        verReservas?: boolean;
        verVentas?: boolean;
        verDirectorio?: boolean;
        editarDirectorio?: boolean;
        verControlCobros?: boolean;
        accionRecordatorio?: boolean;
        accionRegistroPago?: boolean;
        accionSuspension?: boolean;
        activarSalones?: boolean;
        verPreregistros?: boolean;
      };
    };
  }>(
    '/admin/admins',
    { preHandler: [verificarJWT, requierePermiso('crearAdmins')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string };
      const { email, nombre, contrasena, cargo, permisos, permisosSupervisor } = solicitud.body;

      if (!email || !nombre || !contrasena) {
        return respuesta.code(400).send({ error: 'email, nombre y contrasena son requeridos' });
      }

      if (!esNombreColaboradorValido(nombre)) {
        return respuesta.code(400).send({ error: 'El nombre solo admite letras y espacios' });
      }

      if (!esEmailColaboradorValido(email)) {
        return respuesta.code(400).send({ error: 'El correo no es válido o pertenece a un dominio temporal' });
      }

      if (!cargo || !esRolColaboradorValido(cargo)) {
        return respuesta.code(400).send({ error: 'El cargo debe ser: maestro, supervisor o vendedor' });
      }

      const existente = await prisma.usuario.findUnique({
        where: { email: email.trim().toLowerCase() },
        select: { id: true },
      });

      if (existente) {
        return respuesta.code(409).send({ error: 'El correo ya está registrado' });
      }

      const hashContrasena = await generarHashContrasena(contrasena);

      const nuevoColaborador = await prisma.usuario.create({
        data: {
          email: email.trim().toLowerCase(),
          nombre: limpiarNombreColaborador(nombre),
          hashContrasena,
          rol: cargo,
          activo: true,
          emailVerificado: true,
        },
      });

      // Crear permisos según el cargo
      if (cargo === 'maestro') {
        await prisma.permisosMaestro.create({
          data: {
            usuarioId: nuevoColaborador.id,
            ...normalizarPermisos(permisos),
          },
        });
      } else if (cargo === 'supervisor' && permisosSupervisor) {
        await prisma.permisosSupervisor.create({
          data: {
            usuarioId: nuevoColaborador.id,
            ...normalizarPermisosSupervisor(permisosSupervisor),
          },
        });
      }
      // Vendedor no tiene permisos granulares

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'crear_colaborador',
        entidadTipo: 'usuario',
        entidadId: nuevoColaborador.id,
        detalles: { email: nuevoColaborador.email, nombre: nuevoColaborador.nombre, cargo },
        ip: solicitud.ip,
      });

      return respuesta.code(201).send({
        datos: { mensaje: 'Colaborador creado correctamente', id: nuevoColaborador.id },
      });
    },
  );

  servidor.put<{
    Params: { id: string };
    Body: {
      email?: string;
      nombre?: string;
      contrasena?: string;
      cargo?: string;
      permisos?: {
        aprobarSalones?: boolean;
        gestionarPagos?: boolean;
        crearAdmins?: boolean;
        verAuditLog?: boolean;
        verMetricas?: boolean;
        suspenderSalones?: boolean;
        esMaestroTotal?: boolean;
      };
      permisosSupervisor?: {
        verTotalSalones?: boolean;
        verControlSalones?: boolean;
        verReservas?: boolean;
        verVentas?: boolean;
        verDirectorio?: boolean;
        editarDirectorio?: boolean;
        verControlCobros?: boolean;
        accionRecordatorio?: boolean;
        accionRegistroPago?: boolean;
        accionSuspension?: boolean;
        activarSalones?: boolean;
        verPreregistros?: boolean;
      };
    };
  }>(
    '/admin/admins/:id',
    { preHandler: [verificarJWT, requierePermiso('crearAdmins')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string };
      const { id } = solicitud.params;
      const { email, nombre, contrasena, cargo, permisos, permisosSupervisor } = solicitud.body;

      const colaborador = await prisma.usuario.findUnique({
        where: { id },
        select: {
          id: true,
          email: true,
          nombre: true,
          rol: true,
          activo: true,
        },
      });

      if (!colaborador || !esRolColaboradorValido(colaborador.rol)) {
        return respuesta.code(404).send({ error: 'Colaborador no encontrado' });
      }

      if (id === payload.sub) {
        return respuesta.code(403).send({ error: 'No puedes modificar tu propia cuenta desde este panel.' });
      }

      if (esAdminProtegido(colaborador)) {
        return respuesta.code(403).send({ error: 'Este administrador no puede ser modificado ni eliminado.' });
      }

      const emailNormalizado = email?.trim().toLowerCase();
      const cargoNormalizado = cargo?.trim();
      const siguienteCargo =
        cargoNormalizado && esRolColaboradorValido(cargoNormalizado)
          ? cargoNormalizado
          : colaborador.rol;

      if (cargoNormalizado && !esRolColaboradorValido(cargoNormalizado)) {
        return respuesta.code(400).send({ error: 'El cargo debe ser: maestro, supervisor o vendedor' });
      }

      if (emailNormalizado && emailNormalizado !== colaborador.email) {
        if (!esEmailColaboradorValido(emailNormalizado)) {
          return respuesta.code(400).send({ error: 'El correo no es válido o pertenece a un dominio temporal' });
        }

        const existente = await prisma.usuario.findUnique({
          where: { email: emailNormalizado },
          select: { id: true },
        });

        if (existente && existente.id !== colaborador.id) {
          return respuesta.code(409).send({ error: 'El correo ya está registrado' });
        }
      }

      if (contrasena && contrasena.length < 8) {
        return respuesta.code(400).send({ error: 'La contraseña debe tener al menos 8 caracteres' });
      }

      const actualizacionUsuario: Record<string, unknown> = {};
      if (typeof nombre === 'string' && nombre.trim()) {
        if (!esNombreColaboradorValido(nombre)) {
          return respuesta.code(400).send({ error: 'El nombre solo admite letras y espacios' });
        }

        actualizacionUsuario['nombre'] = limpiarNombreColaborador(nombre);
      }
      if (emailNormalizado) {
        actualizacionUsuario['email'] = emailNormalizado;
      }
      if (cargoNormalizado && cargoNormalizado !== colaborador.rol) {
        actualizacionUsuario['rol'] = cargoNormalizado;
      }
      if (contrasena) {
        actualizacionUsuario['hashContrasena'] = await generarHashContrasena(contrasena);
      }

      await prisma.$transaction(async (tx) => {
        if (Object.keys(actualizacionUsuario).length > 0) {
          await tx.usuario.update({ where: { id }, data: actualizacionUsuario });
        }

        if (siguienteCargo === 'maestro') {
          if (colaborador.rol !== 'maestro' || permisos !== undefined) {
            await tx.permisosMaestro.upsert({
              where: { usuarioId: id },
              create: { usuarioId: id, ...normalizarPermisos(permisos) },
              update: normalizarPermisos(permisos),
            });
          }
          await tx.permisosSupervisor.deleteMany({ where: { usuarioId: id } });
        } else if (siguienteCargo === 'supervisor') {
          if (colaborador.rol !== 'supervisor' || permisosSupervisor !== undefined) {
            await tx.permisosSupervisor.upsert({
              where: { usuarioId: id },
              create: { usuarioId: id, ...normalizarPermisosSupervisor(permisosSupervisor) },
              update: normalizarPermisosSupervisor(permisosSupervisor),
            });
          }
          await tx.permisosMaestro.deleteMany({ where: { usuarioId: id } });
        } else {
          await tx.permisosMaestro.deleteMany({ where: { usuarioId: id } });
          await tx.permisosSupervisor.deleteMany({ where: { usuarioId: id } });
        }
      });

      await revocarSesionesPorSujeto('usuario', id, 'colaborador_actualizado');

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'actualizar_colaborador',
        entidadTipo: 'usuario',
        entidadId: id,
        detalles: {
          antes: {
            email: colaborador.email,
            nombre: colaborador.nombre,
            rol: colaborador.rol,
          },
          despues: {
            email: emailNormalizado ?? colaborador.email,
            nombre: typeof nombre === 'string' && nombre.trim() ? nombre.trim() : colaborador.nombre,
            rol: siguienteCargo,
          },
          sesionRevocada: true,
        },
        ip: solicitud.ip,
      });

      return respuesta.send({ datos: { mensaje: 'Colaborador actualizado correctamente' } });
    },
  );

  /**
   * PUT /admin/admins/:id/permisos — Actualizar permisos de un colaborador
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
      permisosSupervisor?: {
        verTotalSalones?: boolean;
        verControlSalones?: boolean;
        verReservas?: boolean;
        verVentas?: boolean;
        verDirectorio?: boolean;
        editarDirectorio?: boolean;
        verControlCobros?: boolean;
        accionRecordatorio?: boolean;
        accionRegistroPago?: boolean;
        accionSuspension?: boolean;
        activarSalones?: boolean;
        verPreregistros?: boolean;
      };
    };
  }>(
    '/admin/admins/:id/permisos',
    { preHandler: [verificarJWT, requierePermiso('crearAdmins')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string };
      const { id } = solicitud.params;

      const colaborador = await obtenerColaboradorObjetivo(id);

      if (!colaborador || !esRolColaboradorValido(colaborador.rol)) {
        return respuesta.code(404).send({ error: 'Colaborador no encontrado' });
      }

      if (id === payload.sub) {
        return respuesta.code(403).send({ error: 'No puedes modificar tu propia cuenta desde este panel.' });
      }

      if (esAdminProtegido(colaborador)) {
        return respuesta.code(403).send({ error: 'Este administrador no puede ser modificado ni eliminado.' });
      }

      if (colaborador.rol === 'maestro') {
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

        await revocarSesionesPorSujeto('usuario', id, 'permisos_actualizados');

        return respuesta.send({ datos: permisosActualizados });
      }

      if (colaborador.rol === 'supervisor' && solicitud.body.permisosSupervisor) {
        const ps = solicitud.body.permisosSupervisor;
        const permisosActualizados = await prisma.permisosSupervisor.upsert({
          where: { usuarioId: id },
          create: {
            usuarioId: id,
            ...normalizarPermisosSupervisor(ps),
          },
          update: normalizarPermisosSupervisor(ps),
        });

        await registrarAuditoria({
          usuarioId: payload.sub,
          accion: 'actualizar_permisos',
          entidadTipo: 'usuario',
          entidadId: id,
          detalles: solicitud.body.permisosSupervisor as Record<string, unknown>,
          ip: solicitud.ip,
        });

        await revocarSesionesPorSujeto('usuario', id, 'permisos_actualizados');

        return respuesta.send({ datos: permisosActualizados });
      }

      return respuesta.send({ datos: { mensaje: 'Sin cambios de permisos para este cargo' } });
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

      const colaborador = await obtenerColaboradorObjetivo(id);

      if (!colaborador || !esRolColaboradorValido(colaborador.rol)) {
        return respuesta.code(404).send({ error: 'Colaborador no encontrado' });
      }

      if (id === payload.sub) {
        return respuesta.code(403).send({ error: 'No puedes modificar tu propia cuenta desde este panel.' });
      }

      if (esAdminProtegido(colaborador)) {
        return respuesta.code(403).send({ error: 'Este administrador no puede ser modificado ni eliminado.' });
      }

      await prisma.usuario.update({
        where: { id },
        data: { activo: false },
      });

      await revocarSesionesPorSujeto('usuario', id, 'colaborador_desactivado');

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'desactivar_colaborador',
        entidadTipo: 'usuario',
        entidadId: id,
        detalles: { cargo: colaborador.rol },
        ip: solicitud.ip,
      });

      return respuesta.send({ datos: { mensaje: 'Colaborador desactivado correctamente' } });
    },
  );

  servidor.put<{ Params: { id: string } }>(
    '/admin/admins/:id/activar',
    { preHandler: [verificarJWT, requierePermiso('crearAdmins')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string };
      const { id } = solicitud.params;

      const colaborador = await obtenerColaboradorObjetivo(id);

      if (!colaborador || !esRolColaboradorValido(colaborador.rol)) {
        return respuesta.code(404).send({ error: 'Colaborador no encontrado' });
      }

      if (id === payload.sub) {
        return respuesta.code(403).send({ error: 'No puedes modificar tu propia cuenta desde este panel.' });
      }

      if (esAdminProtegido(colaborador)) {
        return respuesta.code(403).send({ error: 'Este administrador no puede ser modificado ni eliminado.' });
      }

      await prisma.usuario.update({
        where: { id },
        data: { activo: true },
      });

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'activar_colaborador',
        entidadTipo: 'usuario',
        entidadId: id,
        detalles: { cargo: colaborador.rol },
        ip: solicitud.ip,
      });

      return respuesta.send({ datos: { mensaje: 'Colaborador activado correctamente' } });
    },
  );

  servidor.delete<{ Params: { id: string } }>(
    '/admin/admins/:id',
    { preHandler: [verificarJWT, requierePermiso('crearAdmins')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string };
      const { id } = solicitud.params;

      const colaborador = await obtenerColaboradorObjetivo(id);

      if (!colaborador || !esRolColaboradorValido(colaborador.rol)) {
        return respuesta.code(404).send({ error: 'Colaborador no encontrado' });
      }

      if (id === payload.sub) {
        return respuesta.code(403).send({ error: 'No puedes modificar tu propia cuenta desde este panel.' });
      }

      if (esAdminProtegido(colaborador)) {
        return respuesta.code(403).send({ error: 'Este administrador no puede ser modificado ni eliminado.' });
      }

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'desactivar_colaborador',
        entidadTipo: 'usuario',
        entidadId: id,
        detalles: {
          email: colaborador.email,
          nombre: colaborador.nombre,
          cargo: colaborador.rol,
          antes: { activo: colaborador.activo },
          despues: { activo: false },
          requestId: solicitud.id,
        },
        ip: solicitud.ip,
      });

      await prisma.usuario.update({
        where: { id },
        data: { activo: false },
      });

      await revocarSesionesPorSujeto('usuario', id, 'colaborador_desactivado_desde_panel');

      return respuesta.send({ datos: { mensaje: 'Colaborador desactivado correctamente' } });
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

