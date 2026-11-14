# GODT REGIONAL 3 — FASE F
## AUDITORÍA DE INFRAESTRUCTURA Y COMPONENTES TÉCNICOS
### Documento de Entrega Técnica: FASE_F_INFRASTRUCTURE_AUDIT.md

---

## 1. RESUMEN EJECUTIVO

El presente informe constituye la auditoría técnica exhaustiva de la infraestructura de soporte, dependencias, motores de persistencia, colas asíncronas y almacenamiento privado para el sistema **GODT Regional 3** (Gestión Operativa de Donación y Trasplantes).

GODT Regional 3 implementa una arquitectura desacoplada basada en Clean Architecture y Domain-Driven Design (DDD):
- **Backend:** NestJS 11, TypeScript 5.7, Node.js 20+ LTS, Prisma ORM 6.4, PostgreSQL 16, Redis 7 con BullMQ 6.
- **Frontend:** Vue 3.5, TypeScript 5.8, Vite 6, Pinia 3, Axios y Tailwind CSS 3.4.

---

## 2. INVENTARIO DEL RUNTIME Y DEPENDENCIAS

### 2.1 Entorno de Ejecución (Node.js & TypeScript)
- **Node.js:** Compatible con versiones LTS activas: Node.js 18.x, 20.x y 22.x (auditado en Node.js v20.12.2 / v22.x).
- **TypeScript:** v5.7.3 (Backend) / v5.8.2 (Frontend) con compilación estricta (`strict: true`, `noImplicitAny: true`, `strictNullChecks: true`).
- **Manejador de Paquetes:** npm v10+.

### 2.2 Dependencias Principales Backend (`GODT-B`)
| Componente / Librería | Versión | Rol Arquitectónico | Estado de Licencia |
| :--- | :--- | :--- | :--- |
| `@nestjs/core`, `@nestjs/common` | ^11.0.1 | Framework base modular HTTP y DI | MIT |
| `@prisma/client`, `prisma` | ^6.4.1 | ORM y generador de cliente SQL tipado | Apache-2.0 |
| `ioredis` | ^5.6.1 | Cliente Redis robusto con soporte de reconexión y TLS | MIT |
| `bullmq` | ^6.5.3 | Cola asíncrona distribuida para procesamiento de expedientes | MIT |
| `pdf-lib` | ^1.17.9 | Renderizador y ensamblador vectorial de PDFs sin headless browser | MIT |
| `archiver` | ^7.0.1 | Empaquetador ZIP en streaming con hashes SHA-256 | MIT |
| `yauzl` | ^3.2.0 | Descompresor ZIP en streaming con protección contra ZIP bombs | MIT |
| `bcrypt` | ^5.1.1 | Hash criptográfico de credenciales con salt rounds 10 | MIT |
| `jsonwebtoken` | ^9.0.2 | Generación y verificación de tokens JWT HMAC-SHA256 | MIT |
| `helmet` | ^8.1.0 | Cabeceras de seguridad HTTP | MIT |
| `class-validator`, `class-transformer` | ^0.14.1 | Validación de esquemas DTO y sanitización | MIT |

### 2.3 Dependencias Principales Frontend (`GODT-Frontend`)
| Componente / Librería | Versión | Rol Arquitectónico |
| :--- | :--- | :--- |
| `vue` | ^3.5.13 | Framework reactivo de UI |
| `pinia` | ^3.0.1 | Gestión de estado reactivo desacoplado |
| `vue-router` | ^4.5.0 | Enrutador SPA con guards de autenticación |
| `axios` | ^1.8.1 | Cliente HTTP tipado con interceptores de autenticación y refresco |
| `lucide-vue-next` | ^0.477.0 | Iconografía institucional coherente |
| `tailwindcss` | ^3.4.17 | Motor de estilos utilitarios con paleta clínica Regional 3 |

---

## 3. MOTOR DE PERSISTENCIA RELACIONAL: POSTGRESQL 16 & PRISMA ORM

### 3.1 Historial de Migraciones de Base de Datos
El sistema cuenta con **15 migraciones versionadas y aplicadas** sin truncamiento ni reinicio destructivo:

| # | Migración | Entidades Afectadas | Propósito Funcional |
| :--- | :--- | :--- | :--- |
| 1 | `20261029053351_init_donation_process` | `DonationProcess`, `Hospital`, `Alert` | Fase A: Agregado inicial del proceso de donación |
| 2 | `20261029191024_add_process_package` | `ProcessPackage`, `DocumentSlot` | Fase B: Paquete documental de 23 posiciones |
| 3 | `20261030045435_add_canonical_data` | `DonationProcess.canonicalData` | Fase C: Almacén canónico JSON unificado |
| 4 | `20261030174026_canonical_enhancements` | Índices GIN y restricciones | Fase C.1: Optimización de consultas canónicas |
| 5 | `20261101000000_add_process_participants` | `ProcessParticipant` | Fase D: Modelo de participantes del proceso |
| 6 | `20261102000000_add_generated_pdf_documents` | `GeneratedPdfDocument` | Fase D: Almacén de PDFs generados con hash SHA-256 |
| 7 | `20261103000000_add_document_snapshots` | `DocumentSnapshot` | Fase D: Inmutabilidad de datos y hashes |
| 8 | `20261104000000_add_document_signatures` | `DocumentSignature` | Fase D: Atestaciones y firmas electrónicas |
| 9 | `20261105000000_add_custody_events` | `CustodyEvent` | Fase D: Bitácora de cadena de custodia |
| 10 | `20261106000000_add_source_documents` | `SourceDocument` | Fase D.1: Documentos fuente clínicos anexos |
| 11 | `20261106040000_add_participant_roles` | Enums de rol clínico | Fase D.1: Roles tipados de participantes |
| 12 | `20261106080000_add_document_versions` | `DocumentVersion` | Fase D.2: Versionado documental explícito |
| 13 | `20261107000000_add_process_dossier_exports` | `ProcessDossierExport` | Fase E: Modelo del expediente consolidado |
| 14 | `20261107040000_add_worker_lease_and_heartbeat` | Campos de control de workers | Fase E.1: Concurrencia BullMQ, lease y heartbeat |
| 15 | `20261107080000_add_canonical_manifest_digest` | `manifestDigest`, `canonicalSha256` | Fase E.1.1: Manifiesto canónico RFC 8785 |

### 3.2 Política de Integridad Relacional
- **Cero operaciones destructivas:** Ninguna migración contiene `DROP TABLE`, `DROP COLUMN` de datos en uso ni eliminación de restricciones de clave foránea.
- **Cascadas controladas:** Eliminaciones en cascada restringidas a tablas puramente hijas de ciclo de vida (`DocumentSnapshot`, `DocumentSignature`), preservando la trazabilidad de `DonationProcess`.

---

## 4. MENSAJERÍA ASÍNCRONA: REDIS 7 & BULLMQ 6

### 4.1 Arquitectura de Procesamiento Asíncrono
Para evitar el bloqueo del event-loop de Node.js durante la consolidación de PDFs de hasta 23 posiciones y compresión ZIP, las tareas de exportación se procesan mediante **BullMQ**:
- **Nombre de Cola:** `dossier-exports`
- **Concurrencia por Worker:** 2 tareas concurrentes (configurable vía `DOSSIER_CONCURRENCY`).
- **Heartbeat Dinámico:** Cada worker emite un pulso cada 15 segundos (`lastHeartbeatAt`) durante la consolidación.
- **Lease Timeout:** Si una tarea permanece en estado `PROCESSING` sin pulso por más de 60 segundos (`STALL_TIMEOUT_MS = 60000`), el supervisor de recuperación (`recoverOrphanExports`) la reclama de forma atómica.
- **Unicidad de Worker ID:** Cada instancia genera un identificador único compuesto:
  ```typescript
  `${INSTANCE_ID}-${process.pid}-${randomBytes(4).toString("hex")}`
  ```
  Esto previene colisiones incluso cuando múltiples pods de Kubernetes o contenedores Docker comparten una misma variable de entorno `INSTANCE_ID`.

### 4.2 Aislamiento de Fallback en Producción
Se implementa una compuerta estricta de seguridad:
- La cola en memoria para desarrollo (`ENABLE_IN_MEMORY_QUEUE_FALLBACK=true`) **solo** puede operar si `NODE_ENV === "development"` o `NODE_ENV === "test"`.
- En entornos `production` o `staging`, si Redis no está disponible, el sistema **rechaza la solicitud con código 503 Service Unavailable** y emite una alerta crítica en los logs, impidiendo la pérdida silenciosa de tareas en memoria efímera.

---

## 5. ALMACENAMIENTO PRIVADO DE DOCUMENTOS

### 5.1 Estrategia de Almacenamiento
El sistema soporta dos adaptadores mediante la interfaz `PrivateStorageAdapter`:
1. **`LocalPrivateStorageAdapter`:** Almacenamiento en disco local seguro (`STORAGE_BASE_PATH`), utilizado en entornos locales, pruebas y arquitecturas con volúmenes montados persistentes (PV/PVC).
2. **`CloudflareR2PrivateStorageAdapter`:** Almacenamiento de objetos compatible con Amazon S3 / Cloudflare R2 vía credenciales privadas (`R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`).

### 5.2 Estructura Jerárquica de Almacenamiento
```
storage/
└── donations/
    └── {donationProcessId}/
        ├── documents/
        │   └── {documentCode}/
        │       ├── v1_{documentPdfSha256}.pdf
        │       └── v2_{documentPdfSha256}.pdf
        ├── sources/
        │   └── {sourceDocumentId}_{originalFileName}
        └── dossier/
            └── {exportId}/
                ├── dossier_{processNumber}_{exportId}.pdf
                ├── dossier_{processNumber}_{exportId}.zip
                └── manifest_{exportId}.json
```

### 5.3 Controles de Acceso y Aislamiento
- **Sin acceso web directo:** Ningún archivo dentro de `storage/` es servido como recurso estático por Nginx o NestJS.
- **Descargas controladas:** Todo acceso requiere autenticación JWT con alcance verificado de la IPS participante o rol de Coordinación Regional.
- **Streaming Seguro:** Los archivos se transmiten por tubería (`fs.createReadStream`) calculando el digest SHA-256 en vuelo sin cargar archivos gigantescos en la memoria RAM.

---

## 6. MATRIZ DE VARIABLES DE ENTORNO

| Variable | Tipo | Requerida en Prod | Propósito | Regla de Validación |
| :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | String | Sí | Entorno de ejecución | `production`, `staging`, `test`, `development` |
| `PORT` | Number | No (Default 3000) | Puerto HTTP del backend | Entre 1024 y 65535 |
| `DATABASE_URL` | String | Sí | Cadena de conexión PostgreSQL | Formato `postgresql://user:pass@host:5432/db` |
| `REDIS_HOST` | String | Sí | Host de Redis | Nombre DNS o IP resoluble |
| `REDIS_PORT` | Number | Sí | Puerto de Redis | Default 6379 |
| `REDIS_PASSWORD` | String | Sí (en Prod) | Contraseña Redis | Longitud $\ge 16$ caracteres |
| `JWT_SECRET` | String | Sí | Firma de tokens JWT | **Mínimo 32 caracteres; rechaza claves por defecto** |
| `JWT_EXPIRES_IN` | String | No | Tiempo de vida del JWT | Formato time-span (ej. `8h`, `12h`) |
| `STORAGE_BASE_PATH` | Path | Sí | Ruta raíz de almacenamiento | Directorio con permisos `0700` (`rwx------`) |
| `ENABLE_IN_MEMORY_QUEUE_FALLBACK` | Boolean | Sí | Fallback de cola | **Debe ser `false` en producción** |
| `CORS_ORIGIN` | String | Sí | Orígenes frontend permitidos | URLs exactas (ej. `https://godt.regional3.gov.co`) |
| `SWAGGER_ENABLED` | Boolean | No | Documentación OpenAPI | **Debe ser `false` en producción** |

---

## 7. DICTAMEN DE AUDITORÍA DE INFRAESTRUCTURA

El sistema cuenta con una arquitectura de persistencia, colas y almacenamiento desacoplada, observable y resistente a fallos. Cumple los estándares exigidos para la operación del proceso piloto en la Regional 3.
