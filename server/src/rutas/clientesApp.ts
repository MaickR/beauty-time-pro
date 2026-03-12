import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { env } from '../lib/env.js';
import { resolverCategoriasSalon } from '../lib/categoriasSalon.js';
import { prisma } from '../prismaCliente.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import { obtenerSlotsDisponiblesBackend } from '../lib/programacion.js';
import { fechaIsoSchema, obtenerMensajeValidacion, telefonoSchema, textoSchema } from '../lib/validacion.js';

const MIME_PERMITIDOS: Record<string, string> = {
  'image/jpg': 'jpg',
  'image/jpeg': 'jpg',
  'image/png': 'png',
};
const LIMITE_BYTES = 2 * 1024 * 1024; // 2 MB

const esquemaBusquedaSalones = z.object({
  buscar: textoSchema('buscar', 80).optional(),
  categoria: textoSchema('categoria', 80).optional(),
});

const esquemaPerfilClienteApp = z.object({
  nombre: textoSchema('nombre', 80).optional(),
  apellido: textoSchema('apellido', 80).optional(),
  telefono: z.union([z.literal(''), telefonoSchema]).optional().transform((valor) => (valor === '' ? null : valor)),
  fechaNacimiento: fechaIsoSchema.optional(),
}).strict().refine((datos) => Object.keys(datos).length > 0, {
  message: 'Debes enviar al menos un campo para actualizar',
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

export async function rutasClientesApp(servidor: FastifyInstance): Promise<void> {
  // ─── GET /salones/publicos ───────────────────────────────────────────────
  servidor.get<{ Querystring: { buscar?: string; categoria?: string } }>(
    '/salones/publicos',
    async (solicitud, respuesta) => {
      const consulta = esquemaBusquedaSalones.safeParse(solicitud.query);
      if (!consulta.success) {
        return respuesta.code(400).send({ error: obtenerMensajeValidacion(consulta.error) });
      }

      const { buscar, categoria } = consulta.data;
      const filtroDemo = obtenerFiltroDemo();

      const salones = await prisma.estudio.findMany({
        where: { estado: 'aprobado', activo: true, ...filtroDemo },
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
        },
        orderBy: { nombre: 'asc' },
      });

      const salonesPublicos = salones.map((salon) => ({
        ...salon,
        categorias: resolverCategoriasSalon({ categorias: salon.categorias, servicios: salon.servicios }),
      }));

      let filtrados = salonesPublicos;

      if (buscar) {
        const termino = normalizarTexto(buscar);
        filtrados = filtrados.filter(
          (s) =>
            normalizarTexto(s.nombre).includes(termino) ||
            (s.descripcion ? normalizarTexto(s.descripcion).includes(termino) : false) ||
            (s.categorias ? normalizarTexto(s.categorias).includes(termino) : false),
        );
      }

      if (categoria) {
        const cat = normalizarTexto(categoria);
        filtrados = filtrados.filter((s) => s.categorias ? normalizarTexto(s.categorias).includes(cat) : false);
      }

      return respuesta.send({
        datos: filtrados.map(({ servicios, ...salon }) => salon),
      });
    },
  );

  // ─── GET /salones/publicos/:id ────────────────────────────────────────────
  servidor.get<{ Params: { id: string } }>(
    '/salones/publicos/:id',
    async (solicitud, respuesta) => {
      const { id } = solicitud.params;
      const filtroDemo = obtenerFiltroDemo();

      const salon = await prisma.estudio.findFirst({
        where: { id, estado: 'aprobado', activo: true, ...filtroDemo },
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

      if (!personalId || !fecha || !duracion) {
        return respuesta.code(400).send({ error: 'personalId, fecha y duracion son requeridos' });
      }

      const duracionMin = Number(duracion);
      if (isNaN(duracionMin) || duracionMin <= 0) {
        return respuesta.code(400).send({ error: 'duracion debe ser un número positivo' });
      }

      const [salon, miembro, reservasExistentes] = await Promise.all([
        prisma.estudio.findFirst({
          where: { id, estado: 'aprobado', activo: true },
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
          nombre: true,
          apellido: true,
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
          nombre: clienteApp.nombre,
          apellido: clienteApp.apellido,
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
          nombre: true,
          apellido: true,
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

      const nombreArchivo = `cliente-${payload.sub}.${extension}`;
      await fs.promises.writeFile(path.join(dir, nombreArchivo), buffer);

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
