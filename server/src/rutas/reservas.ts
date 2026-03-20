import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { z } from 'zod';
import type { Prisma } from '../generated/prisma/client.js';
import { canjearRecompensaFidelidad, obtenerConfigFidelidad, registrarVisitaFidelidad, revertirVisitaFidelidad } from '../lib/fidelidad.js';
import {
  calcularResumenServicios,
  incluirReservaConRelaciones,
  incluirServiciosDetalleReserva,
  normalizarServiciosEntrada,
  obtenerDuracionTotalServicios,
  obtenerPrecioTotalServicios,
  obtenerServiciosNormalizados,
  serializarReservaApi,
} from '../lib/serializacionReservas.js';
import { prisma } from '../prismaCliente.js';
import { enviarEmailConfirmacion } from '../servicios/servicioEmail.js';
import { verificarJWT, verificarJWTOpcional } from '../middleware/autenticacion.js';
import { registrarAuditoria } from '../utils/auditoria.js';
import { sanitizarTexto } from '../utils/sanitizar.js';
import {
  notificarCitaCancelada,
  notificarCitaConfirmada,
  notificarNuevaCita,
  obtenerReservaConRelacionesPorId,
} from '../utils/notificarReserva.js';

function serializarServiciosResumen(servicios: ReturnType<typeof obtenerServiciosNormalizados>): Prisma.InputJsonValue {
  return servicios.map((servicio) => ({
    name: servicio.name,
    duration: servicio.duration,
    price: servicio.price,
    ...(servicio.category ? { category: servicio.category } : {}),
  })) as Prisma.InputJsonValue;
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
  precioTotal: z.number().min(0).optional(),
  estado: z.enum(['pending', 'confirmed', 'completed', 'cancelled']).optional(),
  sucursal: z.string().trim().optional(),
  marcaTinte: z.string().trim().optional().nullable(),
  tonalidad: z.string().trim().optional().nullable(),
  usarRecompensa: z.boolean().optional(),
});

const esquemaDatosClienteReserva = z.object({
  nombreCliente: z.string().trim().min(2, 'El nombre del cliente es obligatorio'),
  telefonoCliente: z
    .string()
    .trim()
    .regex(/^[0-9+\-\s()]{7,20}$/, 'El teléfono debe contener entre 7 y 20 caracteres válidos'),
  fechaNacimiento: z
    .string()
    .trim()
    .refine((valor) => /^\d{4}-\d{2}-\d{2}$/.test(valor), 'La fecha de nacimiento debe usar formato YYYY-MM-DD')
    .refine((valor) => !Number.isNaN(new Date(`${valor}T00:00:00`).getTime()), 'La fecha de nacimiento no es válida'),
});

async function sincronizarResumenReserva(reservaId: string) {
  const reserva = await prisma.reserva.findUnique({
    where: { id: reservaId },
    include: incluirServiciosDetalleReserva,
  });

  if (!reserva) return null;

  const servicios = obtenerServiciosNormalizados(reserva);
  const resumen = calcularResumenServicios(servicios);
  const serviciosActivos = resumen.serviciosActivos;

  let estadoReserva = reserva.estado;
  if (serviciosActivos.length === 0 && servicios.length > 0) {
    estadoReserva = 'cancelled';
  } else if (serviciosActivos.length > 0 && serviciosActivos.every((servicio) => servicio.status === 'completed')) {
    estadoReserva = 'completed';
  } else if (serviciosActivos.length > 0 && serviciosActivos.every((servicio) => ['confirmed', 'completed'].includes(servicio.status ?? 'pending'))) {
    estadoReserva = 'confirmed';
  } else if (serviciosActivos.some((servicio) => servicio.status === 'confirmed' || servicio.status === 'completed')) {
    estadoReserva = 'confirmed';
  } else {
    estadoReserva = 'pending';
  }

  await prisma.reserva.update({
    where: { id: reservaId },
    data: {
      estado: estadoReserva,
      duracion: resumen.duracionTotal,
      precioTotal: resumen.precioTotal,
      servicios: serializarServiciosResumen(serviciosActivos),
    },
  });

  return obtenerReservaConRelacionesPorId(reservaId);
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

      const [total, reservas] = await Promise.all([
        prisma.reserva.count(),
        prisma.reserva.findMany({
          orderBy: [{ fecha: 'desc' }, { horaInicio: 'asc' }],
          skip: saltar,
          take: limite,
          include: incluirServiciosDetalleReserva,
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
      if (payload.rol !== 'maestro' && payload.estudioId !== id) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      const where: Record<string, unknown> = { estudioId: id };
      if (solicitud.query.fecha) where['fecha'] = solicitud.query.fecha;

      // Si se piden todas (sin pagina), devolver lista plana para compatibilidad
      if (!solicitud.query.pagina) {
        const reservas = await prisma.reserva.findMany({
          where,
          orderBy: [{ fecha: 'asc' }, { horaInicio: 'asc' }],
          include: incluirServiciosDetalleReserva,
        });
        return respuesta.send({ datos: reservas.map(serializarReservaApi) });
      }

      const pagina = Math.max(1, parseInt(solicitud.query.pagina, 10));
      const limite = Math.min(100, Math.max(1, parseInt(solicitud.query.limite ?? '20', 10)));
      const saltar = (pagina - 1) * limite;

      const [total, reservas] = await Promise.all([
        prisma.reserva.count({ where }),
        prisma.reserva.findMany({
          where,
          orderBy: [{ fecha: 'desc' }, { horaInicio: 'asc' }],
          skip: saltar,
          take: limite,
          include: incluirServiciosDetalleReserva,
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
      usarRecompensa?: boolean;
    };
  }>('/reservas', { preHandler: verificarJWTOpcional }, async (solicitud, respuesta) => {
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
      estudioId, personalId,
      fecha, horaInicio, duracion, servicios, precioTotal, estado, sucursal, marcaTinte, tonalidad, usarRecompensa,
    } = datosReserva;

    let nombreCliente = datosReserva.nombreCliente ?? '';
    let telefonoCliente = datosReserva.telefonoCliente ?? '';
    let fechaNacimiento = datosReserva.fechaNacimiento ?? '';
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

    const [personal, estudio] = await Promise.all([
      prisma.personal.findFirst({
        where: { id: personalId, estudioId, activo: true },
        select: { id: true },
      }),
      prisma.estudio.findUnique({
        where: { id: estudioId },
        select: { fechaVencimiento: true, estado: true, activo: true },
      }),
    ]);

    if (!personal) {
      return respuesta.code(400).send({ error: 'El especialista no está disponible en este salón' });
    }

    if (!estudio || !estudio.activo || estudio.estado !== 'aprobado') {
      return respuesta.code(400).send({ error: 'Este salón no está disponible para reservas' });
    }

    // Verificar que el salón no haya vencido
    const ahora = new Date();
    const hoyStr = `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
    if (estudio.fechaVencimiento < hoyStr) {
      return respuesta.code(400).send({ error: 'Este salón no tiene una suscripción activa' });
    }

    // ─── Si es un ClienteApp autenticado, rellenar datos desde su perfil ──
    const esClienteApp = payload?.rol === 'cliente' && payload.estudioId === null;
    if (esClienteApp) {
      const clienteApp = await prisma.clienteApp.findUnique({
        where: { id: payload.sub },
        select: { id: true, nombre: true, apellido: true, telefono: true, fechaNacimiento: true },
      });
      if (!clienteApp) {
        return respuesta.code(401).send({ error: 'No autenticado' });
      }
      clienteAppId = clienteApp.id;
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
        fechaNacimiento = clienteApp.fechaNacimiento.toISOString().split('T')[0]!;
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

    const serviciosNormalizados = normalizarServiciosEntrada(servicios);
    if (serviciosNormalizados.length === 0) {
      return respuesta.code(400).send({
        error: 'Debes seleccionar al menos un servicio válido para la reserva',
      });
    }

    const estadoReserva = estado ?? 'pending';
    const estadosValidos = ['pending', 'confirmed', 'completed', 'cancelled'];
    if (!estadosValidos.includes(estadoReserva)) {
      return respuesta.code(400).send({
        error: 'Estado inválido',
        campos: { estado: 'pending | confirmed | completed | cancelled' },
      });
    }

    // Calcular edad para detectar menor de edad
    const nacimiento = new Date(`${fechaNacimiento}T00:00:00`);
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const cumpleEsteAnio = new Date(hoy.getFullYear(), nacimiento.getMonth(), nacimiento.getDate());
    if (hoy < cumpleEsteAnio) edad--;
    const esMenorDeEdad = edad < 18;

    // Rechazar reservas en fechas pasadas
    if (fecha < hoyStr) {
      return respuesta.code(400).send({ error: 'No se pueden crear reservas en fechas pasadas' });
    }

    const duracionEfectiva = obtenerDuracionTotalServicios(serviciosNormalizados) || duracion || 60;
    const precioTotalEfectivo = obtenerPrecioTotalServicios(serviciosNormalizados) || precioTotal || 0;
    const [hIni, mIni] = horaInicio.split(':').map(Number);
    const inicioMin = (hIni ?? 0) * 60 + (mIni ?? 0);
    const finMin = inicioMin + duracionEfectiva;

    const datosCliente = {
      nombre: nombreCliente,
      fechaNacimiento: nacimiento,
      ...(email !== undefined && { email }),
    };

    let cliente;
    try {
      cliente = await prisma.cliente.upsert({
        where: { estudioId_telefono: { estudioId, telefono: telefonoCliente } },
        update: datosCliente,
        create: {
          estudioId,
          telefono: telefonoCliente,
          email: email ?? null,
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

    let reservaId = '';
    let resultadoFidelidad = { recompensaGanada: false, descripcion: null as string | null };

    try {
      const resultadoTransaccional = await prisma.$transaction(async (tx) => {
        if (usarRecompensa) {
          await canjearRecompensaFidelidad(cliente.id, estudioId, tx);
        }

        const nuevaReservaId = crypto.randomUUID();
        const tokenCancelacion = crypto.randomUUID();
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
            creadoEn
          )
          SELECT
            ${nuevaReservaId},
            ${estudioId},
            ${personalId},
            ${cliente.id},
            ${nombreCliente},
            ${telefonoCliente},
            ${fecha},
            ${horaInicio},
            ${duracionEfectiva},
            CAST(${JSON.stringify(serviciosNormalizados.map((servicio) => ({
              name: servicio.name,
              duration: servicio.duration,
              price: servicio.price,
              ...(servicio.category ? { category: servicio.category } : {}),
            })))} AS JSON),
            ${precioTotalEfectivo},
            ${estadoReserva},
            ${sucursal ?? ''},
            ${marcaTinte ?? null},
            ${tonalidad ?? null},
            ${esMenorDeEdad ? sanitizarTexto('Cliente menor de edad — requiere acompañante adulto') : null},
            ${clienteAppId ?? null},
            ${tokenCancelacion},
            false,
            NOW()
          FROM DUAL
          WHERE NOT EXISTS (
            SELECT 1
            FROM reservas
            WHERE personalId = ${personalId}
              AND fecha = ${fecha}
              AND estado IN ('pending', 'confirmed')
              AND ${inicioMin} < (TIME_TO_SEC(horaInicio) / 60 + duracion)
              AND ${finMin} > (TIME_TO_SEC(horaInicio) / 60)
          )
        `;

        if (filasInsertadas === 0) {
          throw new Error('SLOT_OCUPADO');
        }

        await tx.reservaServicio.createMany({
          data: serviciosNormalizados.map((servicio, indice) => ({
            reservaId: nuevaReservaId,
            nombre: servicio.name,
            duracion: servicio.duration,
            precio: servicio.price,
            categoria: servicio.category ?? null,
            orden: servicio.order ?? indice,
            estado: servicio.status ?? estadoReserva,
          })),
        });

        const resultadoFidelidadTx = estadoReserva === 'confirmed'
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
        return respuesta.code(400).send({ error: error.message });
      }
      throw error;
    }

    const reserva = await prisma.reserva.findUnique({
      where: { id: reservaId },
      include: incluirReservaConRelaciones,
    });

    if (!reserva) {
      return respuesta.code(500).send({ error: 'No fue posible recuperar la reserva creada' });
    }

    const descripcionRecompensaAplicada = usarRecompensa
      ? (await obtenerConfigFidelidad(estudioId)).descripcionRecompensa
      : null;

    void enviarEmailConfirmacion(reserva.id, {
      recompensaAplicada: Boolean(usarRecompensa),
      descripcionRecompensa: descripcionRecompensaAplicada,
    });
    void notificarNuevaCita(reserva);

    return respuesta.code(201).send({
      datos: serializarReservaApi(reserva),
      recompensaGanada: resultadoFidelidad.recompensaGanada,
      descripcion: resultadoFidelidad.descripcion,
      recompensaUsada: Boolean(usarRecompensa),
    });
  });

  servidor.get<{ Params: { token: string } }>(
    '/reservas/cancelar/:token',
    async (solicitud, respuesta) => {
      const reserva = await prisma.reserva.findUnique({
        where: { tokenCancelacion: solicitud.params.token },
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
          empleado: { select: { nombre: true } },
          estudio: { select: { nombre: true } },
        },
      });

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
    async (solicitud, respuesta) => {
      const reserva = await prisma.reserva.findUnique({
        where: { tokenCancelacion: solicitud.params.token },
        select: { id: true, fecha: true, horaInicio: true, estado: true },
      });

      if (!reserva) {
        return respuesta.code(404).send({ error: 'La reserva no existe o el enlace es inválido.' });
      }
      if (reserva.estado === 'cancelled') {
        return respuesta.code(400).send({ error: 'Esta cita ya fue cancelada anteriormente.' });
      }
      if (['completed'].includes(reserva.estado)) {
        return respuesta.code(400).send({ error: 'Una cita ya completada no puede cancelarse.' });
      }

      const hoy = new Date();
      const compensacion = hoy.getTimezoneOffset();
      const hoyStr = new Date(hoy.getTime() - compensacion * 60 * 1000).toISOString().split('T')[0]!;

      if (reserva.fecha < hoyStr) {
        // Fecha pasada — siempre bloqueado
        return respuesta.code(400).send({ error: 'La cita ya ocurrió o está demasiado próxima para cancelarla desde este enlace.' });
      }

      // Aplicar regla de 2 horas mínimas de anticipación
      const [rH, rM] = reserva.horaInicio.split(':').map(Number);
      const fechaHoraCita = new Date(`${reserva.fecha}T${String(rH ?? 0).padStart(2, '0')}:${String(rM ?? 0).padStart(2, '0')}:00`);
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

      await prisma.reservaServicio.updateMany({
        where: { reservaId: reserva.id },
        data: { estado: 'cancelled' },
      });

      await sincronizarResumenReserva(reserva.id);

      const reservaCompleta = await obtenerReservaConRelacionesPorId(actualizada.id);
      if (reservaCompleta) {
        void notificarCitaCancelada(reservaCompleta);
      }

      return respuesta.send({ datos: actualizada });
    },
  );

  // PUT /reservas/:id/estado
  servidor.put<{ Params: { id: string }; Body: { estado: string; pinCancelacion?: string } }>(
    '/reservas/:id/estado',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string; estudioId: string | null };
      const { estado, pinCancelacion } = solicitud.body;
      const estadosValidos = ['pending', 'confirmed', 'completed', 'cancelled'];
      if (!estadosValidos.includes(estado)) {
        return respuesta.code(400).send({ error: 'Estado inválido', campos: { estado: 'pending | confirmed | completed | cancelled' } });
      }
      const reservaExistente = await prisma.reserva.findUnique({
        where: { id: solicitud.params.id },
        select: {
          estudioId: true,
          estado: true,
          clienteId: true,
          estudio: {
            select: {
              pinCancelacionHash: true,
            },
          },
        },
      });
      if (!reservaExistente) return respuesta.code(404).send({ error: 'Reserva no encontrada' });
      if (payload.rol !== 'maestro' && payload.estudioId !== reservaExistente.estudioId) {
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
        if (estado === 'cancelled') {
          if (!reservaExistente.estudio.pinCancelacionHash) {
            return respuesta.code(403).send({ error: 'Configura el PIN de cancelación en la sección Seguridad antes de cancelar citas' });
          }
          const pinValido = !!pinCancelacion && await bcrypt.compare(pinCancelacion, reservaExistente.estudio.pinCancelacionHash);
          if (!pinValido) {
            return respuesta.code(403).send({ error: 'PIN de cancelación inválido' });
          }
        }
      }

      // Máquina de estados — solo se permiten transiciones válidas
      const TRANSICIONES_VALIDAS: Record<string, string[]> = {
        pending: ['confirmed', 'cancelled'],
        confirmed: ['completed', 'cancelled'],
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
        data: { estado },
      });

      if (estado === 'confirmed') {
        await prisma.reservaServicio.updateMany({
          where: { reservaId: solicitud.params.id, estado: 'pending' },
          data: { estado: 'confirmed' },
        });
      }

      if (estado === 'completed') {
        await prisma.reservaServicio.updateMany({
          where: {
            reservaId: solicitud.params.id,
            estado: { in: ['pending', 'confirmed'] },
          },
          data: { estado: 'completed' },
        });
      }

      if (estado === 'cancelled') {
        await prisma.reservaServicio.updateMany({
          where: {
            reservaId: solicitud.params.id,
            estado: { in: ['pending', 'confirmed'] },
          },
          data: { estado: 'cancelled' },
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
            estadoAnterior: reservaExistente.estado,
            estadoNuevo: estado,
          },
          ip: solicitud.ip,
        });
      }

      if (reservaCompleta && estado === 'confirmed') {
        void notificarCitaConfirmada(reservaCompleta);
        void registrarVisitaFidelidad(reservaExistente.clienteId, reservaExistente.estudioId);
      }
      if (reservaCompleta && estado === 'cancelled') {
        void notificarCitaCancelada(reservaCompleta);
        // Si venía de 'confirmed', revertir la visita de fidelidad
        if (reservaExistente.estado === 'confirmed') {
          void revertirVisitaFidelidad(reservaExistente.clienteId, reservaExistente.estudioId);
        }
      }

      return respuesta.send({ datos: actualizada });
    },
  );

  servidor.put<{
    Params: { id: string; servicioId: string };
    Body: { estado: string; pinCancelacion?: string; motivo?: string };
  }>(
    '/reservas/:id/servicios/:servicioId/estado',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string; estudioId: string | null };
      const { estado, pinCancelacion, motivo } = solicitud.body;
      const estadosValidos = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];

      if (!estadosValidos.includes(estado)) {
        return respuesta.code(400).send({
          error: 'Estado inválido',
          campos: { estado: 'pending | confirmed | completed | cancelled | no_show' },
        });
      }

      const reservaExistente = await prisma.reserva.findUnique({
        where: { id: solicitud.params.id },
        select: {
          id: true,
          estudioId: true,
          estado: true,
          estudio: {
            select: {
              pinCancelacionHash: true,
            },
          },
        },
      });

      if (!reservaExistente) {
        return respuesta.code(404).send({ error: 'Reserva no encontrada' });
      }

      if (payload.rol !== 'maestro' && payload.estudioId !== reservaExistente.estudioId) {
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

        if (['cancelled', 'no_show'].includes(estado)) {
          if (!reservaExistente.estudio.pinCancelacionHash) {
            return respuesta.code(403).send({ error: 'Configura el PIN de cancelación en la sección Seguridad antes de usar esta acción' });
          }
          const pinValido = !!pinCancelacion && await bcrypt.compare(pinCancelacion, reservaExistente.estudio.pinCancelacionHash);
          if (!pinValido) {
            return respuesta.code(403).send({ error: 'PIN de cancelación inválido' });
          }
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
        },
      });

      if (!servicioExistente) {
        return respuesta.code(404).send({ error: 'Servicio de la reserva no encontrado' });
      }

      await prisma.reservaServicio.update({
        where: { id: solicitud.params.servicioId },
        data: { estado, ...(motivo !== undefined && { motivo }) },
      });

      const reservaActualizada = await sincronizarResumenReserva(solicitud.params.id);

      if (payload.rol === 'maestro' || payload.rol === 'dueno') {
        await registrarAuditoria({
          usuarioId: payload.sub,
          accion: 'reserva_servicio_actualizado',
          entidadTipo: 'reserva',
          entidadId: solicitud.params.id,
          detalles: {
            servicioId: servicioExistente.id,
            servicioNombre: servicioExistente.nombre,
            estadoAnterior: servicioExistente.estado,
            estadoNuevo: estado,
          },
          ip: solicitud.ip,
        });
      }

      return respuesta.send({ datos: reservaActualizada });
    },
  );
}
