# Arquitectura vigente — GODT Regional 3

**Estado:** arquitectura contrastada con el código de las ramas principales y el despliegue de referencia del proyecto.  
**Fecha de revisión:** 14 de noviembre de 2026.  
**Repositorios:** [Backend GODT-B](https://github.com/Edier64/GODT-B) · [Frontend GODT-Frontend](https://github.com/Edier64/GODT-Frontend)

## 1. Alcance y criterio de veracidad

Este documento describe la arquitectura implementada, no el diseño aspiracional de los primeros entregables. Se contrastaron los entregables de los módulos 2 y 3 con los archivos package.json, package-lock.json, Dockerfile, docker-compose.local.yml, docker-compose.yml, prisma/schema.prisma, módulos NestJS, adaptadores de infraestructura, configuración de Nginx y la guía de despliegue.

Los diagramas incluyen únicamente componentes que tienen respaldo en el código o en la configuración de despliegue de los repositorios. Los servicios marcados como opcionales no deben interpretarse como activos en el entorno productivo.

## 2. Evolución desde la propuesta inicial

| Área | Propuesta inicial — Módulo 2 | Entrega — Módulo 3 | Implementación actual contrastada |
|---|---|---|---|
| Frontend | Vue 3 con Bun | Vue 3, TypeScript, Vite, Pinia y Axios | Vue 3.5, TypeScript, Vite, Pinia, Vue Router, Axios y Tailwind CSS v4. La instalación y compilación usan npm y package-lock; el contenedor compila con Node 22. |
| Backend | NestJS o Spring Boot | NestJS + TypeScript | NestJS 11 + TypeScript. No se encontró aplicación Spring Boot en el repositorio. |
| Base de datos | Supabase/PostgreSQL o MySQL | PostgreSQL + Prisma | PostgreSQL 17 + Prisma. El datasource de Prisma declara provider PostgreSQL; no se encontró Supabase como servicio de base de datos ni MySQL como motor de persistencia vigente. |
| Colas | Redis/BullMQ en diseño inicial de la actividad | Redis + BullMQ | BullMQ usa PostgreSQL mediante createPostgresBackend y el esquema dedicado bullmq por defecto. Redis permanece como opción de compatibilidad si BULLMQ_BACKEND=redis; no es el backend de cola predeterminado. |
| Archivos | Supabase Storage / bucket privado | Almacenamiento privado local con adaptador | FileStoragePort permite almacenamiento local, Azure Blob Storage y Cloudflare R2/S3-compatible. El despliegue Azure documenta Azure Blob privado con Managed Identity. |
| OCR e IA | Gemini Flash como proveedor gratuito principal; Tesseract/PaddleOCR como alternativas | Gemini configurable y OCR local | Gemini se consume por REST desde el backend y está bloqueado por código en staging/production; Tesseract y Poppler se ejecutan localmente en el contenedor backend. La extracción de texto PDF y DOCX también usa procesamiento local. |
| Despliegue | MVP conectado y arquitectura de bajo costo | Docker y Docker Compose | Imágenes Docker multi-stage desplegadas en Azure Container Apps: gateway, API y worker separados, más un Container Apps Job para migraciones. PostgreSQL Flexible Server y Azure Blob Storage son servicios administrados externos. |

### Precisiones importantes

- Bun y Spring Boot pertenecen a las alternativas descritas en la propuesta inicial; no son las tecnologías que compilan ni ejecutan los repositorios actuales.
- Redis se encuentra en dependencias y en la ruta de compatibilidad, pero la configuración vigente de BullMQ usa PostgreSQL. No se debe dibujar Redis como dependencia obligatoria del entorno desplegado.
- La dependencia @aws-sdk/client-s3 sí tiene uso: implementa el adaptador Cloudflare R2/S3-compatible. No implica que el entorno Azure esté usando S3.
- La API de Gemini se invoca mediante fetch nativo; no se encontró un SDK de Gemini en las dependencias directas del backend.
- Tesseract y Poppler son ejecutables instalados en la imagen del backend, no servicios HTTP externos.
- CRUE, IPS receptoras, INS, SIAM/Casiopea y Red Data INS aparecen en los documentos de propuesta como actores o integraciones futuras. No se dibujan como sistemas conectados porque no se identificó un cliente/API de integración implementado para ellos en los repositorios revisados.

## 3. Inventario de dependencias comprobado

### Frontend — GODT-Frontend

| Grupo | Dependencias declaradas |
|---|---|
| Aplicación | Vue 3.5, Vue Router 4, Pinia 3 |
| HTTP | Axios 1.8 |
| Build | Vite 6, @vitejs/plugin-vue, vue-tsc |
| Tipado | TypeScript 5.8 |
| Estilos | Tailwind CSS 4 y @tailwindcss/vite |
| Ejecución del contenedor | Node 22 Alpine para compilar; Nginx 1.27 Alpine para servir estáticos y actuar como reverse proxy |

No hay SDK de OCR/IA ni claves de proveedor en el frontend. VITE_API_BASE_URL contiene la ruta pública de la API, normalmente /api/v1. El acceso autenticado se realiza contra el backend a través del mismo origen.

### Backend — GODT-B

| Grupo | Dependencias declaradas |
|---|---|
| Framework y API | NestJS 11, @nestjs/config, @nestjs/jwt, @nestjs/platform-express y @nestjs/swagger |
| Lenguaje y build | TypeScript 5.7, Nest CLI, ts-node |
| Persistencia | Prisma Client/CLI 6.19 y pg |
| Trabajos asíncronos | BullMQ 6.5; backend PostgreSQL predeterminado; ioredis para compatibilidad Redis |
| Validación | class-validator, class-transformer, AJV y ajv-formats |
| Archivos cloud | @azure/identity, @azure/storage-blob y @aws-sdk/client-s3 para adaptadores configurables |
| Seguridad | Argon2, JWT, cookie-parser y Helmet |
| Documentos | pdf-lib, archiver, adm-zip y Multer |
| OCR local y remoto | Tesseract/Poppler instalados en la imagen runtime; Gemini por REST nativo con fetch |

Los Dockerfiles de ambos repositorios usan Node 22 Alpine y npm ci. El frontend termina en Nginx; el backend genera targets runtime y migrator. No hay dependencia directa de Supabase, MySQL, Spring Boot ni Bun en los manifiestos revisados.

## 4. Diagrama de contexto

~~~mermaid
flowchart LR
  subgraph USERS["Usuarios del sistema"]
    COORD["Coordinador operativo<br/>COORDINATOR"]
    SURG["Cirujano de rescate<br/>SURGEON"]
    TECH["Técnico de tejidos<br/>TECHNICIAN"]
    ADMIN["Administrador / Calidad<br/>ADMIN"]
  end

  GODT["GODT Regional 3<br/>Gestión operativa y documental<br/>Frontend Vue 3 + Nginx<br/>Backend NestJS + Worker"]

  subgraph AZURE["Servicios de infraestructura Azure"]
    ACA["Azure Container Apps<br/>Gateway / API / Worker / Migrator"]
    PG[("Azure Database for PostgreSQL<br/>Flexible Server · PostgreSQL 17")]
    BLOB[("Azure Blob Storage<br/>Contenedor privado")]
    ACR[("Azure Container Registry<br/>Imágenes OCI")]
  end

  GEM["Google Gemini API<br/>Proveedor opcional de extracción<br/>Solo development/test si se habilita"]

  COORD -->|"HTTPS · navegador"| GODT
  SURG -->|"HTTPS · navegador"| GODT
  TECH -->|"HTTPS · navegador"| GODT
  ADMIN -->|"HTTPS · navegador"| GODT

  GODT -->|"TCP 5432 · PostgreSQL/TLS · Prisma y BullMQ"| PG
  GODT -->|"HTTPS 443 · Azure Storage SDK · Managed Identity"| BLOB
  GODT -.->|"HTTPS REST · generateContent · opcional y bloqueado en staging/production"| GEM
  ACA -.->|"Aloja los contenedores GODT"| GODT
  ACA -->|"HTTPS · pull de imágenes OCI · AcrPull"| ACR
~~~

**Límite de integración:** los archivos pueden consolidarse y descargarse desde GODT; no se representa una conexión automática con CRUE, IPS receptoras, INS, SIAM/Casiopea o Red Data INS porque no se encontró implementación de esos conectores en el código revisado.

## 5. Diagrama de contenedores y protocolos

~~~mermaid
flowchart TB
  BROWSER["Navegador institucional<br/>Vue SPA en el equipo del usuario"]

  subgraph ACA["Azure Container Apps Environment"]
    GATEWAY["godt-gateway<br/>Vue 3 + TypeScript + Vite<br/>Nginx 1.27 · puerto 80<br/>Ingress externo HTTPS"]
    API["godt-api<br/>NestJS 11 + Node 22<br/>REST /api/v1 · puerto 3000<br/>Ingress interno"]
    WORKER["godt-worker<br/>Mismo backend compilado<br/>dist/worker.js · sin ingress<br/>OCR y dossier asíncronos"]
    MIGRATOR["godt-migrator<br/>Target Docker migrator<br/>Prisma CLI + migraciones BullMQ<br/>Container Apps Job"]
  end

  subgraph DATA["Persistencia administrada"]
    PG[("Azure Database for PostgreSQL Flexible Server<br/>PostgreSQL 17<br/>schema public: Prisma<br/>schema bullmq: trabajos BullMQ")]
    BLOB[("Azure Blob Storage<br/>contenedor privado<br/>PDF / imágenes / archivos fuente")]
  end

  subgraph EXTERNAL["Servicios externos / herramientas"]
    GEM["Google Gemini API<br/>REST generateContent<br/>opcional, habilitación development/test"]
    ACR[("Azure Container Registry<br/>imágenes backend y gateway")]
  end

  subgraph LOCAL_OCR["Procesamiento dentro del worker"]
    EXTRACT["Extractores locales<br/>PDF text layer / DOCX OpenXML"]
    TESS["Tesseract OCR + Poppler<br/>binarios del contenedor"]
  end

  BROWSER -->|"HTTPS · carga SPA y navegación"| GATEWAY
  GATEWAY -->|"HTTPS/TLS · reverse proxy /api/v1 · FQDN interno ACA"| API

  API -->|"PostgreSQL wire protocol · TCP 5432/TLS · Prisma"| PG
  API -->|"PostgreSQL wire protocol · TCP 5432/TLS · productor BullMQ"| PG
  WORKER -->|"PostgreSQL wire protocol · TCP 5432/TLS · consumidor BullMQ y repositorios"| PG
  MIGRATOR -->|"PostgreSQL wire protocol · TCP 5432/TLS · Prisma + DDL BullMQ"| PG

  API -->|"HTTPS 443 · Azure Storage SDK · Managed Identity"| BLOB
  WORKER -->|"HTTPS 443 · Azure Storage SDK · Managed Identity"| BLOB

  WORKER -->|"Procesamiento local · archivos y texto"| EXTRACT
  WORKER -->|"Proceso local · CLI Tesseract/Poppler"| TESS
  WORKER -.->|"HTTPS REST · x-goog-api-key · solo si se habilita en development/test"| GEM

  ACR -->|"HTTPS · OCI image pull · AcrPull"| GATEWAY
  ACR -->|"HTTPS · OCI image pull · AcrPull"| API
  ACR -->|"HTTPS · OCI image pull · AcrPull"| WORKER
  ACR -->|"HTTPS · OCI image pull · AcrPull"| MIGRATOR
~~~

### Responsabilidad de los contenedores

| Contenedor | Responsabilidad | Entrada / salida |
|---|---|---|
| godt-gateway | Sirve el bundle estático Vue y reenvía /api/v1 al backend. Es el único ingreso público del diseño Azure. | Navegador por HTTPS; API por HTTPS interno. |
| godt-api | Controladores REST, autenticación/autorización, casos de uso, acceso a PostgreSQL y creación de trabajos. | Gateway por HTTPS interno; PostgreSQL y Blob por sus protocolos respectivos. |
| godt-worker | Consume trabajos persistidos de OCR y dossier; ejecuta OCR local o Gemini si está habilitado. | PostgreSQL BullMQ, Blob y, opcionalmente, Gemini. No expone HTTP. |
| godt-migrator | Ejecuta migraciones Prisma y esquema BullMQ en una etapa controlada previa al despliegue. | PostgreSQL; no atiende solicitudes de usuarios. |

### Servicios y adaptadores que no deben confundirse

- PostgreSQL es tanto la base relacional como el almacenamiento persistente de las colas BullMQ en el esquema bullmq.
- Azure Blob es el adaptador de archivos para el despliegue Azure. El código también contiene adaptadores local y Cloudflare R2/S3-compatible, seleccionados por STORAGE_PROVIDER.
- Redis no forma parte del flujo predeterminado de colas. Solo se selecciona mediante BULLMQ_BACKEND=redis.
- Gemini no es necesario para operar el flujo de ingesta: el backend cuenta con extracción PDF/DOCX, reglas locales y Tesseract para imágenes/PDF escaneados, sujeto a que sus binarios estén instalados y configurados.
- El frontend nunca llama directamente a Gemini ni recibe GEMINI_API_KEY.

## 6. Límites funcionales y de despliegue

1. El flujo de OCR parte de un proceso de donación existente y un SourceDocument asociado. La creación de proceso directamente desde una historia clínica se documentó como mejora futura, no como capacidad confirmada.
2. Los resultados OCR son candidatos. El sistema permite confirmarlos, modificarlos o rechazarlos; solo los valores ratificados deben alimentar el dato canónico.
3. La integración Gemini está bloqueada en staging y production por el adaptador. No enviar información clínica real a un proveedor externo sin autorización institucional.
4. Las integraciones directas con SIAM/Casiopea y Red Data INS pertenecen a fases futuras en los entregables iniciales.
5. La guía deploy/azure/README.md se sincronizó con el despliegue de demostración provisionado y validado en el entorno del proyecto. Sus comandos siguen siendo procedimientos de reconstrucción/actualización: antes de ejecutarlos, confirmar en Azure el estado de los recursos y las revisiones activas.

## 7. Decisiones arquitectónicas

- [ADR-001 — Lenguajes y frameworks del stack](adr/ADR-001-stack.md)
- [ADR-002 — PostgreSQL y plataforma Azure](adr/ADR-002-datos-y-despliegue.md)

## 8. Evidencia técnica del repositorio

- Frontend: [package.json](https://github.com/Edier64/GODT-Frontend/blob/main/package.json), [Dockerfile](https://github.com/Edier64/GODT-Frontend/blob/main/Dockerfile), [docker/nginx.conf](https://github.com/Edier64/GODT-Frontend/blob/main/docker/nginx.conf) y [vite.config.ts](https://github.com/Edier64/GODT-Frontend/blob/main/vite.config.ts).
- Backend: [package.json](../package.json), [Dockerfile](../Dockerfile), [docker-compose.local.yml](../docker-compose.local.yml), [prisma/schema.prisma](../prisma/schema.prisma) y [src/app.module.ts](../src/app.module.ts).
- Colas: src/infrastructure/runtime/bullmq-backend.ts y deploy/azure/README.md.
- OCR: src/application/ocr/document-understanding.service.ts, src/infrastructure/ocr/gemini-ocr.adapter.ts, src/infrastructure/ocr/tesseract-ocr.adapter.ts y src/infrastructure/ocr/ocr-worker.ts.
- Almacenamiento: src/infrastructure/documents/storage.module.ts, azure-blob-storage.adapter.ts y r2-storage.adapter.ts.
