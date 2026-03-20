import { randomBytes } from 'node:crypto';
import { prisma } from '../prismaCliente.js';

const LONGITUD_PREFIJO = 8;
const LONGITUD_INTENTOS = 20;

function normalizarPrefijoClaveSalon(nombreSalon: string): string {
	const base = nombreSalon
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, '')
		.slice(0, LONGITUD_PREFIJO);

	return base || 'SALON';
}

export function sanitizarClaveSalon(clave: string): string {
	return clave
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, '');
}

export async function generarClavesSalonUnicas(nombreSalon: string) {
	const prefijo = normalizarPrefijoClaveSalon(nombreSalon);

	for (let intento = 0; intento < LONGITUD_INTENTOS; intento += 1) {
		const sufijo = randomBytes(3).toString('hex').toUpperCase();
		const claveDueno = `${prefijo}${sufijo}`;
		const claveCliente = `${prefijo}CLI${sufijo}`;

		const existente = await prisma.estudio.findFirst({
			where: {
				OR: [{ claveDueno }, { claveCliente }],
			},
			select: { id: true },
		});

		if (!existente) {
			return { claveDueno, claveCliente };
		}
	}

	throw new Error('No se pudieron generar claves únicas para el salón');
}