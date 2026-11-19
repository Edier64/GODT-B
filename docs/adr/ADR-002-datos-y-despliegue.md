# ADR-002 — PostgreSQL y plataforma de despliegue Azure

- **Estado:** Aceptada
- **Fecha:** 14 de noviembre de 2026
- **Ámbito:** Persistencia, colas, almacenamiento de archivos y ejecución cloud
- **Decisión:** PostgreSQL como base relacional y BullMQ sobre PostgreSQL; Azure Container Apps para ejecutar los contenedores y Azure Blob Storage privado para archivos en el despliegue Azure.

## 1. Contexto

GODT conserva expedientes de donantes, procesos, instituciones, participantes, documentos fuente, candidatos OCR, versiones documentales, eventos de auditoría y paquetes consolidados. También necesita almacenar estructuras variables asociadas a formularios y procesar trabajos de OCR y exportación sin mantener la solicitud HTTP abierta.

El Módulo 2 propuso Supabase/PostgreSQL o MySQL y almacenamiento de objetos. El Módulo 3 describió PostgreSQL con Prisma y Redis/BullMQ. El código actual fija PostgreSQL en Prisma y utiliza el backend PostgreSQL de BullMQ. Para el despliegue Azure, los archivos se guardan en Azure Blob privado mediante identidad administrada.

## 2. Alternativas consideradas

1. **PostgreSQL administrado + Prisma + Azure Container Apps + Azure Blob Storage:** opción implementada y documentada para el despliegue Azure.
2. **Supabase como plataforma de base de datos y storage:** alternativa del diseño inicial; no es el proveedor activo de la base de datos en el despliegue actual.
3. **MySQL:** alternativa de compatibilidad contemplada en el documento inicial, pero no soportada por el schema Prisma actual, cuyo provider es postgresql.
4. **PostgreSQL + Redis para BullMQ:** arquitectura descrita en el reporte inicial del Módulo 3. Se dejó de usar como backend predeterminado de colas.
5. **Almacenamiento local o S3-compatible/R2:** adaptadores existentes para otros entornos; el despliegue Azure utiliza Azure Blob.
6. **Microservicios independientes desde el inicio:** se mantiene un backend modular, con procesos API y worker separados al desplegar, pero que comparten el código y la imagen backend.

## 3. Decisión

### Base de datos y colas

- PostgreSQL 17 es el motor relacional.
- Prisma ORM administra el acceso tipado y las migraciones del esquema de aplicación.
- Los datos de aplicación viven en el esquema relacional administrado por Prisma.
- BullMQ usa createPostgresBackend y un esquema PostgreSQL dedicado llamado bullmq. La configuración predeterminada es BULLMQ_BACKEND=postgres.
- Redis queda como alternativa retrocompatible mediante BULLMQ_BACKEND=redis; no se requiere para el despliegue predeterminado.
- Los archivos binarios no se guardan como BLOB en tablas de aplicación: se conserva su storage key y metadata/hash en la base de datos.

### Plataforma de despliegue y archivos

- Azure Container Apps ejecuta cuatro roles: gateway, API, worker y migrator Job.
- El gateway Nginx es el ingreso externo HTTPS y reenvía /api/v1 al FQDN interno de la API.
- La API NestJS usa ingress interno; el worker no expone ingress HTTP.
- El migrator ejecuta Prisma y DDL de BullMQ en una etapa controlada antes de API/worker.
- Azure Container Registry almacena las imágenes.
- Azure Blob Storage mantiene el contenedor privado y el backend accede por Azure Storage SDK con DefaultAzureCredential/Managed Identity cuando está configurado AZURE_STORAGE_ACCOUNT_URL.
- Para desarrollo local se conserva almacenamiento privado local. El adaptador R2/S3-compatible es una opción configurable, no el almacenamiento activo de Azure.

## 4. Justificación

- **Integridad relacional:** los procesos, donantes, documentos, participantes y eventos de auditoría requieren relaciones, restricciones y transacciones.
- **Estructuras variables:** los campos JSON del dominio documental pueden variar por plantilla y versión sin convertir cada atributo en una columna independiente.
- **Unificación de infraestructura de estado:** BullMQ sobre PostgreSQL evita mantener Redis como recurso obligatorio adicional y conserva trabajos persistentes en la misma plataforma de datos.
- **Separación de binarios:** Blob Storage guarda archivos fuera de las tablas transaccionales; PostgreSQL mantiene referencias, estado y hashes.
- **Seguridad:** el almacenamiento Azure usa contenedor privado y Managed Identity en vez de una clave compartida embebida en la imagen.
- **Escalado por responsabilidad:** gateway, API y worker pueden actualizarse y tener políticas de réplica separadas.

## 5. Consecuencias

### Positivas

- Una base relacional para datos de dominio y cola persistente.
- Menos componentes obligatorios en el despliegue al no requerir Redis por defecto.
- API no expuesta directamente a Internet; el gateway funciona como punto de entrada.
- Los archivos binarios se conservan en almacenamiento privado y su integridad se registra mediante SHA-256.
- El worker puede ejecutar OCR y generación de dossier sin bloquear las solicitudes de la API.

### Costos y limitaciones

- PostgreSQL es una dependencia crítica tanto para los datos como para la cola BullMQ; debe monitorizarse su capacidad y número de conexiones.
- Las migraciones de Prisma y BullMQ deben ejecutarse en el migrator y no simultáneamente en varias réplicas.
- La capacidad de Azure Blob y sus permisos dependen de la configuración de Managed Identity y del contenedor privado.
- Los adaptadores Local y R2/S3 deben probarse por separado cuando se seleccionen; su existencia en código no significa que estén activos en Azure.
- Gemini es un proveedor externo opcional, no una dependencia de persistencia. El adaptador actual lo bloquea en staging y production, por lo que no debe incluirse como requisito del flujo productivo hasta contar con aval institucional.

## 6. Evidencia

- Base de datos: prisma/schema.prisma y package.json.
- BullMQ: src/infrastructure/runtime/bullmq-backend.ts y deploy/azure/README.md.
- Storage: src/infrastructure/documents/storage.module.ts, azure-blob-storage.adapter.ts, local-private-storage.adapter.ts y r2-storage.adapter.ts.
- Contenedores: Dockerfile de backend, Dockerfile de frontend y docker-compose.local.yml.
- Plataforma: deploy/azure/README.md y workflows de GitHub Actions OIDC.
