import 'dotenv/config';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import { PrismaClient as PrismaClientGenerado } from './generated/prisma/client.js';

function obtenerDatabaseUrl(): string {
	const urlBaseDatos = process.env.DATABASE_URL?.trim();
	if (!urlBaseDatos) {
		throw new Error('DATABASE_URL es obligatoria para inicializar Prisma.');
	}

	return urlBaseDatos;
	}

function crearPrismaConAdaptador() {
	const urlBaseDatos = new URL(obtenerDatabaseUrl());

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

export const prisma = crearPrismaConAdaptador();
