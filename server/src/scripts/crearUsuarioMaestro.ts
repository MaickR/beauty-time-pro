import 'dotenv/config';
import { prisma } from '../prismaCliente.js';
import { generarHashContrasena } from '../utils/contrasenas.js';

const REGEX_CONTRASENA = /^(?=.*[A-Z])(?=.*[0-9]).{8,}$/;

interface DatosMaestro {
	email: string;
	contrasena: string;
	nombre: string;
}

function leerMaestrosDesdeEnv(): DatosMaestro[] {
	const maestros: DatosMaestro[] = [];

	const email1 = process.env.MAESTRO_INICIAL_EMAIL?.trim().toLowerCase();
	const contrasena1 = process.env.MAESTRO_INICIAL_CONTRASENA?.trim();
	const nombre1 = process.env.MAESTRO_INICIAL_NOMBRE?.trim() || 'Usuario Maestro';

	if (email1 && contrasena1) {
		maestros.push({ email: email1, contrasena: contrasena1, nombre: nombre1 });
	}

	const email2 = process.env.MAESTRO_2_EMAIL?.trim().toLowerCase();
	const contrasena2 = process.env.MAESTRO_2_CONTRASENA?.trim();
	const nombre2 = process.env.MAESTRO_2_NOMBRE?.trim() || 'Usuario Maestro 2';

	if (email2 && contrasena2) {
		maestros.push({ email: email2, contrasena: contrasena2, nombre: nombre2 });
	}

	return maestros;
}

async function asegurarMaestro(datos: DatosMaestro): Promise<void> {
	if (!REGEX_CONTRASENA.test(datos.contrasena)) {
		throw new Error(`La contraseña de ${datos.email} debe tener al menos 8 caracteres, una mayúscula y un número`);
	}

	const hashContrasena = await generarHashContrasena(datos.contrasena);

	const usuario = await prisma.usuario.upsert({
		where: { email: datos.email },
		update: {
			hashContrasena,
			nombre: datos.nombre,
			rol: 'maestro',
			activo: true,
			emailVerificado: true,
		},
		create: {
			email: datos.email,
			hashContrasena,
			nombre: datos.nombre,
			rol: 'maestro',
			activo: true,
			emailVerificado: true,
		},
	});

	await prisma.permisosMaestro.upsert({
		where: { usuarioId: usuario.id },
		update: {
			aprobarSalones: true,
			gestionarPagos: true,
			crearAdmins: true,
			verAuditLog: true,
			verMetricas: true,
			suspenderSalones: true,
			esMaestroTotal: true,
		},
		create: {
			usuarioId: usuario.id,
			aprobarSalones: true,
			gestionarPagos: true,
			crearAdmins: true,
			verAuditLog: true,
			verMetricas: true,
			suspenderSalones: true,
			esMaestroTotal: true,
		},
	});

	console.log(`✅ Maestro asegurado: ${datos.nombre} <${datos.email}>`);
}

async function crearUsuarioMaestro(): Promise<void> {
	const maestros = leerMaestrosDesdeEnv();

	if (maestros.length === 0) {
		throw new Error('Debes definir MAESTRO_INICIAL_EMAIL y MAESTRO_INICIAL_CONTRASENA para ejecutar este script');
	}

	for (const maestro of maestros) {
		await asegurarMaestro(maestro);
	}
}

crearUsuarioMaestro()
	.catch((error: unknown) => {
		console.error('❌ No se pudo crear el usuario maestro:', error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
