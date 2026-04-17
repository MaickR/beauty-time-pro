import type { FastifyInstance } from 'fastify';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { z } from 'zod';
import NodeCache from 'node-cache';
import { env } from '../lib/env.js';
import { revocarSesionesPorSujeto } from '../lib/sesionesAuth.js';
import { detectarTipoImagen } from '../utils/validarImagen.js';
import { resolverCategoriasSalon } from '../lib/categoriasSalon.js';
import { cacheSalonesPublicos } from '../lib/cache.js';
import { obtenerExcepcionDisponibilidadAplicada, parsearExcepcionesDisponibilidad } from '../lib/disponibilidadExcepciones.js';
import { construirSedesReservables, obtenerNombresSucursales } from '../lib/sedes.js';
import { obtenerServiciosNormalizados } from '../lib/serializacionReservas.js';
import { prisma } from '../prismaCliente.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import { obtenerSlotsDisponiblesBackend } from '../lib/programacion.js';
import { enviarEmailVerificacionCliente } from '../servicios/servicioEmail.js';
import { compararHashContrasena, generarHashContrasena } from '../utils/contrasenas.js';
import { esEmailValido } from '../utils/validarEmail.js';
import { fechaIsoSchema, obtenerMensajeValidacion, telefonoSchema, textoSchema } from '../lib/validacion.js';
import { obtenerFechaISOEnZona, normalizarZonaHorariaEstudio } from '../utils/zonasHorarias.js';

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

const regexTextoPersona = /^[\p{L}\p{M}\s'’-]+$/u;
const regexContrasenaSegura = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{10,}$/;

const esquemaPerfilClienteApp = z.object({
  nombre: textoSchema('nombre', 80).regex(regexTextoPersona, 'El nombre solo puede contener letras, espacios, apóstrofes y guiones').optional(),
  apellido: textoSchema('apellido', 80).regex(regexTextoPersona, 'El apellido solo puede contener letras, espacios, apóstrofes y guiones').optional(),
  telefono: z.union([
    z.literal(''),
    z.string().trim().regex(/^\d{1,10}$/, 'El teléfono solo puede contener números y máximo 10 dígitos'),
  ]).optional().transform((valor) => (valor === '' ? null : valor)),
  fechaNacimiento: fechaIsoSchema.optional(),
  ciudad: z.string().trim().max(80, 'La ciudad no puede superar 80 caracteres').optional().transform((valor) => valor === '' ? null : valor),
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

function salonTieneSuscripcionActiva(salon: {
  fechaVencimiento: string;
  zonaHoraria?: string | null;
  pais?: string | null;
}): boolean {
  const hoySalon = obtenerFechaISOEnZona(
    new Date(),
    normalizarZonaHorariaEstudio(salon.zonaHoraria, salon.pais),
    salon.pais,
  );

  return salon.fechaVencimiento >= hoySalon;
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
      let salonesPublicos = cacheSalonesPublicos.get<{ id: string; nombre: string; descripcion: string | null; direccion: string | null; pais: string; telefono: string; emailContacto: string | null; logoUrl: string | null; colorPrimario: string | null; horarioApertura: string | null; horarioCierre: string | null; diasAtencion: string | null; categorias: string | null; fechaVencimiento: string; zonaHoraria: string | null }[]>(claveCache);

      if (!salonesPublicos) {
        const salones = await prisma.estudio.findMany({
          where: {
            estado: 'aprobado',
            activo: true,
            estudioPrincipalId: null,
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
            fechaVencimiento: true,
            zonaHoraria: true,
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

      let filtrados = salonesPublicos.filter(salonTieneSuscripcionActiva);

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
      const salon = await prisma.estudio.findFirst({
        where: { id, estado: 'aprobado', activo: true, ...filtroDemo },
        select: {
          id: true,
          nombre: true,
          plan: true,
          slug: true,
          descripcion: true,
          direccion: true,
          pais: true,
          telefono: true,
          emailContacto: true,
          logoUrl: true,
          colorPrimario: true,
          estudioPrincipalId: true,
          permiteReservasPublicas: true,
          sucursales: true,
          horarioApertura: true,
          horarioCierre: true,
          diasAtencion: true,
          categorias: true,
          fechaVencimiento: true,
          zonaHoraria: true,
          servicios: true,
          productos: {
            where: { activo: true },
            orderBy: { nombre: 'asc' },
            select: {
              id: true,
              nombre: true,
              categoria: true,
              precio: true,
            },
          },
          horario: true,
          festivos: true,
          excepcionesDisponibilidad: true,
          sedes: {
            where: { activo: true, estado: 'aprobado' },
            orderBy: { creadoEn: 'asc' },
            select: {
              id: true,
              nombre: true,
              slug: true,
              plan: true,
              estado: true,
              activo: true,
              fechaVencimiento: true,
              propietario: true,
              telefono: true,
              direccion: true,
              emailContacto: true,
              estudioPrincipalId: true,
              permiteReservasPublicas: true,
              precioPlanActual: {
                select: {
                  monto: true,
                  moneda: true,
                },
              },
            },
          },
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

      if (!salon || !salonTieneSuscripcionActiva(salon)) return respuesta.code(404).send({ error: 'Salón no encontrado' });

      const sucursales = obtenerNombresSucursales(
        salon as unknown as Record<string, unknown>,
        Array.isArray(salon.sucursales) ? (salon.sucursales as string[]) : [],
      );
      const sedesReservables = construirSedesReservables(
        salon as unknown as Record<string, unknown>,
      );

      return respuesta.send({
        datos: {
          ...salon,
          sucursales,
          sedesReservables,
          categorias: resolverCategoriasSalon({ categorias: salon.categorias, servicios: salon.servicios }),
        },
      });
    },
  );

  servidor.get<{ Params: { clave: string } }>(
    '/salones/publicos/clave/:clave',
    async (solicitud, respuesta) => {
      const identificadorCrudo = solicitud.params.clave.trim();
      const clave = identificadorCrudo.toUpperCase();
      const slug = identificadorCrudo.toLowerCase();
      const filtroDemo = obtenerFiltroDemo();
      const salon = await prisma.estudio.findFirst({
        where: {
          OR: [{ claveCliente: clave }, { slug }],
          estado: 'aprobado',
          activo: true,
          ...filtroDemo,
        },
        select: {
          id: true,
          nombre: true,
          plan: true,
          slug: true,
          descripcion: true,
          direccion: true,
          pais: true,
          telefono: true,
          emailContacto: true,
          logoUrl: true,
          colorPrimario: true,
          estudioPrincipalId: true,
          permiteReservasPublicas: true,
          sucursales: true,
          horarioApertura: true,
          horarioCierre: true,
          diasAtencion: true,
          categorias: true,
          fechaVencimiento: true,
          zonaHoraria: true,
          servicios: true,
          productos: {
            where: { activo: true },
            orderBy: { nombre: 'asc' },
            select: {
              id: true,
              nombre: true,
              categoria: true,
              precio: true,
            },
          },
          horario: true,
          festivos: true,
          excepcionesDisponibilidad: true,
          sedes: {
            where: { activo: true, estado: 'aprobado' },
            orderBy: { creadoEn: 'asc' },
            select: {
              id: true,
              nombre: true,
              slug: true,
              plan: true,
              estado: true,
              activo: true,
              fechaVencimiento: true,
              propietario: true,
              telefono: true,
              direccion: true,
              emailContacto: true,
              estudioPrincipalId: true,
              permiteReservasPublicas: true,
              precioPlanActual: {
                select: {
                  monto: true,
                  moneda: true,
                },
              },
            },
          },
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

      if (!salon || !salonTieneSuscripcionActiva(salon)) return respuesta.code(404).send({ error: 'Salón no encontrado' });

      const sucursales = obtenerNombresSucursales(
        salon as unknown as Record<string, unknown>,
        Array.isArray(salon.sucursales) ? (salon.sucursales as string[]) : [],
      );
      const sedesReservables = construirSedesReservables(
        salon as unknown as Record<string, unknown>,
      );

      return respuesta.send({
        datos: {
          ...salon,
          sucursales,
          sedesReservables,
          categorias: resolverCategoriasSalon({ categorias: salon.categorias, servicios: salon.servicios }),
        },
      });
    },
  );

  servidor.get<{ Params: { id: string }; Querystring: { email?: string } }>(
    '/salones/publicos/:id/cliente-por-email',
    async (solicitud, respuesta) => {
      const email = solicitud.query.email?.trim().toLowerCase() ?? '';
      const { id } = solicitud.params;

      if (!email || !esEmailValido(email)) {
        return respuesta.send({
          datos: {
            encontrado: false,
            email,
            nombre: '',
            apellido: '',
            telefono: null,
            fechaNacimiento: null,
            ciudad: null,
            pais: 'Mexico',
          },
        });
      }

      const salon = await prisma.estudio.findFirst({
        where: { id, estado: 'aprobado', activo: true, ...obtenerFiltroDemo() },
        select: { id: true },
      });

      if (!salon) {
        return respuesta.code(404).send({ error: 'Salón no encontrado' });
      }

      const clienteApp = await prisma.clienteApp.findUnique({
        where: { email },
        select: {
          email: true,
          nombre: true,
          apellido: true,
          telefono: true,
          fechaNacimiento: true,
          ciudad: true,
          pais: true,
          activo: true,
        },
      });

      if (!clienteApp || !clienteApp.activo) {
        return respuesta.send({
          datos: {
            encontrado: false,
            email,
            nombre: '',
            apellido: '',
            telefono: null,
            fechaNacimiento: null,
            ciudad: null,
            pais: 'Mexico',
          },
        });
      }

      return respuesta.send({
        datos: {
          encontrado: true,
          email: clienteApp.email,
          nombre: clienteApp.nombre,
          apellido: clienteApp.apellido,
          telefono: clienteApp.telefono,
          fechaNacimiento: clienteApp.fechaNacimiento?.toISOString().split('T')[0] ?? null,
          ciudad: clienteApp.ciudad ?? null,
          pais: clienteApp.pais === 'Colombia' ? 'Colombia' : 'Mexico',
        },
      });
    },
  );

  // ─── GET /salones/publicos/:id/disponibilidad ─────────────────────────────
  servidor.get<{
    Params: { id: string };
    Querystring: { personalId: string; fecha: string; duracion: string; sucursal?: string };
  }>(
    '/salones/publicos/:id/disponibilidad',
    async (solicitud, respuesta) => {
      const { id } = solicitud.params;
      const { personalId, fecha, duracion, sucursal } = solicitud.query;
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
          select: { nombre: true, horario: true, festivos: true, excepcionesDisponibilidad: true, fechaVencimiento: true, zonaHoraria: true, pais: true },
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
          select: { horaInicio: true, duracion: true, estado: true },
        }),
      ]);

      if (!salon || !miembro || !salonTieneSuscripcionActiva(salon)) {
        return respuesta.code(404).send({ error: 'Salón o especialista no encontrado' });
      }

      const festivos = salon.festivos as string[];
      if (festivos.includes(fecha)) {
        return respuesta.send({ datos: [] });
      }

      const sucursalEfectiva = sucursal?.trim() || salon.nombre;
      const excepcionDia = obtenerExcepcionDisponibilidadAplicada({
        excepciones: salon.excepcionesDisponibilidad,
        fecha,
        sucursal: sucursalEfectiva,
      });

      if (excepcionDia?.tipo === 'cerrado') {
        return respuesta.send({ datos: [] });
      }

      const slots = obtenerSlotsDisponiblesBackend({
        horario: salon.horario as Record<string, { isOpen: boolean; openTime: string; closeTime: string }>,
        miembro,
        fecha,
        duracionMin,
        reservas: reservasExistentes,
        sucursal: sucursalEfectiva,
        excepcionesDisponibilidad: salon.excepcionesDisponibilidad,
        zonaHoraria: normalizarZonaHorariaEstudio(salon.zonaHoraria, salon.pais),
      });

      return respuesta.send({ datos: slots });
    },
  );

  // ─── GET /salones/publicos/:id/disponibilidad-completa ────────────────────
  // Devuelve todos los especialistas activos con sus slots libres y ocupados
  // para una fecha y duración dadas. Usado en el calendario de reservas.
  servidor.get<{
    Params: { id: string };
    Querystring: { fecha: string; duracion: string; sucursal?: string; servicios?: string };
  }>(
    '/salones/publicos/:id/disponibilidad-completa',
    async (solicitud, respuesta) => {
      const { id } = solicitud.params;
      const { fecha, duracion, sucursal, servicios } = solicitud.query;
      if (!fecha || !duracion) {
        return respuesta.code(400).send({ error: 'fecha y duracion son requeridos' });
      }

      const duracionMin = Number(duracion);
      if (isNaN(duracionMin) || duracionMin <= 0) {
        return respuesta.code(400).send({ error: 'duracion debe ser un número positivo' });
      }

      const [salon, personalActivo] = await Promise.all([
        prisma.estudio.findFirst({
          where: { id, estado: 'aprobado', activo: true },
          select: {
            nombre: true,
            horario: true,
            festivos: true,
            excepcionesDisponibilidad: true,
            fechaVencimiento: true,
            zonaHoraria: true,
            pais: true,
            sucursales: true,
            estudioPrincipalId: true,
            permiteReservasPublicas: true,
            sedes: {
              where: { activo: true, estado: 'aprobado' },
              select: {
                id: true,
                nombre: true,
                estudioPrincipalId: true,
                activo: true,
                estado: true,
                permiteReservasPublicas: true,
              },
            },
          },
        }),
        prisma.personal.findMany({
          where: { estudioId: id, activo: true },
          select: {
            id: true,
            nombre: true,
            avatarUrl: true,
            especialidades: true,
            horaInicio: true,
            horaFin: true,
            descansoInicio: true,
            descansoFin: true,
            diasTrabajo: true,
          },
        }),
      ]);

      if (!salon || !salonTieneSuscripcionActiva(salon)) {
        return respuesta.code(404).send({ error: 'Salón no encontrado' });
      }

      if (salon.estudioPrincipalId && !salon.permiteReservasPublicas) {
        return respuesta.code(404).send({ error: 'La sede seleccionada no está disponible para reservas públicas' });
      }

      const serviciosSeleccionados = (servicios ?? '')
        .split(',')
        .map((servicio) => servicio.trim())
        .filter((servicio) => servicio.length > 0);

      const festivos = salon.festivos as string[];
      if (festivos.includes(fecha)) {
        return respuesta.send({ especialistas: [] });
      }

      const sucursalEfectiva = sucursal?.trim() || salon.nombre;
      const excepcionDia = obtenerExcepcionDisponibilidadAplicada({
        excepciones: salon.excepcionesDisponibilidad,
        fecha,
        sucursal: sucursalEfectiva,
      });

      if (excepcionDia?.tipo === 'cerrado') {
        return respuesta.send({ especialistas: [] });
      }

      // Para cada especialista, obtener sus reservas del día y calcular slots
      const reservasPorEspecialista = await prisma.reserva.findMany({
        where: {
          estudioId: id,
          fecha,
          estado: { not: 'cancelled' },
        },
        select: { personalId: true, horaInicio: true, duracion: true, estado: true },
      });

      // Agrupar reservas por especialista
      const mapaReservas = new Map<string, { horaInicio: string; duracion: number; estado?: string }[]>();
      for (const r of reservasPorEspecialista) {
        if (!mapaReservas.has(r.personalId)) mapaReservas.set(r.personalId, []);
        mapaReservas.get(r.personalId)!.push({
          horaInicio: r.horaInicio,
          duracion: r.duracion,
          estado: r.estado,
        });
      }

      const horario = salon.horario as Record<string, { isOpen: boolean; openTime: string; closeTime: string }>;
      const zonaHorariaSalon = normalizarZonaHorariaEstudio(salon.zonaHoraria, salon.pais);

      // Función auxiliar para convertir "HH:mm" a minutos
      function hhmm(t: string): number {
        const [h = '0', m = '0'] = t.split(':');
        return parseInt(h, 10) * 60 + parseInt(m, 10);
      }

      const especialistas = personalActivo.map((miembro) => {
        const reservasEsp = mapaReservas.get(miembro.id) ?? [];

        // Slots libres (considerando duración solicitada)
        const slotsCalculados = obtenerSlotsDisponiblesBackend({
          horario,
          miembro: {
            horaInicio: miembro.horaInicio,
            horaFin: miembro.horaFin,
            descansoInicio: miembro.descansoInicio,
            descansoFin: miembro.descansoFin,
            diasTrabajo: miembro.diasTrabajo,
          },
          fecha,
          duracionMin,
          reservas: reservasEsp,
          sucursal: sucursalEfectiva,
          excepcionesDisponibilidad: salon.excepcionesDisponibilidad,
          zonaHoraria: zonaHorariaSalon,
        });

        const slotsLibres = slotsCalculados.map((s) => s.hora);

        // Slots ocupados: slots de 30 min que caen dentro de una reserva existente
        const slotsOcupados: string[] = [];
        for (const r of reservasEsp) {
          const inicio = hhmm(r.horaInicio);
          const fin = inicio + r.duracion;
          for (let t = inicio; t < fin; t += 30) {
            const hora = `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
            if (!slotsOcupados.includes(hora)) slotsOcupados.push(hora);
          }
        }

        return {
          id: miembro.id,
          nombre: miembro.nombre,
          foto: miembro.avatarUrl,
          especialidades: miembro.especialidades as string[],
          slotsLibres,
          slotsOcupados,
        };
      });

      const conDisponibilidad = especialistas.filter((especialista) => {
        if (especialista.slotsLibres.length === 0 && especialista.slotsOcupados.length === 0) {
          return false;
        }

        if (serviciosSeleccionados.length === 0) {
          return true;
        }

        const especialidades = especialista.especialidades.map((valor) => valor.trim().toLowerCase());
        return serviciosSeleccionados.every((servicio) =>
          especialidades.includes(servicio.trim().toLowerCase()),
        );
      });

      return respuesta.send({ especialistas: conDisponibilidad });
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
          ciudad: true,
          avatarUrl: true,
          creadoEn: true,
          reservas: {
            select: {
              id: true,
              fecha: true,
              horaInicio: true,
              duracion: true,
              estado: true,
              sucursal: true,
              servicios: true,
              serviciosDetalle: {
                select: {
                  id: true,
                  nombre: true,
                  duracion: true,
                  precio: true,
                  categoria: true,
                  orden: true,
                  estado: true,
                },
                orderBy: { orden: 'asc' },
              },
              precioTotal: true,
              tokenCancelacion: true,
              clienteId: true,
              reagendada: true,
              reservaOriginalId: true,
              estudio: {
                select: {
                  id: true,
                  nombre: true,
                  colorPrimario: true,
                  logoUrl: true,
                  direccion: true,
                  pais: true,
                  slug: true,
                },
              },
              empleado: { select: { id: true, nombre: true, activo: true } },
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
          fechaNacimiento: clienteApp.fechaNacimiento?.toISOString().split('T')[0] ?? null,
          ciudad: clienteApp.ciudad ?? null,
          avatarUrl: clienteApp.avatarUrl,
          creadoEn: clienteApp.creadoEn.toISOString(),
          mensajeFidelidad,
          reservas: clienteApp.reservas.map((r) => ({
            id: r.id,
            fecha: r.fecha,
            horaInicio: r.horaInicio,
            duracion: r.duracion,
            estado: r.estado,
            sucursal: r.sucursal,
            servicios: obtenerServiciosNormalizados(r).map((servicio) => ({
              name: servicio.name,
              duration: servicio.duration,
              price: servicio.price,
              ...(servicio.category ? { category: servicio.category } : {}),
            })),
            precioTotal: r.precioTotal,
            tokenCancelacion: r.tokenCancelacion,
            reagendada: r.reagendada,
            reservaOriginalId: r.reservaOriginalId,
            salon: r.estudio,
            especialista: {
              id: r.empleado.id,
              nombre: r.empleado.nombre,
              eliminado: r.empleado.activo === false,
            },
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

      const { nombre, apellido, telefono, fechaNacimiento, ciudad } = resultado.data;

      const actualizado = await prisma.clienteApp.update({
        where: { id: payload.sub },
        data: {
          ...(nombre !== undefined && { nombre }),
          ...(apellido !== undefined && { apellido }),
          ...(telefono !== undefined && { telefono }),
          ...(fechaNacimiento !== undefined && { fechaNacimiento: new Date(fechaNacimiento) }),
          ...(ciudad !== undefined && { ciudad }),
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
          ciudad: true,
          avatarUrl: true,
        },
      });

      return respuesta.send({
        datos: {
          ...actualizado,
          fechaNacimiento: actualizado.fechaNacimiento?.toISOString().split('T')[0] ?? null,
          ciudad: actualizado.ciudad ?? null,
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
        return respuesta.code(400).send({ error: 'Solo se aceptan correos personales válidos de Gmail, Hotmail, Outlook o Yahoo' });
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
      if (!regexContrasenaSegura.test(contrasenaNueva)) {
        return respuesta.code(400).send({
          error: 'La nueva contraseña debe tener al menos 10 caracteres, una mayúscula, una minúscula, un número y un símbolo',
        });
      }

      const clienteApp = await prisma.clienteApp.findUnique({
        where: { id: payload.sub },
        select: { id: true, hashContrasena: true },
      });

      if (!clienteApp) return respuesta.code(404).send({ error: 'Perfil no encontrado' });

      const contrasenaValida = await compararHashContrasena(contrasenaActual, clienteApp.hashContrasena);
      if (!contrasenaValida) {
        return respuesta.code(400).send({ error: 'La contraseña actual es incorrecta' });
      }

      const nuevoHash = await generarHashContrasena(contrasenaNueva);
      await prisma.clienteApp.update({
        where: { id: payload.sub },
        data: { hashContrasena: nuevoHash },
      });

      await revocarSesionesPorSujeto('cliente_app', payload.sub, 'contrasena_actualizada');

      return respuesta.send({ datos: { actualizado: true } });
    },
  );

  // ─── POST /clientes-app/reservas/:id/cancelar ─────────────────────────────
  servidor.post<{ Params: { id: string } }>(
    '/clientes-app/reservas/:id/cancelar',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string; estudioId: string | null };
      if (!soloClienteApp(payload)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const reserva = await prisma.reserva.findFirst({
        where: { id: solicitud.params.id, clienteAppId: payload.sub },
        include: { estudio: { select: { zonaHoraria: true, pais: true } } },
      });

      if (!reserva) {
        return respuesta.code(404).send({ error: 'Reserva no encontrada' });
      }
      if (reserva.estado === 'cancelled') {
        return respuesta.code(400).send({ error: 'This booking is already cancelled.' });
      }
      if (reserva.estado === 'completed') {
        return respuesta.code(400).send({ error: 'A completed booking cannot be cancelled.' });
      }

      // Validar mínimo 2 horas de anticipación
      const zona = normalizarZonaHorariaEstudio(reserva.estudio.zonaHoraria, reserva.estudio.pais);
      const hoy = new Date();
      const hoyStr = obtenerFechaISOEnZona(hoy, zona, reserva.estudio.pais);

      if (reserva.fecha < hoyStr) {
        return respuesta.code(400).send({ error: 'No se puede cancelar una reserva pasada.' });
      }

      const [h, m] = reserva.horaInicio.split(':').map(Number);
      const [anio, mes, dia] = reserva.fecha.split('-').map(Number);
      const fechaCita = new Date(anio!, mes! - 1, dia!, h, m);
      const horasRestantes = (fechaCita.getTime() - hoy.getTime()) / (1000 * 60 * 60);
      if (horasRestantes < 2) {
        return respuesta.code(400).send({
          error: 'No se puede cancelar con menos de 2 horas de anticipación. Contacta directamente al salón.',
        });
      }

      await prisma.reserva.update({
        where: { id: reserva.id },
        data: { estado: 'cancelled' },
      });

      return respuesta.send({ datos: { cancelada: true } });
    },
  );

  // ─── POST /clientes-app/reservas/:id/reagendar ────────────────────────────
  const esquemaReagendar = z.object({
    fecha: fechaIsoSchema,
    horaInicio: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:mm requerido'),
  });

  servidor.post<{ Params: { id: string }; Body: { fecha: string; horaInicio: string } }>(
    '/clientes-app/reservas/:id/reagendar',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string; estudioId: string | null };
      if (!soloClienteApp(payload)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const resultado = esquemaReagendar.safeParse(solicitud.body);
      if (!resultado.success) {
        return respuesta.code(400).send({ error: obtenerMensajeValidacion(resultado.error) });
      }

      const { fecha, horaInicio } = resultado.data;

      const reservaOriginal = await prisma.reserva.findFirst({
        where: { id: solicitud.params.id, clienteAppId: payload.sub },
        include: {
          estudio: { select: { zonaHoraria: true, pais: true } },
          serviciosDetalle: true,
        },
      });

      if (!reservaOriginal) {
        return respuesta.code(404).send({ error: 'Reserva no encontrada' });
      }

      // Verificar que no sea ya una reserva reagendada
      if (reservaOriginal.reagendada) {
        return respuesta.code(400).send({ error: 'This booking was already rescheduled. Rescheduling is allowed only once.' });
      }

      // Verificar que tenga un reagendamiento previo (ya fue reagendada desde otra)
      const yaReagendada = await prisma.reserva.findFirst({
        where: { reservaOriginalId: reservaOriginal.id },
        select: { id: true },
      });
      if (yaReagendada) {
        return respuesta.code(400).send({ error: 'This booking was already rescheduled once.' });
      }

      if (['cancelled', 'completed'].includes(reservaOriginal.estado)) {
        return respuesta.code(400).send({ error: 'Cannot reschedule a cancelled or completed booking.' });
      }

      // Validar que la nueva fecha no sea en el pasado
      const zona = normalizarZonaHorariaEstudio(reservaOriginal.estudio.zonaHoraria, reservaOriginal.estudio.pais);
      const hoy = new Date();
      const hoyStr = obtenerFechaISOEnZona(hoy, zona, reservaOriginal.estudio.pais);
      if (fecha < hoyStr) {
        return respuesta.code(400).send({ error: 'Cannot reschedule to a past date.' });
      }

      // Crear nueva reserva con los mismos datos
      const nuevaReserva = await prisma.$transaction(async (tx) => {
        // Cancelar la original
        await tx.reserva.update({
          where: { id: reservaOriginal.id },
          data: { estado: 'cancelled' },
        });

        // Crear la nueva reserva
        const nueva = await tx.reserva.create({
          data: {
            estudioId: reservaOriginal.estudioId,
            personalId: reservaOriginal.personalId,
            clienteId: reservaOriginal.clienteId,
            nombreCliente: reservaOriginal.nombreCliente,
            telefonoCliente: reservaOriginal.telefonoCliente,
            fecha,
            horaInicio,
            duracion: reservaOriginal.duracion,
            servicios: reservaOriginal.servicios as object,
            precioTotal: reservaOriginal.precioTotal,
            estado: 'pending',
            sucursal: reservaOriginal.sucursal,
            clienteAppId: reservaOriginal.clienteAppId,
            reagendada: true,
            reservaOriginalId: reservaOriginal.id,
          },
        });

        // Copiar servicios detalle
        if (reservaOriginal.serviciosDetalle.length > 0) {
          await tx.reservaServicio.createMany({
            data: reservaOriginal.serviciosDetalle.map((s, i) => ({
              reservaId: nueva.id,
              nombre: s.nombre,
              duracion: s.duracion,
              precio: s.precio,
              categoria: s.categoria,
              orden: i,
              estado: 'active',
            })),
          });
        }

        return nueva;
      });

      return respuesta.code(201).send({
        datos: {
          id: nuevaReserva.id,
          fecha: nuevaReserva.fecha,
          horaInicio: nuevaReserva.horaInicio,
          reagendada: true,
        },
      });
    },
  );
}
