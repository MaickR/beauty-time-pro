<div align="center">

# SalonProMaster

**Plataforma SaaS para la operación moderna de salones de belleza**

<p><strong>Dominio oficial:</strong> https://salonpromaster.com</p>

[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![Fastify](https://img.shields.io/badge/Fastify-5-000000?style=flat-square&logo=fastify&logoColor=white)](https://fastify.dev/)
[![Prisma](https://img.shields.io/badge/Prisma-7-2D3748?style=flat-square&logo=prisma&logoColor=white)](https://www.prisma.io/)
[![MySQL](https://img.shields.io/badge/MySQL-8-4479A1?style=flat-square&logo=mysql&logoColor=white)](https://www.mysql.com/)
[![Vitest](https://img.shields.io/badge/Vitest-4-6E9F18?style=flat-square&logo=vitest&logoColor=white)](https://vitest.dev/)

</div>

---

SalonProMaster centraliza agenda, reservas, personal, pagos y relación con clientes en una sola plataforma. El proyecto está pensado para una operación comercial real en México y Colombia, con foco en seguridad, consistencia de negocio, rendimiento y una experiencia clara tanto para el salón como para el cliente final.

El repositorio incluye el frontend público y privado, la API backend, validaciones de entorno, auditoría operativa y pruebas automatizadas para flujos críticos.

<br>

## Tabla de contenidos

- [Características](#características)
- [Stack tecnológico](#stack-tecnológico)
- [Arquitectura](#arquitectura)
- [Instalación local](#instalación-local)
- [Variables de entorno](#variables-de-entorno)
- [Scripts disponibles](#scripts-disponibles)
- [Autenticación y seguridad](#autenticación-y-seguridad)
- [Deploy](#deploy)
- [Licencia](#licencia)

<br>

## Características

### Panel del propietario
- **Agenda visual** con disponibilidad, cierres y control operativo en tiempo real
- **Gestión de personal** con especialidades, horarios, descansos y estado de acceso
- **Catálogo de servicios** con duración, precio y categorías por salón
- **Programa de fidelidad** configurable por salón
- **Perfil comercial** con logo, color primario, descripción y datos de contacto
- **Control de festivos** y excepciones de disponibilidad
- Notificaciones push a clientes ante cambios en sus reservas

### Portal del cliente
- Búsqueda y filtro de salones por categoría, país y texto libre
- Flujo de reserva guiado: servicio → especialista → horario → confirmación
- Recordatorios automáticos por email (24 h antes)
- Cancelación segura con enlace único por email
- Historial de citas y próximas reservas
- Perfil de cliente con datos personales e historial de fidelidad
- Notificaciones push en tiempo real

### Panel maestro (superadmin)
- Aprobación y rechazo de solicitudes de nuevos salones
- Gestión de suscripciones, fechas de vencimiento y pagos globales
- Auditoría de acciones con log detallado
- Administración de admins con permisos granulares

<br>

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Frontend | React 19, Vite 7, TypeScript 5.9 strict, Tailwind CSS v4 |
| Estado y datos | TanStack Query v5, Zustand v5, React Hook Form + Zod |
| Backend | Fastify 5, Node.js ESM, TypeScript |
| Base de datos | MySQL 8, Prisma ORM 7 |
| Autenticación | JWT — access token 15 min + refresh token en cookie httpOnly |
| Email | Resend con reintentos exponenciales |
| Notificaciones push | Web Push API + VAPID |
| Seguridad | @fastify/helmet (CSP completo), @fastify/rate-limit, bcrypt |
| Rendimiento | @fastify/compress, node-cache, sharp (optimización de imágenes) |
| Testing | Vitest + Testing Library |

<br>

## Arquitectura

~~~
beauty-time-pro/
│
├── src/                          # Aplicación React
│   ├── app/                      # Enrutador y proveedores globales
│   ├── caracteristicas/          # Módulos por dominio
│   │   ├── autenticacion/
│   │   ├── cliente/
│   │   ├── estudio/
│   │   ├── maestro/
│   │   └── reserva/
│   ├── componentes/
│   │   ├── ui/                   # Modal, Toast, Badge, Spinner…
│   │   └── diseno/               # Header, TabBar, NavegacionCliente…
│   ├── servicios/                # Clientes HTTP hacia la API
│   ├── tienda/                   # Estado global (Zustand — solo auth)
│   ├── tipos/                    # Interfaces TypeScript del dominio
│   ├── utils/                    # Funciones puras
│   └── lib/                      # TanStack Query, env validado, constantes
│
├── server/                       # API REST
│   ├── src/
│   │   ├── rutas/                # Handlers por recurso
│   │   ├── servicios/            # Lógica de negocio y email
│   │   ├── middleware/           # Autenticación JWT
│   │   ├── jobs/                 # Tareas programadas (recordatorios)
│   │   ├── lib/                  # Env, email, fidelidad, caché
│   │   └── utils/                # Auditoría, sanitización, notificaciones
│   └── prisma/
│       ├── schema.prisma
│       └── migrations/
│
└── scripts/
    └── semilla.ts                # Datos de demostración
~~~

<br>

## Instalación local

### Requisitos previos

- Node.js ≥ 20
- MySQL 8 corriendo localmente
- (Opcional) Cuenta en [Resend](https://resend.com) para emails

### 1. Clonar e instalar dependencias

~~~bash
git clone https://github.com/MaickR/beauty-time-pro.git
cd beauty-time-pro

# Frontend
npm install

# Backend
cd server && npm install
~~~

### 2. Configurar variables de entorno

Ver sección [Variables de entorno](#variables-de-entorno).

### 3. Aplicar migraciones

~~~bash
cd server
npm run db:migrate   # desarrollo
~~~

### 4. Datos de demostración (opcional)

~~~bash
# Desde la raíz del proyecto
npm run semilla
~~~

### 5. Iniciar en modo desarrollo

~~~bash
# Terminal 1 — Backend (puerto 3000)
cd server && npm run dev

# Terminal 2 — Frontend (puerto 5173)
npm run dev
~~~

Abre [http://localhost:5173](http://localhost:5173) en tu navegador.

<br>

## Variables de entorno

### Backend — `server/.env`

~~~env
ENTORNO=development
PUERTO=3000
DATABASE_URL="mysql://usuario:contrasena@localhost:3306/beauty_time_pro"

# JWT
JWT_SECRETO="secreto-largo-y-aleatorio-minimo-32-caracteres"
JWT_EXPIRA_EN="15m"
JWT_REFRESH_EXPIRA_EN="7d"

# Superadmin
CLAVE_MAESTRO="clave-privada-maestra"

# Email (Resend)
RESEND_API_KEY="re_xxxxxxxxxxxx"
EMAIL_REMITENTE="Beauty Time Pro <no-reply@tudominio.com>"

# CORS
FRONTEND_URL="http://localhost:5173"
FRONTEND_ORIGENES_PERMITIDOS=""

# Web Push (VAPID)
VAPID_PUBLIC_KEY="..."
VAPID_PRIVATE_KEY="..."
VAPID_SUBJECT="mailto:admin@tudominio.com"
~~~

### Frontend — `.env.local`

~~~env
VITE_URL_API=http://localhost:3000
VITE_URL_PUBLICA=http://localhost:5173
~~~

> En producción usa `VITE_URL_API` con la URL publica del backend y `VITE_URL_PUBLICA=https://salonpromaster.com` para que enlaces, QR y rutas compartidas salgan con el dominio oficial.

<br>

## Scripts disponibles

### Frontend

| Script | Descripción |
|---|---|
| `npm run dev` | Servidor de desarrollo Vite |
| `npm run build` | Build de producción |
| `npm run preview` | Vista previa del build |
| `npm run test` | Ejecutar tests con Vitest |
| `npm run verificar-tipos` | Chequeo TypeScript sin emitir |
| `npm run semilla` | Poblar BD con datos demo |

### Backend — `server/`

| Script | Descripción |
|---|---|
| `npm run dev` | Fastify con hot reload (tsx watch) |
| `npm run build` | Compilar a `dist/` |
| `npm run start` | Iniciar desde `dist/` |
| `npm run db:migrate` | Crear y aplicar migración |
| `npm run db:deploy` | Aplicar migraciones (producción) |
| `npm run db:studio` | Abrir Prisma Studio |
| `npm run verificar-tipos` | Chequeo TypeScript sin emitir |

<br>

## Autenticación y seguridad

- **JWT** — access token efímero (15 min) + refresh token en cookie `httpOnly`; en cross-origin productivo se emite como `Secure` + `SameSite=None` para frontend Vercel y API en dominio distinto
- **Bcrypt** — contraseñas hasheadas con factor 12
- **CSP completo** via `@fastify/helmet` — sin `unsafe-eval`, orígenes explícitos
- **Rate limiting** en todos los endpoints públicos y de autenticación
- **Sanitización** de inputs de texto libre antes de persistir en BD
- **`bodyLimit`** de 1 MB en Fastify; máximo 2 MB para imágenes
- **Índices de BD** en columnas de búsqueda frecuente (`estado`, `activo`, `pais`, `estudioId`)
- Variables de entorno validadas con **Zod** al arranque — error descriptivo si falta alguna
- Sin secretos expuestos en el frontend; toda autorización ocurre en el servidor

<br>

## Deploy

### Backend — Railway

1. Conectar repositorio y apuntar a la carpeta `server/`
2. Configurar las variables de entorno del backend
3. Railway ejecuta `npm run start:railway`, que aplica `prisma migrate deploy` antes de levantar Fastify para evitar 500 por esquema desfasado
4. Verificar salud: `GET /health` → `{ "status": "ok" }`
5. Si el frontend vive en Vercel con previews, configurar `FRONTEND_ORIGENES_PERMITIDOS` con el dominio oficial y previews, por ejemplo `https://www.salonpromaster.com,https://<tu-proyecto>.vercel.app,https://<tu-proyecto>-git-*.vercel.app`

### Frontend — Vercel

1. Importar repositorio desde la raíz
2. Configurar `VITE_URL_API` apuntando al backend publicado
3. Configurar `VITE_URL_PUBLICA=https://salonpromaster.com` en producción para que links publicos y QR no salgan con el subdominio preview
4. Asociar el dominio `salonpromaster.com` y, si aplica, `www.salonpromaster.com` en Vercel
5. Confirmar que el backend tenga esos orígenes en `FRONTEND_URL` y `FRONTEND_ORIGENES_PERMITIDOS`
6. Vercel detecta Vite automáticamente
7. En despliegue Vercel + Railway el backend ya queda preparado para cookies `SameSite=None; Secure`, necesarias cuando frontend y API viven en dominios distintos

<br>

## Licencia

Proyecto privado — todos los derechos reservados © 2026 Beauty Time Pro.
