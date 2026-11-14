# Informe de arquitectura, dependencias y revisión senior — GODT Regional 3

**Fecha:** 14 de noviembre de 2026  
**Repositorios:** [GODT-B](https://github.com/Edier64/GODT-B) · [GODT-Frontend](https://github.com/Edier64/GODT-Frontend)

Este documento conserva el análisis comparativo, los diagramas, las decisiones de arquitectura y la revisión senior en el repositorio. La idea es que el equipo pueda consultar el resultado desde GitHub sin depender del historial de conversación.

## 1. Material contrastado

Se compararon los entregables iniciales:

- `Entregable_Modulo2_Arquitectura_GODT_Regional3.pdf`
- `Entregable_Modulo3_GODT(1).pdf`

con los `package.json`, lockfiles, Dockerfiles, configuración Vite/Nginx, `prisma/schema.prisma`, módulos NestJS, adaptadores de infraestructura y guías de despliegue de ambos repositorios.

Los documentos académicos representan propuestas y alternativas de sus respectivas entregas. Los manifiestos y el código de los repositorios representan la implementación contrastada. Una tecnología que aparece como alternativa propuesta no se considera parte del stack ejecutado.

## 2. Propuesta inicial frente a implementación actual

| Componente | Propuesta inicial | Implementación actual contrastada |
|---|---|---|
| Frontend | Vue 3 + Bun | Vue 3 + TypeScript + Vite + Pinia + Vue Router + Axios + Tailwind CSS v4. La instalación se realiza con npm y `package-lock.json`. |
| Backend | NestJS o Spring Boot | NestJS 11 + TypeScript + Node.js 22. |
| Base de datos | Supabase/PostgreSQL o MySQL | PostgreSQL 17 + Prisma ORM. |
| Trabajos asíncronos | Redis + BullMQ | BullMQ sobre PostgreSQL, utilizando el esquema `bullmq`; Redis permanece como alternativa opcional. |
| Almacenamiento | Supabase Storage | Azure Blob Storage privado en el despliegue Azure. El código también conserva adaptadores local y R2/S3-compatible. |
| OCR | Gemini como proveedor principal | Gemini opcional, Tesseract y extracción local de documentos. La activación de Gemini está bloqueada en staging y production por el adaptador actual. |

### 2.1. Precisiones

- Bun y Spring Boot pertenecen a las alternativas del diseño inicial; no son las tecnologías que compilan ni ejecutan los repositorios actuales.
- Prisma declara PostgreSQL. No se encontró MySQL ni Supabase como proveedor de la base de datos desplegada.
- BullMQ utiliza PostgreSQL como backend predeterminado. Redis solo se selecciona mediante configuración de compatibilidad.
- `@aws-sdk/client-s3` se utiliza en el adaptador Cloudflare R2/S3-compatible; su presencia no significa que Azure utilice S3.
- Gemini se invoca mediante REST con `fetch`; no se encontró un SDK Gemini como dependencia directa.
- Tesseract y Poppler se ejecutan como herramientas locales instaladas en la imagen backend, no como servicios HTTP externos.
- CRUE, IPS receptoras, INS, SIAM/Casiopea y Red Data INS aparecen en documentos de diseño, pero no se representan como integraciones activas porque no se encontró un cliente o conector correspondiente en el código revisado.

## 3. Dependencias revisadas

### 3.1. Frontend — GODT-Frontend

| Grupo | Dependencias/tecnologías |
|---|---|
| Aplicación | Vue 3, Vue Router, Pinia |
| HTTP | Axios |
| Build | Vite, plugin de Vue y vue-tsc |
| Tipado | TypeScript |
| Estilos | Tailwind CSS v4 |
| Contenedor | Node 22 Alpine para compilar; Nginx 1.27 Alpine para servir estáticos y actuar como reverse proxy |

El frontend utiliza `VITE_API_BASE_URL` para la ruta pública de la API, normalmente `/api/v1`. No contiene SDK ni credenciales del proveedor OCR. El navegador llega al backend a través del gateway/proxy.

Referencia: [package.json del Frontend](https://github.com/Edier64/GODT-Frontend/blob/main/package.json).

### 3.2. Backend — GODT-B

| Grupo | Dependencias/tecnologías |
|---|---|
| Framework y API | NestJS 11, configuración, JWT, plataforma Express y Swagger |
| Lenguaje y build | TypeScript, Nest CLI y ts-node |
| Persistencia | Prisma ORM y PostgreSQL |
| Trabajos asíncronos | BullMQ con backend PostgreSQL; ioredis para compatibilidad Redis |
| Validación | class-validator, class-transformer, AJV y ajv-formats |
| Archivos cloud | Azure Identity, Azure Storage Blob y AWS SDK para el adaptador R2/S3 |
| Seguridad | Argon2, JWT, cookie-parser y Helmet |
| Documentos | pdf-lib, archiver, adm-zip y Multer |
| OCR | Gemini por REST opcional; Tesseract y Poppler instalados en la imagen runtime |

Referencia: [package.json del Backend](https://github.com/Edier64/GODT-B/blob/main/package.json).

## 4. Diagramas y arquitectura

Los diagramas Mermaid editables están en [docs/arquitectura.md](./arquitectura.md):

- **Contexto:** perfiles de coordinador operativo, cirujano, técnico de tejidos y administrador/calidad; sistema GODT y servicios Azure configurados. Gemini se muestra como proveedor opcional.
- **Contenedores:** gateway Nginx, API NestJS, worker, migrator, PostgreSQL, Azure Blob Storage, OCR local y proveedor externo opcional.
- Las flechas especifican protocolos como HTTPS, PostgreSQL wire protocol sobre TCP 5432 y llamadas REST HTTPS al proveedor opcional.

## 5. Decisiones arquitectónicas

Los ADR documentan contexto, alternativas, decisión, justificación, consecuencias y evidencia:

- [ADR-001 — Selección del lenguaje y los frameworks](./adr/ADR-001-stack.md): TypeScript, Vue 3, Vite, NestJS y Node.js.
- [ADR-002 — PostgreSQL y plataforma de despliegue Azure](./adr/ADR-002-datos-y-despliegue.md): PostgreSQL, Prisma, BullMQ sobre PostgreSQL, Azure Container Apps y Azure Blob Storage.
- [ADR-004 — Diccionario canónico y propagación](./adr/ADR-004-canonical-dictionary-and-propagation.md).
- [ADR-005 — Snapshots y firmas del ciclo documental](./adr/ADR-005-document-lifecycle-snapshots-and-signatures.md).

La arquitectura y los ADR principales también se enlazan desde el repositorio Frontend: [docs/arquitectura.md](https://github.com/Edier64/GODT-Frontend/blob/main/docs/arquitectura.md).

## 6. Revisión senior del flujo OCR

Se revisaron tres archivos clave, priorizando seguridad de secretos, validación de entradas y manejo de errores. Las líneas indicadas corresponden a la versión anterior a las correcciones.

| Archivo y líneas (antes del cambio) | Problema identificado | Severidad | Sugerencia/corrección aplicada |
|---|---|---|---|
| `src/infrastructure/ocr/gemini-ocr.adapter.ts:168–171` | La API key de Gemini se enviaba como parámetro de URL, con riesgo de exposición en registros y sistemas de inspección. | Alta | Se trasladó a la cabecera `x-goog-api-key`. |
| `src/presentation/ocr/ocr.dto.ts:36–37` | El array `items` no validaba el tipo array ni ejecutaba validación anidada por elemento. | Alta | Se agregaron `@IsArray`, `@ArrayMinSize`, `@ValidateNested` y `@Type`. |
| `src/application/ocr/start-ocr.use-case.ts:37` | Un documento inexistente lanzaba un error genérico y podía terminar como HTTP 500. | Media | Se utiliza `OcrNotFoundError`, transformado por el controlador en HTTP 404. |
| `src/application/ocr/start-ocr.use-case.ts:63–83` | Si BullMQ no aceptaba el trabajo y no había fallback local, el registro podía permanecer en `EN_COLA`. | Alta | Se marca como `FALLIDO` con código `OCR_QUEUE_UNAVAILABLE` y se devuelve el estado persistido. |
| `src/application/ocr/start-ocr.use-case.ts:65–68` | El log afirmaba que habría procesamiento directo incluso cuando no existía fallback local. | Baja | Se separaron los mensajes para indicar si el fallback está disponible o no. |

### 6.1. Commits de las correcciones

Las cinco correcciones se publicaron previamente en `main`. Se enlazan para conservar la trazabilidad; no se duplicaron en este PR de reorganización documental.

1. [Enviar Gemini API key en cabecera](https://github.com/Edier64/GODT-B/commit/02564d13bc8a2fda28f3f51008e766a9d8d971c5)
2. [Validar campos del lote OCR](https://github.com/Edier64/GODT-B/commit/02ed5de3c51f8032378c04c59688e2b72f8bc0b1)
3. [Devolver 404 cuando no existe el documento fuente](https://github.com/Edier64/GODT-B/commit/ef97aeb00bec77e9f9ebef1eb3c8d31fd010d3b2)
4. [Marcar fallos al enviar trabajos a la cola](https://github.com/Edier64/GODT-B/commit/c2a38cfd418936ae8baa73f58d3277852cb5a8c0)
5. [Corregir los mensajes de fallback OCR](https://github.com/Edier64/GODT-B/commit/ee9c0300afdebd33d9b7d9d713f0519b60598898)

### 6.2. Pruebas de regresión

El PR de pruebas incorporó cobertura para comprobar que Gemini envía la clave mediante cabecera y no como query string, y que el DTO de propagación valida array, tamaño mínimo y elementos anidados. La ejecución local de las pruebas y el build deben realizarse antes de dar la revisión por cerrada; la existencia de pruebas en el repositorio no equivale a una ejecución aprobada.

## 7. Trazabilidad de documentación

| Repositorio | Cambio | Referencia |
|---|---|---|
| GODT-B | Arquitectura y ADR | [docs: arquitectura y ADR](https://github.com/Edier64/GODT-B/commit/351486d2d43338ed32e5e45ed4e866d5332dfc35) |
| GODT-Frontend | Enlace a arquitectura y ADR globales | [docs: enlazar arquitectura y ADR global](https://github.com/Edier64/GODT-Frontend/commit/5df7352c7dc0eb75266f925d81ec42b34538c2d9) |
| GODT-B | Sincronización del estado del despliegue | [docs: sincronizar estado de despliegue](https://github.com/Edier64/GODT-B/commit/51fb8daf27fc446c2ed58d54af300a251a960ef8) |
| GODT-B | Organización previa de sprints | [PR #12 integrado](https://github.com/Edier64/GODT-B/pull/12) |

## 8. Alcance y limitaciones

- El análisis describe la implementación contrastada con los manifiestos, el código y la configuración de despliegue conocida.
- La existencia de un adaptador no significa que esté activo en el entorno desplegado.
- Los sistemas externos que solo aparecen en el diseño inicial no se presentan como integraciones implementadas.
- Las cinco correcciones se enlazan mediante sus commits; las pruebas de regresión deben ejecutarse y revisarse en CI/local antes de dar la revisión por cerrada.

## 9. Navegación

- [Índice general de documentación](./README.md)
- [Arquitectura y diagramas Mermaid](./arquitectura.md)
- [ADR-001](./adr/ADR-001-stack.md) y [ADR-002](./adr/ADR-002-datos-y-despliegue.md)
- [Histórico de Sprints](./sprints/)
- [Auditorías por fase](./audits/)
- [Modelo y catálogo documental](./documents/)
- [Contratos y Postman](./api/)
- [Guía de despliegue Azure Container Apps](./deployment/azure-container-apps.md)
