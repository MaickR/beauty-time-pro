import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import type { Prisma } from '../generated/prisma/client.js';
import { prisma } from '../prismaCliente.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import {
  calcularComisionVendedor,
  resolverPorcentajesComisionVendedor,
  resolverPorcentajeComisionSegunPlan,
  estudioTienePagoPendiente,
} from '../lib/comisionVendedor.js';
import { obtenerMensajeValidacion, textoSchema, telefonoSchema } from '../lib/validacion.js';
import {
  actualizarPlanSalonDemoVendedor,
  obtenerCredencialesDemoVendedor,
  obtenerSalonDemoVendedor,
  reiniciarSalonDemoVendedor,
} from '../lib/demoVendedor.js';
import { obtenerColumnasTabla } from '../lib/compatibilidadEsquema.js';
import { registrarAuditoria } from '../utils/auditoria.js';

// ─── Helpers ─────────────────────────────────────────────────────────────
function soloVendedor(payload: { rol: string }): boolean {
  return payload.rol === 'vendedor';
}

// ─── Schemas ─────────────────────────────────────────────────────────────
const esquemaPreregistro = z.object({
  nombreSalon: textoSchema('nombreSalon', 120),
  propietario: textoSchema('propietario', 120),
  emailPropietario: z.string().trim().max(120).email('Email inválido'),
  telefonoPropietario: telefonoSchema,
  pais: z.enum(['Mexico', 'Colombia']),
  direccion: textoSchema('direccion', 180).optional().transform((v) => v ?? null),
  descripcion: z.string().trim().max(500).optional().transform((v) => v ?? null),
  categorias: z.string().trim().max(240).optional().transform((v) => v ?? null),
  plan: z.enum(['STANDARD', 'PRO']).optional().default('STANDARD'),
  notas: z.string().trim().max(500).optional().transform((v) => v ?? null),
});
const esquemaPlanDemo = z.object({
  plan: z.enum(['STANDARD', 'PRO']),
});

// ─── Plugin de rutas ─────────────────────────────────────────────────────
export async function rutasVendedor(servidor: FastifyInstance) {
  servidor.get('/vendedor/demo', { preHandler: verificarJWT }, async (solicitud, respuesta) => {
    const payload = solicitud.user as { sub: string; rol: string };
    if (!soloVendedor(payload)) {
      return respuesta.code(403).send({ error: 'Sin permisos para esta accion' });
    }

    const vendedor = await prisma.usuario.findUnique({
      where: { id: payload.sub },
      select: { email: true, nombre: true },
    });
    const salonDemo = await obtenerSalonDemoVendedor(payload.sub);
    if (!salonDemo || !vendedor) {
      return respuesta.code(404).send({ error: 'Salon demo no disponible' });
    }

    const credencialesDemo = obtenerCredencialesDemoVendedor({
      usuarioId: payload.sub,
      emailBase: vendedor.email,
      nombreBase: vendedor.nombre ?? undefined,
    });

    return respuesta.send({
      datos: {
        id: salonDemo.id,
        slug: salonDemo.slug,
        nombre: salonDemo.nombre,
        plan: salonDemo.plan,
        estado: salonDemo.estado,
        activo: salonDemo.activo,
        fechaVencimiento: salonDemo.fechaVencimiento,
        actualizadoEn: salonDemo.actualizadoEn.toISOString(),
        totales: {
          reservas: salonDemo._count.reservas,
          pagos: salonDemo._count.pagos,
          clientes: salonDemo._count.clientes,
          personal: salonDemo._count.personal,
          productos: salonDemo._count.productos,
        },
        credencialesDemo: {
          adminEmail: credencialesDemo.adminEmail,
          adminContrasena: credencialesDemo.adminContrasena,
          empleadoEmail: credencialesDemo.empleadoEmail,
          empleadoContrasena: credencialesDemo.empleadoContrasena,
          contrasenaCompartida: credencialesDemo.contrasenaCompartida,
        },
      },
    });
  });

  servidor.patch<{
    Body: { plan: 'STANDARD' | 'PRO' };
  }>('/vendedor/demo/plan', { preHandler: verificarJWT }, async (solicitud, respuesta) => {
    const payload = solicitud.user as { sub: string; rol: string };
    if (!soloVendedor(payload)) {
      return respuesta.code(403).send({ error: 'Sin permisos para esta accion' });
    }

    const resultado = esquemaPlanDemo.safeParse(solicitud.body);
    if (!resultado.success) {
      return respuesta.code(400).send({ error: obtenerMensajeValidacion(resultado.error) });
    }

    const salonDemo = await actualizarPlanSalonDemoVendedor(payload.sub, resultado.data.plan);
    if (!salonDemo) {
      return respuesta.code(404).send({ error: 'Salon demo no disponible' });
    }

    await registrarAuditoria({
      usuarioId: payload.sub,
      accion: 'actualizar_plan_demo_vendedor',
      entidadTipo: 'Estudio',
      entidadId: salonDemo.id,
      detalles: { plan: resultado.data.plan },
    });

    return respuesta.send({
      datos: {
        id: salonDemo.id,
        slug: salonDemo.slug,
        plan: salonDemo.plan,
      },
    });
  });

  servidor.post('/vendedor/demo/reset', { preHandler: verificarJWT }, async (solicitud, respuesta) => {
    const payload = solicitud.user as { sub: string; rol: string };
    if (!soloVendedor(payload)) {
      return respuesta.code(403).send({ error: 'Sin permisos para esta accion' });
    }

    const salonDemo = await reiniciarSalonDemoVendedor(payload.sub);
    if (!salonDemo) {
      return respuesta.code(404).send({ error: 'Salon demo no disponible' });
    }

    await registrarAuditoria({
      usuarioId: payload.sub,
      accion: 'reset_demo_vendedor',
      entidadTipo: 'Estudio',
      entidadId: salonDemo.id,
      detalles: { origen: 'panel_vendedor' },
    });

    return respuesta.send({
      datos: {
        mensaje: 'El salon demo fue reiniciado correctamente.',
        id: salonDemo.id,
        slug: salonDemo.slug,
      },
    });
  });

  /**
   * GET /vendedor/mis-preregistros — Lista los preregistros creados por el vendedor
   */
  servidor.get<{
    Querystring: {
      busqueda?: string;
      estado?: 'pendiente' | 'aprobado' | 'rechazado';
      pagina?: string;
      limite?: string;
    };
  }>(
    '/vendedor/mis-preregistros',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string };
      if (!soloVendedor(payload)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const pagina = Math.max(1, Number(solicitud.query.pagina ?? '1') || 1);
      const limite = Math.min(50, Math.max(1, Number(solicitud.query.limite ?? '10') || 10));
      const busqueda = solicitud.query.busqueda?.trim();
      const estado = solicitud.query.estado?.trim();
      const columnasPreregistro = await obtenerColumnasTabla('preregistros_salon');
      const tieneDescripcion = columnasPreregistro.has('descripcion');
      const tieneCategorias = columnasPreregistro.has('categorias');
      const tieneMotivoRechazo = columnasPreregistro.has('motivoRechazo');
      const tieneEstudioCreadoId = columnasPreregistro.has('estudioCreadoId');
      const tieneNotas = columnasPreregistro.has('notas');

      const where = {
        vendedorId: payload.sub,
        ...(estado ? { estado } : {}),
        ...(busqueda
          ? {
              OR: [
                { nombreSalon: { contains: busqueda } },
                { propietario: { contains: busqueda } },
                { emailPropietario: { contains: busqueda } },
              ],
            }
          : {}),
      };

      const [preregistros, total] = await Promise.all([
        prisma.preregistroSalon.findMany({
          where,
          orderBy: { creadoEn: 'desc' },
          skip: (pagina - 1) * limite,
          take: limite,
          select: {
            id: true,
            nombreSalon: true,
            propietario: true,
            emailPropietario: true,
            telefonoPropietario: true,
            pais: true,
            direccion: true,
            ...(tieneDescripcion ? { descripcion: true } : {}),
            ...(tieneCategorias ? { categorias: true } : {}),
            plan: true,
            estado: true,
            ...(tieneMotivoRechazo ? { motivoRechazo: true } : {}),
            ...(tieneEstudioCreadoId ? { estudioCreadoId: true } : {}),
            ...(tieneNotas ? { notas: true } : {}),
            creadoEn: true,
          },
        }),
        prisma.preregistroSalon.count({ where }),
      ]);

      return respuesta.send({
        datos: preregistros.map((preregistro) => ({
          ...preregistro,
          descripcion:
            tieneDescripcion && 'descripcion' in preregistro ? preregistro.descripcion ?? null : null,
          categorias:
            tieneCategorias && 'categorias' in preregistro ? preregistro.categorias ?? null : null,
          motivoRechazo:
            tieneMotivoRechazo && 'motivoRechazo' in preregistro
              ? preregistro.motivoRechazo ?? null
              : null,
          estudioCreadoId:
            tieneEstudioCreadoId && 'estudioCreadoId' in preregistro
              ? preregistro.estudioCreadoId ?? null
              : null,
          notas: tieneNotas && 'notas' in preregistro ? preregistro.notas ?? null : null,
          creadoEn: preregistro.creadoEn.toISOString(),
        })),
        total,
        pagina,
        limite,
      });
    },
  );

  /**
   * POST /vendedor/preregistro — Crea un nuevo preregistro de salón
   */
  servidor.post<{
    Body: {
      nombreSalon: string;
      propietario: string;
      emailPropietario: string;
      telefonoPropietario: string;
      pais: string;
      direccion?: string;
      descripcion?: string;
      categorias?: string;
      plan?: string;
      notas?: string;
    };
  }>(
    '/vendedor/preregistro',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string };
      if (!soloVendedor(payload)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const resultado = esquemaPreregistro.safeParse(solicitud.body);
      if (!resultado.success) {
        return respuesta.code(400).send({ error: obtenerMensajeValidacion(resultado.error) });
      }

      const datos = resultado.data;
      const columnasPreregistro = await obtenerColumnasTabla('preregistros_salon');

      // Verificar que no exista un preregistro pendiente con el mismo email
      const existente = await prisma.preregistroSalon.findFirst({
        where: {
          emailPropietario: datos.emailPropietario.toLowerCase(),
          estado: 'pendiente',
        },
      });
      if (existente) {
        return respuesta.code(409).send({
          error: 'Ya existe un preregistro pendiente con este correo.',
        });
      }

      const datosCreacion: Prisma.PreregistroSalonUncheckedCreateInput = {
        vendedorId: payload.sub,
        nombreSalon: datos.nombreSalon,
        propietario: datos.propietario,
        emailPropietario: datos.emailPropietario.toLowerCase(),
        telefonoPropietario: datos.telefonoPropietario,
        pais: datos.pais,
        plan: datos.plan,
      };

      if (columnasPreregistro.has('direccion')) {
        datosCreacion.direccion = datos.direccion;
      }
      if (columnasPreregistro.has('descripcion')) {
        datosCreacion.descripcion = datos.descripcion;
      }
      if (columnasPreregistro.has('categorias')) {
        datosCreacion.categorias = datos.categorias;
      }
      if (columnasPreregistro.has('notas')) {
        datosCreacion.notas = datos.notas;
      }

      const preregistro = await prisma.preregistroSalon.create({
        data: datosCreacion,
        select: {
          id: true,
          nombreSalon: true,
          estado: true,
        },
      });

      return respuesta.code(201).send({
        datos: {
          id: preregistro.id,
          nombreSalon: preregistro.nombreSalon,
          estado: preregistro.estado,
        },
      });
    },
  );

  servidor.get('/vendedor/notificaciones', { preHandler: verificarJWT }, async (solicitud, respuesta) => {
    const payload = solicitud.user as { sub: string; rol: string };
    if (!soloVendedor(payload)) {
      return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
    }

    const hoy = new Date().toISOString().slice(0, 10);
    const haceSieteDias = new Date();
    haceSieteDias.setDate(haceSieteDias.getDate() - 7);
    const columnasPreregistro = await obtenerColumnasTabla('preregistros_salon');
    const tieneMotivoRechazo = columnasPreregistro.has('motivoRechazo');

    const [preregistrosRecientes, salonesConPagoPendiente] = await Promise.all([
      prisma.preregistroSalon.findMany({
        where: {
          vendedorId: payload.sub,
          OR: [{ estado: 'aprobado' }, { estado: 'rechazado' }, { estado: 'pendiente' }],
        },
        orderBy: { actualizadoEn: 'desc' },
        take: 20,
        select: {
          id: true,
          nombreSalon: true,
          estado: true,
          ...(tieneMotivoRechazo ? { motivoRechazo: true } : {}),
          creadoEn: true,
          actualizadoEn: true,
        },
      }),
      prisma.estudio.findMany({
        where: {
          vendedorId: payload.sub,
          activo: true,
          estado: 'aprobado',
          fechaVencimiento: { lt: hoy },
        },
        orderBy: { fechaVencimiento: 'asc' },
        take: 10,
        select: {
          id: true,
          nombre: true,
          fechaVencimiento: true,
          actualizadoEn: true,
        },
      }),
    ]);

    const notificacionesPreregistro = preregistrosRecientes
      .filter((item) => {
        if (item.estado === 'aprobado' || item.estado === 'rechazado') {
          return item.actualizadoEn >= haceSieteDias;
        }
        return item.estado === 'pendiente' && item.creadoEn <= haceSieteDias;
      })
      .map((item) => {
        if (item.estado === 'aprobado') {
          return {
            id: `preregistro-aprobado-${item.id}`,
            tipo: 'preregistro_aprobado' as const,
            titulo: `Pre-registro aprobado: ${item.nombreSalon}`,
            mensaje: 'El admin ya aprobó este salón. Da seguimiento al onboarding y primer pago.',
            prioridad: 'media' as const,
            creadoEn: item.actualizadoEn.toISOString(),
            referenciaId: item.id,
          };
        }

        if (item.estado === 'rechazado') {
          return {
            id: `preregistro-rechazado-${item.id}`,
            tipo: 'preregistro_rechazado' as const,
            titulo: `Pre-registro rechazado: ${item.nombreSalon}`,
            mensaje: item.motivoRechazo
              ? `Motivo: ${item.motivoRechazo}`
              : 'Revisa la causa con supervisión para recuperar el prospecto.',
            prioridad: 'alta' as const,
            creadoEn: item.actualizadoEn.toISOString(),
            referenciaId: item.id,
          };
        }

        return {
          id: `preregistro-pendiente-${item.id}`,
          tipo: 'preregistro_pendiente' as const,
          titulo: `Pre-registro pendiente: ${item.nombreSalon}`,
          mensaje: 'Lleva más de 7 días pendiente. Conviene escalarlo para no enfriar la venta.',
          prioridad: 'media' as const,
          creadoEn: item.creadoEn.toISOString(),
          referenciaId: item.id,
        };
      });

    const notificacionesPago = salonesConPagoPendiente.map((salon) => ({
      id: `pago-pendiente-${salon.id}`,
      tipo: 'pago_pendiente' as const,
      titulo: `Pago pendiente: ${salon.nombre}`,
      mensaje: `Venció el ${salon.fechaVencimiento}. Requiere seguimiento comercial.`,
      prioridad: 'alta' as const,
      creadoEn: salon.actualizadoEn.toISOString(),
      referenciaId: salon.id,
    }));

    const notificaciones = [...notificacionesPago, ...notificacionesPreregistro]
      .sort((a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime())
      .slice(0, 30);

    return respuesta.send({ datos: notificaciones });
  });

  /**
   * GET /vendedor/mis-salones — Salones asociados al vendedor (aprobados/activos)
   */
  servidor.get(
    '/vendedor/mis-salones',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string };
      if (!soloVendedor(payload)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const salones = await prisma.estudio.findMany({
        where: { vendedorId: payload.sub },
        select: {
          id: true,
          nombre: true,
          propietario: true,
          plan: true,
          pais: true,
          estado: true,
          activo: true,
          inicioSuscripcion: true,
          fechaVencimiento: true,
          creadoEn: true,
          _count: { select: { reservas: true } },
        },
        orderBy: { creadoEn: 'desc' },
      });

      return respuesta.send({
        datos: salones.map((s) => ({
          id: s.id,
          nombre: s.nombre,
          propietario: s.propietario,
          plan: s.plan,
          pais: s.pais,
          estado: s.estado,
          activo: s.activo,
          inicioSuscripcion: s.inicioSuscripcion,
          fechaVencimiento: s.fechaVencimiento,
          totalReservas: s._count.reservas,
          creadoEn: s.creadoEn.toISOString(),
        })),
      });
    },
  );

  /**
   * GET /vendedor/resumen — Métricas rápidas del vendedor
   */
  servidor.get(
    '/vendedor/resumen',
    { preHandler: verificarJWT },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { sub: string; rol: string };
      if (!soloVendedor(payload)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const hoy = new Date().toISOString().slice(0, 10);
      const consultaVendedorComision = prisma.usuario.findUnique({
            where: { id: payload.sub },
            select: {
              porcentajeComision: true,
              porcentajeComisionPro: true,
            },
          });
      const [
        totalPreregistros,
        pendientes,
        aprobados,
        rechazados,
        totalSalones,
        salonesActivos,
        salonesPendientesPago,
        ventasComisionables,
        vendedor,
      ] = await Promise.all([
        prisma.preregistroSalon.count({ where: { vendedorId: payload.sub } }),
        prisma.preregistroSalon.count({ where: { vendedorId: payload.sub, estado: 'pendiente' } }),
        prisma.preregistroSalon.count({ where: { vendedorId: payload.sub, estado: 'aprobado' } }),
        prisma.preregistroSalon.count({ where: { vendedorId: payload.sub, estado: 'rechazado' } }),
        prisma.estudio.count({ where: { vendedorId: payload.sub } }),
        prisma.estudio.count({ where: { vendedorId: payload.sub, activo: true, estado: 'aprobado' } }),
        prisma.estudio.count({
          where: {
            vendedorId: payload.sub,
            activo: true,
            estado: 'aprobado',
            fechaVencimiento: { lt: hoy },
          },
        }),
        prisma.pago.findMany({
          where: { estudio: { vendedorId: payload.sub } },
          select: {
            monto: true,
            estudio: {
              select: { plan: true },
            },
          },
        }),
        consultaVendedorComision,
      ]);

      const porcentajesComision = resolverPorcentajesComisionVendedor({
        porcentajeComision: vendedor?.porcentajeComision,
        porcentajeComisionPro: vendedor?.porcentajeComisionPro,
      });

      const resumenVentas = ventasComisionables.reduce(
        (acumulado, venta) => {
          const porcentajeAplicado = resolverPorcentajeComisionSegunPlan(
            venta.estudio.plan,
            porcentajesComision,
          );
          const comisionVenta = calcularComisionVendedor(venta.monto, porcentajeAplicado);
          const esPro = venta.estudio.plan === 'PRO';

          return {
            ventasRegistradas: acumulado.ventasRegistradas + 1,
            ingresosGenerados: acumulado.ingresosGenerados + venta.monto,
            ingresosStandard: acumulado.ingresosStandard + (esPro ? 0 : venta.monto),
            ingresosPro: acumulado.ingresosPro + (esPro ? venta.monto : 0),
            comisionGenerada: acumulado.comisionGenerada + comisionVenta,
            comisionGeneradaStandard: acumulado.comisionGeneradaStandard + (esPro ? 0 : comisionVenta),
            comisionGeneradaPro: acumulado.comisionGeneradaPro + (esPro ? comisionVenta : 0),
          };
        },
        {
          ventasRegistradas: 0,
          ingresosGenerados: 0,
          ingresosStandard: 0,
          ingresosPro: 0,
          comisionGenerada: 0,
          comisionGeneradaStandard: 0,
          comisionGeneradaPro: 0,
        },
      );

      return respuesta.send({
        datos: {
          totalPreregistros,
          pendientes,
          aprobados,
          rechazados,
          totalSalones,
          salonesActivos,
          salonesPendientesPago,
          ventasRegistradas: resumenVentas.ventasRegistradas,
          ingresosGenerados: resumenVentas.ingresosGenerados,
          ingresosStandard: resumenVentas.ingresosStandard,
          ingresosPro: resumenVentas.ingresosPro,
          porcentajeComision: porcentajesComision.standard,
          porcentajeComisionPro: porcentajesComision.pro,
          comisionGenerada: resumenVentas.comisionGenerada,
          comisionGeneradaStandard: resumenVentas.comisionGeneradaStandard,
          comisionGeneradaPro: resumenVentas.comisionGeneradaPro,
        },
      });
    },
  );

  servidor.get<{
    Querystring: { fechaDesde?: string; fechaHasta?: string; soloPendientesPago?: string };
  }>('/vendedor/ventas', { preHandler: verificarJWT }, async (solicitud, respuesta) => {
    const payload = solicitud.user as { sub: string; rol: string };
    if (!soloVendedor(payload)) {
      return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
    }

    const fechaDesde = solicitud.query.fechaDesde?.trim();
    const fechaHasta = solicitud.query.fechaHasta?.trim();
    const soloPendientesPago = ['1', 'true', 'si'].includes(
      solicitud.query.soloPendientesPago?.trim().toLowerCase() ?? '',
    );
    const hoy = new Date().toISOString().slice(0, 10);
    const vendedor = await prisma.usuario.findUnique({
          where: { id: payload.sub },
          select: {
            porcentajeComision: true,
            porcentajeComisionPro: true,
          },
        });
    const porcentajesComision = resolverPorcentajesComisionVendedor({
      porcentajeComision: vendedor?.porcentajeComision,
      porcentajeComisionPro: vendedor?.porcentajeComisionPro,
    });

    const ventas = await prisma.pago.findMany({
      where: {
        estudio: {
          vendedorId: payload.sub,
          ...(soloPendientesPago
            ? { activo: true, estado: 'aprobado', fechaVencimiento: { lt: hoy } }
            : {}),
        },
        ...(fechaDesde || fechaHasta
          ? {
              fecha: {
                ...(fechaDesde ? { gte: fechaDesde } : {}),
                ...(fechaHasta ? { lte: fechaHasta } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ fecha: 'desc' }, { creadoEn: 'desc' }],
      select: {
        id: true,
        monto: true,
        moneda: true,
        concepto: true,
        fecha: true,
        referencia: true,
        estudio: {
          select: {
            id: true,
            nombre: true,
            plan: true,
            pais: true,
            suscripcion: true,
            fechaVencimiento: true,
            activo: true,
            estado: true,
            usuarios: {
              where: { rol: 'dueno' },
              take: 1,
              select: {
                nombre: true,
                email: true,
              },
            },
          },
        },
      },
    });

    return respuesta.send({
      datos: ventas.map((venta) => {
        const dueno = venta.estudio.usuarios[0] ?? null;
        const pendientePago = estudioTienePagoPendiente({
          activo: venta.estudio.activo,
          estado: venta.estudio.estado,
          fechaVencimiento: venta.estudio.fechaVencimiento,
          hoy,
        });
        const porcentajeComisionAplicado = resolverPorcentajeComisionSegunPlan(
          venta.estudio.plan,
          porcentajesComision,
        );

        return {
          id: venta.id,
          fecha: venta.fecha,
          monto: venta.monto,
          moneda: venta.moneda,
          concepto: venta.concepto,
          referencia: venta.referencia,
          salonId: venta.estudio.id,
          salonNombre: venta.estudio.nombre,
          adminSalonNombre: dueno?.nombre ?? venta.estudio.nombre,
          adminSalonEmail: dueno?.email ?? null,
          plan: venta.estudio.plan,
          tipoSuscripcion: venta.estudio.suscripcion,
          valorSuscripcion: venta.monto,
          pais: venta.estudio.pais,
          fechaVencimiento: venta.estudio.fechaVencimiento,
          pendientePago,
          porcentajeComisionAplicado,
          comision: calcularComisionVendedor(venta.monto, porcentajeComisionAplicado),
        };
      }),
    });
  });
}
