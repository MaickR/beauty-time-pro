import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { resolverCategoriasSalon } from '../lib/categoriasSalon.js';
import { generarClavesSalonUnicas } from '../lib/clavesSalon.js';
import { env } from '../lib/env.js';
import { generarCodigoAlfanumerico, hashValorSesion } from '../lib/sesionesAuth.js';
import { prisma } from '../prismaCliente.js';
import { enviarEmailVerificacionCliente } from '../servicios/servicioEmail.js';
import { generarHashContrasena } from '../utils/contrasenas.js';
import { esEmailClienteValido, esEmailValido } from '../utils/validarEmail.js';
import { sanitizarTexto } from '../utils/sanitizar.js';
import {
	colorHexSchema,
	fechaCumpleanosActualSchema,
	horaSchema,
	obtenerMensajeValidacion,
	telefonoClienteSchema,
	telefonoSchema,
	textoSchema,
	textoSoloLetrasSchema,
	urlOpcionalSchema,
} from '../lib/validacion.js';
import { validarCantidadEmpleadosActivosPlan, validarCantidadServiciosPlan } from '../lib/planes.js';
import { obtenerFechaISOEnZona, obtenerZonaHorariaPorPais } from '../utils/zonasHorarias.js';

const REGEX_CONTRASENA = /^(?=.*[A-Z])(?=.*[a-z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{8,}$/;
const ERROR_DOMINIO = 'Solo se aceptan correos personales válidos de Gmail, Outlook, Hotmail, iCloud o Yahoo';
const ERROR_CONTRASENA = 'La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial';
const SEGUNDOS_REENVIO_CODIGO = 60;
const MINUTOS_EXPIRACION_CODIGO = 15;

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
	price: z.number().int().min(100, 'El precio debe ser mayor a 0').max(1000000000, 'El precio excede el máximo permitido'),
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
	nombreCompleto: textoSoloLetrasSchema('nombreCompleto', 120, 3).optional(),
	nombre: textoSoloLetrasSchema('nombre', 80, 1).optional(),
	apellido: textoSoloLetrasSchema('apellido', 80, 1).optional(),
	fechaNacimiento: fechaCumpleanosActualSchema,
	pais: z.enum(['Mexico', 'Colombia']),
	telefono: z.union([z.literal(''), telefonoClienteSchema]).optional().transform((valor) => (valor === '' ? null : valor)),
	ciudad: z.union([z.literal(''), textoSoloLetrasSchema('ciudad', 80, 1)]).optional().transform((valor) => valor || null),
}).superRefine((datos, contexto) => {
	if (!datos.nombreCompleto && !datos.nombre) {
		contexto.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['nombreCompleto'],
			message: 'Debes indicar el nombre completo',
		});
	}
});

const esquemaVerificarEmailCliente = z.object({
	token: z.string().trim().min(1, 'Token requerido').optional(),
	clienteId: z.string().trim().uuid('Cliente inválido').optional(),
	codigo: z.string().trim().min(4, 'Código inválido').max(4, 'Código inválido').optional(),
}).superRefine((datos, contexto) => {
	const usaToken = Boolean(datos.token);
	const usaCodigo = Boolean(datos.clienteId || datos.codigo);

	if (!usaToken && !(datos.clienteId && datos.codigo)) {
		contexto.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['codigo'],
			message: 'Debes enviar un token o un código de verificación',
		});
	}

	if (usaToken && usaCodigo) {
		contexto.addIssue({
			code: z.ZodIssueCode.custom,
			path: ['token'],
			message: 'Envía solo un método de verificación por solicitud',
		});
	}
});

const esquemaReenviarCodigoCliente = z.object({
	clienteId: z.string().trim().uuid('Cliente inválido'),
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
		await prisma.usuario.update({
			where: { id: usuario.id },
			data: {
				email: `archivado+${usuario.id}@beautytime.local`,
			},
		});
		return null;
	}

	return usuario;
}

function obtenerNombreClienteRegistro(datos: {
	nombreCompleto?: string;
	nombre?: string;
	apellido?: string;
}): { nombre: string; apellido: string } {
	if (datos.nombreCompleto?.trim()) {
		const limpio = sanitizarTexto(datos.nombreCompleto.trim());
		const partes = limpio.split(/\s+/).filter(Boolean);
		const nombre = partes.shift() ?? limpio;
		const apellido = partes.join(' ').trim();
		return {
			nombre,
			apellido,
		};
	}

	return {
		nombre: sanitizarTexto(datos.nombre?.trim() ?? ''),
		apellido: sanitizarTexto(datos.apellido?.trim() ?? ''),
	};
}

async function crearCodigoVerificacionCliente(clienteId: string): Promise<{ codigo: string; expiraEn: Date }> {
	await prisma.tokenVerificacionApp.updateMany({
		where: { clienteId, tipo: 'verificacion_email', usado: false },
		data: { usado: true },
	});

	const codigo = generarCodigoAlfanumerico(4);
	const expiraEn = new Date(Date.now() + MINUTOS_EXPIRACION_CODIGO * 60 * 1000);

	await prisma.tokenVerificacionApp.create({
		data: {
			clienteId,
			tipo: 'verificacion_email',
			codigoHash: hashValorSesion(codigo),
			expiraEn,
			ultimoEnvioEn: new Date(),
		},
	});

	return { codigo, expiraEn };
}

async function enviarCodigoVerificacionCliente(params: {
	emailDestino: string;
	nombreCliente: string;
	codigo: string;
}): Promise<void> {
	await enviarEmailVerificacionCliente({
		emailDestino: params.emailDestino,
		nombreCliente: params.nombreCliente,
		codigoVerificacion: params.codigo,
		titulo: 'Completa tu registro',
		mensajePrincipal: `Hola ${params.nombreCliente}, ingresa este código en Beauty Time Pro para terminar de crear tu cuenta de cliente.`,
		mensajeSecundario: 'El código vence en 15 minutos. Si solicitas uno nuevo, el anterior queda inválido de inmediato.',
		asunto: 'Tu código de verificación — Beauty Time Pro',
	});
}

interface RegistroVerificacionCodigo {
	id: string;
	clienteId: string | null;
	tipo: string;
	usado: boolean;
	expiraEn: Date;
	creadoEn: Date;
	codigoHash: string | null;
	intentosFallidos: number;
	ultimoEnvioEn: Date;
	clienteApp: {
		id: string;
		emailPendiente: string | null;
	} | null;
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
				return respuesta.send({ disponible: false });
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
			nombreCompleto?: string;
			nombre?: string;
			apellido?: string;
			fechaNacimiento: string;
			pais: 'Mexico' | 'Colombia';
			telefono?: string;
			ciudad?: string;
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

		const { email, contrasena, fechaNacimiento, pais, telefono, ciudad } = resultado.data;
		const nombreCliente = obtenerNombreClienteRegistro(resultado.data);

		const emailNorm = email.trim().toLowerCase();
		const telefonoNormalizado = telefono?.trim() ?? null;

		if (!esEmailClienteValido(emailNorm)) {
			return respuesta.code(400).send({ error: ERROR_DOMINIO });
		}

		if (!REGEX_CONTRASENA.test(contrasena)) {
			return respuesta.code(400).send({ error: ERROR_CONTRASENA });
		}

		const [clienteExistente, existeUsuario, telefonoDuplicado] = await Promise.all([
			prisma.clienteApp.findUnique({ where: { email: emailNorm }, select: { id: true, emailVerificado: true } }),
			obtenerUsuarioBloqueante(emailNorm),
			telefonoNormalizado
				? prisma.clienteApp.findFirst({
					where: { telefono: telefonoNormalizado },
					select: { id: true },
				})
				: Promise.resolve(null),
		]);

		if (telefonoDuplicado && telefonoDuplicado.id !== clienteExistente?.id) {
			return respuesta.code(409).send({
				error: 'Este número de teléfono ya está registrado.',
				campos: { telefono: 'El teléfono ya está en uso.' },
			});
		}

		if (existeUsuario || clienteExistente?.emailVerificado) {
			return respuesta.send({ datos: { mensaje: 'Si este correo no está registrado, recibirás un email de confirmación.' } });
		}

		const hashContrasena = await generarHashContrasena(contrasena);

		const cliente = clienteExistente
			? await prisma.clienteApp.update({
				where: { id: clienteExistente.id },
				data: {
					hashContrasena,
					nombre: nombreCliente.nombre,
					apellido: nombreCliente.apellido,
					fechaNacimiento: new Date(fechaNacimiento),
					pais,
					telefono: telefonoNormalizado,
					ciudad: ciudad ?? null,
					emailVerificado: false,
					activo: true,
				},
				select: { id: true, nombre: true, email: true },
			})
			: await prisma.clienteApp.create({
				data: {
					email: emailNorm,
					hashContrasena,
					nombre: nombreCliente.nombre,
					apellido: nombreCliente.apellido,
					fechaNacimiento: new Date(fechaNacimiento),
					pais,
					telefono: telefonoNormalizado,
					ciudad: ciudad ?? null,
					emailVerificado: false,
				},
				select: { id: true, nombre: true, email: true },
			});

		const { codigo, expiraEn } = await crearCodigoVerificacionCliente(cliente.id);
		void enviarCodigoVerificacionCliente({
			emailDestino: emailNorm,
			nombreCliente: cliente.nombre,
			codigo,
		});

		console.log('[Registro] Cliente creado:', emailNorm.split('@')[0] + '@***');

		return respuesta.code(201).send({
			datos: {
				mensaje: 'Enviamos un código de verificación a tu correo.',
				clienteId: cliente.id,
				email: cliente.email,
				expiraEn,
				reenviarEnSegundos: SEGUNDOS_REENVIO_CODIGO,
			},
		});
	  },
	);

	servidor.post<{
		Body: { token?: string; clienteId?: string; codigo?: string };
	}>(
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

		if (resultado.data.clienteId && resultado.data.codigo) {
			const registro = await prisma.tokenVerificacionApp.findFirst({
				where: {
					clienteId: resultado.data.clienteId,
					tipo: 'verificacion_email',
					usado: false,
				},
				include: { clienteApp: true },
				orderBy: { creadoEn: 'desc' },
			}) as RegistroVerificacionCodigo | null;

			if (!registro || !registro.clienteId || !registro.clienteApp || !registro.codigoHash) {
				return respuesta.code(400).send({
					error: 'El código de verificación es inválido o expiró.',
					codigo: 'CODIGO_EXPIRADO',
					campos: { codigo: 'Solicita un nuevo código.' },
				});
			}

			if (registro.expiraEn < new Date()) {
				await prisma.tokenVerificacionApp.update({
					where: { id: registro.id },
					data: { usado: true },
				});

				return respuesta.code(400).send({
					error: 'Este código expiró. Solicita uno nuevo.',
					codigo: 'CODIGO_EXPIRADO',
					campos: { codigo: 'Código expirado.' },
				});
			}

			if (hashValorSesion(resultado.data.codigo.toUpperCase()) !== registro.codigoHash) {
				const intentosFallidos = registro.intentosFallidos + 1;
				await prisma.tokenVerificacionApp.update({
					where: { id: registro.id },
					data: {
						intentosFallidos,
						usado: intentosFallidos >= 5,
					},
				});

				return respuesta.code(400).send({
					error: intentosFallidos >= 5
						? 'Este código expiró. Solicita uno nuevo.'
						: 'El código de verificación es incorrecto.',
					codigo: intentosFallidos >= 5 ? 'CODIGO_EXPIRADO' : 'CODIGO_INVALIDO',
					campos: { codigo: intentosFallidos >= 5 ? 'El código expiró por demasiados intentos.' : 'Código incorrecto.' },
				});
			}

			await prisma.$transaction([
				prisma.clienteApp.update({
					where: { id: registro.clienteId },
					data: { emailVerificado: true },
				}),
				prisma.tokenVerificacionApp.update({ where: { id: registro.id }, data: { usado: true } }),
				prisma.tokenVerificacionApp.updateMany({
					where: {
						clienteId: registro.clienteId,
						tipo: 'verificacion_email',
						usado: false,
						id: { not: registro.id },
					},
					data: { usado: true },
				}),
			]);

			return respuesta.send({ datos: { mensaje: 'Correo verificado. Ya puedes iniciar sesión.' } });
		}

		const token = resultado.data.token;
		if (!token) {
			return respuesta.code(400).send({ error: 'No se proporcionó un token de verificación.' });
		}

		const registro = await prisma.tokenVerificacionApp.findUnique({
			where: { token },
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
			}>(token);

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

	servidor.post<{
		Body: { clienteId: string };
	}>(
		'/registro/reenviar-codigo',
		{
			config: {
				rateLimit: {
					max: 6,
					timeWindow: '1 hour',
					errorResponseBuilder: () => ({
						error: 'Demasiadas solicitudes. Intenta más tarde.',
					}),
				},
			},
		},
		async (solicitud, respuesta) => {
			const resultado = esquemaReenviarCodigoCliente.safeParse(solicitud.body);
			if (!resultado.success) {
				return respuesta.code(400).send({ error: obtenerMensajeValidacion(resultado.error) });
			}

			const cliente = await prisma.clienteApp.findUnique({
				where: { id: resultado.data.clienteId },
				select: { id: true, nombre: true, email: true, emailVerificado: true, activo: true },
			});

			if (!cliente || !cliente.activo || cliente.emailVerificado) {
				return respuesta.send({ datos: { mensaje: 'Si la solicitud es válida, enviaremos un nuevo código.' } });
			}

			const ultimoCodigo = await prisma.tokenVerificacionApp.findFirst({
				where: {
					clienteId: cliente.id,
					tipo: 'verificacion_email',
					usado: false,
				},
				orderBy: { creadoEn: 'desc' },
			}) as RegistroVerificacionCodigo | null;

			if (ultimoCodigo) {
				const transcurrido = Date.now() - ultimoCodigo.ultimoEnvioEn.getTime();
				const restante = SEGUNDOS_REENVIO_CODIGO - Math.ceil(transcurrido / 1000);
				if (restante > 0) {
					return respuesta.code(429).send({
						error: `Espera ${restante} segundos antes de solicitar un nuevo código.`,
						codigo: 'REENVIO_BLOQUEADO',
						segundosRestantes: restante,
					});
				}
			}

			const { codigo, expiraEn } = await crearCodigoVerificacionCliente(cliente.id);
			void enviarCodigoVerificacionCliente({
				emailDestino: cliente.email,
				nombreCliente: cliente.nombre,
				codigo,
			});

			return respuesta.send({
				datos: {
					mensaje: 'Enviamos un nuevo código de verificación a tu correo.',
					clienteId: cliente.id,
					expiraEn,
					reenviarEnSegundos: SEGUNDOS_REENVIO_CODIGO,
				},
			});
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

		const errorServiciosPlan = validarCantidadServiciosPlan({
			plan: 'STANDARD',
			cantidadNueva: servicios.length,
		});
		if (errorServiciosPlan) {
			return respuesta.code(400).send({ error: errorServiciosPlan, codigo: 'LIMITE_PLAN' });
		}

		const errorPersonalPlan = validarCantidadEmpleadosActivosPlan({
			plan: 'STANDARD',
			cantidadNueva: personal.length,
		});
		if (errorPersonalPlan) {
			return respuesta.code(400).send({ error: errorPersonalPlan, codigo: 'LIMITE_PLAN' });
		}

		if (existeCliente ?? existeUsuario) {
			return respuesta.send({ datos: { mensaje: 'Si este correo no está registrado, recibirás un email de confirmación.' } });
		}

		const hashContrasena = await generarHashContrasena(contrasena);

		const { claveDueno, claveCliente } = await generarClavesSalonUnicas(nombreSalon);

		const hoy = new Date();
		const vencimiento = new Date(hoy);
		vencimiento.setMonth(vencimiento.getMonth() + 1);
		const zonaHorariaSalon = obtenerZonaHorariaPorPais(pais);
		const vencimientoStr = obtenerFechaISOEnZona(vencimiento, zonaHorariaSalon, pais);
		const hoyStr = obtenerFechaISOEnZona(hoy, zonaHorariaSalon, pais);

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
					zonaHoraria: obtenerZonaHorariaPorPais(pais),
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
