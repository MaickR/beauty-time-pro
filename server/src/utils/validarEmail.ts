const DOMINIOS_PERMITIDOS = [
	'gmail.com',
	'googlemail.com',
	'hotmail.com',
	'hotmail.es',
	'hotmail.com.mx',
	'hotmail.com.co',
	'outlook.com',
	'outlook.es',
	'outlook.com.mx',
	'yahoo.com',
	'yahoo.es',
	'yahoo.com.mx',
	'yahoo.com.co',
];

const DOMINIOS_TEMPORALES_BLOQUEADOS = [
	'mailinator.com',
	'guerrillamail.com',
	'10minutemail.com',
	'temp-mail.org',
	'tempmail.com',
	'yopmail.com',
	'sharklasers.com',
	'dispostable.com',
];

export function esDominioPermitido(email: string): boolean {
	const dominio = email.split('@')[1]?.toLowerCase();
	return dominio !== undefined && DOMINIOS_PERMITIDOS.includes(dominio);
}

export function esEmailValido(email: string): boolean {
	const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return regex.test(email) && esDominioPermitido(email);
}

export function esEmailColaboradorValido(email: string): boolean {
	const correo = email.trim().toLowerCase();
	const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const dominio = correo.split('@')[1]?.toLowerCase();

	return Boolean(
		regex.test(correo) &&
			dominio &&
			!DOMINIOS_TEMPORALES_BLOQUEADOS.includes(dominio),
	);
}
