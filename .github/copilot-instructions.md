# copilot-instructions.md — Beauty Time Pro

## 1. Contexto del proyecto

Beauty Time Pro es una aplicación SaaS para gestión de salones de belleza enfocada en México y Colombia.

La app no se rehace desde cero. Se fortalece sobre la base existente, corrigiendo errores de lógica, cerrando huecos de seguridad, mejorando UX/UI, ordenando permisos y extendiendo el producto hasta una versión comercializable, mantenible y segura.

La prioridad no es construir más rápido, sino construir bien para evitar reprocesos, fraudes, pérdidas de datos, problemas operativos y deuda técnica innecesaria.

### Stack del proyecto
- Frontend: React 19 + Vite 7 + Tailwind CSS + TypeScript strict
- Backend: Fastify + Prisma + MySQL 8
- Estado: TanStack Query + Zustand
- Formularios: React Hook Form + Zod
- Testing: Vitest + Testing Library

---

## 2. Filosofía general

- No reinventar la rueda.
- Mejorar lo existente antes que rehacerlo.
- Backend es la fuente de verdad.
- Seguridad > velocidad.
- UX limpia, clara y profesional.
- Código modular, escalable y mantenible.
- Código para personas: claro hoy y mantenible mañana.
- Cuando algo funciona pero rompe seguridad, dinero, permisos o consistencia, se corrige antes de seguir.

---

## 3. Reglas absolutas del proyecto

- Todo cambio crítico debe validarse en backend, aunque también exista validación en frontend.
- El frontend nunca es fuente de verdad para precios, permisos, estados, planes, acceso o vigencias.
- Ningún usuario podrá operar fuera de su rol ni por manipulación de URL, ni por copiar enlaces, ni por editar requests.
- Todo cambio financiero, de permisos, plan, suspensión, bloqueo, credenciales o acceso debe quedar auditado.
- No se exponen secretos en frontend.
- No se almacenan contraseñas reversibles.
- No se usa `Math.random()` para contraseñas, claves, tokens ni identificadores sensibles.
- No se usa `float` para dinero.
- No se permiten respuestas, estados o pantallas que revelen información sensible por inferencia.
- No se permite lógica que “funcione” si rompe seguridad, consistencia o negocio.

---

## 4. Idioma del código y contenido

### Código y comentarios
Todo el código, nombres internos y comentarios deben estar en español:
- variables
- funciones
- componentes
- archivos
- carpetas
- comentarios
- tests
- documentación técnica

### Texto visible para el usuario final
Los textos, títulos, labels, mensajes y contenido visible para el cliente final deben estar en inglés, salvo que el producto defina otra cosa en una pantalla específica.

### Excepciones
Se exceptúan:
- palabras reservadas del lenguaje
- nombres de librerías
- APIs de terceros
- nombres técnicos establecidos por framework

Ejemplos:
```ts
// Correcto
const estudiosActivos = []
function obtenerDisponibilidad() {}
const tieneReservaHoy = true

// Incorrecto
const activeStudios = []
function getAvailability() {}
const hasBookingToday = true
```

---

## 5. Convenciones de estilo y nomenclatura

### Convenciones generales
- Usar camelCase para variables y funciones.
- Usar PascalCase para componentes, clases y tipos.
- Usar kebab-case para carpetas cuando aplique.
- Usar SCREAMING_SNAKE_CASE para constantes globales.
- Nombres descriptivos, no abreviados sin necesidad.
- Evitar nombres genéricos como `data`, `temp`, `value`, `info` salvo contexto muy claro.
- Mantener consistencia total en nombres de dominio.

### Regla de legibilidad
Si una función, componente o archivo requiere explicación larga para entender su propósito, el nombre está mal elegido.

---

## 6. Estructura de carpetas

```txt
src/
├── app/
├── caracteristicas/
│   ├── autenticacion/
│   ├── maestro/
│   ├── estudio/
│   ├── empleado/
│   ├── cliente/
│   ├── vendedor/
│   └── reserva/
│       ├── componentes/
│       ├── hooks/
│       └── index.tsx
├── componentes/
│   ├── ui/
│   └── diseno/
├── hooks/
├── servicios/
├── repositorios/
├── tienda/
├── utils/
├── tipos/
└── lib/
```

### Responsabilidad por carpeta
- `app/`: tailwind, router, providers, layout global
- `caracteristicas/`: lógica por dominio
- `componentes/ui/`: UI reutilizable sin lógica de negocio
- `componentes/diseno/`: layout, navegación, contenedores, patrones visuales
- `hooks/`: hooks reutilizables sin dominio específico
- `servicios/`: lógica de comunicación con API
- `repositorios/`: acceso a datos o capa de persistencia
- `tienda/`: estado global mínimo, principalmente auth/sesión
- `utils/`: funciones puras
- `tipos/`: contratos del dominio
- `lib/`: configuración, validaciones, helpers comunes

---

## 7. Arquitectura de código

### Separación estricta
- Rutas → reciben requests
- Servicios → lógica de negocio
- Repositorios → acceso a datos
- UI → presentación
- Hooks → composición y estado local reutilizable

### Regla obligatoria
No mezclar lógica de negocio con componentes visuales.

### DRY
Seguir DRY en todo el proyecto:
- no duplicar validaciones
- no duplicar formateos
- no duplicar cálculos
- no duplicar permisos
- no duplicar mapeos de datos

### KISS
Mantener la solución más simple que sea correcta, segura y mantenible.

### SRP
Cada componente, función o módulo debe tener una sola responsabilidad principal.

### SOLID
Aplicar principios SOLID cuando aporte claridad y mantenibilidad, sin sobre-ingeniería.

---

## 8. TypeScript

- `strict: true` siempre.
- Prohibido usar `any` sin justificación real y comentario.
- Prohibido `@ts-ignore`.
- Usar `@ts-expect-error` solo con explicación.
- Datos externos siempre se validan con Zod antes de tipar.
- Las fechas se representan como `string` en formato ISO 8601 o formatos específicos del dominio, nunca como `Date` en el estado de la app.
- Cada componente define su interfaz de props antes de la función.
- No inferir tipos de negocio desde el frontend si el backend ya los define.

---

## 9. React

- Máximo 200 líneas por componente. Si supera ese límite, extraer subcomponentes.
- Máximo 7 props visibles. Si hay más, rediseñar o usar contexto.
- Máximo 3 `useState` por componente. Si hay más, extraer un hook.
- Una sola exportación nombrada por archivo.
- Evitar nesting de JSX mayor a 4 niveles. Si pasa, extraer componente intermedio.
- Prohibido usar `alert()`, `confirm()` o `window.print()` nativos.
- Usar componentes propios de `componentes/ui/`.
- Todo componente debe contemplar:
  - estado de carga
  - estado vacío
  - estado de error
  - feedback visual de acción

---

## 10. Estado y datos

| Tipo de estado | Herramienta |
|---|---|
| UI local | `useState` / `useReducer` |
| Estado global de sesión | Zustand |
| Datos del servidor | TanStack Query |
| Formularios | React Hook Form + Zod |

### Reglas
- Prohibido prop drilling de más de 2 niveles.
- Las búsquedas deben llevar debounce.
- Las tablas deben paginar 10 registros por página.
- Exportaciones a Excel deben operar sobre los filtros activos, no sobre toda la base sin control.
- Evitar N+1 queries.
- No cargar bloques redundantes de datos en dashboards.
- Usar memoización cuando el re-render sea costoso.
- Lazy loading en rutas pesadas.

---

## 11. Formularios

Siempre usar:
- React Hook Form
- Zod
- Mejores practicas de formularios para frontend  y backend

### Reglas
- Cada formulario debe tener su propio hook dentro de la feature correspondiente.
- Los mensajes de error deben estar en inglés en la interfaz, pero el código y las claves internas deben permanecer en español.
- Nunca confiar solo en validación visual.
- Validar también en backend.
- Los formularios críticos deben impedir valores absurdos, negativos o vacíos según negocio.

---

## 12. Backend — Fastify + Prisma + MySQL

### Separación
- Handlers: solo reciben y responden.
- Servicios: negocio.
- Repositorios: persistencia.

### Formato de respuesta canónico
- Éxito: `{ datos: T }`
- Error de validación: `{ error: "mensaje", campos: {} }`
- No autenticado: `{ error: "No autenticado" }`
- Sin permisos: `{ error: "Sin permisos para esta acción" }`

### Reglas
- Toda ruta protegida verifica:
  - usuario activo
  - rol permitido
  - estado del salón o estudio
  - permisos granulares
- Recalcular precios siempre en backend.
- No confiar en `precioTotal` enviado por frontend.
- Usar transacciones en reservas, pagos, fidelidad y cambios de estado.
- No borrar físicamente datos que afecten historial operativo; usar soft delete o inactivación cuando aplique.
- Todo cambio crítico debe dejar auditoría.
- No revelar existencia de cuentas por mensajes de error.

---

## 13. Seguridad obligatoria

### Autenticación
- JWT con access token corto y refresh token rotativo en cookie httpOnly.
- Invalidar sesiones al suspender, bloquear o desactivar usuario o salón.
- No permitir tokens viejos operando después de un cambio crítico.

### Protección mínima
- Rate limit por IP y por usuario en login, reset, cambios de contraseña, reservas y uploads.
- CSRF donde aplique.
- Headers de seguridad:
  - CSP
  - HSTS
  - X-Frame-Options
  - X-Content-Type-Options
  - Permissions-Policy
- No permitir `SameSite=None` sin una razón arquitectónica fuerte y controles complementarios.
- No exponer contratos PDF ni archivos privados desde rutas públicas sin control.
- Validar archivos por tipo real, no solo por extensión.
- Validar magic bytes.
- Sanitizar texto libre para evitar XSS almacenado.
- Protección contra scraping, enumeración de claves públicas y bots de reservas falsas.
- Protección contra abuso de endpoints públicos.
- Usar aleatoriedad criptográfica real para claves y contraseñas temporales.
- MFA para cuentas maestro como mejora prioritaria.

### Auditoría
Registrar siempre:
- cambios de plan
- pagos
- bloqueos
- suspensiones
- activaciones
- credenciales
- acciones críticas
- edición de reservas
- creación o desactivación de colaboradores
- otorgamiento o retiro de beneficios
- envío de mensajes masivos

Formato recomendado:
- quién
- qué hizo
- sobre qué entidad
- cuándo
- antes
- después

---

## 14. Dinero, vigencias y negocio

- Nunca usar `float` para dinero.
- Usar `Decimal` o enteros en centavos.
- El backend recalcula totales, impuestos, adicionales y descuentos.
- No permitir precios negativos, cero ni absurdos.
- No permitir duraciones negativas ni cero.
- La vigencia y los días restantes se calculan en servidor.
- Cada estudio trabaja con su zona horaria definida, nunca con la del servidor.
- Toda modificación financiera debe dejar trazabilidad.

---

## 15. Reglas de negocio no negociables

- No se reserva en el pasado.
- No se reserva fuera de horario.
- No se reserva en días de descanso o festivos del salón.
- El reagendamiento es máximo 1 vez.
- Un salón suspendido no opera.
- Un salón bloqueado no opera hasta levantamiento manual.
- El vendedor no activa salones.
- El supervisor solo actúa dentro de permisos.
- La fidelidad no cuenta canceladas ni pendientes.
- Los mensajes masivos PRO son 3 al año, salvo compra adicional aprobada.
- Los productos y adicionales en reservas deben quedar auditados.
- Los especialistas no se borran si eso rompe historial; usar desactivación o soft delete.
- Toda modificación de plan, vigencia, suspensión, bloqueo o credenciales deja rastro.

---

## 16. UX/UI y diseño con Tailwind CSS

### Reglas
- Tailwind por npm, nunca por CDN.
- Usar breakpoints oficiales:
  - sm
  - md
  - lg
  - xl
  - 2xl
- No mezclar Tailwind con `style={{}}` inline salvo casos muy justificados.
- Usar `cn()` o `cva()` para variantes condicionales.
- No hardcodear colores hex en inline styles.
- Preferir `grid` para layouts de panel y tablas, `flex` para alineaciones pequeñas.
- No saturar la interfaz en el lado izquierdo.
- Preferir tablas sobre tarjetas cuando hay muchos datos.
- Usar modales solo cuando agregan claridad real.
- Mantener espaciado consistente en todas las vistas.
- Evitar interfaces apretadas o recargadas.

### Criterios visuales
- Claridad > creatividad
- Reducir carga cognitiva
- Interfaces predecibles
- Feedback inmediato
- Consistencia visual total

### Accesibilidad
- Botones de solo ícono requieren `aria-label`.
- Modales con `role="dialog"`, `aria-labelledby`, focus trap y `Escape`.
- Formularios con `label` asociado.
- Errores asociados con `aria-describedby`.
- Imágenes con `alt` descriptivo.
- Cargas con `aria-busy="true"` y skeleton visible.

---

## 17. HTML5, SEO y contenido público

Esto aplica a cualquier pantalla pública, landing page, contenido promocional o marketing del proyecto.

### HTML5 semántico
- Usar etiquetas semánticas correctas.
- Usar `main`, `header`, `nav`, `section`, `article`, `footer` cuando corresponda.
- Usar WAI-ARIA solo cuando la semántica no sea suficiente.

### SEO técnico
- Metaetiquetas claras y optimizadas.
- `sitemap.xml`.
- `robots.txt`.
- Breadcrumbs estructurados cuando aplique.
- JSON-LD / schema.org cuando corresponda.
- Priorizar Core Web Vitals.

### Recursos
- Carga optimizada de scripts, imágenes y librerías externas.
- Priorizar formatos de imagen modernos:
  - avif
  - webp
  - png
  - jpg / jpeg
- `font-display: swap`.
- `preconnect` cuando aporte valor real.
- Evitar carga innecesaria de recursos.

### HTML y atributos
- `id` claros y específicos.
- Formularios con labels, foco visible y orden tab lógico.
- Contraste AA como mínimo.
- Accesibilidad moderna (WCAG 2.1+).
- Evitar anidación innecesaria.
- Mantener texto, estructura y jerarquía legibles.

---

## 18. CSS3 y SASS/SCSS

### Preferencia del proyecto
En el frontend de React se prioriza Tailwind CSS.

### Si existe CSS/SCSS adicional
Aplicar estas reglas:

#### CSS3
- Usar `rem` en vez de `px` cuando sea posible.
- Configurar base para que 1rem equivalga a 10px si el proyecto lo define así.
- Usar `normalize.css` si el proyecto lo requiere.
- Mobile first.
- Evitar selectores complejos.
- Evitar anidamientos profundos.
- Priorizar clases legibles y reutilizables.
- Ordenar estilos por secciones lógicas.
- Reutilizar estilos donde corresponda.
- Mantener consistencia visual.

#### SASS / SCSS
- Aplicar arquitectura escalable tipo 7-1 si realmente se usa SCSS.
- Variables reutilizables.
- Mixins y funciones para media queries, grids y botones.
- Anidación controlada: máximo 3 niveles.
- Convención clara y documentada.
- `@extend` solo cuando sea estrictamente necesario.
- Partials con responsabilidad clara.
- Documentación por bloque y por utilidad.

### Regla
No introducir CSS paralelo si Tailwind ya resuelve mejor el problema sin duplicar complejidad.

---

## 19. JavaScript / TypeScript moderno

- Usar sintaxis moderna.
- Mantener funciones pequeñas, puras cuando sea posible.
- Usar módulos ES.
- Aplicar DRY y KISS.
- Evitar efectos colaterales ocultos.
- Manejo de errores claro con contexto útil.
- Preferir composición sobre bloques gigantes.
- Accesibilidad en scripts: no mover el foco de forma inesperada.
- Evitar listeners excesivos; usar delegación cuando aplique.
- Usar debounce/throttle donde corresponda.
- Evitar `innerHTML` con datos no sanitizados.
- Mantener el código legible para mantenimiento futuro.

---

## 20. Comentarios y documentación

### Comentarios
Usar comentarios solo donde aporten valor real.

### Convención recomendada
- `//` para aclaraciones cortas
- `/* ... */` para bloques
- JSDoc en funciones públicas, hooks y servicios
- Better Comments si el equipo lo usa, con uso consistente y en español

### Documentación viva
Mantener actualizados:
- `README`
- `CONTRIBUTING`
- `CHANGELOG`
- documentación técnica de arquitectura y decisiones

---

## 21. Testing

Usar Vitest + Testing Library.

### Reglas
- Tests en español.
- Cobertura mínima en `utils/`.
- Probar comportamiento visible, no implementación interna.
- No usar snapshots como única prueba.
- Agregar pruebas para:
  - validaciones
  - permisos
  - cálculos de dinero
  - concurrencia
  - fechas
  - reglas de negocio críticas

---

## 22. Rendimiento y escalabilidad

- Evitar N+1 queries.
- Lazy loading en rutas pesadas.
- Memoización donde aporte valor real.
- Debounce en búsquedas.
- Índices en DB para campos de consulta frecuente.
- Evitar renderizados innecesarios.
- No duplicar datos que pueden derivarse desde backend.
- Exportaciones y listados deben trabajar con filtros y paginación.
- No cargar información irrelevante en dashboards.

---

## 23. Variables de entorno

Todas las variables de entorno deben declararse y validarse en `src/lib/env.ts` usando Zod.

Si falta una variable requerida:
- la app debe fallar con un mensaje claro al arrancar
- nunca con un crash silencioso en runtime

---

## 24. Reglas de despliegue y repo

- Prohibido el seeder de datos de demo en el arranque de producción.
- Ejecutar semillas solo con comando explícito.
- Revisar `.gitignore`, secretos del hosting, variables de entorno y permisos de base de datos.
- Desactivar source maps en producción si exponen demasiado.
- Agregar `X-Request-ID` para correlación de logs si la infraestructura lo permite.
- Evitar cachear datos sensibles con service worker.
- Error boundaries por feature, no uno global para toda la app.

---

## 25. Estados del sistema

### Estado del salón
- activo
- suspendido
- bloqueado
- pendiente_pago

### Estado de reserva
- pendiente
- confirmada
- cancelada
- reagendada
- completada
- no_show

### Estado del usuario
- activo
- desactivado

No usar estados ambiguos ni textos libres para lógica crítica.

---

## 26. Reglas de construcción por feature

Antes de crear o modificar algo:
1. identificar el dominio
2. identificar el rol
3. identificar la regla de negocio
4. validar backend primero
5. luego frontend
6. luego tests
7. luego auditoría y permisos

Cada feature debe nacer con:
- modelo
- validación
- servicio
- repositorio
- endpoint
- UI
- test mínimo
- auditoría si aplica

---

## 27. Roles principales del producto

- Administrador / Maestro
- Supervisor
- Salón
- Empleado
- Cliente
- Vendedor

### Principio de implementación
Cuando una pantalla tenga mucha densidad de datos:
1. tabla limpia
2. modal de detalle
3. filtros
4. exportación
5. paginación

---

## 28. Regla final

Si algo puede romper:
- seguridad
- datos
- dinero
- permisos
- consistencia
- trazabilidad

entonces se detiene, se corrige y no se implementa todavía.
