import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from '../prismaCliente.js';
import {
  listarPreciosPlanesActuales,
  obtenerMonedaPrecio,
  obtenerPrecioPlanActual,
  obtenerResumenSuscripcionesActivas,
  obtenerSiguienteVersionPrecio,
  normalizarPaisPrecio,
  programarCambioPrecioPlan,
} from '../lib/preciosPlanes.js';
import { verificarJWT } from '../middleware/autenticacion.js';
import { requierePermiso } from '../middleware/verificarPermiso.js';
import { registrarAuditoria } from '../utils/auditoria.js';
import { convertirMonedaACentavos } from '../utils/moneda.js';
import { enviarEmailCambioPrecioPlan } from '../servicios/servicioEmail.js';

const esquemaActualizarPrecio = z.object({
  monto: z.number().int().min(1, 'El monto debe ser mayor a 0').max(999_999_999),
});

function esAdministradorConPermisos(rol: string) {
  return rol === 'maestro' || rol === 'supervisor';
}

export async function rutasPreciosPlanes(servidor: FastifyInstance): Promise<void> {
  servidor.get('/planes/precios-publicos', async (_solicitud, respuesta) => {
    const precios = await listarPreciosPlanesActuales();
    return respuesta.send({ datos: precios });
  });

  servidor.get(
    '/admin/precios-planes',
    { preHandler: [verificarJWT, requierePermiso('gestionarPagos')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string };
      if (!esAdministradorConPermisos(payload.rol)) {
        return respuesta.code(403).send({ error: 'Sin permisos para esta acción' });
      }

      const [precios, metricas] = await Promise.all([
        listarPreciosPlanesActuales(),
        obtenerResumenSuscripcionesActivas(),
      ]);

      return respuesta.send({ datos: { precios, metricas } });
    },
  );

  servidor.put<{
    Params: { plan: 'STANDARD' | 'PRO'; pais: 'Mexico' | 'Colombia' };
    Body: { monto: number };
  }>(
    '/admin/precios-planes/:plan/:pais',
    { preHandler: [verificarJWT, requierePermiso('gestionarPagos')] },
    async (solicitud, respuesta) => {
      const payload = solicitud.user as { rol: string; sub: string };
      if (payload.rol !== 'maestro') {
        return respuesta.code(403).send({ error: 'Solo el maestro puede actualizar precios' });
      }

      const resultado = esquemaActualizarPrecio.safeParse(solicitud.body);
      if (!resultado.success) {
        return respuesta.code(400).send({ error: resultado.error.issues[0]?.message ?? 'Datos inválidos' });
      }

      const plan = solicitud.params.plan === 'PRO' ? 'PRO' : 'STANDARD';
      const pais = normalizarPaisPrecio(solicitud.params.pais);
      const moneda = obtenerMonedaPrecio(pais);
      const montoCentavos = convertirMonedaACentavos(resultado.data.monto);

      const precioActual = await obtenerPrecioPlanActual(plan, pais);
      if (!precioActual) {
        return respuesta.code(500).send({ error: 'No existe un precio base configurado para este plan' });
      }

      if (precioActual.monto === montoCentavos) {
        return respuesta.code(400).send({ error: 'El nuevo precio es igual al precio actual' });
      }

      const version = await obtenerSiguienteVersionPrecio(plan, pais);
      const precioNuevo = await prisma.precioPlan.create({
        data: {
          plan,
          pais,
          moneda,
          monto: montoCentavos,
          version,
        },
      });

      const programacion = await programarCambioPrecioPlan({
        plan,
        pais,
        precioNuevoId: precioNuevo.id,
      });

      await registrarAuditoria({
        usuarioId: payload.sub,
        accion: 'actualizar_precio_plan',
        entidadTipo: 'precio_plan',
        entidadId: precioNuevo.id,
        detalles: {
          plan,
          pais,
          moneda,
          precioAnteriorCentavos: precioActual.monto,
          precioNuevoCentavos: precioNuevo.monto,
          versionAnterior: precioActual.version,
          versionNueva: precioNuevo.version,
          salonesProgramados: programacion.activosProgramados.length,
          salonesActualizadosInmediato: programacion.actualizadosInmediatos,
          totalAfectados: programacion.totalAfectados,
        },
        ip: solicitud.ip,
      });

      await Promise.allSettled(
        programacion.activosProgramados
          .filter((estudio) => Boolean(estudio.emailContacto) && Boolean(estudio.precioPlanActual))
          .map(async (estudio) => {
            await enviarEmailCambioPrecioPlan({
              email: estudio.emailContacto!,
              nombreDueno: estudio.propietario || estudio.nombre,
              nombreSalon: estudio.nombre,
              plan,
              moneda,
              precioAnterior: estudio.precioPlanActual!.monto,
              precioNuevo: precioNuevo.monto,
              fechaEntradaVigor: estudio.fechaVencimiento,
            });

            await prisma.notificacionEstudio.create({
              data: {
                estudioId: estudio.id,
                tipo: 'cambio_precio_plan',
                titulo: 'Cambio de precio programado',
                mensaje: `Tu plan ${plan === 'PRO' ? 'Pro' : 'Standard'} aplicará un nuevo precio desde ${estudio.fechaVencimiento}.`,
              },
            });
          }),
      );

      const [precios, metricas] = await Promise.all([
        listarPreciosPlanesActuales(),
        obtenerResumenSuscripcionesActivas(),
      ]);

      return respuesta.send({
        datos: {
          precios,
          metricas,
          cambio: {
            plan,
            pais,
            moneda,
            precioAnterior: precioActual.monto,
            precioNuevo: precioNuevo.monto,
            versionNueva: precioNuevo.version,
            salonesProgramados: programacion.activosProgramados.length,
            salonesActualizadosInmediato: programacion.actualizadosInmediatos,
          },
        },
      });
    },
  );
}