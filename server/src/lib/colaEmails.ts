import { prisma } from '../prismaCliente.js';
import { enviarEmail } from './email.js';

const ESTADO_PENDIENTE = 'pending';
const ESTADO_PROCESANDO = 'processing';
const ESTADO_ENVIADO = 'sent';
const ESTADO_FALLIDO = 'failed';
const TIPO_RECORDATORIO_RESERVA = 'recordatorio_reserva';

export type ResultadoEncoladoCorreo = 'nueva' | 'existente' | 'reactivada';

interface DatosCorreoPendiente {
  destinatario: string;
  asunto: string;
  html: string;
  tipoEvento?: string;
  referenciaId?: string;
  claveUnica?: string;
  maxIntentos?: number;
  procesarEn?: Date;
}

function normalizarClaveUnica(claveUnica?: string): string | null {
  const valor = claveUnica?.trim();
  return valor ? valor : null;
}

function calcularSiguienteIntento(intentos: number): Date {
  const minutosEspera = Math.min(60, Math.max(5, intentos * 5));
  return new Date(Date.now() + minutosEspera * 60 * 1000);
}

async function marcarRecordatorioEnviado(referenciaId?: string): Promise<void> {
  if (!referenciaId) {
    return;
  }

  await prisma.reserva.updateMany({
    where: { id: referenciaId, recordatorioEnviado: false },
    data: { recordatorioEnviado: true },
  });
}

export async function encolarCorreo(datos: DatosCorreoPendiente): Promise<ResultadoEncoladoCorreo> {
  const claveUnica = normalizarClaveUnica(datos.claveUnica);
  const procesarEn = datos.procesarEn ?? new Date();

  if (!claveUnica) {
    await prisma.correoPendiente.create({
      data: {
        destinatario: datos.destinatario,
        asunto: datos.asunto,
        html: datos.html,
        tipoEvento: datos.tipoEvento,
        referenciaId: datos.referenciaId,
        maxIntentos: datos.maxIntentos ?? 5,
        procesarEn,
      },
    });

    return 'nueva';
  }

  const existente = await prisma.correoPendiente.findUnique({
    where: { claveUnica },
    select: {
      id: true,
      estado: true,
    },
  });

  if (!existente) {
    await prisma.correoPendiente.create({
      data: {
        destinatario: datos.destinatario,
        asunto: datos.asunto,
        html: datos.html,
        tipoEvento: datos.tipoEvento,
        referenciaId: datos.referenciaId,
        claveUnica,
        maxIntentos: datos.maxIntentos ?? 5,
        procesarEn,
      },
    });

    return 'nueva';
  }

  if ([ESTADO_PENDIENTE, ESTADO_PROCESANDO, ESTADO_ENVIADO].includes(existente.estado)) {
    return 'existente';
  }

  await prisma.correoPendiente.update({
    where: { id: existente.id },
    data: {
      destinatario: datos.destinatario,
      asunto: datos.asunto,
      html: datos.html,
      estado: ESTADO_PENDIENTE,
      intentos: 0,
      maxIntentos: datos.maxIntentos ?? 5,
      ultimoError: null,
      procesarEn,
      enviadoEn: null,
      tipoEvento: datos.tipoEvento,
      referenciaId: datos.referenciaId,
    },
  });

  return 'reactivada';
}

export async function procesarColaCorreos(limite = 10): Promise<void> {
  const umbralRecuperacion = new Date(Date.now() - 10 * 60 * 1000);

  await prisma.correoPendiente.updateMany({
    where: {
      estado: ESTADO_PROCESANDO,
      actualizadoEn: { lt: umbralRecuperacion },
    },
    data: {
      estado: ESTADO_PENDIENTE,
      procesarEn: new Date(),
      ultimoError: 'Proceso anterior interrumpido; correo reprogramado automáticamente.',
    },
  });

  const pendientes = await prisma.correoPendiente.findMany({
    where: {
      estado: ESTADO_PENDIENTE,
      procesarEn: { lte: new Date() },
    },
    orderBy: [
      { procesarEn: 'asc' },
      { creadoEn: 'asc' },
    ],
    take: limite,
  });

  for (const correo of pendientes) {
    const tomado = await prisma.correoPendiente.updateMany({
      where: {
        id: correo.id,
        estado: ESTADO_PENDIENTE,
      },
      data: { estado: ESTADO_PROCESANDO },
    });

    if (tomado.count === 0) {
      continue;
    }

    const intentosTotales = correo.intentos + 1;

    try {
      const enviado = await enviarEmail(correo.destinatario, correo.asunto, correo.html);

      if (!enviado) {
        throw new Error('El proveedor no confirmó el envío del correo.');
      }

      await prisma.correoPendiente.update({
        where: { id: correo.id },
        data: {
          estado: ESTADO_ENVIADO,
          intentos: intentosTotales,
          ultimoError: null,
          enviadoEn: new Date(),
        },
      });

      if (correo.tipoEvento === TIPO_RECORDATORIO_RESERVA) {
        await marcarRecordatorioEnviado(correo.referenciaId ?? undefined);
      }
    } catch (error) {
      const mensaje = error instanceof Error ? error.message : 'No se pudo enviar el correo.';
      const agotoIntentos = intentosTotales >= correo.maxIntentos;

      await prisma.correoPendiente.update({
        where: { id: correo.id },
        data: {
          estado: agotoIntentos ? ESTADO_FALLIDO : ESTADO_PENDIENTE,
          intentos: intentosTotales,
          ultimoError: mensaje,
          procesarEn: agotoIntentos ? correo.procesarEn : calcularSiguienteIntento(intentosTotales),
        },
      });
    }
  }
}