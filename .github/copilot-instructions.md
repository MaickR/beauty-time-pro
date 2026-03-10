# Instrucciones de Desarrollo — Beauty Time Pro

## Contexto del proyecto
Aplicación SaaS para gestión de salones de belleza. Mercado objetivo: México y Colombia.
Stack: React 19, Vite 7, Tailwind CSS (npm, no CDN), TypeScript strict, Fastify, Prisma, MySQL 8.

---

## Idioma del código
Todo el código se escribe en **español**: variables, funciones, componentes, comentarios, nombres de archivos y carpetas.
Las únicas excepciones son palabras reservadas del lenguaje (`return`, `const`, `async`, etc.) y nombres propios de librerías (`useState`, `useQuery`, etc.).

```
// ✅ Correcto
const estudiosActivos = []
function obtenerDisponibilidad() {}
const tieneReservaHoy = true

// ❌ Incorrecto
const activeStudios = []
function getAvailability() {}
const hasBookingToday = true
```

---

## Estructura de carpetas
```
src/
├── app/                    # enrutador.tsx, proveedores.tsx
├── caracteristicas/        # Un directorio por dominio
│   ├── autenticacion/
│   ├── maestro/
│   ├── estudio/
│   └── reserva/
│       ├── componentes/
│       ├── hooks/
│       └── index.tsx
├── componentes/
│   ├── ui/                 # Modal, Toast, Badge, Spinner (sin lógica de dominio)
│   └── diseno/             # Header, TabBar, PaginaContenedor
├── hooks/                  # Hooks reutilizables sin dominio específico
├── servicios/              # HTTP client, llamadas a la API
├── tienda/                 # Zustand: solo auth y sesión
├── utils/                  # Funciones puras sin React ni efectos secundarios
├── tipos/                  # Interfaces y tipos TypeScript del dominio
└── lib/
    ├── env.ts              # Variables de entorno validadas con Zod
    ├── clienteConsulta.ts  # Configuración TanStack Query
    └── constantes.ts       # CATALOGO_SERVICIOS, DIAS_SEMANA
```

---

## Convenciones de nombrado

| Tipo | Convención | Ejemplo |
|------|-----------|---------|
| Componente React | PascalCase.tsx | `SelectorPersonal.tsx` |
| Hook personalizado | camelCase con prefijo `usar` | `usarReservaActiva.ts` |
| Función utilitaria | camelCase.ts | `formatearDinero.ts` |
| Tienda Zustand | camelCase + sufijo `Tienda` | `tiendaAuth.ts` |
| Servicio API | camelCase + sufijo `Servicio` | `servicioReservas.ts` |
| Tipos TypeScript | PascalCase.ts | `Reserva.ts` |
| Constantes | SCREAMING_SNAKE_CASE | `CATALOGO_SERVICIOS` |
| Carpetas | kebab-case | `selector-personal/` |
| Tests | mismo nombre + `.test.ts` | `horarios.test.ts` |

---

## TypeScript

- Siempre `strict: true`. Prohibido usar `any` sin justificación en comentario.
- Prohibido `@ts-ignore`. Usar `@ts-expect-error` con comentario explicativo.
- Datos externos (API) siempre validados con Zod antes de tipar.
- Las fechas se representan como `string` en formato ISO 8601: `"YYYY-MM-DD"` o `"HH:mm"`. Nunca como `Date` o `number`.
- Cada componente define su interfaz de props antes de la función: `interface PropsNombreComponente {}`.

---

## Componentes React

- Máximo **200 líneas** por componente. Si supera ese límite, extraer sub-componentes.
- Máximo **7 props** visibles. Si hay más, usar contexto o rediseñar.
- Máximo **3 `useState`** por componente. Si hay más, extraer un custom hook.
- **1 exportación nombrada** por archivo.
- Nesting de JSX máximo **4 niveles**. Si hay más, extraer componente intermedio.
- Prohibido usar `alert()`, `confirm()` o `window.print()` nativos. Siempre usar los componentes de `componentes/ui/`.

---

## Manejo del estado

| Tipo de estado | Herramienta |
|---------------|-------------|
| UI local (modal abierto, paso actual) | `useState` / `useReducer` |
| Estado global de sesión | Zustand (`tiendaAuth`) |
| Datos que vienen del servidor | TanStack Query (`useQuery`, `useMutation`) |
| Formularios | React Hook Form + Zod |

- Prohibido prop drilling de más de 2 niveles. Si un dato pasa por más de 2 componentes sin ser usado, moverlo a Zustand o TanStack Query.

---

## Formularios

Siempre React Hook Form + Zod. Cada formulario tiene su propio custom hook en `hooks/` de su feature.
El esquema Zod define las validaciones. Los mensajes de error van en español.

```ts
const esquemaReserva = z.object({
  nombreCliente: z.string().min(2, "Mínimo 2 caracteres"),
  telefono: z.string().regex(/^[0-9]{10}$/, "10 dígitos sin espacios"),
});
```

---

## Backend (Fastify + Prisma + MySQL)

- Los handlers de rutas no contienen lógica de negocio. Solo llaman a servicios.
- La lógica de negocio vive en `servicios/`. El acceso a datos vive en `repositorios/`.
- Formato de respuesta canónico:
  - Éxito: `{ datos: T }` con código 200/201
  - Error de validación: `{ error: "mensaje", campos: {} }` con código 400
  - No autenticado: `{ error: "No autenticado" }` con código 401
  - Sin permisos: `{ error: "Sin permisos para esta acción" }` con código 403
- **Ningún secreto puede vivir en el frontend.** Las validaciones de autorización siempre ocurren en el servidor.
- JWT para autenticación: access token efímero (15min) + refresh token en cookie httpOnly.

---

## Estilos con Tailwind CSS

- Tailwind instalado vía npm, nunca desde CDN.
- Solo clases de Tailwind. Prohibido mezclar clases Tailwind con `style={{}}` inline.
- Para variantes condicionales usar `cn()` o `cva()`.
- No hardcodear colores hex en inline styles. Usar las clases de Tailwind o extender el tema en `tailwind.config`.

---

## Accesibilidad

- Botones de solo ícono requieren `aria-label` descriptivo en español.
- Modales: `role="dialog"`, `aria-labelledby`, focus trap y cierre con `Escape`.
- Formularios: `label` asociado con `htmlFor`, errores con `aria-describedby`.
- Imágenes: `alt` descriptivo. Si es decorativa, `alt=""`.
- Estados de carga: `aria-busy="true"` y skeleton visible.

---

## Testing (Vitest + Testing Library)

- Los tests se escriben en español (descripciones de `describe` e `it`).
- Las funciones en `utils/` son puras y deben tener cobertura mínima del 80%.
- Los componentes se prueban por comportamiento visible, no por implementación interna.
- Nunca hacer `expect(componente).toMatchSnapshot()` como única prueba.

```ts
// ✅ Correcto
it("muestra error cuando el teléfono tiene menos de 10 dígitos", ...)

// ❌ Incorrecto
it("renders correctly", ...)
```

---

## Variables de entorno

Todas las variables de entorno deben declararse y validarse en `src/lib/env.ts` usando Zod.
Si falta una variable requerida, la app debe lanzar un error descriptivo al arrancar, no un crash silencioso en runtime.

---

## Reglas generales

- Prohibido el seeder de datos de demo en el arranque de producción. Debe ejecutarse solo con `npm run semilla`.
- Error Boundaries por feature, no uno global para toda la app.
- Todo componente de lista debe manejar el estado vacío explícitamente (no simplemente no renderizar nada).
- Las rutas protegidas redirigen a `/iniciar-sesion` con un mensaje en toast explicando el motivo.