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
	'live.com',
	'live.com.mx',
	'live.com.co',
	'yahoo.com',
	'yahoo.es',
	'yahoo.com.mx',
	'yahoo.com.co',
	'icloud.com',
	'me.com',
	'protonmail.com',
	'pm.me',
];

export function esDominioPermitido(email: string): boolean {
	const dominio = email.split('@')[1]?.toLowerCase();
	return dominio !== undefined && DOMINIOS_PERMITIDOS.includes(dominio);
}

export function esEmailValido(email: string): boolean {
	const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return regex.test(email) && esDominioPermitido(email);
}
