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

export function esDominioPermitido(email: string): boolean {
	const dominio = email.split('@')[1]?.toLowerCase();
	return dominio !== undefined && DOMINIOS_PERMITIDOS.includes(dominio);
}

export function esEmailValido(email: string): boolean {
	const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	return regex.test(email) && esDominioPermitido(email);
}
