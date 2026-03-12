# Beauty Time Pro

> Plataforma SaaS para la gestion integral de salones de belleza en Mexico y Colombia.

---

## ¿Que es Beauty Time Pro?

Beauty Time Pro es una aplicacion web completa que conecta duenos de salones con sus clientes. Permite gestionar reservas, personal, servicios, fidelidad y pagos desde un unico panel, mientras los clientes encuentran y agendan citas en sus salones favoritos en segundos.

---

## Stack tecnologico

| Capa | Tecnologia |
|---|---|
| Frontend | React 19, Vite 7, TypeScript strict, Tailwind CSS 4 |
| Estado y datos | TanStack Query v5, Zustand v5, React Hook Form + Zod |
| Backend | Fastify 5, Node.js ESM, TypeScript |
| Base de datos | MySQL 8, Prisma ORM 7 |
| Autenticacion | JWT (access token 15 min + refresh token httpOnly) |
| Email | Resend |
| Seguridad | @fastify/helmet, @fastify/rate-limit, bcrypt |
| Testing | Vitest, Testing Library |
| Linting / formato | ESLint, Prettier, Husky |

---

## Caracteristicas principales

### Panel del dueno de salon
- Agenda visual semanal con disponibilidad en tiempo real
- Gestion de personal, especialidades y horarios
- Configuracion de servicios, precios y duracion
- Programa de fidelidad personalizable por salon
- Carga de logo, color de marca y datos de contacto
- Control de dias festivos
- Registro de pagos y suscripciones

### Portal del cliente
- Busqueda y filtro de salones por categoria y texto
- Reserva de citas en pocos pasos (servicio → especialista → horario → confirmacion)
- Historial de reservas y proximas citas
- Cancelacion con enlace seguro enviado por email
- Perfil personal con foto de avatar
- Acumulacion de puntos de fidelidad

### Panel maestro (superadmin)
- Aprobacion y rechazo de solicitudes de nuevos salones
- Gestion de suscripciones y fechas de vencimiento
- Finanzas y pagos globales
- Administracion de admins con permisos granulares

---

## Estructura del repositorio

```
beauty-time-pro/
├── src/                        # Aplicacion React (frontend)
│   ├── app/                    # Enrutador y proveedores globales
│   ├── caracteristicas/        # Modulos por dominio (autenticacion, estudio, reserva...)
│   ├── componentes/            # UI generica y componentes de diseno
│   ├── hooks/                  # Hooks reutilizables globales
│   ├── servicios/              # Clientes HTTP hacia la API
│   ├── tienda/                 # Estado global (Zustand)
│   ├── tipos/                  # Interfaces TypeScript del dominio
│   ├── utils/                  # Funciones puras
│   └── lib/                    # TanStack Query, env, constantes
│
├── server/                     # API REST (Fastify + Prisma)
│   ├── src/
│   │   ├── rutas/              # Handlers por recurso
│   │   ├── servicios/          # Logica de negocio y email
│   │   ├── middleware/         # Autenticacion JWT
│   │   ├── jobs/               # Tareas programadas (recordatorios)
│   │   └── lib/                # Env, email, fidelidad
│   └── prisma/
│       ├── schema.prisma
│       └── migrations/
│
└── scripts/
    └── semilla.ts              # Datos de demostracion
```

---

## Instalacion y desarrollo local

### Pre-requisitos
- Node.js >= 20
- MySQL 8 corriendo localmente
- Cuenta en [Resend](https://resend.com) para emails (opcional en dev)

### 1. Instalar dependencias

```bash
# Raiz — frontend
npm install

# Backend
cd server && npm install
```

### 2. Configurar variables de entorno

Crear `server/.env` con al menos:

```env
ENTORNO=development
PUERTO=3000
DATABASE_URL="mysql://usuario:contrasena@localhost:3306/beauty_time_pro"
JWT_SECRETO="secreto-largo-y-aleatorio"
JWT_EXPIRA_EN="15m"
JWT_REFRESH_EXPIRA_EN="7d"
CLAVE_MAESTRO="clave-privada-maestra"
RESEND_API_KEY="re_xxxxxxxxxxxx"
EMAIL_REMITENTE="Beauty Time Pro <no-reply@tudominio.com>"
FRONTEND_URL="http://localhost:5173"
```

Para el frontend solo es necesario en produccion:

```env
VITE_URL_API=https://api.tu-dominio.com
```

### 3. Aplicar migraciones

```bash
cd server
npm run db:deploy     # produccion
# o
npm run db:migrate    # desarrollo (crea migration)
```

### 4. Cargar datos de demostracion (opcional)

```bash
# Desde la raiz:
npm run semilla
```

### 5. Levantar en modo desarrollo

```bash
# Terminal 1 — Backend
cd server && npm run dev

# Terminal 2 — Frontend
npm run dev
```

Accede a la app en `http://localhost:5173` y a la API en `http://localhost:3000`.

---

## Scripts disponibles

### Frontend (raiz)

| Script | Descripcion |
|---|---|
| `npm run dev` | Servidor de desarrollo Vite |
| `npm run build` | Build de produccion |
| `npm run preview` | Preview del build |
| `npm run test` | Tests con Vitest |
| `npm run verificar-tipos` | Chequeo TypeScript sin emitir |
| `npm run semilla` | Poblar BD con datos demo |
| `npm run limpiar-pruebas` | Eliminar datos demo |

### Backend (`server/`)

| Script | Descripcion |
|---|---|
| `npm run dev` | Fastify con hot reload (tsx watch) |
| `npm run build` | Compilar a `dist/` |
| `npm run start` | Iniciar desde `dist/` |
| `npm run db:migrate` | Crear y aplicar migracion |
| `npm run db:deploy` | Aplicar migraciones (produccion) |
| `npm run db:studio` | Abrir Prisma Studio |
| `npm run db:generar` | Regenerar cliente Prisma |
| `npm run verificar-tipos` | Chequeo TypeScript sin emitir |

---

## Autenticacion

- Login emite un **access token JWT** (15 min) + **refresh token** en cookie `httpOnly`.
- Cada request protegido lleva el access token en `Authorization: Bearer <token>`.
- El refresh token rota automaticamente; no requiere re-login del usuario.
- Las rutas protegidas redirigen a `/iniciar-sesion` si no hay sesion activa.
- Roles disponibles: `cliente`, `dueno`, `admin`, `maestro`.

---

## Seguridad

- Contrasenas hasheadas con **bcrypt** (factor 12).
- Rate limiting en todos los endpoints publicos (`@fastify/rate-limit`).
- Headers de seguridad via `@fastify/helmet`.
- Variables de entorno validadas con **Zod** al arranque; error descriptivo si falta alguna.
- Sin secretos expuestos en el frontend.
- Toda logica de autorizacion ocurre en el servidor.

---

## Deploy

### Backend (Railway)

1. Apuntar a la carpeta `server/`.
2. Configurar variables de entorno.
3. Ejecutar `npm run db:deploy` para aplicar migraciones.
4. Verificar `GET /salud` → `{ "estado": "ok" }`.

### Frontend (Vercel)

1. Importar repositorio desde la raiz.
2. Configurar `VITE_URL_API` apuntando al backend publicado.
3. Verificar navegacion directa en rutas internas (e.g. `/iniciar-sesion`).

---

## Modelos principales

`Estudio` · `ClienteApp` · `Usuario` · `Personal` · `Reserva` · `Pago` · `DiaFestivo` · `ConfigFidelidad` · `PuntosFidelidad` · `TokenCancelacion` · `Recordatorio`

---

## Licencia

Proyecto privado — todos los derechos reservados.