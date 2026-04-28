import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { z } from 'zod';
import { Prisma } from '../generated/prisma/client.js';
import {
  asegurarColumnaTabla,
  construirSelectDesdeColumnas,
  limpiarCacheCompatibilidadEsquema,
  obtenerColumnasTabla,
  obtenerTablasDisponibles,
} from '../lib/compatibilidadEsquema.js';
import { canjearRecompensaFidelidad, obtenerConfigFidelidad, registrarVisitaFidelidad, revertirVisitaFidelidad } from '../lib/fidelidad.js';
import {
  calcularResumenServicios,
  incluirReservaConRelaciones,
  incluirServiciosDetalleReserva,
  normalizarServiciosEntrada,
  recalcularServiciosContraCatalogo,
  obtenerDuracionTotalServicios,
  obtenerPrecioTotalServicios,
  obtenerServiciosNormalizados,
  serializarReservaApi,
} from '../lib/serializacionReservas.js';
import {
  normalizarProductosAdicionalesReserva,
  obtenerIdsProductosReserva,
  resolverSucursalReserva,
} from '../lib/reservasPublicas.js';
import { obtenerExcepcionDisponibilidadAplicada } from '../lib/disponibilidadExcepciones.js';
import { tieneAccesoAdministrativoEstudio } from '../lib/accesoEstudio.js';
import { obtenerMensajeRestriccionPlan, planPermiteFuncion } from '../lib/planes.js';
import { validarMetodoPagoReservaDisponible } from '../lib/metodosPagoReserva.js';
import { prisma } from '../prismaCliente.js';
import { enviarEmailConfirmacion } from '../servicios/servicioEmail.js';
import { verificarJWT, verificarJWTOpcional } from '../middleware/autenticacion.js';
import { registrarAuditoria } from '../utils/auditoria.js';
import { sanitizarTexto } from '../utils/sanitizar.js';
import { esEmailValido } from '../utils/validarEmail.js';
import { obtenerNombresSucursales } from '../lib/sedes.js';
import { construirFechaHoraEnZona, obtenerFechaISOEnZona, normalizarZonaHorariaEstudio } from '../utils/zonasHorarias.js';
import {
  notificarCitaCancelada,
  notificarCitaConfirmada,
  notificarNuevaCita,
  obtenerReservaConRelacionesPorId,
} from '../utils/notificarReserva.js';
import { publicarEventoDisponibilidadTiempoReal } from '../lib/canalDisponibilidadTiempoReal.js';
import { calcularEdadDesdeFechaNacimiento } from '../lib/validacion.js';

async function asegurarInfraestructuraServiciosDetalle(): Promise<boolean> {
  const tablasDisponibles = await obtenerTablasDisponibles();

  if (!tablasDisponibles.has('reserva_servicios')) {
    try {
      await prisma.$executeRaw(
        Prisma.raw(`
          CREATE TABLE \`reserva_servicios\` (
            \`id\` VARCHAR(191) NOT NULL,
            \`reservaId\` VARCHAR(191) NOT NULL,
            \`nombre\` VARCHAR(191) NOT NULL,
            \`duracion\` INTEGER NOT NULL,
            \`precio\` INTEGER NOT NULL DEFAULT 0,
            \`categoria\` VARCHAR(191) NULL,
            \`orden\` INTEGER NOT NULL DEFAULT 0,
            \`estado\` VARCHAR(191) NOT NULL DEFAULT 'pending',
            \`motivo\` VARCHAR(191) NULL,
            \`creadoEn\` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
            PRIMARY KEY (\`id\`),
            INDEX \`reserva_servicios_reservaId_idx\`(\`reservaId\`),
            CONSTRAINT \`reserva_servicios_reservaId_fkey\` FOREIGN KEY (\`reservaId\`) REFERENCES \`reservas\`(\`id\`) ON DELETE CASCADE ON UPDATE CASCADE
          ) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `),
      );
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : '';
      if (!/Table .* already exists/i.test(mensaje)) {
        throw error;
      }
    }

    limpiarCacheCompatibilidadEsquema();
  }

  return asegurarColumnaTabla('reserva_servicios', 'motivo', 'VARCHAR(191) NULL');
}

async function asegurarColumnasAdicionalesReserva(): Promise<boolean> {
  const resultados = await Promise.all([
    asegurarColumnaTabla('reservas', 'metodoPago', 'VARCHAR(120) NULL'),
    asegurarColumnaTabla('reservas', 'motivoCancelacion', 'VARCHAR(200) NULL'),
    asegurarColumnaTabla('reservas', 'productosAdicionales', 'JSON NULL'),
  ]);

  return resultados.every(Boolean);
}

async function construirSelectEstudioReserva() {
  const columnasEstudio = await obtenerColumnasTabla('estudios');

  return {
    ...construirSelectDesdeColumnas(columnasEstudio, [
      'id',
      'nombre',
      'plan',
      'fechaVencimiento',
      'estado',
      'activo',
      'horario',
      'festivos',
      'excepcionesDisponibilidad',
      'servicios',
      'metodosPagoReserva',
      'sucursales',
      'estudioPrincipalId',
      'permiteReservasPublicas',
      'zonaHoraria',
      'pais',
    ]),
    sedes: {
      where: { activo: true, estado: 'aprobado' as const },
      select: {
        id: true,
        nombre: true,
        estudioPrincipalId: true,
        activo: true,
        estado: true,
        permiteReservasPublicas: true,
      },
    },
  } as Prisma.EstudioSelect;
}

function normalizarMotivoAccion(motivo: unknown): string | null {
  if (typeof motivo !== 'string') return null;

  const motivoLimpio = sanitizarTexto(motivo).trim().slice(0, 200);
  return motivoLimpio.length > 0 ? motivoLimpio : null;
}

function obtenerTotalProductosReserva(productos: unknown): number {
  if (!Array.isArray(productos)) return 0;

  return productos.reduce((total, producto) => {
    if (typeof producto !== 'object' || producto === null) return total;

    const registro = producto as Record<string, unknown>;
    const cantidad = Math.max(1, Number(registro['cantidad'] ?? 1));
    const precioUnitario = Math.max(0, Number(registro['precioUnitario'] ?? 0));
    const subtotal = Math.max(precioUnitario * cantidad, Number(registro['total'] ?? 0));
    return total + (Number.isFinite(subtotal) ? subtotal : 0);
  }, 0);
}

async function resolverUsuarioAuditoriaReserva(payload: {
  sub: string;
  rol: string;
  estudioId: string | null;
  personalId?: string;
}): Promise<string | null> {
  if (payload.rol !== 'empleado') {
    return payload.sub;
  }

  if (!payload.estudioId) {
    return null;
  }

  const dueno = await prisma.usuario.findFirst({
    where: { estudioId: payload.estudioId, rol: 'dueno' },
    select: { id: true },
  });

  if (dueno) {
    return dueno.id;
  }

  const usuarioRespaldo = await prisma.usuario.findFirst({
    where: { estudioId: payload.estudioId },
    select: { id: true },
    orderBy: { creadoEn: 'asc' },
  });

  return usuarioRespaldo?.id ?? null;
}

type ReservaCompatParaBackfill = {
  id: string;
  servicios: unknown;
  estado: string;
  serviciosDetalle?: Array<{ id?: string }>;
};

async function sincronizarServiciosDetalleFaltantes(
  reservas: ReservaCompatParaBackfill[],
): Promise<string[]> {
  const idsSincronizados: string[] = [];
  for (const reserva of reservas) {
    if (Array.isArray(reserva.serviciosDetalle) && reserva.serviciosDetalle.length > 0) {
      continue;
    }

    const serviciosNormalizados = normalizarServiciosEntrada(reserva.servicios);
    if (serviciosNormalizados.length === 0) {
      continue;
    }

    await prisma.reservaServicio.createMany({
      data: serviciosNormalizados.map((servicio, indice) => ({
        id: crypto.randomUUID(),
        reservaId: reserva.id,
        nombre: servicio.name,
        duracion: servicio.duration,
        precio: servicio.price,
        categoria: servicio.category ?? null,
        orden: servicio.order ?? indice,
        estado: servicio.status ?? reserva.estado,
        motivo: null,
      })),
      skipDuplicates: true,
    });
    idsSincronizados.push(reserva.id);
  }
  return idsSincronizados;
}

function serializarServiciosResumen(servicios: ReturnType<typeof obtenerServiciosNormalizados>): Prisma.InputJsonValue {
  return servicios.map((servicio) => ({
    name: servicio.name,
    duration: servicio.duration,
    price: servicio.price,
    ...(servicio.category ? { category: servicio.category } : {}),
  })) as Prisma.InputJsonValue;
}

function esErrorCompatibilidadServiciosDetalle(error: unknown): boolean {
  const codigo =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';
  const mensaje = error instanceof Error ? error.message : '';

  return (
    codigo === 'P2021' ||
    codigo === 'P2022' ||
    /reserva_servicios/i.test(mensaje) ||
    /(clienteAppId|tokenCancelacion|recordatorioEnviado|notasMenorEdad|metodoPago|motivoCancelacion|productosAdicionales)/i.test(mensaje) ||
    /Unknown column/i.test(mensaje) ||
    /doesn'?t exist/i.test(mensaje)
  );
}

const seleccionarReservaListadoCompat = {
  id: true,
  estudioId: true,
  personalId: true,
  clienteId: true,
  nombreCliente: true,
  telefonoCliente: true,
  fecha: true,
  horaInicio: true,
  duracion: true,
  servicios: true,
  precioTotal: true,
  estado: true,
  sucursal: true,
  marcaTinte: true,
  tonalidad: true,
  creadoEn: true,
  observaciones: true,
} satisfies Prisma.ReservaSelect;

const seleccionarReservaConRelacionesCompat = {
  id: true,
  estudioId: true,
  personalId: true,
  clienteId: true,
  nombreCliente: true,
  telefonoCliente: true,
  fecha: true,
  horaInicio: true,
  duracion: true,
  servicios: true,
  precioTotal: true,
  estado: true,
  sucursal: true,
  marcaTinte: true,
  tonalidad: true,
  observaciones: true,
  creadoEn: true,
  estudio: {
    select: {
      id: true,
      nombre: true,
      telefono: true,
      colorPrimario: true,
      logoUrl: true,
      direccion: true,
      claveCliente: true,
    },
  },
  empleado: {
    select: {
      id: true,
      nombre: true,
    },
  },
  cliente: {
    select: {
      id: true,
      email: true,
    },
  },
} satisfies Prisma.ReservaSelect;

async function buscarReservasCompat(args: Prisma.ReservaFindManyArgs) {
  try {
    return await prisma.reserva.findMany({
      ...args,
      include: incluirServiciosDetalleReserva,
    });
  } catch (error) {
    if (!esErrorCompatibilidadServiciosDetalle(error)) {
      throw error;
    }

    return prisma.reserva.findMany({
      ...args,
      select: seleccionarReservaListadoCompat,
    }) as Promise<Awaited<ReturnType<typeof prisma.reserva.findMany>>>;
  }
}

async function buscarReservaCompat(args: Prisma.ReservaFindUniqueArgs) {
  try {
    return await prisma.reserva.findUnique({
      ...args,
      include: incluirReservaConRelaciones,
    });
  } catch (error) {
    if (!esErrorCompatibilidadServiciosDetalle(error)) {
      throw error;
    }

    return prisma.reserva.findUnique({
      ...args,
      select: seleccionarReservaConRelacionesCompat,
    }) as Promise<Awaited<ReturnType<typeof prisma.reserva.findUnique>>>;
  }
}

async function buscarReservaCancelableCompat(token: string) {
  try {
    return await prisma.reserva.findUnique({
      where: { tokenCancelacion: token },
      select: {
        id: true,
        fecha: true,
        horaInicio: true,
        estado: true,
        tokenCancelacion: true,
        nombreCliente: true,
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
        empleado: { select: { nombre: true, activo: true } },
        estudio: { select: { nombre: true, zonaHoraria: true, pais: true } },
      },
    });
  } catch (error) {
    if (!esErrorCompatibilidadServiciosDetalle(error)) {
      throw error;
    }

    if (error instanceof Error && /tokenCancelacion/i.test(error.message)) {
      return null;
    }

    return prisma.reserva.findUnique({
      where: { tokenCancelacion: token },
      select: {
        id: true,
        fecha: true,
        horaInicio: true,
        estado: true,
        nombreCliente: true,
        servicios: true,
        empleado: { select: { nombre: true, activo: true } },
        estudio: { select: { nombre: true, zonaHoraria: true, pais: true } },
      },
    });
  }
}

const esquemaCrearReservaBase = z.object({
  estudioId: z.string().trim().min(1, 'El estudio es obligatorio'),
  personalId: z.string().trim().min(1, 'Debes seleccionar un especialista'),
  nombreCliente: z.string().trim().optional(),
  telefonoCliente: z.string().trim().optional(),
  fechaNacimiento: z.string().trim().optional(),
  email: z.string().trim().email('Correo inválido').optional().or(z.literal('')),
  fecha: z
    .string()
    .trim()
    .refine((valor) => /^\d{4}-\d{2}-\d{2}$/.test(valor), 'La fecha debe usar formato YYYY-MM-DD')
    .refine((valor) => !Number.isNaN(new Date(`${valor}T00:00:00`).getTime()), 'La fecha no es válida'),
  horaInicio: z
    .string()
    .trim()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'La hora debe usar formato HH:mm'),
  duracion: z.number().int().min(1).max(480).optional(),
  servicios: z.array(z.unknown()).min(1, 'Debes seleccionar al menos un servicio'),
  precioTotal: z.number().int().min(0).optional(),
  estado: z.enum(['pending', 'confirmed', 'working', 'completed', 'cancelled']).optional(),
  sucursal: z.string().trim().optional(),
  marcaTinte: z.string().trim().optional().nullable(),
  tonalidad: z.string().trim().optional().nullable(),
  observaciones: z
    .string()
    .trim()
    .max(240)
    .regex(
      /^[\p{L}\p{M}\p{N}\s.,:;()¿?¡!'"%/#&+\-–—]*$/u,
      'Las notas solo aceptan letras, números y signos comunes del español',
    )
    .optional()
    .nullable(),
  metodoPago: z
    .enum(['cash', 'card', 'bank_transfer', 'digital_transfer'])
    .optional()
    .nullable(),
  productosSeleccionados: z
    .array(
      z.object({
        productoId: z.string().trim().min(1, 'Debes seleccionar un producto válido'),
        cantidad: z.number().int().min(1, 'La cantidad mínima es 1').max(20, 'La cantidad máxima es 20'),
      }),
    )
    .max(20, 'Solo puedes agregar hasta 20 productos por reserva')
    .optional(),
  usarRecompensa: z.boolean().optional(),
});

const esquemaDatosClienteReserva = z.object({
  nombreCliente: z
    .string()
    .trim()
    .min(2, 'El nombre del cliente es obligatorio')
    .regex(
      /^[\p{L}\p{M}\s'’-]+$/u,
      'El nombre del cliente solo puede contener letras, espacios, apóstrofes y guiones',
    ),
  telefonoCliente: z
    .string()
    .trim()
    .regex(/^\d{10}$/, 'El teléfono del cliente debe tener exactamente 10 dígitos'),
  fechaNacimiento: z
    .string()
    .trim()
    .refine((valor) => /^\d{4}-\d{2}-\d{2}$/.test(valor), 'La fecha de nacimiento debe usar formato YYYY-MM-DD')
    .refine((valor) => !Number.isNaN(new Date(`${valor}T00:00:00`).getTime()), 'La fecha de nacimiento no es válida'),
});

async function sincronizarResumenReserva(reservaId: string) {
  const reserva = await buscarReservasCompat({
    where: { id: reservaId },
    take: 1,
  }).then((reservas) => reservas[0] ?? null);

  if (!reserva) return null;

  const servicios = obtenerServiciosNormalizados(reserva);
  const resumen = calcularResumenServicios(servicios);
  const serviciosActivos = resumen.serviciosActivos;
  const totalProductos = obtenerTotalProductosReserva(
    (reserva as { productosAdicionales?: unknown }).productosAdicionales,
  );
  const huboNoShow = servicios.some((servicio) => servicio.status === 'no_show');

  let estadoReserva = reserva.estado;
  if (serviciosActivos.length === 0 && servicios.length > 0) {
    estadoReserva = huboNoShow ? 'no_show' : 'cancelled';
  } else if (
    serviciosActivos.length > 0 &&
    serviciosActivos.every((servicio) => servicio.status === 'completed')
  ) {
    estadoReserva = 'completed';
  } else if (serviciosActivos.some((servicio) => servicio.status === 'working')) {
    estadoReserva = 'working';
  } else if (
    serviciosActivos.length > 0 &&
    serviciosActivos.every((servicio) =>
      ['pending', 'confirmed', 'completed'].includes(servicio.status ?? 'pending'),
    )
  ) {
    estadoReserva = 'confirmed';
  } else if (
    serviciosActivos.some(
      (servicio) =>
        servicio.status === 'pending' ||
        servicio.status === 'confirmed' ||
        servicio.status === 'completed',
    )
  ) {
    estadoReserva = 'confirmed';
  } else {
    estadoReserva = 'pending';
  }

  await prisma.reserva.update({
    where: { id: reservaId },
    data: {
      estado: estadoReserva,
      duracion: resumen.duracionTotal,
      precioTotal: resumen.precioTotal + totalProductos,
      servicios: serializarServiciosResumen(serviciosActivos),
    },
  });

  return obtenerReservaConRelacionesPorId(reservaId);
}

async function insertarReservaCompat(
  tx: Prisma.TransactionClient,
  datos: {
    nuevaReservaId: string;
    estudioId: string;
    personalId: string;
    clienteId: string;
    nombreCliente: string;
    telefonoCliente: string;
    fecha: string;
    horaInicio: string;
    duracionEfectiva: number;
    serviciosNormalizados: ReturnType<typeof normalizarServiciosEntrada>;
    precioTotalEfectivo: number;
    estadoReserva: string;
    sucursal?: string;
    marcaTinte?: string | null;
    tonalidad?: string | null;
    notaMenorEdad?: string | null;
    observaciones?: string | null;
    metodoPago?: string | null;
    motivoCancelacion?: string | null;
    productosAdicionales?: Prisma.InputJsonValue;
    clienteAppId?: string | null;
    tokenCancelacion: string;
    inicioMin: number;
    finMin: number;
  },
): Promise<void> {
  const serviciosJson = JSON.stringify(
    datos.serviciosNormalizados.map((servicio) => ({
      name: servicio.name,
      duration: servicio.duration,
      price: servicio.price,
      ...(servicio.category ? { category: servicio.category } : {}),
    })),
  );

  try {
    const filasInsertadas = await tx.$executeRaw`
      INSERT INTO reservas (
        id,
        estudioId,
        personalId,
        clienteId,
        nombreCliente,
        telefonoCliente,
        fecha,
        horaInicio,
        duracion,
        servicios,
        precioTotal,
        estado,
        sucursal,
        marcaTinte,
        tonalidad,
        notasMenorEdad,
        clienteAppId,
        tokenCancelacion,
        recordatorioEnviado,
        observaciones,
        metodoPago,
        motivoCancelacion,
        productosAdicionales,
        creadoEn
      )
      SELECT
        ${datos.nuevaReservaId},
        ${datos.estudioId},
        ${datos.personalId},
        ${datos.clienteId},
        ${datos.nombreCliente},
        ${datos.telefonoCliente},
        ${datos.fecha},
        ${datos.horaInicio},
        ${datos.duracionEfectiva},
        CAST(${serviciosJson} AS JSON),
        ${datos.precioTotalEfectivo},
        ${datos.estadoReserva},
        ${datos.sucursal ?? ''},
        ${datos.marcaTinte ?? null},
        ${datos.tonalidad ?? null},
        ${datos.notaMenorEdad ?? null},
        ${datos.clienteAppId ?? null},
        ${datos.tokenCancelacion},
        false,
        ${datos.observaciones ?? null},
        ${datos.metodoPago ?? null},
        ${datos.motivoCancelacion ?? null},
        CAST(${JSON.stringify(datos.productosAdicionales ?? [])} AS JSON),
        NOW()
      FROM DUAL
      WHERE NOT EXISTS (
        SELECT 1
        FROM reservas
        WHERE personalId = ${datos.personalId}
          AND fecha = ${datos.fecha}
          AND estado IN ('pending', 'confirmed', 'working')
          AND ${datos.inicioMin} < (TIME_TO_SEC(horaInicio) / 60 + duracion)
          AND ${datos.finMin} > (TIME_TO_SEC(horaInicio) / 60)
      )
    `;

    if (filasInsertadas === 0) {
      throw new Error('SLOT_OCUPADO');
    }
  } catch (error) {
    if (!esErrorCompatibilidadServiciosDetalle(error)) {
      throw error;
    }

    const filasInsertadas = await tx.$executeRaw`
      INSERT INTO reservas (
        id,
        estudioId,
        personalId,
        clienteId,
        nombreCliente,
        telefonoCliente,
        fecha,
        horaInicio,
        duracion,
        servicios,
        precioTotal,
        estado,
        sucursal,
        marcaTinte,
        tonalidad,
        observaciones,
        creadoEn
      )
      SELECT
        ${datos.nuevaReservaId},
        ${datos.estudioId},
        ${datos.personalId},
        ${datos.clienteId},
        ${datos.nombreCliente},
        ${datos.telefonoCliente},
        ${datos.fecha},
        ${datos.horaInicio},
        ${datos.duracionEfectiva},
        CAST(${serviciosJson} AS JSON),
        ${datos.precioTotalEfectivo},
        ${datos.estadoReserva},
        ${datos.sucursal ?? ''},
        ${datos.marcaTinte ?? null},
        ${datos.tonalidad ?? null},
        ${datos.observaciones ?? null},
        NOW()
      FROM DUAL
      WHERE NOT EXISTS (
        SELECT 1
        FROM reservas
        WHERE personalId = ${datos.personalId}
          AND fecha = ${datos.fecha}
          AND estado IN ('pending', 'confirmed', 'working')
          AND ${datos.inicioMin} < (TIME_TO_SEC(horaInicio) / 60 + duracion)
          AND ${datos.finMin} > (TIME_TO_SEC(horaInicio) / 60)
      )
    `;

    if (filasInsertadas === 0) {
      throw new Error('SLOT_OCUPADO');
    }
  }
}

async function actualizarServiciosReservaCompat(args: Prisma.ReservaServicioUpdateManyArgs) {
  try {
    await prisma.reservaServicio.updateMany(args);
  } catch (error) {
    if (!esErrorCompatibilidadServiciosDetalle(error)) {
      throw error;
    }
  }
}

export async function rutasReservas(servidor: FastifyInstance): Promise<void> {
  // GET /reservas/todas — solo maestro
  servidor.get<{ Querystring: { pagina?: string; limite?: string } }>(
    '/reservas/todas',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      const pagina = Math.max(1, parseInt(solicitud.query.pagina ?? '1', 10));
      const limite = Math.min(100, Math.max(1, parseInt(solicitud.query.limite ?? '20', 10)));
      const saltar = (pagina - 1) * limite;

      await asegurarColumnasAdicionalesReserva();

      const [total, reservas] = await Promise.all([
        prisma.reserva.count(),
        buscarReservasCompat({
          orderBy: [{ fecha: 'desc' }, { horaInicio: 'asc' }],
          skip: saltar,
          take: limite,
        }),
      ]);

      return respuesta.send({
        datos: reservas.map(serializarReservaApi),
        total,
        pagina,
        totalPaginas: Math.ceil(total / limite),
      });
    },
  );

  // GET /estudios/:id/reservas
  servidor.get<{ Params: { id: string }; Querystring: { fecha?: string; pagina?: string; limite?: string } }>(
    '/estudios/:id/reservas',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const { id } = solicitud.params;
      if (!tieneAccesoAdministrativoEstudio(payload, id)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      const where: Record<string, unknown> = { estudioId: id };
      if (solicitud.query.fecha) where['fecha'] = solicitud.query.fecha;

      // Si se piden todas (sin pagina), devolver lista plana para compatibilidad
      if (!solicitud.query.pagina) {
        await asegurarInfraestructuraServiciosDetalle();
        await asegurarColumnasAdicionalesReserva();

        let reservas = await buscarReservasCompat({
          where,
          orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
        });

        const idsSincronizados = await sincronizarServiciosDetalleFaltantes(reservas as ReservaCompatParaBackfill[]);

        if (idsSincronizados.length > 0) {
          const actualizadas = await buscarReservasCompat({
            where: { id: { in: idsSincronizados } },
            orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
          });
          const mapa = new Map(actualizadas.map((r) => [r.id, r]));
          reservas = reservas.map((r) => mapa.get(r.id) ?? r);
        }

        return respuesta.send({ datos: reservas.map(serializarReservaApi) });
      }

      const pagina = Math.max(1, parseInt(solicitud.query.pagina, 10));
      const limite = Math.min(100, Math.max(1, parseInt(solicitud.query.limite ?? '20', 10)));
      const saltar = (pagina - 1) * limite;

      await asegurarInfraestructuraServiciosDetalle();
      await asegurarColumnasAdicionalesReserva();

      const [total, reservasIniciales] = await Promise.all([
        prisma.reserva.count({ where }),
        buscarReservasCompat({
          where,
          orderBy: [{ fecha: 'desc' }, { horaInicio: 'asc' }],
          skip: saltar,
          take: limite,
        }),
      ]);

      const idsSincronizadosPag = await sincronizarServiciosDetalleFaltantes(reservasIniciales as ReservaCompatParaBackfill[]);

      let reservas = reservasIniciales;
      if (idsSincronizadosPag.length > 0) {
        const actualizadasPag = await buscarReservasCompat({
          where: { id: { in: idsSincronizadosPag } },
          orderBy: [{ fecha: 'desc' }, { horaInicio: 'asc' }],
        });
        const mapaPag = new Map(actualizadasPag.map((r) => [r.id, r]));
        reservas = reservasIniciales.map((r) => mapaPag.get(r.id) ?? r);
      }

      return respuesta.send({
        datos: reservas.map(serializarReservaApi),
        total,
        pagina,
        totalPaginas: Math.ceil(total / limite),
      });
    },
  );

  // POST /reservas — cualquier rol autenticado puede crear reservas
  servidor.post<{
    Body: {
      estudioId: string;
      personalId: string;
      nombreCliente?: string;
      telefonoCliente?: string;
      fechaNacimiento?: string; // "YYYY-MM-DD"
      email?: string;
      fecha: string;
      horaInicio: string;
      duracion: number;
      servicios: unknown;
      precioTotal?: number;
      estado?: string;
      sucursal?: string;
      marcaTinte?: string;
      tonalidad?: string;
      observaciones?: string;
      metodoPago?: 'cash' | 'card' | 'bank_transfer' | 'digital_transfer';
      usarRecompensa?: boolean;
    };
  }>('/reservas', {
    preHandler: verificarJWTOpcional,
    config: {
      rateLimit: {
        max: 10,
        timeWindow: '15 minutes',
        keyGenerator: (solicitud: { ip: string }) => solicitud.ip,
        errorResponseBuilder: () => ({
          error: 'Demasiados intentos. Intenta en 15 minutos.',
          codigo: 'RATE_LIMIT',
        }),
      },
    },
  }, async (solicitud, respuesta) => {
    const resultadoValidacionBase = esquemaCrearReservaBase.safeParse(solicitud.body);
    if (!resultadoValidacionBase.success) {
      const campos = Object.fromEntries(
        resultadoValidacionBase.error.issues.map((issue) => [
          issue.path.join('.') || 'body',
          issue.message,
        ]),
      );
      return respuesta.code(400).send({
        error: 'Datos inválidos para crear la reserva',
        campos,
      });
    }

    const payload =
      (solicitud.user as { sub: string; rol: string; estudioId: string | null } | undefined) ??
      null;
    const datosReserva = resultadoValidacionBase.data;
    const {
      estudioId,
      personalId,
      fecha,
      horaInicio,
      duracion,
      servicios,
      estado,
      sucursal,
      marcaTinte,
      tonalidad,
      observaciones,
      metodoPago,
      usarRecompensa,
    } = datosReserva;

    let nombreCliente = datosReserva.nombreCliente ?? '';
    let telefonoCliente = datosReserva.telefonoCliente ?? '';
    let fechaNacimiento: string | undefined = datosReserva.fechaNacimiento ?? undefined;
    const email = datosReserva.email;
    let clienteAppId: string | undefined;

    if (payload?.rol === 'dueno') {
      const estudioDelDueno = await prisma.estudio.findFirst({
        where: {
          id: estudioId,
          usuarios: {
            some: {
              id: payload.sub,
              rol: 'dueno',
            },
          },
        },
        select: { id: true },
      });
      if (!estudioDelDueno) {
        return respuesta.code(403).send({ error: 'Sin acceso a este recurso' });
      }
    }

    if (payload?.rol === 'empleado') {
      const accesoEmpleado = await prisma.empleadoAcceso.findUnique({
        where: { id: payload.sub },
        select: {
          personal: {
            select: {
              estudioId: true,
            },
          },
        },
      });
      if (!accesoEmpleado?.personal || accesoEmpleado.personal.estudioId !== estudioId) {
        return respuesta.code(403).send({ error: 'Sin acceso a este recurso' });
      }
    }

    const selectEstudioReserva = await construirSelectEstudioReserva();

    const [personal, estudio] = await Promise.all([
      prisma.personal.findFirst({
        where: { id: personalId, estudioId, activo: true },
        select: { id: true },
      }),
      prisma.estudio.findUnique({
        where: { id: estudioId },
        select: selectEstudioReserva,
      }),
    ]);

    if (!personal) {
      return respuesta.code(400).send({ error: 'El especialista no está disponible en este salón' });
    }

    if (!estudio || !estudio.activo || estudio.estado !== 'aprobado') {
      return respuesta.code(400).send({ error: 'Este salón no está disponible para reservas' });
    }

    // Verificar que el salón no haya vencido
    const zonaHorariaSalon = normalizarZonaHorariaEstudio(estudio.zonaHoraria, estudio.pais);
    const hoyStr = obtenerFechaISOEnZona(new Date(), zonaHorariaSalon, estudio.pais);
    if (estudio.fechaVencimiento < hoyStr) {
      return respuesta.code(400).send({ error: 'Este salón no tiene una suscripción activa' });
    }

    const esReservaPublica = !payload || (payload.rol === 'cliente' && payload.estudioId === null);
    if (esReservaPublica && estudio.estudioPrincipalId && !estudio.permiteReservasPublicas) {
      return respuesta.code(400).send({ error: 'La sede seleccionada no está disponible para reservas públicas' });
    }

    const sucursalesDisponibles = [
      estudio.nombre,
      ...obtenerNombresSucursales(
        estudio as unknown as Record<string, unknown>,
        Array.isArray(estudio.sucursales) ? (estudio.sucursales as string[]) : [],
      ),
    ];
    const sucursalEfectiva = resolverSucursalReserva(estudio.nombre, sucursal);

    if (!sucursalesDisponibles.includes(sucursalEfectiva)) {
      return respuesta.code(400).send({ error: 'La sede seleccionada no pertenece a este salón' });
    }

    if ((estudio.festivos as string[]).includes(fecha)) {
      return respuesta.code(400).send({ error: 'La fecha seleccionada está cerrada para reservas' });
    }

    const excepcionDia = obtenerExcepcionDisponibilidadAplicada({
      excepciones: estudio.excepcionesDisponibilidad,
      fecha,
      sucursal: sucursalEfectiva,
    });

    if (excepcionDia?.tipo === 'cerrado') {
      return respuesta.code(400).send({ error: 'La sede seleccionada está cerrada en esa fecha' });
    }

    // ─── Si es un ClienteApp autenticado, rellenar datos desde su perfil ──
    const esClienteApp = payload?.rol === 'cliente' && payload.estudioId === null;
    let emailClienteAppAutenticado: string | undefined;
    if (esClienteApp) {
      const clienteApp = await prisma.clienteApp.findUnique({
        where: { id: payload.sub },
        select: {
          id: true,
          email: true,
          nombre: true,
          apellido: true,
          telefono: true,
          fechaNacimiento: true,
        },
      });
      if (!clienteApp) {
        return respuesta.code(401).send({ error: 'No autenticado' });
      }
      clienteAppId = clienteApp.id;
      emailClienteAppAutenticado = clienteApp.email.trim().toLowerCase();
      if (!nombreCliente) nombreCliente = `${clienteApp.nombre} ${clienteApp.apellido}`;
      if (!telefonoCliente) {
        if (!clienteApp.telefono) {
          return respuesta.code(400).send({
            error: 'Teléfono requerido. Actualiza tu perfil o ingrésalo en el formulario.',
          });
        }
        telefonoCliente = clienteApp.telefono;
      }
      if (!fechaNacimiento) {
        fechaNacimiento = clienteApp.fechaNacimiento?.toISOString().split('T')[0] ?? undefined;
        if (!fechaNacimiento) {
          return respuesta.code(400).send({
            error: 'Fecha de nacimiento requerida. Actualiza tu perfil antes de reservar.',
          });
        }
      }
    }

    const emailNormalizado =
      email?.trim().toLowerCase() || emailClienteAppAutenticado || undefined;

    if (!clienteAppId && emailNormalizado) {
      const clienteAppPorEmail = await prisma.clienteApp.findUnique({
        where: { email: emailNormalizado },
        select: { id: true, activo: true },
      });

      if (clienteAppPorEmail?.activo) {
        clienteAppId = clienteAppPorEmail.id;
      }
    }

    const resultadoDatosCliente = esquemaDatosClienteReserva.safeParse({
      nombreCliente,
      telefonoCliente,
      fechaNacimiento,
    });
    if (!resultadoDatosCliente.success) {
      const campos = Object.fromEntries(
        resultadoDatosCliente.error.issues.map((issue) => [
          issue.path.join('.') || 'body',
          issue.message,
        ]),
      );
      return respuesta.code(400).send({
        error: 'Datos del cliente inválidos para crear la reserva',
        campos,
      });
    }

    if (emailNormalizado && !esClienteApp && !esEmailValido(emailNormalizado)) {
      return respuesta.code(400).send({
        error: 'Solo se aceptan correos personales válidos de Gmail, Hotmail, Outlook o Yahoo',
      });
    }

    const serviciosSolicitados = normalizarServiciosEntrada(servicios);
    if (serviciosSolicitados.length === 0) {
      return respuesta.code(400).send({
        error: 'Debes seleccionar al menos un servicio válido para la reserva',
      });
    }

    const serviciosNormalizados = recalcularServiciosContraCatalogo(servicios, estudio.servicios);
    if (serviciosNormalizados.length !== serviciosSolicitados.length) {
      return respuesta.code(400).send({
        error: 'Uno o más servicios ya no están disponibles en el catálogo del salón',
      });
    }

    if (!validarMetodoPagoReservaDisponible(metodoPago, estudio.metodosPagoReserva)) {
      return respuesta.code(400).send({
        error: 'El método de pago seleccionado no está habilitado para este salón',
        campos: { metodoPago: 'Selecciona un método de pago disponible' },
      });
    }

    const productosSeleccionados = datosReserva.productosSeleccionados ?? [];
    let productosAdicionalesNormalizados: Prisma.InputJsonValue = [];

    if (productosSeleccionados.length > 0) {
      if (!planPermiteFuncion({ plan: estudio.plan, funcion: 'ventasProductos' })) {
        return respuesta.code(403).send({
          error: obtenerMensajeRestriccionPlan('ventasProductos'),
        });
      }

      const idsProductos = obtenerIdsProductosReserva(productosSeleccionados);
      const productosCatalogo = await prisma.producto.findMany({
        where: {
          estudioId,
          activo: true,
          id: { in: idsProductos },
        },
        select: {
          id: true,
          nombre: true,
          categoria: true,
          precio: true,
        },
      });

      if (productosCatalogo.length !== idsProductos.length) {
        return respuesta.code(400).send({
          error: 'Uno o más productos ya no están disponibles en el catálogo del salón',
        });
      }

      productosAdicionalesNormalizados = normalizarProductosAdicionalesReserva({
        planEstudio: estudio.plan,
        productosSeleccionados,
        productosCatalogo,
      }) as unknown as Prisma.InputJsonValue;
    }

    const estadoReserva = estado ?? 'confirmed';
    const estadosValidos = ['pending', 'confirmed', 'working', 'completed', 'cancelled'];
    if (!estadosValidos.includes(estadoReserva)) {
      return respuesta.code(400).send({
        error: 'Estado inválido',
        campos: { estado: 'pending | confirmed | working | completed | cancelled' },
      });
    }

    // Calcular edad para detectar menor de edad solo en reserva pública de cliente app.
    // En reserva manual interna se captura cumpleaños (día/mes), no una fecha de nacimiento completa.
    const nacimiento = new Date(`${fechaNacimiento}T00:00:00`);
    const edad = esClienteApp && fechaNacimiento
      ? calcularEdadDesdeFechaNacimiento(fechaNacimiento)
      : null;
    const esMenorDeEdad = edad !== null && edad < 18;

    // Rechazar reservas en fechas pasadas
    if (fecha < hoyStr) {
      return respuesta.code(400).send({ error: 'No se pueden crear reservas en fechas pasadas' });
    }

    const duracionEfectiva = obtenerDuracionTotalServicios(serviciosNormalizados) || duracion || 60;
    const precioTotalEfectivo = obtenerPrecioTotalServicios(serviciosNormalizados);
    const [hIni, mIni] = horaInicio.split(':').map(Number);
    const inicioMin = (hIni ?? 0) * 60 + (mIni ?? 0);
    const finMin = inicioMin + duracionEfectiva;

    const datosCliente = {
      nombre: sanitizarTexto(nombreCliente),
      fechaNacimiento: nacimiento,
      ...(emailNormalizado !== undefined && { email: emailNormalizado }),
    };

    let cliente;
    try {
      cliente = await prisma.cliente.upsert({
        where: { estudioId_telefono: { estudioId, telefono: telefonoCliente } },
        update: datosCliente,
        create: {
          estudioId,
          telefono: telefonoCliente,
          email: emailNormalizado ?? null,
          ...datosCliente,
        },
      });
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'P2002'
      ) {
        const clienteExistente = await prisma.cliente.findUnique({
          where: { estudioId_telefono: { estudioId, telefono: telefonoCliente } },
          select: { id: true },
        });
        if (!clienteExistente) {
          throw error;
        }
        cliente = await prisma.cliente.update({
          where: { id: clienteExistente.id },
          data: datosCliente,
        });
      } else {
        throw error;
      }
    }

    const columnasReservaDisponibles = await asegurarColumnasAdicionalesReserva();

    let reservaId = '';
    let resultadoFidelidad = { recompensaGanada: false, descripcion: null as string | null };

    try {
      const resultadoTransaccional = await prisma.$transaction(async (tx) => {
        if (usarRecompensa) {
          await canjearRecompensaFidelidad(cliente.id, estudioId, tx);
        }

        const nuevaReservaId = crypto.randomUUID();
        const tokenCancelacion = crypto.randomUUID();
        await insertarReservaCompat(tx, {
          nuevaReservaId,
          estudioId,
          personalId,
          clienteId: cliente.id,
          nombreCliente,
          telefonoCliente,
          fecha,
          horaInicio,
          duracionEfectiva,
          serviciosNormalizados,
          precioTotalEfectivo,
          estadoReserva,
          sucursal: sucursalEfectiva,
          marcaTinte,
          tonalidad,
          notaMenorEdad: esMenorDeEdad
            ? sanitizarTexto('Cliente menor de edad - requiere acompañante adulto')
            : null,
          clienteAppId: clienteAppId ?? null,
          tokenCancelacion,
          observaciones: observaciones ?? null,
          metodoPago: columnasReservaDisponibles ? metodoPago ?? null : null,
          motivoCancelacion: null,
          productosAdicionales: productosAdicionalesNormalizados,
          inicioMin,
          finMin,
        });

        const infraestructuraServiciosDisponible = await asegurarInfraestructuraServiciosDetalle();
        if (infraestructuraServiciosDisponible) {
          try {
            await tx.reservaServicio.createMany({
              data: serviciosNormalizados.map((servicio, indice) => ({
                id: crypto.randomUUID(),
                reservaId: nuevaReservaId,
                nombre: servicio.name,
                duracion: servicio.duration,
                precio: servicio.price,
                categoria: servicio.category ?? null,
                orden: servicio.order ?? indice,
                estado: servicio.status ?? estadoReserva,
                motivo: servicio.motivo ?? null,
              })),
            });
          } catch (error) {
            if (!esErrorCompatibilidadServiciosDetalle(error)) {
              throw error;
            }
          }
        }

        const resultadoFidelidadTx = estadoReserva === 'completed'
          ? await registrarVisitaFidelidad(cliente.id, estudioId, tx)
          : { recompensaGanada: false, descripcion: null };

        return {
          reservaId: nuevaReservaId,
          clienteId: cliente.id,
          resultadoFidelidad: resultadoFidelidadTx,
        };
      });

      reservaId = resultadoTransaccional.reservaId;
      resultadoFidelidad = resultadoTransaccional.resultadoFidelidad;
    } catch (error) {
      if (error instanceof Error && error.message === 'SLOT_OCUPADO') {
        return respuesta.code(409).send({
          error: 'Este horario acaba de ser reservado por otro cliente. Por favor elige otro.',
        });
      }
      if (error instanceof Error) {
        solicitud.log.warn({ err: error }, 'Fallo controlado al crear la reserva');
        return respuesta.code(400).send({ error: 'No fue posible crear la reserva con los datos enviados' });
      }
      throw error;
    }

    const reserva = await buscarReservaCompat({
      where: { id: reservaId },
    });

    if (!reserva) {
      return respuesta.code(500).send({ error: 'No fue posible recuperar la reserva creada' });
    }

    const usuarioAuditoriaId = payload
      ? await resolverUsuarioAuditoriaReserva(payload)
      : null;

    await registrarAuditoria({
      usuarioId: usuarioAuditoriaId,
      accion: 'reserva_creada',
      entidadTipo: 'reserva',
      entidadId: reserva.id,
      detalles: {
        requestId: solicitud.id,
        actor: payload
          ? {
              rol: payload.rol,
              accesoId: payload.sub,
            }
          : { rol: 'publico' },
        estudioId,
        clienteId: cliente.id,
        personalId,
        fecha,
        horaInicio,
        estado: estadoReserva,
        precioTotal: precioTotalEfectivo,
        cantidadServicios: serviciosNormalizados.length,
        cantidadProductos: Array.isArray(productosAdicionalesNormalizados)
          ? productosAdicionalesNormalizados.length
          : 0,
        recompensaUsada: Boolean(usarRecompensa),
      },
      ip: solicitud.ip,
    });

    const descripcionRecompensaAplicada = usarRecompensa
      ? (await obtenerConfigFidelidad(estudioId)).descripcionRecompensa
      : null;

    void enviarEmailConfirmacion(reserva.id, {
      recompensaAplicada: Boolean(usarRecompensa),
      descripcionRecompensa: descripcionRecompensaAplicada,
    }).catch((error) => {
      servidor.log.error(error);
    });
    void notificarNuevaCita(reserva).catch((error) => {
      servidor.log.error(error);
    });
    publicarEventoDisponibilidadTiempoReal({
      tipo: 'reserva_creada',
      estudioId: reserva.estudioId,
      reservaId: reserva.id,
      fecha: reserva.fecha,
      personalId: reserva.personalId,
      timestamp: new Date().toISOString(),
    });

    return respuesta.code(201).send({
      datos: serializarReservaApi(reserva),
      recompensaGanada: resultadoFidelidad.recompensaGanada,
      descripcion: resultadoFidelidad.descripcion,
      recompensaUsada: Boolean(usarRecompensa),
    });
  });

  servidor.get<{ Params: { token: string } }>(
    '/reservas/cancelar/:token',
    {
      config: {
        rateLimit: {
          max: 15,
          timeWindow: '15 minutes',
          errorResponseBuilder: () => ({
            error: 'Demasiados intentos. Espera unos minutos.',
            codigo: 'RATE_LIMIT',
          }),
        },
      },
    },
    async (solicitud, respuesta) => {
      const reserva = await buscarReservaCancelableCompat(solicitud.params.token);

      if (!reserva) {
        return respuesta.code(404).send({ error: 'La reserva no existe o el enlace es inválido.' });
      }

      return respuesta.send({
        datos: {
          id: reserva.id,
          fecha: reserva.fecha,
          horaInicio: reserva.horaInicio,
          estado: reserva.estado,
          nombreCliente: reserva.nombreCliente,
          especialista: reserva.empleado.nombre,
          especialistaEliminado: reserva.empleado.activo === false,
          salon: reserva.estudio.nombre,
          servicios: obtenerServiciosNormalizados(reserva).map((servicio) => ({
            name: servicio.name,
            duration: servicio.duration,
            price: servicio.price,
            ...(servicio.category ? { category: servicio.category } : {}),
          })),
        },
      });
    },
  );

  servidor.post<{ Params: { token: string } }>(
    '/reservas/cancelar/:token',
    {
      config: {
        rateLimit: {
          max: 5,
          timeWindow: '15 minutes',
          errorResponseBuilder: () => ({
            error: 'Demasiados intentos de cancelación. Espera unos minutos.',
            codigo: 'RATE_LIMIT',
          }),
        },
      },
    },
    async (solicitud, respuesta) => {
      const reserva = await buscarReservaCancelableCompat(solicitud.params.token);

      if (!reserva) {
        return respuesta.code(404).send({ error: 'La reserva no existe o el enlace es inválido.' });
      }
      if (reserva.estado === 'cancelled') {
        return respuesta.code(400).send({ error: 'Esta cita ya fue cancelada anteriormente.' });
      }
      if (['completed', 'working'].includes(reserva.estado)) {
        return respuesta.code(400).send({ error: 'Una cita en proceso o ya completada no puede cancelarse desde este enlace.' });
      }

      const hoy = new Date();
      const zonaHorariaSalon = normalizarZonaHorariaEstudio(
        reserva.estudio.zonaHoraria,
        reserva.estudio.pais,
      );
      const hoyStr = obtenerFechaISOEnZona(hoy, zonaHorariaSalon, reserva.estudio.pais);

      if (reserva.fecha < hoyStr) {
        // Fecha pasada — siempre bloqueado
        return respuesta.code(400).send({ error: 'La cita ya ocurrió o está demasiado próxima para cancelarla desde este enlace.' });
      }

      // Aplicar regla de 2 horas mínimas de anticipación
      const fechaHoraCita = construirFechaHoraEnZona(
        reserva.fecha,
        reserva.horaInicio,
        zonaHorariaSalon,
        reserva.estudio.pais,
      );
      const horasRestantes = (fechaHoraCita.getTime() - hoy.getTime()) / (1000 * 60 * 60);
      if (horasRestantes < 2) {
        return respuesta.code(400).send({
          error: 'No puedes cancelar con menos de 2 horas de anticipación. Contacta al salón directamente.',
        });
      }

      const actualizada = await prisma.reserva.update({
        where: { id: reserva.id },
        data: { estado: 'cancelled' },
      });

      await actualizarServiciosReservaCompat({
        where: { reservaId: reserva.id },
        data: { estado: 'cancelled' },
      });

      await sincronizarResumenReserva(reserva.id);

      await registrarAuditoria({
        usuarioId: null,
        accion: 'reserva_cancelada_publica',
        entidadTipo: 'reserva',
        entidadId: reserva.id,
        detalles: {
          requestId: solicitud.id,
          actor: { rol: 'publico' },
          antes: {
            estado: reserva.estado,
          },
          despues: {
            estado: 'cancelled',
          },
          fecha: reserva.fecha,
          horaInicio: reserva.horaInicio,
          estudioNombre: reserva.estudio.nombre,
        },
        ip: solicitud.ip,
      });

      const reservaCompleta = await obtenerReservaConRelacionesPorId(actualizada.id);
      if (reservaCompleta) {
        void notificarCitaCancelada(reservaCompleta);
      }
      publicarEventoDisponibilidadTiempoReal({
        tipo: 'reserva_cancelada',
        estudioId: actualizada.estudioId,
        reservaId: actualizada.id,
        fecha: actualizada.fecha,
        personalId: actualizada.personalId,
        timestamp: new Date().toISOString(),
      });

      return respuesta.send({ datos: actualizada });
    },
  );

  // PUT /reservas/:id/estado
  servidor.put<{ Params: { id: string }; Body: { estado: string; motivo?: string } }>(
    '/reservas/:id/estado',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string; estudioId: string | null };
      const { estado, motivo } = solicitud.body;
      const estadosValidos = ['pending', 'confirmed', 'working', 'completed', 'cancelled'];
      if (!estadosValidos.includes(estado)) {
        return respuesta.code(400).send({ error: 'Estado inválido', campos: { estado: 'pending | confirmed | working | completed | cancelled' } });
      }

      await asegurarInfraestructuraServiciosDetalle();
      await asegurarColumnasAdicionalesReserva();

      const motivoNormalizado = normalizarMotivoAccion(motivo);
      if (estado === 'cancelled' && (!motivoNormalizado || motivoNormalizado.length < 4)) {
        return respuesta.code(400).send({ error: 'Debes indicar un motivo de cancelación más claro (mínimo 4 caracteres y máximo 200).' });
      }

      const reservaExistente = await prisma.reserva.findUnique({
        where: { id: solicitud.params.id },
        select: {
          estudioId: true,
          estado: true,
          clienteId: true,
          motivoCancelacion: true,
        },
      });
      if (!reservaExistente) return respuesta.code(404).send({ error: 'Reserva no encontrada' });
      if (!(payload.rol === 'maestro' || (payload.rol === 'dueno' && payload.estudioId === reservaExistente.estudioId))) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      if (payload.rol === 'dueno') {
        const reservaDelDueno = await prisma.reserva.findFirst({
          where: {
            id: solicitud.params.id,
            estudio: {
              usuarios: {
                some: {
                  id: payload.sub,
                  rol: 'dueno',
                },
              },
            },
          },
          select: { id: true },
        });
        if (!reservaDelDueno) {
          return respuesta.code(403).send({ error: 'Sin acceso a este recurso' });
        }
      }

      // Máquina de estados — solo se permiten transiciones válidas
      const TRANSICIONES_VALIDAS: Record<string, string[]> = {
        pending: ['confirmed', 'working', 'cancelled'],
        confirmed: ['working', 'completed', 'cancelled'],
        working: ['confirmed', 'completed', 'cancelled'],
        completed: [],
        cancelled: [],
      };
      const transicionesPermitidas = TRANSICIONES_VALIDAS[reservaExistente.estado] ?? [];
      if (!transicionesPermitidas.includes(estado)) {
        return respuesta.code(422).send({
          error: `Transición no permitida: '${reservaExistente.estado}' → '${estado}'. Permitidas: [${transicionesPermitidas.join(', ') || 'ninguna'}]`,
        });
      }

      const actualizada = await prisma.reserva.update({
        where: { id: solicitud.params.id },
        data: {
          estado,
          ...(estado === 'cancelled'
            ? { motivoCancelacion: motivoNormalizado }
            : { motivoCancelacion: null }),
        },
      });

      if (estado === 'confirmed') {
        await actualizarServiciosReservaCompat({
          where: {
            reservaId: solicitud.params.id,
            estado: { in: ['pending', 'working'] },
          },
          data: { estado: 'confirmed' },
        });
      }

      if (estado === 'working') {
        await actualizarServiciosReservaCompat({
          where: {
            reservaId: solicitud.params.id,
            estado: { in: ['pending', 'confirmed'] },
          },
          data: { estado: 'working' },
        });
      }

      if (estado === 'completed') {
        await actualizarServiciosReservaCompat({
          where: {
            reservaId: solicitud.params.id,
            estado: { in: ['pending', 'confirmed', 'working'] },
          },
          data: { estado: 'completed' },
        });
      }

      if (estado === 'cancelled') {
        await actualizarServiciosReservaCompat({
          where: {
            reservaId: solicitud.params.id,
            estado: { in: ['pending', 'confirmed', 'working'] },
          },
          data: { estado: 'cancelled', motivo: motivoNormalizado },
        });
      }

      const reservaCompleta = await sincronizarResumenReserva(actualizada.id);

      if (payload.rol === 'maestro' || payload.rol === 'dueno') {
        await registrarAuditoria({
          usuarioId: payload.sub,
          accion: estado === 'cancelled' ? 'reserva_cancelada' : 'reserva_actualizada',
          entidadTipo: 'reserva',
          entidadId: actualizada.id,
          detalles: {
            requestId: solicitud.id,
            actor: {
              rol: payload.rol,
              accesoId: payload.sub,
            },
            antes: {
              estado: reservaExistente.estado,
              motivoCancelacion: reservaExistente.motivoCancelacion ?? null,
            },
            despues: {
              estado,
              motivoCancelacion: motivoNormalizado,
            },
            motivo: motivoNormalizado,
          },
          ip: solicitud.ip,
        });
      }

      if (reservaCompleta && estado === 'confirmed') {
        void notificarCitaConfirmada(reservaCompleta);
      }
      if (reservaCompleta && estado === 'completed') {
        void registrarVisitaFidelidad(reservaExistente.clienteId, reservaExistente.estudioId);
      }
      if (reservaCompleta && estado === 'cancelled') {
        void notificarCitaCancelada(reservaCompleta);
        // Si venía de 'completed', revertir la visita de fidelidad
        if (reservaExistente.estado === 'completed') {
          void revertirVisitaFidelidad(reservaExistente.clienteId, reservaExistente.estudioId);
        }
      }

      publicarEventoDisponibilidadTiempoReal({
        tipo: estado === 'cancelled' ? 'reserva_cancelada' : 'reserva_actualizada',
        estudioId: reservaExistente.estudioId,
        reservaId: actualizada.id,
        fecha: actualizada.fecha,
        personalId: actualizada.personalId,
        timestamp: new Date().toISOString(),
      });

      return respuesta.send({ datos: actualizada });
    },
  );

  servidor.put<{
    Params: { id: string; servicioId: string };
    Body: { estado: string; motivo?: string };
  }>(
    '/reservas/:id/servicios/:servicioId/estado',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string; estudioId: string | null };
      const { estado, motivo } = solicitud.body;
      const estadosValidos = ['pending', 'confirmed', 'working', 'completed', 'cancelled', 'no_show'];

      if (!estadosValidos.includes(estado)) {
        return respuesta.code(400).send({
          error: 'Estado inválido',
          campos: { estado: 'pending | confirmed | working | completed | cancelled | no_show' },
        });
      }

      const motivoNormalizado = normalizarMotivoAccion(motivo);
      if (['cancelled', 'no_show'].includes(estado) && (!motivoNormalizado || motivoNormalizado.length < 4)) {
        return respuesta.code(400).send({ error: 'Debes escribir un motivo claro para registrar esta acción (mínimo 4 caracteres y máximo 200).' });
      }

      const reservaExistente = await prisma.reserva.findUnique({
        where: { id: solicitud.params.id },
        select: {
          id: true,
          estudioId: true,
          estado: true,
        },
      });

      if (!reservaExistente) {
        return respuesta.code(404).send({ error: 'Reserva no encontrada' });
      }

      if (!(payload.rol === 'maestro' || (payload.rol === 'dueno' && payload.estudioId === reservaExistente.estudioId))) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      if (payload.rol === 'dueno') {
        const reservaDelDueno = await prisma.reserva.findFirst({
          where: {
            id: solicitud.params.id,
            estudio: {
              usuarios: {
                some: {
                  id: payload.sub,
                  rol: 'dueno',
                },
              },
            },
          },
          select: { id: true },
        });

        if (!reservaDelDueno) {
          return respuesta.code(403).send({ error: 'Sin acceso a este recurso' });
        }

      }

      const servicioExistente = await prisma.reservaServicio.findFirst({
        where: {
          id: solicitud.params.servicioId,
          reservaId: solicitud.params.id,
        },
        select: {
          id: true,
          estado: true,
          nombre: true,
          motivo: true,
        },
      });

      if (!servicioExistente) {
        return respuesta.code(404).send({ error: 'Servicio de la reserva no encontrado' });
      }

      await prisma.reservaServicio.update({
        where: { id: solicitud.params.servicioId },
        data: { estado, ...(motivoNormalizado !== null && { motivo: motivoNormalizado }) },
      });

      const reservaActualizada = await sincronizarResumenReserva(solicitud.params.id);

      if (payload.rol === 'maestro' || payload.rol === 'dueno') {
        await registrarAuditoria({
          usuarioId: payload.sub,
          accion: 'reserva_servicio_actualizado',
          entidadTipo: 'reserva',
          entidadId: solicitud.params.id,
          detalles: {
            requestId: solicitud.id,
            actor: {
              rol: payload.rol,
              accesoId: payload.sub,
            },
            servicioId: servicioExistente.id,
            servicioNombre: servicioExistente.nombre,
            antes: {
              estado: servicioExistente.estado,
              motivo: servicioExistente.motivo ?? null,
            },
            despues: {
              estado,
              motivo: motivoNormalizado,
            },
            motivo: motivoNormalizado,
          },
          ip: solicitud.ip,
        });
      }

      return respuesta.send({ datos: reservaActualizada });
    },
  );

  // POST /reservas/:id/servicios — agregar servicio adicional a una reserva existente
  servidor.post<{
    Params: { id: string };
    Body: { nombre: string; duracion: number; precio: number; categoria?: string };
  }>(
    '/reservas/:id/servicios',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string; estudioId: string | null; personalId?: string };

      const esquemaAdicional = z.object({
        nombre: z.string().trim().min(1, 'El nombre del servicio es requerido'),
        duracion: z.number().int().min(5, 'Duración mínima 5 minutos'),
        precio: z.number().int().min(0, 'El precio no puede ser negativo'),
        categoria: z.string().trim().optional(),
      });

      const resultado = esquemaAdicional.safeParse(solicitud.body);
      if (!resultado.success) {
        const campos = Object.fromEntries(
          resultado.error.issues.map((issue) => [issue.path.join('.') || 'body', issue.message]),
        );
        return respuesta.code(400).send({ error: 'Datos inválidos', campos });
      }

      const { nombre, duracion, precio, categoria } = resultado.data;

      const reservaExistente = await prisma.reserva.findUnique({
        where: { id: solicitud.params.id },
        select: {
          id: true,
          estudioId: true,
          estado: true,
          personalId: true,
        },
      });

      if (!reservaExistente) {
        return respuesta.code(404).send({ error: 'Reserva no encontrada' });
      }

      if (['completed', 'cancelled'].includes(reservaExistente.estado)) {
        return respuesta.code(400).send({ error: 'No se pueden agregar servicios a una reserva finalizada o cancelada' });
      }

      if (!(
        payload.rol === 'maestro' ||
        (payload.rol === 'dueno' && payload.estudioId === reservaExistente.estudioId) ||
        (payload.rol === 'empleado' && payload.estudioId === reservaExistente.estudioId)
      )) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      if (payload.rol === 'empleado') {
        if (!payload.personalId || reservaExistente.personalId !== payload.personalId) {
          return respuesta.code(403).send({ error: 'Solo puedes agregar extras a tus propias citas' });
        }
      }

      if (payload.rol === 'dueno') {
        const reservaDelDueno = await prisma.reserva.findFirst({
          where: {
            id: solicitud.params.id,
            estudio: {
              usuarios: { some: { id: payload.sub, rol: 'dueno' } },
            },
          },
          select: { id: true },
        });
        if (!reservaDelDueno) {
          return respuesta.code(403).send({ error: 'Sin acceso a este recurso' });
        }
      }

      await asegurarInfraestructuraServiciosDetalle();

      const ordenActual = await prisma.reservaServicio.count({
        where: { reservaId: solicitud.params.id },
      });

      await prisma.reservaServicio.create({
        data: {
          id: crypto.randomUUID(),
          reservaId: solicitud.params.id,
          nombre,
          duracion,
          precio,
          categoria: categoria ?? null,
          orden: ordenActual,
          estado:
            reservaExistente.estado === 'working'
              ? 'working'
              : reservaExistente.estado === 'confirmed'
                ? 'confirmed'
                : 'pending',
        },
      });

      const reservaActualizada = await sincronizarResumenReserva(solicitud.params.id);

      const usuarioAuditoriaId = await resolverUsuarioAuditoriaReserva(payload);

      if (usuarioAuditoriaId) {
        await registrarAuditoria({
          usuarioId: usuarioAuditoriaId,
          accion: 'reserva_servicio_agregado',
          entidadTipo: 'reserva',
          entidadId: solicitud.params.id,
          detalles: {
            requestId: solicitud.id,
            servicioNombre: nombre,
            duracion,
            precio,
            actor: {
              rol: payload.rol,
              accesoId: payload.sub,
              personalId: payload.personalId ?? null,
            },
          },
          ip: solicitud.ip,
        });
      } else {
        solicitud.log.warn(
          { reservaId: solicitud.params.id, actorRol: payload.rol, accesoId: payload.sub },
          'No se pudo resolver un usuario para auditar el servicio adicional de la reserva',
        );
      }

      return respuesta.send({ datos: reservaActualizada });
    },
  );

  // POST /reservas/:id/productos — agregar producto adicional a una reserva existente
  servidor.post<{
    Params: { id: string };
    Body: { productoId: string; cantidad: number };
  }>(
    '/reservas/:id/productos',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as {
        sub: string;
        rol: string;
        estudioId: string | null;
        personalId?: string;
      };

      const esquemaProductoAdicional = z.object({
        productoId: z.string().trim().min(1, 'Debes seleccionar un producto'),
        cantidad: z.number().int().min(1, 'La cantidad mínima es 1').max(20, 'La cantidad máxima es 20'),
      });

      const resultado = esquemaProductoAdicional.safeParse(solicitud.body);
      if (!resultado.success) {
        const campos = Object.fromEntries(
          resultado.error.issues.map((issue) => [issue.path.join('.') || 'body', issue.message]),
        );
        return respuesta.code(400).send({ error: 'Datos inválidos', campos });
      }

      await asegurarColumnasAdicionalesReserva();

      const reservaExistente = await prisma.reserva.findUnique({
        where: { id: solicitud.params.id },
        select: {
          id: true,
          estudioId: true,
          estado: true,
          personalId: true,
          productosAdicionales: true,
          estudio: {
            select: {
              plan: true,
            },
          },
        },
      });

      if (!reservaExistente) {
        return respuesta.code(404).send({ error: 'Reserva no encontrada' });
      }

      if (['completed', 'cancelled'].includes(reservaExistente.estado)) {
        return respuesta.code(400).send({ error: 'No se pueden agregar productos a una reserva finalizada o cancelada' });
      }

      if (!(
        payload.rol === 'maestro' ||
        (payload.rol === 'dueno' && payload.estudioId === reservaExistente.estudioId) ||
        (payload.rol === 'empleado' && payload.estudioId === reservaExistente.estudioId)
      )) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      if (payload.rol === 'empleado' && (!payload.personalId || payload.personalId !== reservaExistente.personalId)) {
        return respuesta.code(403).send({ error: 'Solo puedes agregar productos a tus propias citas' });
      }

      if (!planPermiteFuncion({ plan: reservaExistente.estudio.plan, funcion: 'ventasProductos' })) {
        return respuesta
          .code(403)
          .send({ error: obtenerMensajeRestriccionPlan('ventasProductos') });
      }

      const producto = await prisma.producto.findFirst({
        where: {
          id: resultado.data.productoId,
          estudioId: reservaExistente.estudioId,
          activo: true,
        },
        select: {
          id: true,
          nombre: true,
          categoria: true,
          precio: true,
        },
      });

      if (!producto) {
        return respuesta.code(404).send({ error: 'Producto no disponible en este salón' });
      }

      const productosActuales = Array.isArray(reservaExistente.productosAdicionales)
        ? [...(reservaExistente.productosAdicionales as Array<Record<string, unknown>>)]
        : [];
      const indiceExistente = productosActuales.findIndex((item) => item['id'] === producto.id);

      if (indiceExistente >= 0) {
        const itemActual = productosActuales[indiceExistente] ?? {};
        const cantidadNueva = Number(itemActual['cantidad'] ?? 1) + resultado.data.cantidad;
        productosActuales[indiceExistente] = {
          id: producto.id,
          nombre: producto.nombre,
          categoria: producto.categoria,
          cantidad: cantidadNueva,
          precioUnitario: producto.precio,
          total: producto.precio * cantidadNueva,
        };
      } else {
        productosActuales.push({
          id: producto.id,
          nombre: producto.nombre,
          categoria: producto.categoria,
          cantidad: resultado.data.cantidad,
          precioUnitario: producto.precio,
          total: producto.precio * resultado.data.cantidad,
        });
      }

      await prisma.reserva.update({
        where: { id: solicitud.params.id },
        data: {
          productosAdicionales: productosActuales as Prisma.InputJsonValue,
        },
      });

      const reservaActualizada = await sincronizarResumenReserva(solicitud.params.id);
      const usuarioAuditoriaId = await resolverUsuarioAuditoriaReserva(payload);

      if (usuarioAuditoriaId) {
        await registrarAuditoria({
          usuarioId: usuarioAuditoriaId,
          accion: 'reserva_producto_agregado',
          entidadTipo: 'reserva',
          entidadId: solicitud.params.id,
          detalles: {
            requestId: solicitud.id,
            productoId: producto.id,
            productoNombre: producto.nombre,
            cantidad: resultado.data.cantidad,
            precioUnitario: producto.precio,
            actor: {
              rol: payload.rol,
              accesoId: payload.sub,
              personalId: payload.personalId ?? null,
            },
          },
          ip: solicitud.ip,
        });
      }

      return respuesta.send({ datos: reservaActualizada });
    },
  );
}
