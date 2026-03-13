import type { FastifyInstance } from 'fastify';
import crypto from 'crypto';
import { canjearRecompensaFidelidad, obtenerConfigFidelidad, registrarVisitaFidelidad, revertirVisitaFidelidad } from '../lib/fidelidad.js';
import { prisma } from '../prismaCliente.js';
import { enviarEmailConfirmacion } from '../servicios/servicioEmail.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import { sanitizarTexto } from '../utils/sanitizar.js';
import {
  notificarCitaCancelada,
  notificarCitaConfirmada,
  notificarNuevaCita,
  obtenerReservaConRelacionesPorId,
} from '../utils/notificarReserva.js';

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
        }),
      ]);

      return respuesta.send({
        datos: reservas,
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
        });
        return respuesta.send({ datos: reservas });
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
        }),
      ]);

      return respuesta.send({
        datos: reservas,
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
      servicios: object;
      precioTotal?: number;
      estado?: string;
      sucursal?: string;
      marcaTinte?: string;
      tonalidad?: string;
      usarRecompensa?: boolean;
    };
  }>('/reservas', { preHandler: verificarJWT }, async (solicitud, respuesta) => {
    const payload = solicitud.user as { sub: string; rol: string; estudioId: string | null };
    const {
      estudioId, personalId,
      fecha, horaInicio, duracion, servicios, precioTotal, estado, sucursal, marcaTinte, tonalidad, usarRecompensa,
    } = solicitud.body;

    let nombreCliente = solicitud.body.nombreCliente ?? '';
    let telefonoCliente = solicitud.body.telefonoCliente ?? '';
    let fechaNacimiento = solicitud.body.fechaNacimiento ?? '';
    const email = solicitud.body.email;
    let clienteAppId: string | undefined;

    if (payload.rol === 'dueno') {
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

    if (payload.rol === 'empleado') {
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
    const esClienteApp = payload.rol === 'cliente' && payload.estudioId === null;
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

    if (!estudioId || !personalId || !nombreCliente || !telefonoCliente || !fecha || !horaInicio || !fechaNacimiento) {
      return respuesta.code(400).send({
        error: 'Campos requeridos: estudioId, personalId, nombreCliente, telefonoCliente, fecha, horaInicio, fechaNacimiento',
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
    const nacimiento = new Date(fechaNacimiento);
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const cumpleEsteAnio = new Date(hoy.getFullYear(), nacimiento.getMonth(), nacimiento.getDate());
    if (hoy < cumpleEsteAnio) edad--;
    const esMenorDeEdad = edad < 18;

    // Rechazar reservas en fechas pasadas
    if (fecha < hoyStr) {
      return respuesta.code(400).send({ error: 'No se pueden crear reservas en fechas pasadas' });
    }

    const duracionEfectiva = duracion ?? 60;
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
            ${duracion ?? 60},
            CAST(${JSON.stringify(servicios ?? [])} AS JSON),
            ${precioTotal ?? 0},
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
      include: {
        estudio: true,
        empleado: true,
        cliente: true,
        clienteApp: true,
      },
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
      datos: reserva,
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
          servicios: reserva.servicios,
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

      const reservaCompleta = await obtenerReservaConRelacionesPorId(actualizada.id);
      if (reservaCompleta) {
        void notificarCitaCancelada(reservaCompleta);
      }

      return respuesta.send({ datos: actualizada });
    },
  );

  // PUT /reservas/:id/estado
  servidor.put<{ Params: { id: string }; Body: { estado: string } }>(
    '/reservas/:id/estado',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string; estudioId: string | null };
      const { estado } = solicitud.body;
      const estadosValidos = ['pending', 'confirmed', 'completed', 'cancelled'];
      if (!estadosValidos.includes(estado)) {
        return respuesta.code(400).send({ error: 'Estado inválido', campos: { estado: 'pending | confirmed | completed | cancelled' } });
      }
      const reservaExistente = await prisma.reserva.findUnique({
        where: { id: solicitud.params.id },
        select: { estudioId: true, estado: true, clienteId: true },
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

      const reservaCompleta = await obtenerReservaConRelacionesPorId(actualizada.id);
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
}
