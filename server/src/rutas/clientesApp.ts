import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { z } from 'zod';
import NodeCache from 'node-cache';
import { env } from '../lib/env.js';
import { detectarTipoImagen } from '../utils/validarImagen.js';
import { resolverCategoriasSalon } from '../lib/categoriasSalon.js';
import { cacheSalonesPublicos } from '../lib/cache.js';
import { prisma } from '../prismaCliente.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import { obtenerSlotsDisponiblesBackend } from '../lib/programacion.js';
import { enviarEmailVerificacionCliente } from '../servicios/servicioEmail.js';
import { esEmailValido } from '../utils/validarEmail.js';
import { fechaIsoSchema, obtenerMensajeValidacion, telefonoSchema, textoSchema } from '../lib/validacion.js';

// Caché en memoria para listados de salones públicos — gestionado en lib/cache.ts
// (importado arriba)

const MIME_PERMITIDOS: Record<string, string> = {
  'image/jpg': 'jpg',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};
const LIMITE_BYTES = 2 * 1024 * 1024; // 2 MB

const esquemaBusquedaSalones = z.object({
  buscar: textoSchema('buscar', 80).optional(),
  categoria: textoSchema('categoria', 80).optional(),
  categorias: z.union([textoSchema('categorias', 240), z.array(textoSchema('categorias', 80))]).optional(),
  pais: z.enum(['Mexico', 'Colombia']).optional(),
});

const esquemaPerfilClienteApp = z.object({
  nombre: textoSchema('nombre', 80).optional(),
  apellido: textoSchema('apellido', 80).optional(),
  telefono: z.union([z.literal(''), telefonoSchema]).optional().transform((valor) => (valor === '' ? null : valor)),
  fechaNacimiento: fechaIsoSchema.optional(),
}).strict().refine((datos) => Object.keys(datos).length > 0, {
  message: 'Debes enviar al menos un campo para actualizar',
});

const esquemaActualizarEmailCliente = z.object({
  email: z.string().trim().max(120, 'El email no puede superar 120 caracteres').email('Email inválido'),
});

function dirAvatares(): string {
  return path.join(process.cwd(), 'uploads', 'avatares');
}

function soloClienteApp(payload: { rol: string; estudioId: string | null }): boolean {
  return payload.rol === 'cliente' && payload.estudioId === null;
}

function obtenerFiltroDemo() {
  return env.ENTORNO === 'development' || !env.DEMO_CLAVE_DUENO
    ? {}
    : { claveDueno: { not: env.DEMO_CLAVE_DUENO } };
}

function normalizarTexto(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function obtenerFechaHoyLocal(): string {
  const hoy = new Date();
  const compensacion = hoy.getTimezoneOffset();
  return new Date(hoy.getTime() - compensacion * 60 * 1000).toISOString().split('T')[0]!;
}

export async function rutasClientesApp(servidor: FastifyInstance): Promise<void> {
  // ─── GET /salones/publicos ───────────────────────────────────────────────
  servidor.get<{
    Querystring: { buscar?: string; categoria?: string; categorias?: string | string[]; pais?: 'Mexico' | 'Colombia' };
  }>(
    '/salones/publicos',
    async (solicitud, respuesta) => {
      const consulta = esquemaBusquedaSalones.safeParse(solicitud.query);
      if (!consulta.success) {
        return respuesta.code(400).send({ error: obtenerMensajeValidacion(consulta.error) });
      }

      const { buscar, categoria, categorias, pais } = consulta.data;
      const filtroDemo = obtenerFiltroDemo();
      const hoy = obtenerFechaHoyLocal();
      const categoriasEntrada = Array.isArray(categorias)
        ? categorias
        : typeof categorias === 'string'
          ? categorias.split(',').map((valor) => valor.trim()).filter(Boolean)
          : categoria
            ? [categoria]
            : [];
      const categoriasFiltro = categoriasEntrada.map(normalizarTexto);

      // Caché solo cuando no hay filtros dinámicos (búsqueda libre)
      const claveCache = `salones_${pais ?? 'todos'}`;
      let salonesPublicos = cacheSalonesPublicos.get<{ id: string; nombre: string; descripcion: string | null; direccion: string | null; pais: string; telefono: string; emailContacto: string | null; logoUrl: string | null; colorPrimario: string | null; horarioApertura: string | null; horarioCierre: string | null; diasAtencion: string | null; categorias: string | null }[]>(claveCache);

      if (!salonesPublicos) {
        const salones = await prisma.estudio.findMany({
          where: {
            estado: 'aprobado',
            activo: true,
            fechaVencimiento: { gte: hoy },
            ...(pais ? { pais } : {}),
            ...filtroDemo,
          },
          select: {
            id: true,
            nombre: true,
            descripcion: true,
            direccion: true,
            pais: true,
            telefono: true,
            emailContacto: true,
            logoUrl: true,
            colorPrimario: true,
            horarioApertura: true,
            horarioCierre: true,
            diasAtencion: true,
            categorias: true,
            servicios: true,
          },
          orderBy: { nombre: 'asc' },
        });

        salonesPublicos = salones.map(({ servicios, ...salon }) => ({
          ...salon,
          categorias: resolverCategoriasSalon({ categorias: salon.categorias, servicios }),
        }));
        cacheSalonesPublicos.set(claveCache, salonesPublicos);
      }

      let filtrados = salonesPublicos;

      if (buscar) {
        const termino = normalizarTexto(buscar);
        filtrados = filtrados.filter(
          (s) =>
            normalizarTexto(s.nombre).includes(termino) ||
            (s.descripcion ? normalizarTexto(s.descripcion).includes(termino) : false) ||
            (s.direccion ? normalizarTexto(s.direccion).includes(termino) : false) ||
            (s.categorias ? normalizarTexto(s.categorias).includes(termino) : false),
        );
      }

      if (categoriasFiltro.length > 0) {
        filtrados = filtrados.filter((s) => {
          const categoriasSalon = (s.categorias ?? '')
            .split(',')
            .map((valor) => normalizarTexto(valor.trim()))
            .filter(Boolean);
          return categoriasFiltro.every((categoriaActual) => categoriasSalon.includes(categoriaActual));
        });
      }

      return respuesta.send({ datos: filtrados });
    },
  );

  // ─── GET /salones/publicos/:id ────────────────────────────────────────────
  servidor.get<{ Params: { id: string } }>(
    '/salones/publicos/:id',
    async (solicitud, respuesta) => {
      const { id } = solicitud.params;
      const filtroDemo = obtenerFiltroDemo();
      const hoy = obtenerFechaHoyLocal();

      const salon = await prisma.estudio.findFirst({
        where: { id, estado: 'aprobado', activo: true, fechaVencimiento: { gte: hoy }, ...filtroDemo },
        select: {
          id: true,
          nombre: true,
          descripcion: true,
          direccion: true,
          telefono: true,
          emailContacto: true,
          logoUrl: true,
          colorPrimario: true,
          horarioApertura: true,
          horarioCierre: true,
          diasAtencion: true,
          categorias: true,
          servicios: true,
          horario: true,
          festivos: true,
          personal: {
            where: { activo: true },
            select: {
              id: true,
              nombre: true,
              especialidades: true,
              horaInicio: true,
              horaFin: true,
              descansoInicio: true,
              descansoFin: true,
              diasTrabajo: true,
            },
            orderBy: { nombre: 'asc' },
          },
        },
      });

      if (!salon) return respuesta.code(404).send({ error: 'Salón no encontrado' });

      return respuesta.send({
        datos: {
          ...salon,
          categorias: resolverCategoriasSalon({ categorias: salon.categorias, servicios: salon.servicios }),
        },
      });
    },
  );

  // ─── GET /salones/publicos/:id/disponibilidad ─────────────────────────────
  servidor.get<{
    Params: { id: string };
    Querystring: { personalId: string; fecha: string; duracion: string };
  }>(
    '/salones/publicos/:id/disponibilidad',
    async (solicitud, respuesta) => {
      const { id } = solicitud.params;
      const { personalId, fecha, duracion } = solicitud.query;
      const hoy = obtenerFechaHoyLocal();

      if (!personalId || !fecha || !duracion) {
        return respuesta.code(400).send({ error: 'personalId, fecha y duracion son requeridos' });
      }

      const duracionMin = Number(duracion);
      if (isNaN(duracionMin) || duracionMin <= 0) {
        return respuesta.code(400).send({ error: 'duracion debe ser un número positivo' });
      }

      const [salon, miembro, reservasExistentes] = await Promise.all([
        prisma.estudio.findFirst({
          where: { id, estado: 'aprobado', activo: true, fechaVencimiento: { gte: hoy } },
          select: { horario: true, festivos: true },
        }),
        prisma.personal.findFirst({
          where: { id: personalId, estudioId: id, activo: true },
          select: {
            id: true,
            horaInicio: true,
            horaFin: true,
            descansoInicio: true,
            descansoFin: true,
            diasTrabajo: true,
          },
        }),
        prisma.reserva.findMany({
          where: {
            estudioId: id,
            personalId,
            fecha,
            estado: { not: 'cancelled' },
          },
          select: { horaInicio: true, duracion: true },
        }),
      ]);

      if (!salon || !miembro) {
        return respuesta.code(404).send({ error: 'Salón o especialista no encontrado' });
      }

      const festivos = salon.festivos as string[];
      if (festivos.includes(fecha)) {
        return respuesta.send({ datos: [] });
      }

      const slots = obtenerSlotsDisponiblesBackend({
        horario: salon.horario as Record<string, { isOpen: boolean; openTime: string; closeTime: string }>,
        miembro,
        fecha,
        duracionMin,
        reservas: reservasExistentes,
      });

      return respuesta.send({ datos: slots });
    },
  );

  // ─── GET /mi-perfil ───────────────────────────────────────────────────────
  servidor.get(
    '/mi-perfil',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string; estudioId: string | null };
      if (!soloClienteApp(payload)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const clienteApp = await prisma.clienteApp.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          emailPendiente: true,
          nombre: true,
          apellido: true,
          pais: true,
          telefono: true,
          fechaNacimiento: true,
          avatarUrl: true,
          creadoEn: true,
          reservas: {
            select: {
              id: true,
              fecha: true,
              horaInicio: true,
              duracion: true,
              estado: true,
              servicios: true,
              precioTotal: true,
              tokenCancelacion: true,
              clienteId: true,
              estudio: { select: { id: true, nombre: true, colorPrimario: true, logoUrl: true } },
              empleado: { select: { id: true, nombre: true } },
            },
            orderBy: { fecha: 'desc' },
          },
        },
      });

      if (!clienteApp) return respuesta.code(404).send({ error: 'Perfil no encontrado' });

      let mensajeFidelidad: string | null = null;
      let fidelidad: Array<{
        estudioId: string;
        nombreSalon: string;
        colorPrimario: string | null;
        logoUrl: string | null;
        visitasAcumuladas: number;
        visitasUsadas: number;
        recompensasGanadas: number;
        recompensasUsadas: number;
        visitasRequeridas: number;
        descripcionRecompensa: string;
        activo: boolean;
      }> = [];

      if (!clienteApp.telefono) {
        mensajeFidelidad = 'Agrega tu teléfono al perfil para ver tus puntos de fidelidad';
      } else {
        const puntosFidelidad = await prisma.puntosFidelidad.findMany({
          where: { cliente: { telefono: clienteApp.telefono } },
          include: {
            estudio: {
              select: {
                id: true,
                nombre: true,
                logoUrl: true,
                colorPrimario: true,
                configFidelidad: true,
              },
            },
          },
        });

        fidelidad = puntosFidelidad.map((punto) => ({
          estudioId: punto.estudioId,
          nombreSalon: punto.estudio.nombre,
          colorPrimario: punto.estudio.colorPrimario,
          logoUrl: punto.estudio.logoUrl,
          visitasAcumuladas: punto.visitasAcumuladas,
          visitasUsadas: punto.visitasUsadas,
          recompensasGanadas: punto.recompensasGanadas,
          recompensasUsadas: punto.recompensasUsadas,
          visitasRequeridas: punto.estudio.configFidelidad?.visitasRequeridas ?? 5,
          descripcionRecompensa: punto.estudio.configFidelidad?.descripcionRecompensa ?? 'Recompensa disponible',
          activo: punto.estudio.configFidelidad?.activo ?? false,
        }));
      }

      return respuesta.send({
        datos: {
          id: clienteApp.id,
          email: clienteApp.email,
          emailPendiente: clienteApp.emailPendiente,
          nombre: clienteApp.nombre,
          apellido: clienteApp.apellido,
          pais: clienteApp.pais,
          telefono: clienteApp.telefono,
          fechaNacimiento: clienteApp.fechaNacimiento.toISOString().split('T')[0],
          avatarUrl: clienteApp.avatarUrl,
          creadoEn: clienteApp.creadoEn.toISOString(),
          mensajeFidelidad,
          reservas: clienteApp.reservas.map((r) => ({
            id: r.id,
            fecha: r.fecha,
            horaInicio: r.horaInicio,
            duracion: r.duracion,
            estado: r.estado,
            servicios: r.servicios,
            precioTotal: r.precioTotal,
            tokenCancelacion: r.tokenCancelacion,
            salon: r.estudio,
            especialista: r.empleado,
          })),
          fidelidad,
        },
      });
    },
  );

  // ─── PUT /mi-perfil ───────────────────────────────────────────────────────
  servidor.put<{
    Body: {
      nombre?: string;
      apellido?: string;
      telefono?: string;
      fechaNacimiento?: string;
    };
  }>(
    '/mi-perfil',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string; estudioId: string | null };
      if (!soloClienteApp(payload)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const resultado = esquemaPerfilClienteApp.safeParse(solicitud.body);
      if (!resultado.success) {
        return respuesta.code(400).send({ error: obtenerMensajeValidacion(resultado.error) });
      }

      const { nombre, apellido, telefono, fechaNacimiento } = resultado.data;

      const actualizado = await prisma.clienteApp.update({
        where: { id: payload.sub },
        data: {
          ...(nombre !== undefined && { nombre }),
          ...(apellido !== undefined && { apellido }),
          ...(telefono !== undefined && { telefono }),
          ...(fechaNacimiento !== undefined && { fechaNacimiento: new Date(fechaNacimiento) }),
        },
        select: {
          id: true,
          email: true,
          emailPendiente: true,
          nombre: true,
          apellido: true,
          pais: true,
          telefono: true,
          fechaNacimiento: true,
          avatarUrl: true,
        },
      });

      return respuesta.send({
        datos: {
          ...actualizado,
          fechaNacimiento: actualizado.fechaNacimiento.toISOString().split('T')[0],
        },
      });
    },
  );

  servidor.put<{ Body: { email: string } }>(
    '/perfil/email',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string; estudioId: string | null };
      if (!soloClienteApp(payload)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const resultado = esquemaActualizarEmailCliente.safeParse(solicitud.body);
      if (!resultado.success) {
        return respuesta.code(400).send({ error: obtenerMensajeValidacion(resultado.error) });
      }

      const emailNuevo = resultado.data.email.trim().toLowerCase();
      if (!esEmailValido(emailNuevo)) {
        return respuesta.code(400).send({ error: 'Solo se aceptan correos personales válidos y no temporales de Gmail, Hotmail, Outlook, Yahoo, iCloud o Proton' });
      }

      const clienteActual = await prisma.clienteApp.findUnique({
        where: { id: payload.sub },
        select: { id: true, email: true, nombre: true, emailPendiente: true },
      });

      if (!clienteActual) {
        return respuesta.code(404).send({ error: 'Perfil no encontrado' });
      }

      if (clienteActual.email === emailNuevo) {
        return respuesta.code(400).send({ error: 'Ese correo ya es el actual de tu cuenta.' });
      }

      const [clienteDuplicado, usuarioDuplicado] = await Promise.all([
        prisma.clienteApp.findFirst({
          where: { OR: [{ email: emailNuevo }, { emailPendiente: emailNuevo }], id: { not: payload.sub } },
          select: { id: true },
        }),
        prisma.usuario.findUnique({ where: { email: emailNuevo }, select: { id: true } }),
      ]);

      if (clienteDuplicado ?? usuarioDuplicado) {
        return respuesta.code(409).send({ error: 'Ese correo ya está registrado en otra cuenta.' });
      }

      await prisma.tokenVerificacionApp.updateMany({
        where: { clienteId: payload.sub, tipo: 'cambio_email_cliente', usado: false },
        data: { usado: true },
      });

      const tokenVerificacion = await prisma.tokenVerificacionApp.create({
        data: {
          clienteId: payload.sub,
          tipo: 'cambio_email_cliente',
          expiraEn: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });

      await prisma.clienteApp.update({
        where: { id: payload.sub },
        data: { emailPendiente: emailNuevo },
      });

      const enlaceVerificacion = `${env.FRONTEND_URL}/verificar-email?token=${tokenVerificacion.token}`;
      void enviarEmailVerificacionCliente({
        emailDestino: emailNuevo,
        nombreCliente: clienteActual.nombre,
        enlaceVerificacion,
      });

      return respuesta.send({
        datos: {
          mensaje: 'Enviamos un enlace de verificación al nuevo correo. Tu correo actual seguirá activo hasta que confirmes el cambio.',
          emailPendiente: emailNuevo,
        },
      });
    },
  );

  // ─── POST /mi-perfil/avatar ───────────────────────────────────────────────
  servidor.post(
    '/mi-perfil/avatar',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string; estudioId: string | null };
      if (!soloClienteApp(payload)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const archivo = await solicitud.file();
      if (!archivo) {
        return respuesta.code(400).send({ error: 'No se recibió ningún archivo' });
      }

      const extension = MIME_PERMITIDOS[archivo.mimetype];
      if (!extension) {
        archivo.file.resume();
        return respuesta.code(400).send({ error: 'Solo se aceptan imágenes JPG y PNG' });
      }

      let buffer: Buffer;
      try {
        buffer = await archivo.toBuffer();
      } catch {
        return respuesta.code(400).send({ error: 'La imagen no puede superar 2 MB' });
      }

      if (buffer.byteLength > LIMITE_BYTES) {
        return respuesta.code(400).send({ error: 'La imagen no puede superar 2 MB' });
      }

      const extensionSegura = detectarTipoImagen(buffer);
      if (!extensionSegura) {
        return respuesta.code(400).send({ error: 'El archivo no contiene una imagen válida' });
      }

      const dir = dirAvatares();
      await fs.promises.mkdir(dir, { recursive: true });

      // Eliminar avatar anterior si existe
      const clienteActual = await prisma.clienteApp.findUnique({
        where: { id: payload.sub },
        select: { avatarUrl: true },
      });
      if (clienteActual?.avatarUrl) {
        const rutaAnterior = path.join(
          process.cwd(),
          'uploads',
          clienteActual.avatarUrl.replace('/uploads/', ''),
        );
        await fs.promises.rm(rutaAnterior, { force: true });
      }

      const nombreArchivo = `cliente-${payload.sub}.jpg`;
      const imagenOptimizada = await sharp(buffer)
        .resize(400, 400, { fit: 'cover', withoutEnlargement: true })
        .jpeg({ quality: 85, progressive: true })
        .toBuffer();
      await fs.promises.writeFile(path.join(dir, nombreArchivo), imagenOptimizada);

      const avatarUrl = `/uploads/avatares/${nombreArchivo}`;
      await prisma.clienteApp.update({
        where: { id: payload.sub },
        data: { avatarUrl },
      });

      return respuesta.send({ datos: { avatarUrl } });
    },
  );

  // ─── POST /mi-perfil/cambiar-contrasena ──────────────────────────────────
  servidor.post<{
    Body: { contrasenaActual: string; contrasenaNueva: string };
  }>(
    '/mi-perfil/cambiar-contrasena',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string; estudioId: string | null };
      if (!soloClienteApp(payload)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const { contrasenaActual, contrasenaNueva } = solicitud.body;

      if (!contrasenaActual || !contrasenaNueva) {
        return respuesta.code(400).send({
          error: 'contrasenaActual y contrasenaNueva son requeridos',
        });
      }

      // Validar nueva contraseña: mínimo 8 caracteres, una mayúscula, un número
      const regexContrasena = /^(?=.*[A-Z])(?=.*\d).{8,}$/;
      if (!regexContrasena.test(contrasenaNueva)) {
        return respuesta.code(400).send({
          error: 'La nueva contraseña debe tener al menos 8 caracteres, una mayúscula y un número',
        });
      }

      const clienteApp = await prisma.clienteApp.findUnique({
        where: { id: payload.sub },
        select: { id: true, hashContrasena: true },
      });

      if (!clienteApp) return respuesta.code(404).send({ error: 'Perfil no encontrado' });

      const contrasenaValida = await bcrypt.compare(contrasenaActual, clienteApp.hashContrasena);
      if (!contrasenaValida) {
        return respuesta.code(400).send({ error: 'La contraseña actual es incorrecta' });
      }

      const nuevoHash = await bcrypt.hash(contrasenaNueva, 12);
      await prisma.clienteApp.update({
        where: { id: payload.sub },
        data: { hashContrasena: nuevoHash },
      });

      return respuesta.send({ datos: { actualizado: true } });
    },
  );
}
