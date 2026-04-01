import { randomBytes } from 'node:crypto';
import { prisma } from '../prismaCliente.js';

const LONGITUD_INTENTOS = 20;
const LONGITUD_SEGMENTO_ALEATORIO = 20;

export const REGEX_CLAVE_DUENO_SEGURA = /^DUE[0-9A-F]{20}$/;
export const REGEX_CLAVE_CLIENTE_SEGURA = /^CLI[0-9A-F]{20}$/;

export function sanitizarClaveSalon(clave: string): string {
	return clave
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, '');
}

export function esClaveSalonSegura(
	clave: string,
	tipo: 'dueno' | 'cliente',
): boolean {
	const claveNormalizada = sanitizarClaveSalon(clave);
	return tipo === 'dueno'
		? REGEX_CLAVE_DUENO_SEGURA.test(claveNormalizada)
		: REGEX_CLAVE_CLIENTE_SEGURA.test(claveNormalizada);
}

function generarSegmentoAleatorio(): string {
	return randomBytes(LONGITUD_SEGMENTO_ALEATORIO / 2).toString('hex').toUpperCase();
}

export async function generarClavesSalonUnicas(_nombreSalon: string) {

	for (let intento = 0; intento < LONGITUD_INTENTOS; intento += 1) {
		const claveDueno = `DUE${generarSegmentoAleatorio()}`;
		const claveCliente = `CLI${generarSegmentoAleatorio()}`;

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