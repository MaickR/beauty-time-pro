# Plan Maestro de Remediación y Salida a Producción

## Beauty Time Pro

Fecha: 2026-04-08

## 1. Propósito del documento

Este documento consolida las auditorías realizadas sobre Beauty Time Pro durante esta sesión y establece un plan técnico realista para llevar la aplicación a un estado apto para producción comercial, auditoría externa y operación concurrente a escala en México y Colombia.

El objetivo no es “mejorar un poco”, sino cerrar los huecos que hoy comprometen seguridad, trazabilidad, mantenibilidad, accesibilidad, calidad operativa y escalabilidad.

Este documento parte de cuatro fuentes:

- las reglas definidas en `.github/copilot-instructions.md`
- la auditoría de seguridad, accesibilidad y mantenibilidad
- la auditoría orientada a concurrencia y escalabilidad
- la revisión de cumplimiento contra reglas internas del proyecto

## 2. Veredicto ejecutivo

Beauty Time Pro no está lista hoy para salir a producción comercial seria ni para pasar con tranquilidad una auditoría externa rigurosa.

La base existente es aprovechable, pero todavía presenta incumplimientos estructurales en seguridad, autenticación, trazabilidad, formularios, calidad de frontend, cobertura de pruebas y disciplina de implementación.

Los principales bloqueadores son:

1. seguridad de sesión incompleta
2. trazabilidad crítica incompleta
3. incumplimiento de reglas de formularios y consistencia de dominio
4. frontend con deuda estructural relevante en componentes, estilos y accesibilidad
5. cobertura de pruebas insuficiente para un SaaS transaccional
6. falta de endurecimiento del proceso de desarrollo para que la IA y los humanos no reintroduzcan regresiones

## 3. Hallazgos críticos confirmados

### 3.1 Autenticación y sesión

Estado actual:

- `server/src/rutas/auth.ts` implementa refresh token, pero no una rotación robusta con invalidación del token previo.
- los cambios críticos como cambio de contraseña no invalidan de forma inmediata todas las sesiones activas.
- esto deja una ventana de uso de tokens viejos después de eventos sensibles.

Riesgo:

- secuestro de sesión persistente
- incumplimiento de la política interna de seguridad
- hallazgo directo en auditoría externa

Remediación requerida:

1. introducir rotación real de refresh token con persistencia de sesión o versión de token
2. invalidar sesiones activas en cambios de contraseña, bloqueo, suspensión, desactivación y eventos administrativos sensibles
3. registrar eventos de revocación por usuario, estudio, dispositivo y fecha

Criterio de aceptación:

- ningún refresh token viejo puede reutilizarse después de un refresh exitoso
- cualquier cambio crítico debe inutilizar tokens previos en el siguiente request como máximo

### 3.2 CSRF y endurecimiento de endpoints sensibles

Estado actual:

- no se encontró protección CSRF implementada de forma explícita en backend
- la app usa cookies httpOnly, pero eso no sustituye un control CSRF cuando existen acciones mutables

Riesgo:

- ejecución no deseada de acciones autenticadas desde sitios maliciosos
- incumplimiento de controles mínimos esperables en un panel administrativo SaaS

Remediación requerida:

1. implementar protección CSRF para endpoints mutables cuando aplique
2. revisar estrategia de cookies, cabeceras y origen permitido
3. documentar claramente cuándo se usa cookie, cuándo bearer token y qué controles cubren cada flujo

### 3.3 Auditoría y trazabilidad insuficientes

Estado actual:

- existe infraestructura de auditoría en base de datos, pero no está aplicada de forma completa a todas las acciones críticas.
- faltan registros consistentes para bloqueos, suspensiones, credenciales, activaciones, edición de reservas, altas y bajas de colaboradores, beneficios y mensajes masivos.

Riesgo:

- imposibilidad de reconstruir incidentes
- incumplimiento de políticas internas y de control operativo
- alto riesgo reputacional y legal ante conflictos comerciales o fraude

Remediación requerida:

1. definir catálogo único de eventos auditables
2. exigir auditoría obligatoria en todas las rutas y servicios críticos
3. registrar siempre: quién, qué hizo, sobre qué entidad, cuándo, antes, después, IP, contexto y correlación de request
4. añadir `X-Request-ID` o equivalente para enlazar logs de backend, auditoría y errores

### 3.4 Dominio inconsistente en tipos y contratos

Estado actual:

- `src/tipos/index.ts` contiene decenas de propiedades en inglés en un proyecto cuya regla interna exige español para código, contratos y nombres internos.
- esto rompe la consistencia del lenguaje ubicuo del dominio y contamina todo el frontend.

Riesgo:

- mantenimiento más costoso
- mayor carga cognitiva
- contratos ambiguos entre frontend, backend y negocio
- evidencia clara de falta de disciplina de construcción

Remediación requerida:

1. rediseñar los contratos tipados del frontend usando nombres internos en español
2. definir una estrategia de mapeo entre DTO externo y modelo de dominio si el backend o terceros requieren claves distintas
3. migrar uso por etapas para evitar una refactorización caótica

Ejemplos de deuda actual:

- `name`, `status`, `price`, `duration`, `createdAt`, `staff`, `schedule`, `services`

## 4. Hallazgos altos por área

### 4.1 Formularios

Estado actual:

- varios formularios usan `useState` directo en lugar de `React Hook Form + Zod`, incumpliendo la regla del proyecto.
- esto aparece en componentes como:
  - `src/caracteristicas/estudio/componentes/FormularioNuevoPersonal.tsx`
  - `src/caracteristicas/estudio/componentes/FormularioPinCancelacion.tsx`
  - `src/caracteristicas/empleado/componentes/ModalCrearAccesoEmpleado.tsx`
  - `src/caracteristicas/estudio/componentes/FormularioNuevoServicio.tsx`
  - `src/caracteristicas/estudio/componentes/ModalEditarPersonal.tsx`
  - `src/caracteristicas/estudio/componentes/PanelProductos.tsx`

Problema real:

- validaciones duplicadas o incompletas
- mayor probabilidad de errores de consistencia
- formularios más difíciles de testear y evolucionar

Remediación requerida:

1. crear un hook por formulario dentro de su feature
2. usar esquema Zod compartido entre frontend y backend cuando sea viable
3. centralizar transformaciones de entrada, errores y mensajes
4. validar en backend todo valor crítico aunque el frontend ya lo valide

### 4.2 Testing insuficiente para un SaaS transaccional

Estado actual:

- la cobertura actual es insuficiente.
- solo se identificó un archivo de pruebas utilitarias (`src/utils/programacion.test.ts`) y faltan pruebas relevantes en seguridad, dinero, permisos y negocio.

Riesgo:

- regresiones silenciosas
- incidentes de producción por cambios aparentemente menores
- baja confiabilidad ante crecimiento del equipo o uso intensivo de IA

Remediación requerida:

1. añadir pruebas de utilidades críticas:
   - `src/utils/formato.ts`
   - `src/utils/seguridad.ts`
   - `src/utils/archivos.ts`
2. añadir pruebas de permisos por rol
3. añadir pruebas de cálculos monetarios y reglas de promociones, adicionales e impuestos
4. añadir pruebas de concurrencia y condiciones de carrera en reservas
5. añadir pruebas de fechas, zona horaria y disponibilidad
6. añadir pruebas de flujos críticos de autenticación, refresh, bloqueo y suspensión

### 4.3 Componentes sobredimensionados y estado fragmentado

Estado actual:

- hay componentes que exceden la regla interna de 200 líneas y otros que usan más de 3 `useState`.
- ejemplos:
  - `src/caracteristicas/maestro/componentes/VisorReservas.tsx`
  - `src/caracteristicas/estudio/componentes/AgendaDiaria.tsx`
  - `src/caracteristicas/maestro/PaginaMaestro.tsx`
  - `src/caracteristicas/maestro/componentes/PanelFinanciero.tsx`

Riesgo:

- lectura difícil
- acoplamiento alto
- menor testabilidad
- más errores al introducir cambios

Remediación requerida:

1. separar presentación, hooks, tablas, modales y paneles de filtros
2. mover lógica derivada a hooks o utilidades puras
3. usar `useReducer` o hooks de formulario cuando el estado local ya supera el umbral saludable

### 4.4 Deuda visual y técnica en frontend

Estado actual:

- existen múltiples `style={{}}` inline mezclados con Tailwind
- no existe una utilidad consistente tipo `cn()` o `cva()` para variantes
- hay colores hex hardcodeados dentro de componentes
- hay un uso puntual de `confirm()` nativo

Riesgo:

- UI inconsistente
- difícil tematización y mantenimiento
- mala trazabilidad de decisiones visuales
- incumplimiento directo de reglas del proyecto

Remediación requerida:

1. mover estilos dinámicos a variables CSS o variantes reutilizables
2. introducir una utilidad `cn()` y una estrategia de variantes por componente
3. eliminar `confirm()` nativo y reemplazarlo por diálogo accesible propio
4. consolidar tokens visuales de color, espaciado y estados

## 5. Hallazgos medios relevantes

### 5.1 Búsquedas sin debounce

Se identificaron búsquedas sin debounce en:

- `src/caracteristicas/estudio/componentes/PanelProductos.tsx`
- `src/caracteristicas/maestro/componentes/PanelFinanciero.tsx`

Esto impacta rendimiento, carga de render y potencialmente tráfico innecesario si el patrón se expande a búsquedas remotas.

### 5.2 Paginación fuera de estándar interno

`src/caracteristicas/maestro/componentes/VisorReservas.tsx` usa 15 registros por página cuando la política del proyecto exige 10.

### 5.3 Error boundaries ausentes

No se encontraron error boundaries por feature.

Esto implica que un error no controlado puede derribar una parte demasiado amplia de la aplicación o toda la SPA.

### 5.4 SEO y contenido público incompletos

No se encontraron al momento:

- `public/sitemap.xml`
- `public/robots.txt`
- estrategia clara de JSON-LD o datos estructurados para pantallas públicas

## 6. Rendimiento y escalabilidad

## 6.1 Meta operativa realista

La aplicación debe poder sostener miles de usuarios concurrentes desde dispositivos móviles y tabletas, con latencias razonables y sin degradar reservas, autenticación, agenda ni pagos.

Eso exige una disciplina de arquitectura y observabilidad superior a la actual.

## 6.2 Trabajo requerido en backend

1. revisar exhaustivamente rutas con alto tráfico para evitar N+1 queries
2. auditar índices de Prisma y MySQL en campos de consulta frecuente
3. separar mejor lógica de handler y servicio en rutas complejas
4. revisar límites, rate limiting y protección contra abuso por endpoint
5. introducir métricas de latencia, errores y saturación por ruta
6. revisar tareas programadas y procesos secundarios para evitar competencia con el tráfico principal
7. diseñar estrategia de caché para datos que sí puedan cachearse sin comprometer consistencia

## 6.3 Trabajo requerido en frontend

1. mantener lazy loading en rutas pesadas y extenderlo donde falte
2. revisar listas grandes, tablas densas y modalización excesiva
3. minimizar renders costosos y derivaciones repetidas dentro de componentes grandes
4. tratar búsquedas, filtros y dashboards con criterios de costo real de render y fetch
5. vigilar que service worker y caché no expongan datos sensibles ni dejen UI inconsistente

## 7. Accesibilidad, semántica y experiencia de usuario

## 7.1 Estado actual

Hay avances útiles, pero todavía no existe una garantía suficiente de accesibilidad de nivel profesional en todo el sistema.

Puntos favorables observados:

- presencia de `aria-label` en varios botones de solo ícono
- componentes de carga con `aria-busy`
- uso de modales con base accesible en algunos casos

Brechas a cerrar:

1. revisar de forma completa todos los formularios para asegurar `label`, `aria-describedby`, foco visible y orden tab lógico
2. unificar modales para garantizar focus trap real y no solo cierre por Escape
3. revisar contraste, estados de error, mensajes y navegación por teclado
4. completar semántica estructural de pantallas públicas y de panel
5. documentar criterios de accesibilidad mínimos por componente reusable

## 8. Backend y reglas de negocio

## 8.1 Lo que está bien encaminado

- existe validación y estructura backend que ya resuelve parte importante del dominio
- hay uso de Prisma, Fastify, middleware de autenticación y algunos patrones sanos
- la política de no usar `float` para dinero ya se refleja en modelos basados en enteros

## 8.2 Lo que aún debe endurecerse

1. asegurar que todas las rutas protegidas validen usuario activo, rol, estado del salón y permiso granular de forma uniforme
2. consolidar auditoría y trazabilidad en todos los cambios de estado y dinero
3. revisar si existen eliminaciones físicas donde debería haber soft delete o inactivación
4. reforzar blindaje contra inferencia de existencia de cuentas y filtraciones indirectas
5. endurecer la gobernanza de estados de negocio para evitar textos libres o transiciones inválidas

## 9. Calidad de código y mantenibilidad

## 9.1 Problemas actuales

1. reglas internas amplias, pero todavía poco traducidas a mecanismos automáticos
2. frontend con mezcla de responsabilidades visuales, de estado y de validación
3. documentación técnica viva incompleta
4. ausencia de un plan claro de refactorización por dominio

## 9.2 Remediación requerida

1. crear módulos más pequeños, legibles y testeables
2. documentar decisiones importantes de arquitectura
3. normalizar contratos, nombres y estructuras por dominio
4. introducir definición de hecho terminado por feature
5. impedir crecimiento del código sin pruebas, auditoría y validación backend cuando aplique

## 10. Recomendación específica sobre Copilot en VS Code

## 10.1 Sí, `copilot-instructions.md` sí funciona

Sí. `.github/copilot-instructions.md` está en la ubicación correcta para instrucciones globales de workspace y sí es una convención válida para Copilot.

No está “mal puesto”. El problema no es la ruta.

## 10.2 Por qué no bastó para que la IA construyera exactamente como pediste

Porque ese archivo guía el comportamiento, pero no lo garantiza de forma determinista.

Las causas reales más probables son estas:

1. el archivo es demasiado amplio y ambicioso para actuar como único mecanismo de control
2. mezcla reglas estratégicas, de arquitectura, seguridad, frontend, testing, naming y despliegue en un solo bloque largo
3. las instrucciones naturales compiten con el contexto del código existente, el prompt del momento y las restricciones superiores del sistema
4. la IA no reemplaza validaciones automáticas; si una regla no está reforzada por lint, test, schema, hooks o CI, tarde o temprano se rompe
5. pedir “construir toda la app bien desde cero” sobre una base ya existente es una tarea demasiado abierta; la IA responde mejor con objetivos cerrados, criterios de aceptación y superficie limitada
6. si no existen instrucciones por archivo o por dominio, el modelo no siempre aplica con precisión todas las reglas a cada contexto concreto

## 10.3 Qué hacer para que Copilot obedezca mucho mejor

### Mantener `copilot-instructions.md`, pero adelgazarlo

Debe contener solo lo verdaderamente global y no negociable:

1. idioma del código
2. seguridad y backend como fuente de verdad
3. reglas monetarias
4. obligación de auditoría
5. reglas estructurales de React y formularios
6. política de pruebas mínimas

Todo lo demás conviene moverlo a instrucciones especializadas o documentación técnica enlazada.

### Crear instrucciones por contexto en `.github/instructions/`

Recomendación concreta:

- `frontend.instructions.md` con `applyTo: "src/**/*.tsx"`
- `backend.instructions.md` con `applyTo: "server/src/**/*.ts"`
- `formularios.instructions.md` con `applyTo: "src/caracteristicas/**/*.tsx"`
- `seguridad.instructions.md` con `applyTo: "server/src/**/*.{ts,tsx}"`
- `testing.instructions.md` con `applyTo: "**/*.{test,spec}.{ts,tsx}"`

Así reduces ambigüedad y aumentas precisión por tipo de archivo.

### Convertir reglas críticas en mecanismos automáticos

Lo verdaderamente serio no debe depender de memoria del modelo.

Deben implementarse controles automáticos para:

1. prohibir `confirm`, `alert`, `window.print`
2. limitar estilos inline no justificados
3. detectar componentes demasiado grandes
4. prohibir `any`, nombres en inglés en capas internas y patrones inseguros
5. exigir tests mínimos para dominios críticos
6. verificar cobertura por módulos sensibles
7. fallar CI si se rompe una regla crítica

### Usar prompts y flujos de trabajo repetibles

Conviene crear prompts del repositorio para tareas frecuentes como:

1. crear una nueva feature
2. refactorizar un formulario
3. revisar seguridad de una ruta Fastify
4. auditar accesibilidad de una pantalla
5. preparar cambios para producción

### No pedir cambios gigantes en una sola orden

La forma correcta de trabajar con IA en este repositorio es por lotes acotados:

1. dominio o feature concreto
2. criterio de aceptación explícito
3. backend primero cuando aplique
4. frontend después
5. tests después
6. verificación final contra checklist

## 11. Hoja de ruta de remediación propuesta

## Fase 0 — Bloqueo de salida a producción

Objetivo: cerrar hallazgos críticos antes de cualquier despliegue comercial.

Entregables:

1. refresh token rotativo real
2. invalidación de sesión por eventos críticos
3. CSRF donde aplique
4. auditoría completa de acciones críticas
5. `Permissions-Policy`
6. revisión de exposición de archivos privados y service worker

## Fase 1 — Consistencia estructural de dominio

Objetivo: alinear contratos, nombres y formularios con las reglas del proyecto.

Entregables:

1. normalización de tipos internos al español
2. migración de formularios a React Hook Form + Zod
3. extracción de hooks de formulario por feature
4. eliminación de duplicidad de validaciones

## Fase 2 — Refactorización de frontend y experiencia de uso

Objetivo: hacer el frontend mantenible, rápido y profesional.

Entregables:

1. división de componentes grandes
2. eliminación de `confirm()` y estilos inline evitables
3. sistema de variantes reusable
4. error boundaries por feature
5. revisión completa de accesibilidad

## Fase 3 — Calidad, pruebas y observabilidad

Objetivo: hacer que la app sea defendible ante crecimiento y auditoría.

Entregables:

1. suite de pruebas mínima por dominio crítico
2. cobertura utilitaria y de negocio
3. métricas, logs y correlación por request
4. definición de release gate y checklist técnico de salida

## Fase 4 — Endurecimiento para escala comercial

Objetivo: operar con miles de usuarios concurrentes sin degradación seria.

Entregables:

1. auditoría final de queries e índices
2. pruebas de carga en reservas, login y agenda
3. revisión de límites, cachés y colas
4. playbooks operativos para incidentes

## 12. Criterios mínimos de salida a producción

No debe liberarse la aplicación a producción comercial hasta cumplir, como mínimo, con lo siguiente:

1. cero hallazgos críticos abiertos en autenticación, auditoría y sesiones
2. formularios críticos migrados a RHF + Zod
3. pruebas automatizadas sobre autenticación, dinero, permisos, reservas y fechas
4. trazabilidad completa de acciones sensibles
5. error boundaries y manejo de errores consistente en frontend
6. accesibilidad aceptable en flujos críticos
7. lineamientos de IA reforzados por automatización, no solo por texto
8. revisión final de seguridad y performance con evidencia medible

## 13. Recomendación final

La app no necesita rehacerse desde cero, pero sí necesita una remediación dirigida, disciplinada y por fases.

La base técnica elegida es suficiente para construir un producto serio con React, Fastify, Prisma, Zod, TanStack Query y Zustand, pero el proyecto todavía requiere endurecimiento real en seguridad, contratos, pruebas, accesibilidad, observabilidad y disciplina de entrega.

La prioridad correcta no es “hacer más pantallas”, sino cerrar primero los huecos que hoy impedirían vender la plataforma con confianza o sostener una auditoría externa exigente.

Mientras esos puntos no estén resueltos, cualquier aceleración funcional solo aumenta la deuda y el riesgo.