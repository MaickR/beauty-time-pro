import type { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { resolverCategoriasSalon } from '../lib/categoriasSalon.js';
import { generarClavesSalonUnicas } from '../lib/clavesSalon.js';
import { env } from '../lib/env.js';
import { prisma } from '../prismaCliente.js';
import { enviarEmailVerificacionCliente } from '../servicios/servicioEmail.js';
import { esEmailValido } from '../utils/validarEmail.js';
import { sanitizarTexto } from '../utils/sanitizar.js';
import { colorHexSchema, fechaIsoSchema, horaSchema, obtenerMensajeValidacion, telefonoSchema, textoSchema, urlOpcionalSchema } from '../lib/validacion.js';

const REGEX_CONTRASENA = /^(?=.*[A-Z])(?=.*[0-9]).{8,}$/;
const ERROR_DOMINIO = 'Solo se aceptan correos personales válidos y no temporales de Gmail, Hotmail, Outlook, Yahoo, iCloud o Proton';
const ERROR_CONTRASENA = 'La contraseña debe tener al menos 8 caracteres, una mayúscula y un número';

const esquemaHorarioRegistro = z.record(
	z.string(),
	z.object({
		isOpen: z.boolean(),
		openTime: horaSchema,
		closeTime: horaSchema,
	}).superRefine((dato, contexto) => {
		if (dato.isOpen && dato.closeTime <= dato.openTime) {
			contexto.addIssue({
				code: z.ZodIssueCode.custom,
				path: ['closeTime'],
				message: 'La hora de cierre debe ser posterior a la hora de apertura',
			});
		}
	}),
);

const esquemaServicioRegistro = z.object({
	name: textoSchema('servicio', 80),
	duration: z.number().int().min(5, 'La duración mínima es 5 minutos').max(720, 'La duración máxima es 720 minutos'),
	price: z.number().min(1, 'El precio debe ser mayor a 0').max(10000000, 'El precio excede el máximo permitido'),
	category: textoSchema('categoria', 80).optional(),
});

const esquemaServicioPersonalizadoRegistro = z.object({
	name: textoSchema('servicioPersonalizado', 80),
	category: textoSchema('categoria', 80),
});

const esquemaPersonalRegistro = z.object({
	nombre: textoSchema('nombrePersonal', 80),
	especialidades: z.array(textoSchema('especialidad', 80)).min(1, 'Cada especialista debe tener al menos un servicio').max(100),
	horaInicio: horaSchema,
	horaFin: horaSchema,
	descansoInicio: horaSchema.nullable().optional(),
	descansoFin: horaSchema.nullable().optional(),
}).superRefine((datos, contexto) => {
	if (datos.horaFin <= datos.horaInicio) {
		contexto.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['horaFin'],
			message: 'La hora de salida debe ser posterior a la hora de entrada',
		});
	}

	if ((datos.descansoInicio && !datos.descansoFin) || (!datos.descansoInicio && datos.descansoFin)) {
		contexto.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['descansoFin'],
			message: 'Debes completar ambas horas del almuerzo',
		});
	}

	if (datos.descansoInicio && datos.descansoFin && datos.descansoFin <= datos.descansoInicio) {
		contexto.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['descansoFin'],
			message: 'La salida de almuerzo debe ser posterior al inicio',
		});
	}
});

const esquemaDisponibilidadEmail = z.object({
	email: z.string().trim().max(120, 'El email no puede superar 120 caracteres').email('Email inválido'),
});

const esquemaRegistroCliente = z.object({
	email: z.string().trim().max(120, 'El email no puede superar 120 caracteres').email('Email inválido'),
	contrasena: z.string().min(8, ERROR_CONTRASENA).max(100, 'La contraseña no puede superar 100 caracteres'),
	nombre: textoSchema('nombre', 80),
	apellido: textoSchema('apellido', 80),
	fechaNacimiento: fechaIsoSchema,
	pais: z.enum(['Mexico', 'Colombia']),
	telefono: z.union([z.literal(''), telefonoSchema]).optional().transform((valor) => (valor === '' ? null : valor)),
});

const esquemaVerificarEmailCliente = z.object({
	token: z.string().trim().min(1, 'Token requerido'),
});

const esquemaRegistroSalon = z.object({
	email: z.string().trim().max(120, 'El email no puede superar 120 caracteres').email('Email inválido'),
	contrasena: z.string().min(8, ERROR_CONTRASENA).max(100, 'La contraseña no puede superar 100 caracteres'),
	nombre: textoSchema('nombre', 80),
	apellido: textoSchema('apellido', 80),
	nombreSalon: textoSchema('nombreSalon', 120),
	descripcion: textoSchema('descripcion', 500).nullable().optional(),
	direccion: textoSchema('direccion', 180),
	telefono: telefonoSchema,
	sitioWeb: urlOpcionalSchema,
	pais: z.enum(['Mexico', 'Colombia']),
	sucursales: z.array(textoSchema('sucursal', 80)).min(1, 'Debes registrar al menos una sucursal').max(20, 'Máximo 20 sucursales'),
	horario: esquemaHorarioRegistro,
	servicios: z.array(esquemaServicioRegistro).min(1, 'Debes registrar al menos un servicio').max(100, 'Máximo 100 servicios'),
	serviciosCustom: z.array(esquemaServicioPersonalizadoRegistro).max(100).optional(),
	personal: z.array(esquemaPersonalRegistro).min(1, 'Debes registrar al menos un especialista').max(100, 'Máximo 100 especialistas'),
	horarioApertura: horaSchema.optional(),
	horarioCierre: horaSchema.optional(),
	diasAtencion: textoSchema('diasAtencion', 120).optional(),
	numeroEspecialistas: z.number().int().min(1).max(100).optional(),
	categorias: textoSchema('categorias', 160).nullable().optional(),
	colorPrimario: colorHexSchema.optional(),
}).superRefine((datos, contexto) => {
	const serviciosDisponibles = new Set(datos.servicios.map((servicio) => servicio.name));
	const horariosAbiertos = Object.values(datos.horario).filter((dia) => dia.isOpen);

	if (horariosAbiertos.length === 0) {
		contexto.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['horario'],
			message: 'Debes abrir al menos un día de atención',
		});
	}

	if ((datos.numeroEspecialistas ?? datos.personal.length) !== datos.personal.length) {
		contexto.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['numeroEspecialistas'],
			message: 'El número de especialistas debe coincidir con el detalle capturado',
		});
	}

	datos.personal.forEach((persona, indice) => {
		persona.especialidades.forEach((especialidad) => {
			if (!serviciosDisponibles.has(especialidad)) {
				contexto.addIssue({
					code: z.ZodIssueCode.custom,
					path: ['personal', indice, 'especialidades'],
					message: `La especialidad ${especialidad} no existe en el catálogo del salón`,
				});
			}
		});
	});
});

async function obtenerUsuarioBloqueante(email: string) {
	const usuario = await prisma.usuario.findUnique({
		where: { email },
		select: {
			id: true,
			rol: true,
			activo: true,
			estudioId: true,
			estudio: { select: { id: true } },
		},
	});

	if (
		usuario &&
		usuario.rol === 'dueno' &&
		!usuario.activo &&
		(!usuario.estudioId || !usuario.estudio)
	) {
		await prisma.usuario.delete({ where: { id: usuario.id } });
		return null;
	}

	return usuario;
}

export async function rutasRegistro(servidor: FastifyInstance): Promise<void> {
	servidor.post<{
		Body: {
			email: string;
		};
	}>(
		'/registro/verificar-disponibilidad',
		async (solicitud, respuesta) => {
			const resultado = esquemaDisponibilidadEmail.safeParse(solicitud.body);
			if (!resultado.success) {
				return respuesta.code(400).send({ error: obtenerMensajeValidacion(resultado.error) });
			}

			const emailNorm = resultado.data.email.trim().toLowerCase();

			if (!esEmailValido(emailNorm)) {
				return respuesta.code(400).send({ error: ERROR_DOMINIO });
			}

			const [existeCliente, existeUsuario] = await Promise.all([
				prisma.clienteApp.findUnique({ where: { email: emailNorm }, select: { id: true } }),
				obtenerUsuarioBloqueante(emailNorm),
			]);

			if (existeCliente ?? existeUsuario) {
				return respuesta.code(409).send({ error: 'Este correo ya está registrado', codigo: 'EMAIL_DUPLICADO' });
			}

			return respuesta.send({ disponible: true });
		},
	);

	/**
	 * POST /registro/cliente
	 */
	servidor.post<{
		Body: {
			email: string;
			contrasena: string;
			nombre: string;
			apellido: string;
			fechaNacimiento: string;
			pais: 'Mexico' | 'Colombia';
			telefono?: string;
		};
	}>(  '/registro/cliente',
	  {
	    config: {
	      rateLimit: {
	        max: 5,
	        timeWindow: '1 hour',
	        errorResponseBuilder: () => ({
	          error: 'Demasiados registros. Espera 1 hora.',
	        }),
	      },
	    },
	  },
	  async (solicitud, respuesta) => {
		const resultado = esquemaRegistroCliente.safeParse(solicitud.body);
		if (!resultado.success) {
			return respuesta.code(400).send({ error: obtenerMensajeValidacion(resultado.error) });
		}

		const { email, contrasena, nombre, apellido, fechaNacimiento, pais, telefono } = resultado.data;

		const emailNorm = email.trim().toLowerCase();

		if (!esEmailValido(emailNorm)) {
			return respuesta.code(400).send({ error: ERROR_DOMINIO });
		}

		if (!REGEX_CONTRASENA.test(contrasena)) {
			return respuesta.code(400).send({ error: ERROR_CONTRASENA });
		}

		const [existeCliente, existeUsuario] = await Promise.all([
			prisma.clienteApp.findUnique({ where: { email: emailNorm }, select: { id: true } }),
			obtenerUsuarioBloqueante(emailNorm),
		]);

		if (existeCliente ?? existeUsuario) {
			return respuesta.code(409).send({ error: 'Este correo ya está registrado' });
		}

		const hashContrasena = await bcrypt.hash(contrasena, 12);

		const cliente = await prisma.clienteApp.create({
			data: {
				email: emailNorm,
				hashContrasena,
				nombre: nombre.trim(),
				apellido: apellido.trim(),
				fechaNacimiento: new Date(fechaNacimiento),
				pais,
				telefono: telefono?.trim() ?? null,
				emailVerificado: false,
			},
		});

		await prisma.tokenVerificacionApp.deleteMany({
			where: { clienteId: cliente.id, tipo: 'verificacion_email', usado: false },
		});

		const tokenVerificacion = await prisma.tokenVerificacionApp.create({
			data: {
				clienteId: cliente.id,
				tipo: 'verificacion_email',
				expiraEn: new Date(Date.now() + 24 * 60 * 60 * 1000),
			},
		});

		const enlaceVerificacion = `${env.FRONTEND_URL}/verificar-email?token=${tokenVerificacion.token}`;
		void enviarEmailVerificacionCliente({
			emailDestino: emailNorm,
			nombreCliente: nombre.trim(),
			enlaceVerificacion,
		});

		console.log('[Registro] Cliente creado:', emailNorm.split('@')[0] + '@***');
		void cliente;

		return respuesta.code(201).send({ datos: { mensaje: 'Revisa tu correo para verificar tu cuenta.', enlaceVerificacion } });
	  },
	);

	servidor.post<{ Body: { token: string } }>(
	  '/registro/verificar-email',
	  {
	    config: {
	      rateLimit: {
	        max: 10,
	        timeWindow: '15 minutes',
	        errorResponseBuilder: () => ({
	          error: 'Demasiados intentos. Espera 15 minutos.',
	        }),
	      },
	    },
	  },
	  async (solicitud, respuesta) => {
		const resultado = esquemaVerificarEmailCliente.safeParse(solicitud.body);
		if (!resultado.success) {
			return respuesta.code(400).send({ error: obtenerMensajeValidacion(resultado.error) });
		}

		const registro = await prisma.tokenVerificacionApp.findUnique({
			where: { token: resultado.data.token },
			include: { clienteApp: true },
		});

		if (!registro || registro.usado || registro.expiraEn < new Date() || !registro.clienteId || !registro.clienteApp) {
			return respuesta.code(400).send({ error: 'El enlace de verificación es inválido o expiró.' });
		}

		if (registro.tipo === 'verificacion_email') {
			await prisma.$transaction([
				prisma.clienteApp.update({ where: { id: registro.clienteId }, data: { emailVerificado: true } }),
				prisma.tokenVerificacionApp.update({ where: { id: registro.id }, data: { usado: true } }),
			]);

			return respuesta.send({ datos: { mensaje: 'Correo verificado. Ya puedes iniciar sesión.' } });
		}

		if (registro.tipo === 'cambio_email_cliente') {
			if (!registro.clienteApp.emailPendiente) {
				return respuesta.code(400).send({ error: 'No hay un cambio de correo pendiente para este enlace.' });
			}

			const emailPendienteNorm = registro.clienteApp.emailPendiente.trim().toLowerCase();
			const [existeCliente, existeUsuario] = await Promise.all([
				prisma.clienteApp.findFirst({
					where: { email: emailPendienteNorm, id: { not: registro.clienteId } },
					select: { id: true },
				}),
				obtenerUsuarioBloqueante(emailPendienteNorm),
			]);

			if (existeCliente ?? existeUsuario) {
				return respuesta.code(409).send({ error: 'Ese correo ya fue usado por otra cuenta.' });
			}

			await prisma.$transaction([
				prisma.clienteApp.update({
					where: { id: registro.clienteId },
					data: { email: emailPendienteNorm, emailPendiente: null, emailVerificado: true },
				}),
				prisma.tokenVerificacionApp.update({ where: { id: registro.id }, data: { usado: true } }),
				prisma.tokenVerificacionApp.updateMany({
					where: {
						clienteId: registro.clienteId,
						tipo: 'cambio_email_cliente',
						usado: false,
						id: { not: registro.id },
					},
					data: { usado: true },
				}),
			]);

			return respuesta.send({ datos: { mensaje: 'Tu nuevo correo fue confirmado correctamente.' } });
		}

		try {
			const tokenUsuario = servidor.jwt.verify<{
				tipo?: string;
				usuarioId?: string;
				emailNuevo?: string;
			}>(resultado.data.token);

			if (
				tokenUsuario.tipo === 'cambio_email_dueno' &&
				tokenUsuario.usuarioId &&
				tokenUsuario.emailNuevo
			) {
				const emailNuevo = tokenUsuario.emailNuevo.trim().toLowerCase();
				const usuario = await prisma.usuario.findUnique({
					where: { id: tokenUsuario.usuarioId },
					select: { id: true, email: true },
				});

				if (!usuario) {
					return respuesta.code(404).send({ error: 'La cuenta del dueño ya no existe.' });
				}

				if (usuario.email === emailNuevo) {
					return respuesta.send({ datos: { mensaje: 'Tu nuevo correo ya estaba confirmado.' } });
				}

				const [existeCliente, existeUsuario] = await Promise.all([
					prisma.clienteApp.findFirst({
						where: { OR: [{ email: emailNuevo }, { emailPendiente: emailNuevo }] },
						select: { id: true },
					}),
					obtenerUsuarioBloqueante(emailNuevo),
				]);

				if ((existeUsuario && existeUsuario.id !== usuario.id) || existeCliente) {
					return respuesta.code(409).send({ error: 'Ese correo ya fue usado por otra cuenta.' });
				}

				await prisma.usuario.update({
					where: { id: usuario.id },
					data: { email: emailNuevo, emailVerificado: true },
				});

				return respuesta.send({ datos: { mensaje: 'Tu nuevo correo fue confirmado correctamente.' } });
			}
		} catch {
			// Si no es un JWT válido, caerá al error genérico de enlace inválido.
		}

		return respuesta.code(400).send({ error: 'El enlace de verificación es inválido o expiró.' });
	  },
	);

	/**
	 * POST /registro/salon
	 */
	servidor.post<{
		Body: {
			email: string;
			contrasena: string;
			nombre: string;
			apellido: string;
			nombreSalon: string;
			descripcion?: string;
			direccion: string;
			telefono: string;
			horarioApertura?: string;
			horarioCierre?: string;
			diasAtencion?: string;
			numeroEspecialistas?: number;
			categorias?: string;
			colorPrimario?: string;
		};
	}>(  '/registro/salon',
	  {
	    config: {
	      rateLimit: {
	        max: 3,
	        timeWindow: '1 hour',
	        errorResponseBuilder: () => ({
	          error: 'Demasiados registros. Espera 1 hora.',
	        }),
	      },
	    },
	  },
	  async (solicitud, respuesta) => {
		const resultado = esquemaRegistroSalon.safeParse(solicitud.body);
		if (!resultado.success) {
			return respuesta.code(400).send({ error: obtenerMensajeValidacion(resultado.error) });
		}

		const {
			email,
			contrasena,
			nombre,
			apellido,
			nombreSalon,
			descripcion,
			direccion,
			telefono,
			sitioWeb,
			pais,
			sucursales,
			horario,
			servicios,
			serviciosCustom,
			personal,
			horarioApertura,
			horarioCierre,
			diasAtencion,
			numeroEspecialistas,
			categorias,
			colorPrimario,
		} = resultado.data;

		const emailNorm = email.trim().toLowerCase();

		if (!esEmailValido(emailNorm)) {
			return respuesta.code(400).send({ error: ERROR_DOMINIO });
		}

		if (!REGEX_CONTRASENA.test(contrasena)) {
			return respuesta.code(400).send({ error: ERROR_CONTRASENA });
		}

		const [existeCliente, existeUsuario] = await Promise.all([
			prisma.clienteApp.findUnique({ where: { email: emailNorm }, select: { id: true } }),
			obtenerUsuarioBloqueante(emailNorm),
		]);

		if (existeCliente ?? existeUsuario) {
			return respuesta.code(409).send({ error: 'Este correo ya está registrado' });
		}

		const hashContrasena = await bcrypt.hash(contrasena, 12);

		const { claveDueno, claveCliente } = await generarClavesSalonUnicas(nombreSalon);

		const hoy = new Date();
		const vencimiento = new Date(hoy);
		vencimiento.setMonth(vencimiento.getMonth() + 1);
		const vencimientoStr = vencimiento.toISOString().split('T')[0]!;
		const hoyStr = hoy.toISOString().split('T')[0]!;

		const [_usuario, _estudio] = await prisma.$transaction(async (tx) => {
			const nuevoUsuario = await tx.usuario.create({
				data: {
					email: emailNorm,
					hashContrasena,
					nombre: `${nombre.trim()} ${apellido.trim()}`,
					rol: 'dueno',
					activo: false,
					emailVerificado: true,
				},
			});

			const nuevoEstudio = await tx.estudio.create({
				data: {
				nombre: sanitizarTexto(nombreSalon.trim()),
					propietario: `${nombre.trim()} ${apellido.trim()}`,
					telefono: telefono.trim(),
					sitioWeb: sitioWeb ?? null,
					pais,
					sucursales,
					claveDueno,
					claveCliente,
					estado: 'pendiente',
					inicioSuscripcion: hoyStr,
					fechaVencimiento: vencimientoStr,
					horario,
					servicios,
					serviciosCustom: serviciosCustom ?? [],
					festivos: [],
				descripcion: descripcion !== undefined && descripcion !== null ? sanitizarTexto(descripcion.trim()) : null,
				direccion: sanitizarTexto(direccion.trim()),
					emailContacto: emailNorm,
					horarioApertura: horarioApertura ?? '09:00',
					horarioCierre: horarioCierre ?? '18:00',
					diasAtencion: diasAtencion ?? 'lunes,martes,miercoles,jueves,viernes',
					numeroEspecialistas: numeroEspecialistas ?? personal.length,
					categorias: resolverCategoriasSalon({ categorias, servicios, serviciosCustom }),
					colorPrimario: colorPrimario ?? '#C2185B',
					usuarios: { connect: { id: nuevoUsuario.id } },
				},
			});

			await tx.personal.createMany({
				data: personal.map((persona) => ({
					estudioId: nuevoEstudio.id,
					nombre: persona.nombre.trim(),
					especialidades: persona.especialidades,
					activo: true,
					horaInicio: persona.horaInicio,
					horaFin: persona.horaFin,
					descansoInicio: persona.descansoInicio ?? null,
					descansoFin: persona.descansoFin ?? null,
				})),
			});

			return [nuevoUsuario, nuevoEstudio];
		});

		console.log('[Registro] Solicitud salón generada para:', emailNorm.split('@')[0] + '@***');

		const datosRespuesta = {
			mensaje: 'Tu solicitud fue enviada. Te notificaremos cuando sea revisada.',
		};

		return respuesta.code(201).send({ datos: datosRespuesta });
	});
}
