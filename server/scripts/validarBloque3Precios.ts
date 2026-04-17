import { prisma } from '../src/prismaCliente.js';

interface SesionRespuesta {
  datos: {
    token: string;
    csrfToken: string;
  };
}

interface GestionPreciosRespuesta {
  datos: {
    precios: Array<{
      id: string;
      plan: 'STANDARD' | 'PRO';
      pais: 'Mexico' | 'Colombia';
      moneda: 'MXN' | 'COP';
      monto: number;
      version: number;
    }>;
    metricas: {
      totalSuscripcionesActivas: number;
      totalActivasStandard: number;
      totalActivasPro: number;
    };
    cambio?: {
      precioAnterior: number;
      precioNuevo: number;
      salonesProgramados: number;
      salonesActualizadosInmediato: number;
      versionNueva: number;
    };
  };
}

interface PreciosPublicosRespuesta {
  datos: Array<{
    id: string;
    plan: 'STANDARD' | 'PRO';
    pais: 'Mexico' | 'Colombia';
    moneda: 'MXN' | 'COP';
    monto: number;
    version: number;
  }>;
}

interface PagoRespuesta {
  datos: {
    id: string;
    monto: number;
    moneda: 'MXN' | 'COP';
    precioAplicado: {
      id: string;
      monto: number;
      version: number;
    } | null;
  };
}

function asegurar(condicion: unknown, mensaje: string): asserts condicion {
  if (!condicion) {
    throw new Error(mensaje);
  }
}

function hoyISO(): string {
  return new Date().toISOString().split('T')[0]!;
}

async function solicitarJSON<T>(url: string, opciones?: RequestInit): Promise<T> {
  const respuesta = await fetch(url, {
    ...opciones,
    headers: {
      'content-type': 'application/json',
      ...(opciones?.headers ?? {}),
    },
  });

  const texto = await respuesta.text();
  let json: unknown;
  try {
    json = texto ? JSON.parse(texto) : {};
  } catch {
    json = { error: texto || 'Respuesta no JSON' };
  }

  if (!respuesta.ok) {
    throw new Error(`HTTP ${respuesta.status} en ${url}: ${JSON.stringify(json)}`);
  }

  return json as T;
}

async function main() {
  const baseUrl = 'http://localhost:3000';
  const credenciales = {
    email: 'qa.bloque3@salonpromaster.com',
    contrasena: 'Bloque3Test2026',
  };

  let pagoCreadoId: string | null = null;
  let estudioRevertir: {
    id: string;
    fechaVencimiento: string;
    precioPlanActualId: string | null;
    precioPlanProximoId: string | null;
    fechaAplicacionPrecioProximo: string | null;
  } | null = null;
  let montoOriginalCentavos: number | null = null;

  try {
    const sesion = await solicitarJSON<SesionRespuesta>(`${baseUrl}/auth/iniciar-sesion`, {
      method: 'POST',
      body: JSON.stringify(credenciales),
    });

    const token = sesion.datos.token;
    asegurar(token, 'No se obtuvo token de sesión para pruebas BLOQUE 3');

    const cabecerasAuth = {
      authorization: `Bearer ${token}`,
    };

    const gestionInicial = await solicitarJSON<GestionPreciosRespuesta>(`${baseUrl}/admin/precios-planes`, {
      method: 'GET',
      headers: cabecerasAuth,
    });

    const precioObjetivoInicial = gestionInicial.datos.precios.find(
      (precio) => precio.plan === 'STANDARD' && precio.pais === 'Mexico',
    );

    asegurar(precioObjetivoInicial, 'No se encontró precio STANDARD Mexico para prueba');
    montoOriginalCentavos = precioObjetivoInicial.monto;

    const montoNuevoCentavos = montoOriginalCentavos + 10_000;
    const montoNuevoPesos = Math.trunc(montoNuevoCentavos / 100);

    const actualizacion = await solicitarJSON<GestionPreciosRespuesta>(
      `${baseUrl}/admin/precios-planes/STANDARD/Mexico`,
      {
        method: 'PUT',
        headers: cabecerasAuth,
        body: JSON.stringify({ monto: montoNuevoPesos }),
      },
    );

    asegurar(actualizacion.datos.cambio, 'La actualización no devolvió información de cambio');
    asegurar(
      actualizacion.datos.cambio.precioNuevo === montoNuevoCentavos,
      'El precio nuevo reportado no coincide con el solicitado',
    );

    const publicos = await solicitarJSON<PreciosPublicosRespuesta>(`${baseUrl}/planes/precios-publicos`);
    const precioPublico = publicos.datos.find(
      (precio) => precio.plan === 'STANDARD' && precio.pais === 'Mexico',
    );

    asegurar(precioPublico, 'No se encontró precio público STANDARD Mexico');
    asegurar(
      precioPublico.monto === montoNuevoCentavos,
      'La landing no refleja el precio actualizado en endpoint público',
    );

    const estudioProgramado = await prisma.estudio.findFirst({
      where: {
        plan: 'STANDARD',
        pais: 'Mexico',
        activo: true,
        estado: 'aprobado',
        fechaVencimiento: { gte: hoyISO() },
        precioPlanProximo: {
          monto: montoNuevoCentavos,
        },
      },
      select: {
        id: true,
        nombre: true,
        fechaVencimiento: true,
        precioPlanActualId: true,
        precioPlanProximoId: true,
        fechaAplicacionPrecioProximo: true,
        precioPlanActual: { select: { monto: true, version: true } },
        precioPlanProximo: { select: { monto: true, version: true } },
      },
    });

    asegurar(estudioProgramado, 'No se encontró un salón activo con precio próximo programado');
    asegurar(
      estudioProgramado.precioPlanActual?.monto === montoOriginalCentavos,
      'El salón activo no conservó precio anterior antes del corte',
    );
    asegurar(
      estudioProgramado.precioPlanProximo?.monto === montoNuevoCentavos,
      'El salón activo no quedó con precio próximo programado',
    );

    estudioRevertir = {
      id: estudioProgramado.id,
      fechaVencimiento: estudioProgramado.fechaVencimiento,
      precioPlanActualId: estudioProgramado.precioPlanActualId,
      precioPlanProximoId: estudioProgramado.precioPlanProximoId,
      fechaAplicacionPrecioProximo: estudioProgramado.fechaAplicacionPrecioProximo,
    };

    const pago = await solicitarJSON<PagoRespuesta>(`${baseUrl}/pagos`, {
      method: 'POST',
      headers: cabecerasAuth,
      body: JSON.stringify({
        estudioId: estudioProgramado.id,
        monto: 1,
        moneda: 'MXN',
        fecha: hoyISO(),
        extenderSuscripcion: true,
        meses: 1,
      }),
    });

    pagoCreadoId = pago.datos.id;

    asegurar(
      pago.datos.monto === montoNuevoCentavos,
      'El pago de renovación no cobró el nuevo precio al llegar el corte',
    );
    const estudioTrasPago = await prisma.estudio.findUnique({
      where: { id: estudioProgramado.id },
      select: {
        precioPlanActual: { select: { monto: true } },
        precioPlanProximoId: true,
        fechaAplicacionPrecioProximo: true,
      },
    });

    asegurar(estudioTrasPago, 'No se encontró el salón tras registrar el pago');
    asegurar(
      estudioTrasPago.precioPlanActual?.monto === montoNuevoCentavos,
      'El salón no tomó el nuevo precio como actual después de la renovación',
    );
    asegurar(
      estudioTrasPago.precioPlanProximoId === null && estudioTrasPago.fechaAplicacionPrecioProximo === null,
      'La programación no se limpió después de aplicar el nuevo precio',
    );

    console.log('BLOQUE 3 OK');
    console.log(
      JSON.stringify(
        {
          validaciones: [
            'Actualización de precio persistente y versionada',
            'Reflejo en endpoint público de landing',
            'Salón activo conserva precio anterior antes de corte',
            'Renovación aplica nuevo precio al corte',
            'Limpieza de programación post-renovación',
          ],
          metricas: gestionInicial.datos.metricas,
        },
        null,
        2,
      ),
    );
  } finally {
    if (estudioRevertir) {
      await prisma.estudio.update({
        where: { id: estudioRevertir.id },
        data: {
          fechaVencimiento: estudioRevertir.fechaVencimiento,
          precioPlanActualId: estudioRevertir.precioPlanActualId,
          precioPlanProximoId: estudioRevertir.precioPlanProximoId,
          fechaAplicacionPrecioProximo: estudioRevertir.fechaAplicacionPrecioProximo,
        },
      });
    }

    if (pagoCreadoId) {
      await prisma.pago.delete({ where: { id: pagoCreadoId } });
    }

    if (montoOriginalCentavos !== null) {
      try {
        const sesion = await solicitarJSON<SesionRespuesta>('http://localhost:3000/auth/iniciar-sesion', {
          method: 'POST',
          body: JSON.stringify({
            email: 'qa.bloque3@salonpromaster.com',
            contrasena: 'Bloque3Test2026',
          }),
        });

        await solicitarJSON<GestionPreciosRespuesta>('http://localhost:3000/admin/precios-planes/STANDARD/Mexico', {
          method: 'PUT',
          headers: { authorization: `Bearer ${sesion.datos.token}` },
          body: JSON.stringify({ monto: Math.trunc(montoOriginalCentavos / 100) }),
        });
      } catch (error) {
        console.warn('No se pudo restaurar el precio original al finalizar la prueba:', error);
      }
    }

    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('BLOQUE 3 FAIL');
  console.error(error);
  process.exitCode = 1;
});
