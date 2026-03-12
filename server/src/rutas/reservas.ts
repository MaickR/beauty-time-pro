import type { FastifyInstance } from 'fastify';
import { canjearRecompensaFidelidad, obtenerConfigFidelidad, registrarVisitaFidelidad } from '../lib/fidelidad.js';
import { prisma } from '../prismaCliente.js';
import { enviarEmailConfirmacion } from '../servicios/servicioEmail.js';
import { verificarJWT } from '../middleware/autenticacion.js';

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

    if (payload.rol === 'dueno' && payload.estudioId !== estudioId) {
      return respuesta.code(403).send({ error: 'Sin permisos para crear reservas en este salón' });
    }

    const personal = await prisma.personal.findFirst({
      where: { id: personalId, estudioId },
      select: { id: true },
    });

    if (!personal) {
      return respuesta.code(400).send({ error: 'El especialista no pertenece a este salón' });
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

    // Upsert del cliente — busca por (estudioId, telefono)
    const cliente = await prisma.cliente.upsert({
      where: { estudioId_telefono: { estudioId, telefono: telefonoCliente } },
      update: {
        nombre: nombreCliente,
        fechaNacimiento: nacimiento,
        ...(email !== undefined && { email }),
      },
      create: {
        estudioId,
        nombre: nombreCliente,
        telefono: telefonoCliente,
        fechaNacimiento: nacimiento,
        email: email ?? null,
      },
    });

    if (usarRecompensa) {
      try {
        await canjearRecompensaFidelidad(cliente.id, estudioId);
      } catch (error) {
        return respuesta.code(400).send({ error: error instanceof Error ? error.message : 'No fue posible usar la recompensa' });
      }
    }

    const reserva = await prisma.reserva.create({
      data: {
        estudioId,
        personalId,
        clienteId: cliente.id,
        nombreCliente,
        telefonoCliente,
        fecha,
        horaInicio,
        duracion: duracion ?? 60,
        servicios: servicios ?? [],
        precioTotal: precioTotal ?? 0,
        sucursal: sucursal ?? '',
        marcaTinte: marcaTinte ?? null,
        tonalidad: tonalidad ?? null,
        notasMenorEdad: esMenorDeEdad
          ? 'Cliente menor de edad — requiere acompañante adulto'
          : null,
        estado: estadoReserva,
        ...(clienteAppId !== undefined && { clienteAppId }),
      },
    });

    const resultadoFidelidad = estadoReserva === 'confirmed'
      ? await registrarVisitaFidelidad(cliente.id, estudioId)
      : { recompensaGanada: false, descripcion: null };

    const descripcionRecompensaAplicada = usarRecompensa
      ? (await obtenerConfigFidelidad(estudioId)).descripcionRecompensa
      : null;

    void enviarEmailConfirmacion(reserva.id, {
      recompensaAplicada: Boolean(usarRecompensa),
      descripcionRecompensa: descripcionRecompensaAplicada,
    });

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
        select: { id: true, fecha: true, estado: true },
      });

      if (!reserva) {
        return respuesta.code(404).send({ error: 'La reserva no existe o el enlace es inválido.' });
      }
      if (reserva.estado === 'cancelled') {
        return respuesta.code(400).send({ error: 'Esta cita ya fue cancelada anteriormente.' });
      }

      const hoy = new Date();
      const compensacion = hoy.getTimezoneOffset();
      const hoyStr = new Date(hoy.getTime() - compensacion * 60 * 1000).toISOString().split('T')[0]!;
      if (reserva.fecha <= hoyStr) {
        return respuesta.code(400).send({ error: 'La cita ya ocurrió o está demasiado próxima para cancelarla desde este enlace.' });
      }

      const actualizada = await prisma.reserva.update({
        where: { id: reserva.id },
        data: { estado: 'cancelled' },
      });

      return respuesta.send({ datos: actualizada });
    },
  );

  // PUT /reservas/:id/estado
  servidor.put<{ Params: { id: string }; Body: { estado: string } }>(
    '/reservas/:id/estado',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; estudioId: string | null };
      const { estado } = solicitud.body;
      const estadosValidos = ['pending', 'confirmed', 'completed', 'cancelled'];
      if (!estadosValidos.includes(estado)) {
        return respuesta.code(400).send({ error: 'Estado inválido', campos: { estado: 'pending | confirmed | completed | cancelled' } });
      }
      const reservaExistente = await prisma.reserva.findUnique({
        where: { id: solicitud.params.id },
        select: { estudioId: true },
      });
      if (!reservaExistente) return respuesta.code(404).send({ error: 'Reserva no encontrada' });
      if (payload.rol !== 'maestro' && payload.estudioId !== reservaExistente.estudioId) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }
      const actualizada = await prisma.reserva.update({
        where: { id: solicitud.params.id },
        data: { estado },
      });
      return respuesta.send({ datos: actualizada });
    },
  );
}
