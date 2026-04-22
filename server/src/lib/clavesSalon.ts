import { randomBytes, randomInt } from 'node:crypto';
import { prisma } from '../prismaCliente.js';

const LONGITUD_INTENTOS = 120;
const LONGITUD_SEGMENTO_ALEATORIO = 20;
const TOTAL_VARIANTES_NUMERICAS_CLIENTE = 100;
const TOTAL_VARIANTES_NUMERICAS_DUENO = 1000;
const LONGITUD_MAXIMA_CLAVE_CLIENTE = 32;
const LONGITUD_BASE_MAXIMA_CLAVE_CLIENTE = LONGITUD_MAXIMA_CLAVE_CLIENTE - 2;
const PREFIJO_CLAVE_DUENO_MEMORABLE = 'ADM';
const LONGITUD_SUFIJO_CLAVE_DUENO = 3;
const LONGITUD_MAXIMA_CLAVE_DUENO = 32;
const LONGITUD_BASE_MAXIMA_CLAVE_DUENO =
	LONGITUD_MAXIMA_CLAVE_DUENO -
	PREFIJO_CLAVE_DUENO_MEMORABLE.length -
	LONGITUD_SUFIJO_CLAVE_DUENO;

export const REGEX_CLAVE_DUENO_SEGURA = /^DUE[0-9A-F]{20}$/;
export const REGEX_CLAVE_DUENO_MEMORABLE = /^ADM[A-Z][A-Z0-9]{1,25}[0-9]{3}$/;
export const REGEX_CLAVE_CLIENTE_SEGURA = /^CLI[0-9A-F]{20}$/;
export const REGEX_CLAVE_CLIENTE_MEMORABLE = /^[A-Z][A-Z0-9]{1,29}[0-9]{2}$/;

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
		? REGEX_CLAVE_DUENO_SEGURA.test(claveNormalizada) ||
				REGEX_CLAVE_DUENO_MEMORABLE.test(claveNormalizada)
		: REGEX_CLAVE_CLIENTE_SEGURA.test(claveNormalizada) ||
				REGEX_CLAVE_CLIENTE_MEMORABLE.test(claveNormalizada);
}

function generarSegmentoAleatorio(): string {
	return randomBytes(LONGITUD_SEGMENTO_ALEATORIO / 2).toString('hex').toUpperCase();
}

function normalizarBaseClaveDueno(nombreSalon: string): string {
	const baseNormalizada = nombreSalon
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, '')
		.replace(/^[0-9]+/, '');

	const baseConFallback = baseNormalizada || 'SALON';
	return baseConFallback.slice(0, LONGITUD_BASE_MAXIMA_CLAVE_DUENO);
}

function construirClaveDuenoMemorable(nombreSalon: string, sufijoNumerico: number): string {
	const base = normalizarBaseClaveDueno(nombreSalon);
	const sufijo = String(sufijoNumerico).padStart(LONGITUD_SUFIJO_CLAVE_DUENO, '0');
	return `${PREFIJO_CLAVE_DUENO_MEMORABLE}${base}${sufijo}`;
}

function normalizarBaseClaveCliente(nombreSalon: string): string {
	const baseNormalizada = nombreSalon
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '')
		.toUpperCase()
		.replace(/[^A-Z0-9]/g, '')
		.replace(/^[0-9]+/, '');

	const baseConFallback = baseNormalizada || 'SALON';
	return baseConFallback.slice(0, LONGITUD_BASE_MAXIMA_CLAVE_CLIENTE);
}

function construirClaveClienteMemorable(nombreSalon: string, sufijoNumerico: number): string {
	const base = normalizarBaseClaveCliente(nombreSalon);
	const sufijo = String(sufijoNumerico).padStart(2, '0');
	return `${base}${sufijo}`;
}

function elegirSufijoNumerico(intentados: Set<number>): number {
	if (intentados.size >= TOTAL_VARIANTES_NUMERICAS_CLIENTE) {
		return randomInt(TOTAL_VARIANTES_NUMERICAS_CLIENTE);
	}

	let numero = randomInt(TOTAL_VARIANTES_NUMERICAS_CLIENTE);
	while (intentados.has(numero)) {
		numero = randomInt(TOTAL_VARIANTES_NUMERICAS_CLIENTE);
	}

	intentados.add(numero);
	return numero;
}

function elegirSufijoNumericoDueno(intentados: Set<number>): number {
	if (intentados.size >= TOTAL_VARIANTES_NUMERICAS_DUENO) {
		return randomInt(TOTAL_VARIANTES_NUMERICAS_DUENO);
	}

	let numero = randomInt(TOTAL_VARIANTES_NUMERICAS_DUENO);
	while (intentados.has(numero)) {
		numero = randomInt(TOTAL_VARIANTES_NUMERICAS_DUENO);
	}

	intentados.add(numero);
	return numero;
}

export async function generarClavesSalonUnicas(nombreSalon: string) {
	const sufijosIntentados = new Set<number>();
	const sufijosDuenoIntentados = new Set<number>();

	for (let intento = 0; intento < LONGITUD_INTENTOS; intento += 1) {
		const sufijoDueno = elegirSufijoNumericoDueno(sufijosDuenoIntentados);
		const claveDueno = construirClaveDuenoMemorable(nombreSalon, sufijoDueno);
		const sufijoNumerico = elegirSufijoNumerico(sufijosIntentados);
		const claveCliente = construirClaveClienteMemorable(nombreSalon, sufijoNumerico);

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