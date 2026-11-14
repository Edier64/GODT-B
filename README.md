# Sistema GODT Regional 3 — Backend API & Workers

Backend modular de alta fidelidad clínica para la **Gestión Operativa de Donación y Trasplantes (GODT Regional 3, Colombia)**. Implementado con **NestJS**, **TypeScript**, **Prisma ORM**, **PostgreSQL** y **BullMQ**.

El sistema administra expedientes de donantes, ingesta y comprensión documental mediante IA multimodal (Google Gemini) y OCR, catálogo de plantillas institucionales, propagación de datos canónicos, firmas, cadena de custodia y consolidación de dossiers con verificación criptográfica de integridad.

---

## 1. Arquitectura del Sistema

El backend sigue un diseño de **monolito modular guiado por el dominio (DDD)** con separación estricta de responsabilidades:

```
src/
├── domain/            # Entidades, agregados, reglas de negocio e interfaces puras
├── application/       # Casos de uso, servicios de aplicación y puertos
├── infrastructure/    # Adaptadores Prisma, almacenamiento privado, colas BullMQ, OCR y runtime
├── presentation/      # Controladores HTTP NestJS, DTOs con class-validator, guards y decoradores
├── health/            # Probe de salud (/health) para PostgreSQL, BullMQ y almacenamiento
├── main.ts            # Punto de entrada HTTP (APP_MODE=api o 'all')
└── worker.ts          # Punto de entrada BullMQ Worker sin servidor HTTP (APP_MODE=worker)
```

### Componentes de Ejecución

1. **`godt-api` (Servidor HTTP NestJS):**
   - Expone la API RESTful bajo el prefijo `/api/v1` y documentación interactiva Swagger en `/docs`.
   - Maneja autenticación institucional JWT y sesiones seguras en cookies `HttpOnly`.
   - Encola trabajos asíncronos en colas persistentes (OCR y generación de Dossier).
2. **`godt-worker` (Consumidor BullMQ sin HTTP):**
   - Procesa trabajos en segundo plano:
     - `OcrWorker`: extracción multimodal con Google Gemini / reglas locales / Tesseract.
     - `BullmqDossierQueueService`: compilación de dossiers, PDF consolidado, empaquetado ZIP y cálculo de checksums SHA-256.
   - Puede correr en el mismo proceso del API en desarrollo (`APP_MODE=all`), o en un proceso/contenedor independiente (`APP_MODE=worker`).
3. **`godt-migrator` (Etapa controlada de migraciones):**
   - Ejecuta `prisma migrate deploy` (schema `public`) y migraciones DDL de BullMQ (schema `bullmq`) de forma idempotente antes de levantar réplicas.

### Decisión de Infraestructura: BullMQ sobre PostgreSQL
A diferencia de arquitecturas tradicionales dependientes de Redis, este backend utiliza **PostgreSQL** como motor de colas persistentes (`createPostgresBackend` de `bullmq` en el schema `bullmq`). Esto **elimina la necesidad obligatoria de Redis**, reduciendo costos de infraestructura tanto en local como en Azure. Redis se mantiene únicamente como opción retrocompatible.

---

## 2. Requisitos Previos

- **Node.js:** Versión 20.x o 22.x LTS (se recomienda Node 22).
- **npm:** Versión 10+ u 11+.
- **Docker Desktop:** Con soporte para Docker Compose v2 (para levantar PostgreSQL en local).
- **Opcional para OCR local:** Binario de Tesseract OCR y herramientas Poppler (`pdftoppm`, `pdfinfo`) si no se utiliza el motor de IA multimodal de Gemini.

---

## 3. Configuración de Variables de Entorno

El repositorio dispone de tres plantillas de configuración según el modo de ejecución:

| Archivo | Propósito |
|---|---|
| `.env.example` | Plantilla para ejecución del backend directamente en Windows/host. |
| `.env.docker.example` | Plantilla de credenciales para los contenedores de soporte (`docker-compose.yml`). |
| `.env.local.example` | Plantilla para el stack completo emulado en Docker (`docker-compose.local.yml`). |

### Variables Principales (`.env`)

```ini
# --- ENTORNO Y PUERTO ---
NODE_ENV=development
PORT=3000
APP_NAME=godt-backend
SWAGGER_ENABLED=true

# --- BASE DE DATOS (POSTGRESQL 16/17) ---
DATABASE_URL=postgresql://godt:change_this_local_password@localhost:5432/godt?schema=public

# --- COLAS BULLMQ (POSTGRESQL POR DEFECTO) ---
BULLMQ_BACKEND=postgres
BULLMQ_PG_SCHEMA=bullmq
# Si desea usar Redis en su lugar:
# BULLMQ_BACKEND=redis
# REDIS_URL=redis://localhost:6379

# --- SEGURIDAD Y JWT ---
# Mínimo 32 caracteres aleatorios y seguros (el arranque fallará si es débil o placeholder)
JWT_SECRET=tu_secreto_aleatorio_muy_largo_de_al_menos_32_caracteres_12345
JWT_ISSUER=godt-backend
JWT_AUDIENCE=godt-frontend
JWT_ACCESS_EXPIRES_IN=15m
REFRESH_TOKEN_TTL_DAYS=7
REFRESH_COOKIE_NAME=godt_refresh_token
AUTH_COOKIE_SECURE=false
AUTH_COOKIE_SAMESITE=strict

# --- CORS ---
CORS_ORIGIN=http://localhost:5173,http://localhost:3000,http://127.0.0.1:5173

# --- ALMACENAMIENTO DE DOCUMENTOS ---
STORAGE_PROVIDER=local
STORAGE_BASE_PATH=storage/private
DOCUMENT_STORAGE_MAX_BYTES=20971520

# --- IA MULTIMODAL Y OCR (OPCIONAL / RECOMENDADO EN DESARROLLO) ---
AI_EXTERNAL_PROVIDER_ENABLED=true
GEMINI_API_KEY=tu_api_key_de_google_ai_studio
GEMINI_MODEL=gemini-3.8-flash
```

---

## 4. Guía de Ejecución Local (Paso a Paso)

Siga este orden para inicializar el backend por primera vez:

### Paso 1: Levantar la Base de Datos con Docker

En la raíz de `GODT-B`:

```powershell
# 1. Crear el archivo de entorno para Docker
Copy-Item .env.docker.example .env.docker

# 2. Iniciar el contenedor de PostgreSQL (Redis y pgAdmin son opcionales)
docker compose --env-file .env.docker up -d postgres

# 3. Confirmar que el contenedor está "healthy"
docker compose --env-file .env.docker ps
```

> **Nota:** Por defecto, el contenedor expone el puerto `5432` con usuario `godt`, contraseña `change_this_local_password` y base de datos `godt`.

### Paso 2: Configurar el Entorno del Backend

```powershell
# Copiar plantilla si no tiene .env
Copy-Item .env.example .env
```

Asegúrese de que `JWT_SECRET` tenga al menos 32 caracteres reales (no use textos de ejemplo).

### Paso 3: Migraciones y Creación de Esquemas

Ejecute las migraciones relacionales de Prisma y las migraciones de colas de BullMQ en PostgreSQL:

```powershell
# 1. Generar cliente Prisma
npm run prisma:generate

# 2. Validar esquema
npm run prisma:validate

# 3. Aplicar migraciones SQL de Prisma (schema public)
npm run prisma:deploy

# 4. Crear tablas de colas persistentes (schema bullmq)
npm run bullmq:migrate
```

### Paso 4: Carga de Datos Maestros y Usuario Administrador

El sistema opera bajo un modelo de **cero registro público** y requiere que los catálogos y usuarios existan en base de datos:

```powershell
# 1. Sembrar las instituciones de salud oficiales de Regional 3 (HUV, Imbanaco, Occidente, Valle del Lili, etc.)
npx ts-node scripts/seed-institutions.ts

# 2. Sembrar las 19 plantillas documentales normativas
npm run seed:templates

# 3. Aprovisionar el usuario administrador institucional inicial
npm run auth:provision-user -- --email admin@godt.gov.co --name "Administrador GODT" --role ADMIN --all-active-institutions
```
*(El comando solicitará la contraseña de forma interactiva y segura sin eco en consola, o puede asignarla temporalmente con `$env:PROVISION_USER_PASSWORD="tu_password_fuerte_123"`).*

### Paso 5: Iniciar el Servidor de Desarrollo

```powershell
# Cargar variables en la sesión PowerShell si arranca directo en host
Get-Content .env | ForEach-Object {
  if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
    [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), "Process")
  }
}

npm run start:dev
```

### Paso 6: Verificación del Servicio

- **Health Probe:** [http://localhost:3000/health](http://localhost:3000/health) (debe responder `{"status":"ok","database":"up","queue":"up","storage":"up"}`)
- **Swagger UI:** [http://localhost:3000/docs](http://localhost:3000/docs)
- **API Base:** [http://localhost:3000/api/v1](http://localhost:3000/api/v1)

---

## 5. Modo de Ejecución Completo con Docker Compose (Paridad con Azure)

Para probar la plataforma completa idéntica a producción (API + Worker + Base de Datos + Gateway Nginx del Frontend) en un solo comando:

```powershell
# 1. Crear .env.local a partir del ejemplo
Copy-Item .env.local.example .env.local

# 2. Ajustar contraseñas y secretos en .env.local

# 3. Levantar todo el stack
docker compose -f docker-compose.local.yml --env-file .env.local up --build
```

El sistema estará accesible de forma centralizada en **`http://localhost:8080`** mediante el Gateway Nginx.

---

## 6. Scripts Disponibles en `package.json`

| Script | Descripción |
|---|---|
| `npm run start:dev` | Inicia el API en modo desarrollo con recarga en caliente (watch). |
| `npm run start:prod` | Inicia el API compilado en producción (`node dist/src/main.js`). |
| `npm run start:worker` | Inicia únicamente los workers de BullMQ sin servidor HTTP. |
| `npm run build` | Compila TypeScript a JavaScript en el directorio `dist/`. |
| `npm run prisma:generate` | Genera los tipos y el cliente tipado de Prisma. |
| `npm run prisma:deploy` | Aplica migraciones SQL pendientes en la base de datos de destino. |
| `npm run prisma:migrate` | Crea y aplica nuevas migraciones en entorno de desarrollo (`migrate dev`). |
| `npm run bullmq:migrate` | Ejecuta las migraciones DDL para las colas BullMQ en PostgreSQL. |
| `npm run auth:provision-user` | Utilidad administrativa para crear o actualizar usuarios con contraseña Argon2id. |
| `npm run seed:templates` | Siembra las plantillas normativas oficiales del motor documental. |
| `npm run test` | Ejecuta la suite de pruebas unitarias con Jest. |
| `npm run test:integration` | Ejecuta pruebas de integración contra PostgreSQL activo. |
| `npm run lint` | Ejecuta el linter ESLint con auto-corrección. |

---

## 7. Módulos y Capacidades del Sistema

- **Autenticación y Sesiones (`presentation/auth`):** Login institucional, refresh tokens criptográficos en cookies `HttpOnly`, revocación de sesiones, rotación con detección de reuso y hashing Argon2id.
- **Expedientes de Donantes (`presentation/donors`):** Gestión de donantes, datos clínicos, antropometría y código RND.
- **Procesos de Donación (`presentation/processes`):** Orquestación integral de procesos de donación, asignación de IPS y participantes clínicos.
- **Diccionario Canónico (`presentation/canonical`):** Inventario de campos clínicos canónicos con historial de cambios, proveniencia y reglas de propagación cruzada.
- **Motor Documental y Catálogo (`presentation/document-engine`):** Versiones versionadas con JSON Schema, UI Schema, reglas de aplicabilidad y validación.
- **Ciclo de Vida Documental (`presentation/document-lifecycle`):** Borrador, completitud, aprobación, firmas electrónicas y registro de cadena de custodia inmutable.
- **Extracción Inteligente e Ingesta OCR (`presentation/ocr`):** Procesamiento de historias clínicas DOCX, PDF e imágenes vía Gemini Multimodal y respaldo de reglas locales.
- **Dossier Clínico Consolidado (`presentation/dossier`):** Generación asíncrona de expediente compilado (PDF único, exportación ZIP, manifiesto canónico y verificación de digest SHA-256).

---

## 8. Despliegue en Azure Container Apps

El repositorio está preparado para despliegue en **Azure Container Apps (ACA)** mediante GitHub Actions OIDC:

- **Imágenes Multi-Stage ([Dockerfile](./Dockerfile)):**
  - Target `runtime`: contenedor mínimo y seguro para `godt-api` y `godt-worker` (sin devDependencies, usuario no root `node`).
  - Target `migrator`: contenedor especializado para ejecutar migraciones Prisma y BullMQ en un Container App Job previo al despliegue.
- **Almacenamiento Cloud:** Integración con **Azure Blob Storage** privado usando autenticación nativa por **Managed Identity** (`DefaultAzureCredential`).
- **Guía completa de despliegue:** Consulte [deploy/azure/README.md](./deploy/azure/README.md) para detalles de arquitectura cloud, costos en Azure for Students y scripts de aprovisionamiento con Azure CLI.
