import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient as PrismaClientEstandar } from '@prisma/client';
import { PrismaClient as PrismaClientGenerado } from './generated/prisma/client.js';

const usarAdaptadorMariaDb = process.env.PRISMA_USAR_ADAPTADOR_MARIADB === 'true';

function crearPrismaConAdaptador() {
	const urlBaseDatos = new URL(
		process.env.DATABASE_URL ?? 'mysql://root:1234@localhost:3306/beauty_time_pro',
	);

	const adaptador = new PrismaMariaDb({
		host: urlBaseDatos.hostname,
		port: Number(urlBaseDatos.port || '3306'),
		user: decodeURIComponent(urlBaseDatos.username),
		password: decodeURIComponent(urlBaseDatos.password),
		database: urlBaseDatos.pathname.replace(/^\//, ''),
		allowPublicKeyRetrieval: true,
	});

	return new PrismaClientGenerado({ adapter: adaptador });
}

export const prisma = (
	usarAdaptadorMariaDb ? crearPrismaConAdaptador() : new PrismaClientEstandar()
) as unknown as PrismaClientGenerado;
