import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../prismaCliente.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import {
  asegurarCamposComisionVendedorUsuario,
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

      const where = {
        vendedorId: payload.sub,
        ...(estado ? { estado } : {}),
        ...(busqueda
          ? {
              OR: [
                { nombreSalon: { contains: busqueda } },
                { propietario: { contains: busqueda } },
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
            categorias: true,
            plan: true,
            estado: true,
            motivoRechazo: true,
            estudioCreadoId: true,
            notas: true,
            creadoEn: true,
          },
        }),
        prisma.preregistroSalon.count({ where }),
      ]);

      return respuesta.send({ datos: preregistros, total, pagina, limite });
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

      const preregistro = await prisma.preregistroSalon.create({
        data: {
          vendedorId: payload.sub,
          nombreSalon: datos.nombreSalon,
          propietario: datos.propietario,
          emailPropietario: datos.emailPropietario.toLowerCase(),
          telefonoPropietario: datos.telefonoPropietario,
          pais: datos.pais,
          direccion: datos.direccion,
          descripcion: datos.descripcion,
          categorias: datos.categorias,
          plan: datos.plan,
          notas: datos.notas,
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
      const columnasComision = await asegurarCamposComisionVendedorUsuario().catch(() => ({
        porcentajeComision: false,
        porcentajeComisionPro: false,
      }));
      const consultaVendedorComision =
        columnasComision.porcentajeComision || columnasComision.porcentajeComisionPro
          ? prisma.usuario.findUnique({
              where: { id: payload.sub },
              select: {
                ...(columnasComision.porcentajeComision ? { porcentajeComision: true } : {}),
                ...(columnasComision.porcentajeComisionPro
                  ? { porcentajeComisionPro: true }
                  : {}),
              },
            })
          : Promise.resolve(null);
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

      const porcentajeComisionGuardado =
        vendedor && 'porcentajeComision' in vendedor ? vendedor.porcentajeComision : undefined;
      const porcentajeComisionProGuardado =
        vendedor && 'porcentajeComisionPro' in vendedor ? vendedor.porcentajeComisionPro : undefined;
      const porcentajesComision = resolverPorcentajesComisionVendedor({
        porcentajeComision: columnasComision.porcentajeComision ? porcentajeComisionGuardado : undefined,
        porcentajeComisionPro: columnasComision.porcentajeComisionPro
          ? porcentajeComisionProGuardado
          : undefined,
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
    const columnasComision = await asegurarCamposComisionVendedorUsuario().catch(() => ({
      porcentajeComision: false,
      porcentajeComisionPro: false,
    }));
    const vendedor =
      columnasComision.porcentajeComision || columnasComision.porcentajeComisionPro
        ? await prisma.usuario.findUnique({
            where: { id: payload.sub },
            select: {
              ...(columnasComision.porcentajeComision ? { porcentajeComision: true } : {}),
              ...(columnasComision.porcentajeComisionPro ? { porcentajeComisionPro: true } : {}),
            },
          })
        : null;
    const porcentajesComision = resolverPorcentajesComisionVendedor({
      porcentajeComision:
        columnasComision.porcentajeComision && vendedor && 'porcentajeComision' in vendedor
          ? vendedor.porcentajeComision
          : undefined,
      porcentajeComisionPro:
        columnasComision.porcentajeComisionPro && vendedor && 'porcentajeComisionPro' in vendedor
          ? vendedor.porcentajeComisionPro
          : undefined,
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
