import { prisma } from '../prismaCliente.js';
import { encolarCorreo } from '../lib/colaEmails.js';
import {
  normalizarZonaHorariaEstudio,
  obtenerFechaISOEnZona,
} from '../utils/zonasHorarias.js';

let intervaloCumpleanos: NodeJS.Timeout | null = null;

/**
 * Obtiene las fechas MMDD de los próximos N días según una zona horaria.
 * Retorna un Set de strings "MM-DD" para comparar con fechaNacimiento.
 */
function obtenerRangoMmDd(zona: string, pais: string, dias: number): Set<string> {
  const resultado = new Set<string>();
  const ahora = new Date();

  for (let i = 0; i <= dias; i++) {
    const fecha = new Date(ahora);
    fecha.setDate(fecha.getDate() + i);
    const isoZona = obtenerFechaISOEnZona(fecha, zona, pais);
    // isoZona = "YYYY-MM-DD" → extraer MM-DD
    const mmDd = isoZona.substring(5); // "MM-DD"
    resultado.add(mmDd);
  }

  return resultado;
}

async function ejecutarJobCumpleanos(): Promise<void> {
  // Obtener estudios activos con plan PRO y vigencia válida
  const estudios = await prisma.estudio.findMany({
    where: {
      activo: true,
      estado: 'aprobado',
      plan: 'PRO',
    },
    select: {
      id: true,
      nombre: true,
      pais: true,
      zonaHoraria: true,
      fechaVencimiento: true,
    },
  });

  for (const estudio of estudios) {
    const zona = normalizarZonaHorariaEstudio(estudio.zonaHoraria, estudio.pais);
    const hoyZona = obtenerFechaISOEnZona(new Date(), zona, estudio.pais);

    // Saltar estudios vencidos
    if (estudio.fechaVencimiento < hoyZona) continue;

    // Rango de 3 días (hoy + 1 + 2 + 3)
    const rangoMmDd = obtenerRangoMmDd(zona, estudio.pais, 3);
    const anioActual = hoyZona.substring(0, 4);

    // Buscar clientes con email y al menos una reserva completada
    const clientes = await prisma.cliente.findMany({
      where: {
        estudioId: estudio.id,
        activo: true,
        email: { not: null },
        reservas: {
          some: { estado: 'completed' },
        },
      },
      select: {
        id: true,
        nombre: true,
        email: true,
        fechaNacimiento: true,
      },
    });

    for (const cliente of clientes) {
      if (!cliente.email || !cliente.fechaNacimiento) continue;

      // Extraer MM-DD del fechaNacimiento (DateTime → ISO string)
      const fechaNac = new Date(cliente.fechaNacimiento);
      const mes = String(fechaNac.getMonth() + 1).padStart(2, '0');
      const dia = String(fechaNac.getDate()).padStart(2, '0');
      const mmDdCliente = `${mes}-${dia}`;

      if (!rangoMmDd.has(mmDdCliente)) continue;

      // Encolar correo de cumpleaños (claveUnica evita duplicados por año)
      await encolarCorreo({
        destinatario: cliente.email,
        asunto: `🎂 Happy Birthday, ${cliente.nombre}! — ${estudio.nombre}`,
        html: construirHtmlCumpleanos(cliente.nombre, estudio.nombre),
        tipoEvento: 'cumpleanos',
        referenciaId: cliente.id,
        claveUnica: `cumpleanos_${cliente.id}_${anioActual}`,
      });
    }
  }
}

function construirHtmlCumpleanos(nombreCliente: string, nombreSalon: string): string {
  return `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;text-align:center;">
      <h1 style="color:#C2185B;font-size:28px;">🎂 Happy Birthday, ${nombreCliente}!</h1>
      <p style="font-size:16px;line-height:1.6;color:#333;">
        From all of us at <strong>${nombreSalon}</strong>, we wish you a wonderful birthday!
      </p>
      <p style="font-size:16px;line-height:1.6;color:#333;">
        Celebrate with a special visit — we'd love to pamper you on your special day.
      </p>
      <hr style="border:none;border-top:1px solid #eee;margin:24px 0;" />
      <p style="font-size:12px;color:#999;">Sent by ${nombreSalon}</p>
    </div>
  `;
}

export function iniciarJobCumpleanos(): void {
  if (intervaloCumpleanos) return;

  void ejecutarJobCumpleanos().catch((error) => {
    console.error('Error ejecutando job de cumpleaños inicial:', error);
  });

  // Ejecutar cada 6 horas
  intervaloCumpleanos = setInterval(() => {
    void ejecutarJobCumpleanos().catch((error) => {
      console.error('Error ejecutando job de cumpleaños:', error);
    });
  }, 6 * 60 * 60 * 1000);
}
