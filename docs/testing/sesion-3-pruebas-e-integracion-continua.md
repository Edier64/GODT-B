# Sesión 3 — Pruebas e integración continua

**Proyecto:** GODT Regional 3 — Backend  
**Stack:** NestJS 11, TypeScript, Jest y PostgreSQL/Prisma  
**Alcance:** pruebas unitarias, pruebas HTTP de API y automatización CI.

## 1. Objetivo de la evidencia

La sesión 3 solicita una pirámide de pruebas con mayor cantidad de pruebas unitarias que pruebas de API, al menos ocho pruebas en total, ejecución automática mediante GitHub Actions y un badge visible en el README.

## 2. Pruebas implementadas

### 2.1. Pruebas unitarias

Archivo: [session-3-unit.spec.ts](../../test/session-3-unit.spec.ts)

Se prueban tres funciones puras del helper de normalización de instituciones:

| Función | Escenarios cubiertos |
|---|---|
| `normalizeString` | Tildes, mayúsculas, puntuación y espacios repetidos. |
| `levenshteinDistance` | Cadenas idénticas e inserciones. |
| `stringSimilarity` | Coincidencia normalizada, entrada vacía y error ortográfico menor. |

Estas pruebas no requieren red ni base de datos.

### 2.2. Pruebas HTTP de API

Archivo: [session-3-api.spec.ts](../../test/session-3-api.spec.ts)

Se levanta un módulo NestJS de prueba con el controlador real de donantes, guard JWT sustituido por un guard controlado y casos de uso simulados. Se realizan solicitudes HTTP reales contra un puerto local efímero; no se conecta PostgreSQL ni se usan datos clínicos reales.

| Endpoint | Escenario | Resultado esperado |
|---|---|---|
| `POST /api/v1/donors` | Creación válida | 201 y expediente retornado. |
| `POST /api/v1/donors` | Campo obligatorio vacío | 400 y no se ejecuta el caso de uso. |
| `GET /api/v1/donors?page=2&pageSize=10&status=ACTIVO` | Consulta con paginación | 200 y parámetros convertidos a números. |
| `GET /api/v1/donors/:id` | Expediente inexistente | 404. |
| `PATCH /api/v1/donors/:id` | Usuario sin autorización | 403. |

Total agregado para la evidencia de esta sesión: **8 pruebas** (3 unitarias y 5 de API). El repositorio ya tenía otras suites de pruebas previas; estas dos suites hacen explícita la evidencia solicitada para la Sesión 3.

## 3. Integración continua

Workflow: [ci-cd-backend.yml](../../.github/workflows/ci-cd-backend.yml)

Se conserva el flujo de compilación, validación de Prisma y build Docker, y se agrega un paso independiente para las pruebas HTTP de API.

En eventos `pull_request` hacia `main` y en `push` a `main` o a las ramas feature configuradas, CI realiza:

1. Checkout del repositorio.
2. Configuración de Node.js 22 y caché npm.
3. Instalación reproducible con `npm ci`.
4. Generación de Prisma Client y validación del schema.
5. Compilación NestJS.
6. Ejecución de las pruebas unitarias sin servicios externos.
7. Ejecución de las cinco pruebas HTTP de API sin base de datos externa.
8. Build de validación de la imagen Docker runtime, sin publicar ni desplegar.

Los jobs de publicación de imágenes, migraciones y despliegue Azure siguen condicionados a una ejecución manual (`workflow_dispatch`); las pruebas de esta sesión no despliegan recursos.

## 4. Comandos para reproducir localmente

```bash
npm ci
npx prisma generate
npx prisma validate
npm run build
npx jest --runInBand --forceExit --testPathIgnorePatterns="integration-spec|-integration\\.spec|e2e-spec|real-http-api-operations|session-3-api|gemini-ocr-integration|fase-d2-e2e|fase-g1-4-diligenced-pdf-preview|fase-g1-clinical-history-intake|fase-g1-ingestion-ocr-canonical"
npx jest test/session-3-api.spec.ts --runInBand --forceExit
```

## 5. Criterio de cierre

La evidencia se considera cerrada cuando GitHub Actions termina en verde para el commit/PR y el badge muestra el estado del workflow. La existencia del workflow o del badge, por sí sola, no demuestra que las pruebas hayan pasado.

- [Workflow Backend CI/CD](https://github.com/Edier64/GODT-B/actions/workflows/ci-cd-backend.yml)
- [README Backend y badge](../../README.md)
