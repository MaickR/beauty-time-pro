import 'dotenv/config';
import { prisma } from '../prismaCliente.js';
import { generarHashContrasena } from '../utils/contrasenas.js';
import { asegurarCampoPorcentajeComisionUsuario } from '../lib/comisionVendedor.js';

const REGEX_CONTRASENA = /^(?=.*[A-Z])(?=.*[0-9]).{8,}$/;
const EMAIL_MIKE_LEGADO = 'msrl.dev420@gmail.com';

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

async function migrarCorreoMikeLegado(emailObjetivo: string, nombreObjetivo: string): Promise<void> {
	const emailNormalizado = emailObjetivo.trim().toLowerCase();
	if (!emailNormalizado || emailNormalizado === EMAIL_MIKE_LEGADO) {
		return;
	}

	const [usuarioObjetivo, usuarioLegado] = await Promise.all([
		prisma.usuario.findUnique({
			where: { email: emailNormalizado },
			select: { id: true },
		}),
		prisma.usuario.findUnique({
			where: { email: EMAIL_MIKE_LEGADO },
			select: { id: true },
		}),
	]);

	if (!usuarioLegado || usuarioObjetivo) {
		return;
	}

	await prisma.usuario.update({
		where: { id: usuarioLegado.id },
		data: {
			email: emailNormalizado,
			nombre: nombreObjetivo,
		},
	});

	console.log(`[maestro] Correo legado migrado: ${EMAIL_MIKE_LEGADO} -> ${emailNormalizado}`);
}

async function asegurarMaestro(datos: DatosMaestro): Promise<void> {
	if (!REGEX_CONTRASENA.test(datos.contrasena)) {
		console.error(`[maestro] La contraseña de ${datos.email} no cumple requisitos — omitiendo`);
		return;
	}

	// Verificar si el usuario ya existe para NO sobreescribir su contraseña en cada redeploy.
	// Solo se actualiza la contraseña desde el env var en la creación inicial.
	const usuarioExistente = await prisma.usuario.findUnique({
		where: { email: datos.email },
		select: { id: true },
	});

	let usuario: { id: string };

	if (usuarioExistente) {
		// Usuario ya existe: solo asegurar rol, nombre y estado activo — nunca resetear contraseña.
		usuario = await prisma.usuario.update({
			where: { id: usuarioExistente.id },
			data: {
				nombre: datos.nombre,
				rol: 'maestro',
				activo: true,
				emailVerificado: true,
			},
			select: { id: true },
		});
		console.log(`[maestro] Perfil existente asegurado (contraseña preservada): ${datos.email}`);
	} else {
		// Usuario nuevo: crear con la contraseña del env var.
		const hashContrasena = await generarHashContrasena(datos.contrasena);
		usuario = await prisma.usuario.create({
			data: {
				email: datos.email,
				hashContrasena,
				nombre: datos.nombre,
				rol: 'maestro',
				activo: true,
				emailVerificado: true,
			},
			select: { id: true },
		});
		console.log(`[maestro] Nuevo perfil maestro creado: ${datos.email}`);
	}

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
		console.log('[maestro] No hay variables MAESTRO_INICIAL_EMAIL/CONTRASENA — omitiendo');
		return;
	}

	await asegurarCampoPorcentajeComisionUsuario();

	if (maestros.length > 0) {
		await migrarCorreoMikeLegado(maestros[0]!.email, maestros[0]!.nombre);
	}

	for (const maestro of maestros) {
		await asegurarMaestro(maestro);
	}
}

crearUsuarioMaestro()
	.catch((error: unknown) => {
		console.error('[maestro] Error (no bloquea arranque):', error);
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
