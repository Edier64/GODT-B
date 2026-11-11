# GODT Regional 3 — Guía de Despliegue en Azure Container Apps (Consumption)

> **Estado actual:** Repositorios preparados para Azure Container Apps (ACA), Azure Container Registry (ACR), PostgreSQL Flexible Server, Azure Blob Storage privado y GitHub Actions OIDC. **No se han aprovisionado recursos cloud en esta fase.**  
> **Suscripción objetivo:** Azure for Students (crédito inicial USD 100, vigencia según portal Azure).

---

## 1. Arquitectura

La plataforma se separa en tres Container Apps y una etapa controlada de migración dentro de un mismo **Container Apps Environment (Consumption)**:

┌──────────────────────────────────────────────────────────┐
│                     Internet HTTPS                       │
└──────────────────────────┬───────────────────────────────┘
                           ▼
┌──────────────────────────────────────────────────────────┐
│ godt-gateway  (Ingress EXTERNO HTTPS :80)                │
│ Vue 3 SPA + Nginx (resolver dinámico DNS)                │
│   ├─ GET  /         → SPA estática + fallback index.html │
│   ├─ GET  /health   → Probe propio del gateway           │
│   └─ *    /api/v1/* → Proxy HTTP/HTTPS interno vía       │
│                       API_UPSTREAM (preserva Set-Cookie) │
└──────────────────────────┬───────────────────────────────┘
                           │ FQDN interno ACA (TLS)
                           ▼
┌──────────────────────────────────────────────────────────┐
│ godt-api  (Ingress INTERNO :3000, APP_MODE=api)          │
│ NestJS API (sin consumidores BullMQ activos)             │
│   ├─ Auth institucional JWT + Cookie HttpOnly            │
│   ├─ Encola trabajos OCR y Dossier en PostgreSQL BullMQ  │
│   └─ Lee/escribe documentos mediante FILE_STORAGE_PORT   │
└──────────────┬───────────────────────────┬───────────────┘
               │                           │
               ▼                           ▼
┌───────────────────────────────┐  ┌───────────────────────┐
│ PostgreSQL Flexible Server    │  │ Azure Blob Storage    │
│   ├─ schema public (Prisma)   │  │ Contenedor privado    │
│   └─ schema bullmq (Colas)    │  │ (Managed Identity)    │
└──────────────▲────────────────┘  └───────────▲───────────┘
               │                               │
               └───────────────┬───────────────┘
                               │
┌──────────────────────────────┴───────────────────────────┐
│ godt-worker  (Sin ingress HTTP, APP_MODE=worker)         │
│ Mismo código backend compilado (dist/worker.js)          │
│ Contexto NestFactory.createApplicationContext (sin HTTP) │
│   ├─ OcrWorker (extracción clínica / Tesseract / Gemini) │
│   └─ BullmqDossierQueueService (ZIP/PDF/integridad)      │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│ godt-migrator (Container App Job, target: migrator)      │
│ Ejecuta una sola vez por despliegue antes de API/Worker: │
│   1. npx prisma migrate deploy   (schema public)         │
│   2. migrate-queues.js           (schema bullmq, v11)    │
└──────────────────────────────────────────────────────────┘
```

### Decisión técnica BullMQ: PostgreSQL (`createPostgresBackend`) implementado y Redis eliminado

- **Validación real en `bullmq@6.5.1` + `pg` contra PostgreSQL 17:** Se ejecutó un PoC real y la validación integral en Docker Compose cubriendo ambas colas (`ocr` y `dossier-exports`), deduplicación por `jobId`, reintentos con backoff exponencial, `QueueEvents`, `getJob`/`getState`, recuperación tras reinicio de contenedores y migraciones controladas.
- **Resultado técnico:** `withBackend(createPostgresBackend)` con esquema dedicado `bullmq` (`BULLMQ_PG_SCHEMA=bullmq`) funciona de forma estable. Solo `paginate`, `removeDeprecatedPriorityKey` y `trimEvents` figuran como `notImplemented` en `bullmq@6.5.1` y ninguna es usada por GODT.
- **Control de concurrencia DDL:** `APP_MODE=migrate` (`godt-migrator`) ejecuta `runMigrations()` una única vez por despliegue. Tanto `godt-api` como `godt-worker` arrancan con `skipMigrations: true` para evitar locks o DDL concurrentes entre réplicas.
- **Implicación directa en Azure for Students:** Se **elimina completamente Redis** (`Azure Cache for Redis` ~$16/mes y servicio `redis` en Compose), optimizando la vigencia del crédito de USD 100.
- **Control de conexiones PostgreSQL:** Cada `Queue` y `Worker` PostgreSQL limita el pool a `max: 5` (más 1 cliente `LISTEN` por worker). Dimensionar `max-replicas` de `godt-api` y `godt-worker` considerando el límite de conexiones de `Standard_B1ms` (~50 conexiones activas).
- *(Compatibilidad opcional: `BULLMQ_BACKEND=redis` se conserva solo por retrocompatibilidad si se decidiera usar Redis en otro entorno).*

---

## 2. Requisitos de Azure

1. **Suscripción activa:** Azure for Students (USD 100 de crédito) o Pay-As-You-Go.
2. **Proveedores registrados en la suscripción:**
   - `Microsoft.App` (Azure Container Apps)
   - `Microsoft.OperationalInsights` (Log Analytics Workspace)
   - `Microsoft.ContainerRegistry` (ACR)
   - `Microsoft.DBforPostgreSQL` (Flexible Server)
   - `Microsoft.Storage` (Blob Storage)
3. **Herramientas locales / CI:** Azure CLI (`az` >= 2.60) con extensión `containerapp`, Docker Engine, repositorio en GitHub con permisos de creación de Environments/Variables.

---

## 3. Recursos necesarios y costos estimados (Azure for Students)

Distinción entre **cuotas/beneficios gratuitos de Azure Container Apps** y **cargos adicionales**:

| Recurso | Tier sugerido piloto | Beneficio / Cargo | Costo mensual aprox. (USD) |
|---|---|---|---|
| **Azure Container Apps Environment** (Consumption) | Consumption + Log Analytics | **Cuota gratuita mensual ACA:** primeros 180.000 vCPU-s, 360.000 GiB-s y 2M solicitudes HTTP/mes | **$0 – $5** (según actividad; escala a 0 en gateway/api si se permite, o 1 réplica mínima) |
| **Log Analytics Workspace** | Pay-per-GB | Primeros **5 GB/mes gratis** por billing account | **$0 – $2** |
| **Azure Container Registry (ACR)** | Basic | Cargo fijo (no incluido en free grant si no aplica promo estudiantil) | **~$5/mes** |
| **PostgreSQL Flexible Server** | Burstable `Standard_B1ms` (1 vCPU, 2 GiB RAM, 32 GB) | Base de datos principal + colas BullMQ (`bullmq` schema) | **~$15–18/mes** *(o $0 mientras aplique free grant elegible)* |
| **Azure Storage Account (Blob privado)** | Standard LRS (Hot) | Almacenamiento privado de PDFs y ZIPs | **~$0.50 – $2/mes** |
| **Total estimado (sin Redis)** | | Descontado del crédito USD 100 | **~$6 – $27/mes** (~3.7 a 12 meses según escala a cero) |

---

## 4. Configuración de secretos y variables de entorno

**Regla:** Cero secretos en imágenes Docker, código fuente, `.github/workflows` o logs.

### A. Variables para GitHub Actions (Repository / Environment `Variables`, nunca hardcodeadas)

| Variable GitHub | Descripción |
|---|---|
| `AZURE_CLIENT_ID` | Client ID de la Managed Identity o App Registration con OIDC |
| `AZURE_TENANT_ID` | Tenant ID de Microsoft Entra ID |
| `AZURE_SUBSCRIPTION_ID` | ID de suscripción Azure |
| `AZURE_RESOURCE_GROUP` | Resource Group destino (ej. definido al provisionar) |
| `AZURE_ACR_NAME` | Nombre corto del Azure Container Registry |
| `AZURE_ACR_LOGIN_SERVER` | FQDN del ACR (`<acr>.azurecr.io`) |
| `ACA_GATEWAY_APP_NAME` | Nombre de la Container App `godt-gateway` |
| `ACA_API_APP_NAME` | Nombre de la Container App `godt-api` |
| `ACA_WORKER_APP_NAME` | Nombre de la Container App `godt-worker` |
| `ACA_MIGRATOR_JOB_NAME` | Nombre del Container App Job `godt-migrator` |

### B. Secretos en Azure Container Apps (`secretref:`)

| Secreto ACA | Usado en | Descripción |
|---|---|---|
| `database-url` | `migrator`, `godt-api`, `godt-worker` | Cadena PostgreSQL con TLS (`?sslmode=require`) |
| `jwt-secret` | `godt-api` | Mínimo 32 caracteres aleatorios (`openssl rand -hex 32`) |
| `gemini-api-key` | `godt-worker` (y `godt-api` si fallback OCR) | Clave de Google AI Studio (opcional; deshabilitada si `AI_EXTERNAL_PROVIDER_ENABLED=false`) |

### C. Variables de entorno por Container App

#### `godt-gateway` (Ingress externo HTTPS :80)
- `API_UPSTREAM`: `https://<FQDN-INTERNO-DE-GODT-API>` (obtener con `az containerapp show`, **nunca inventar**)
- `API_HOST_HEADER`: `<FQDN-INTERNO-DE-GODT-API>` (necesario para enrutamiento Envoy interno de ACA)

#### `godt-api` (Ingress interno :3000)
- `NODE_ENV=production`
- `APP_MODE=api` (desactiva consumidores BullMQ en API)
- `PORT=3000`
- `DATABASE_URL` (vía secretref)
- `BULLMQ_BACKEND=postgres`
- `BULLMQ_PG_SCHEMA=bullmq`
- `JWT_SECRET` (vía secretref)
- `JWT_ISSUER=godt-backend`, `JWT_AUDIENCE=godt-frontend`
- `JWT_ACCESS_EXPIRES_IN=15m`, `REFRESH_TOKEN_TTL_DAYS=7`
- `REFRESH_COOKIE_NAME=godt_refresh_token`, `AUTH_COOKIE_SECURE=true`, `AUTH_COOKIE_SAMESITE=strict`
- `TRUST_PROXY=true`
- `CORS_ORIGIN=https://<FQDN-PUBLICO-DE-GODT-GATEWAY>`
- `SWAGGER_ENABLED=false`
- `STORAGE_PROVIDER=azure`
- `AZURE_STORAGE_ACCOUNT_URL=https://<storage-account>.blob.core.windows.net`
- `AZURE_STORAGE_CONTAINER=godt-documents`
- `AZURE_CLIENT_ID=<client-id-user-assigned-managed-identity>` *(si usa UAMI en lugar de System-Assigned)*

#### `godt-worker` (Sin ingress)
- `NODE_ENV=production`
- `APP_MODE=worker` (arranca `dist/worker.js` sin HTTP server ni controllers)
- `INSTANCE_ID=godt-worker-aca`
- `DATABASE_URL` (vía secretref)
- `BULLMQ_BACKEND=postgres`
- `BULLMQ_PG_SCHEMA=bullmq`
- `STORAGE_PROVIDER=azure`
- `AZURE_STORAGE_ACCOUNT_URL=https://<storage-account>.blob.core.windows.net`
- `AZURE_STORAGE_CONTAINER=godt-documents`
- `OCR_PROVIDER=tesseract` *(o `gemini` solo si política clínica autoriza `AI_EXTERNAL_PROVIDER_ENABLED=true`)*
- `OCR_CONCURRENCY=1`, `DOSSIER_CONCURRENCY=2`

---

## 5. Construcción de imágenes

### Backend (`Dockerfile` multi-stage con dos targets)
- **Target `runtime`** (`godt-api` y `godt-worker`):
  - Incluye dependencias de producción (`npm ci --omit=dev`), cliente Prisma generado (`.prisma`, `@prisma`), `dist/`, `openssl`, `ca-certificates`, `tesseract-ocr`, `tesseract-ocr-data-eng`, `tesseract-ocr-data-spa`, `poppler-utils` y usuario no root `node`.
  - **No incluye** `devDependencies` ni Prisma CLI.
- **Target `migrator`** (`godt-migrator`):
  - Incluye `prisma` CLI, `prisma/schema.prisma`, `prisma/migrations/`, `prisma.config.ts` y `dist/` (`migrate-queues.js`).
  - Ejecuta `npx prisma migrate deploy` seguido de `node dist/infrastructure/runtime/migrate-queues.js`.

### Frontend (`Frontend/Dockerfile`)
- Compila Vue 3 con `VITE_API_BASE_URL=/api/v1` (mismo origen detrás del gateway).
- Sirve estáticos con `nginx:1.27-alpine` y procesa `docker/nginx.conf` como plantilla `/etc/nginx/templates/default.conf.template` usando `API_UPSTREAM` y `API_HOST_HEADER`.

---

## 6. Estrategia de migraciones

- **Prohibido** ejecutar `prisma migrate deploy` al arranque de cada réplica de `godt-api` o `godt-worker`.
- En producción se ejecuta el Container App Job `godt-migrator` (target `migrator`, `APP_MODE=migrate`) **antes** de crear una nueva revisión de `godt-api` o `godt-worker`.
- **Nota sobre base de datos existente:** Si se restaura una BD donde ciertas tablas ya existían fuera del historial `_prisma_migrations`, ejecutar `npx prisma migrate resolve --applied <nombre_migracion>` antes de `migrate deploy`.

---

## 7. Aprovisionamiento inicial (referencia sin ejecutar todavía)

```bash
# 1. Crear Resource Group y ACR
az group create --name "$AZURE_RESOURCE_GROUP" --location eastus
az acr create --name "$AZURE_ACR_NAME" --resource-group "$AZURE_RESOURCE_GROUP" --sku Basic --admin-enabled false

# 2. Crear Storage Account y contenedor privado (sin acceso anónimo)
az storage account create \
  --name "$AZURE_STORAGE_ACCOUNT" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --location eastus \
  --sku Standard_LRS \
  --allow-blob-public-access false \
  --min-tls-version TLS1_2

az storage container create \
  --name godt-documents \
  --account-name "$AZURE_STORAGE_ACCOUNT" \
  --auth-mode login \
  --public-access off

# 3. Managed Identity y permisos mínimos (AcrPull + Storage Blob Data Contributor)
az identity create --name godt-aca-identity --resource-group "$AZURE_RESOURCE_GROUP"
# Asignar AcrPull sobre ACR y "Storage Blob Data Contributor" sobre el contenedor/Storage Account

# 4. PostgreSQL Flexible Server (TLS obligatorio)
az postgres flexible-server create \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$PG_SERVER_NAME" \
  --location eastus \
  --sku-name Standard_B1ms \
  --tier Burstable \
  --version 17 \
  --storage-size 32

# 5. Container Apps Environment
az containerapp env create \
  --name "$ACA_ENV_NAME" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --location eastus
```

### Obtención del FQDN interno real de `godt-api`

Nunca hardcodear el FQDN interno; consultarlo tras crear `godt-api` con `--ingress internal`:

```bash
API_INTERNAL_FQDN=$(az containerapp show \
  --name "$ACA_API_APP_NAME" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --query "properties.configuration.ingress.fqdn" \
  -o tsv)

echo "FQDN interno real: $API_INTERNAL_FQDN"

# Actualizar godt-gateway con el upstream interno real
az containerapp update \
  --name "$ACA_GATEWAY_APP_NAME" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --set-env-vars \
    "API_UPSTREAM=https://${API_INTERNAL_FQDN}" \
    "API_HOST_HEADER=${API_INTERNAL_FQDN}"
```

### Escalado y límites de réplicas
- **`godt-gateway`**: `--ingress external --target-port 80 --min-replicas 1 --max-replicas 3` (o `min-replicas 0` fuera de horario para ahorrar).
- **`godt-api`**: `--ingress internal --target-port 3000 --min-replicas 1 --max-replicas 3`, con `APP_MODE=api`. Health probe HTTP `GET /health` cada 15s (`--startup-probe`, `--liveness-probe`, `--readiness-probe`).
- **`godt-worker`**: sin ingress (`APP_MODE=worker`), `--min-replicas 1 --max-replicas 1` inicialmente.
  - **Control de concurrencia:** BullMQ en PostgreSQL utiliza bloqueos atómicos transaccionales y `SKIP LOCKED` para distribuir jobs sin duplicación, pero `OcrWorker` ejecuta `requeuePersistedJobs()` al arrancar y `BullmqDossierQueueService` ejecuta `recoverOrphanExports()`. Por ello mantener `max-replicas 1` (con `DOSSIER_CONCURRENCY=2` / `OCR_CONCURRENCY=1`) hasta validar escalado multi-réplica en staging.

---

## 8. Despliegue (GitHub Actions OIDC)

1. Configurar **Federated Credentials** en Microsoft Entra ID (App Registration o User-Assigned Managed Identity) vinculando los repositorios `Edier64/GODT-B` y `Edier64/GODT-Frontend`.
2. Asignar roles mínimos al principal OIDC:
   - `AcrPush` sobre el ACR.
   - `Contributor` limitado al Resource Group de GODT (para actualizar Container Apps/Jobs).
3. En cada repositorio se dispone de workflow independiente:
   - Backend: `.github/workflows/ci-cd-backend.yml`
   - Frontend: `.github/workflows/ci-cd-gateway.yml`
4. Los Pull Requests ejecutan únicamente CI (`ci`). El push y despliegue a Azure están protegidos bajo `workflow_dispatch` + GitHub Environments con aprobación manual si se configura.

---

## 9. Actualizaciones independientes

- **Solo Frontend (`godt-gateway`):** Ejecutar `ci-cd-gateway.yml` (`deploy_gateway=true`). No reinicia `godt-api` ni `godt-worker`.
- **Solo Backend API o Worker:** Ejecutar `ci-cd-backend.yml` eligiendo `run_migrations`, `deploy_api` y/o `deploy_worker` de forma independiente.
- Si hubo cambio de esquema Prisma, marcar `run_migrations=true` para que `migrate` complete antes de `deploy-api` y `deploy-worker`.

---

## 10. Rollback

Azure Container Apps conserva revisiones inmutables identificadas por etiqueta SHA:

```bash
# Listar revisiones activas
az containerapp revision list \
  --name "$ACA_API_APP_NAME" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  -o table

# Revertir tráfico 100% a la revisión anterior sana
az containerapp ingress traffic set \
  --name "$ACA_API_APP_NAME" \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --revision-weight "<REVISION_ANTERIOR>=100"
```

Para `godt-worker` (sin ingress), actualizar directamente la imagen al SHA anterior probado (`az containerapp update --image ...:<SHA_ANTERIOR>`). Las migraciones Prisma destructivas requieren estrategia *expand-and-contract* (nunca rollback automático hacia atrás sin backup).

---

## 11. Backups y recuperación

1. **PostgreSQL Flexible Server:** Retención automática de backups diarios (7–35 días configurable) + Point-in-Time Restore (PITR). Antes de migraciones mayores, ejecutar backup lógico adicional (`pg_dump --format=custom`).
2. **Azure Blob Storage:** Habilitar **Soft Delete** para blobs y contenedores (ej. 14 días) + versionamiento para impedir pérdida accidental de historias clínicas o dossiers ZIP.
3. **Verificación de integridad:** Los documentos y dossiers almacenan `sha256Hash` en PostgreSQL y manifiesto canónico en cada ZIP (`VerifyDossierIntegrityUseCase`).

---

## 12. Logs y monitoreo

- **Logs estructurados en stdout/stderr:** Both `main.ts` y `worker.ts` emiten logs directamente a consola en producción (`log`, `warn`, `error`), capturados automáticamente por Log Analytics en ACA.
- Consultas KQL útiles en Log Analytics (`ContainerAppConsoleLogs_CL`):
  - Filtrar por `ContainerAppName_s == "godt-api"` o `"godt-worker"`.
  - Alertar ante `[CRITICAL]` o tasa alta de HTTP `5xx` en `godt-gateway` / `godt-api`.
- **Probes recomendados:**
  - `godt-gateway`: HTTP `GET /health` puerto `80` (espera `200 ok`).
  - `godt-api`: HTTP `GET /health` puerto `3000` (verifica PostgreSQL, esquema `bullmq` y almacenamiento privado).
  - `godt-worker`: sin probe HTTP (supervisado por exit code y logs de `WorkerBootstrap` / `OcrWorker`).

---

## 13. Apagado o reducción de costos

Cuando no haya demostraciones o pruebas activas:

```bash
# Reducir réplicas a 0 en apps de consumo (evita consumo vCPU/RAM)
az containerapp update --name "$ACA_GATEWAY_APP_NAME" --resource-group "$AZURE_RESOURCE_GROUP" --min-replicas 0
az containerapp update --name "$ACA_API_APP_NAME" --resource-group "$AZURE_RESOURCE_GROUP" --min-replicas 0
az containerapp update --name "$ACA_WORKER_APP_NAME" --resource-group "$AZURE_RESOURCE_GROUP" --min-replicas 0

# Detener temporalmente PostgreSQL Flexible Server (máx. 7 días antes de auto-reinicio)
az postgres flexible-server stop --name "$PG_SERVER_NAME" --resource-group "$AZURE_RESOURCE_GROUP"
```

> **Importante:** ACR Basic continúa generando cargo fijo mínimo (~$5/mes) mientras exista el registro. Ya no hay cargo por Azure Cache for Redis al usar PostgreSQL como backend de BullMQ.
