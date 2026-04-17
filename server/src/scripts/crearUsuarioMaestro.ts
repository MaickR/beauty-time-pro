import 'dotenv/config';
import { prisma } from '../prismaCliente.js';
import { generarHashContrasena } from '../utils/contrasenas.js';

const REGEX_CONTRASENA = /^(?=.*[A-Z])(?=.*[0-9]).{8,}$/;

async function crearUsuarioMaestro(): Promise<void> {
	const email = process.env.MAESTRO_INICIAL_EMAIL?.trim().toLowerCase();
	const contrasena = process.env.MAESTRO_INICIAL_CONTRASENA?.trim();
	const nombre = process.env.MAESTRO_INICIAL_NOMBRE?.trim() || 'Usuario Maestro';

	if (!email || !contrasena) {
		throw new Error('Debes definir MAESTRO_INICIAL_EMAIL y MAESTRO_INICIAL_CONTRASENA para ejecutar este script');
	}

	if (!REGEX_CONTRASENA.test(contrasena)) {
		throw new Error('MAESTRO_INICIAL_CONTRASENA debe tener al menos 8 caracteres, una mayúscula y un número');
	}

	const usuarioExistente = await prisma.usuario.findUnique({
		where: { email },
		select: { id: true },
	});

	if (usuarioExistente) {
		console.log('ℹ️ Usuario maestro ya existe.');
		return;
	}

	const hashContrasena = await generarHashContrasena(contrasena);

	await prisma.usuario.create({
		data: {
			email,
			hashContrasena,
			nombre,
			rol: 'maestro',
			activo: true,
		},
	});

	console.log(`✅ Usuario maestro creado: ${email}`);
}

crearUsuarioMaestro()
	.catch((error: unknown) => {
		console.error('❌ No se pudo crear el usuario maestro:', error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
