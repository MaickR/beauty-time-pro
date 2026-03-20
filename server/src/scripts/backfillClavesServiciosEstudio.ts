import 'dotenv/config';
import { prisma } from '../prismaCliente.js';
import { generarClavesSalonUnicas, sanitizarClaveSalon } from '../lib/clavesSalon.js';

const CLAVE_SALON_REGEX = /^[A-Z0-9]+$/;

function normalizarServicios(servicios: unknown): { servicios: unknown; cambios: boolean } {
	if (!Array.isArray(servicios)) {
		return { servicios, cambios: false };
	}

	let cambios = false;
	const serviciosNormalizados = servicios.map((servicio) => {
		if (!servicio || typeof servicio !== 'object' || Array.isArray(servicio)) {
			return servicio;
		}

		const servicioActual = servicio as Record<string, unknown>;
		const precioActual = typeof servicioActual.price === 'number'
			? servicioActual.price
			: Number(servicioActual.price ?? 0);

		if (Number.isFinite(precioActual) && precioActual >= 1) {
			return servicio;
		}

		cambios = true;
		return {
			...servicioActual,
			price: 1,
		};
	});

	return { servicios: serviciosNormalizados, cambios };
}

async function ejecutar(): Promise<void> {
	const estudios = await prisma.estudio.findMany({
		select: {
			id: true,
			nombre: true,
			claveDueno: true,
			claveCliente: true,
			servicios: true,
		},
	});

	let clavesActualizadas = 0;
	let serviciosActualizados = 0;

	for (const estudio of estudios) {
		const cambios: Record<string, unknown> = {};
		const claveDuenoNormalizada = sanitizarClaveSalon(estudio.claveDueno);
		const claveClienteNormalizada = sanitizarClaveSalon(estudio.claveCliente);
		const requiereClavesNuevas =
			claveDuenoNormalizada !== estudio.claveDueno ||
			claveClienteNormalizada !== estudio.claveCliente ||
			!CLAVE_SALON_REGEX.test(estudio.claveDueno) ||
			!CLAVE_SALON_REGEX.test(estudio.claveCliente);

		if (requiereClavesNuevas) {
			const nuevasClaves = await generarClavesSalonUnicas(estudio.nombre);
			cambios.claveDueno = nuevasClaves.claveDueno;
			cambios.claveCliente = nuevasClaves.claveCliente;
			clavesActualizadas += 1;
		}

		const resultadoServicios = normalizarServicios(estudio.servicios);
		if (resultadoServicios.cambios) {
			cambios.servicios = resultadoServicios.servicios;
			serviciosActualizados += 1;
		}

		if (Object.keys(cambios).length > 0) {
			await prisma.estudio.update({
				where: { id: estudio.id },
				data: cambios,
			});
		}
	}

	console.log(
		JSON.stringify(
			{
				estudiosRevisados: estudios.length,
				clavesActualizadas,
				serviciosActualizados,
			},
			null,
			2,
		),
	);
}

void ejecutar()
	.catch((error) => {
		console.error('Error ejecutando backfill de estudios:', error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});