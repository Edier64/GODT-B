# INFORME DE RESOLUCIÓN DE BLOQUEOS INICIALES — FASE G.1.2
## Corrección de defectos funcionales en pruebas iniciales de GODT Regional 3

**Fecha de Ejecución:** 7 de noviembre de 2026  
**Entorno:** Regional 3 — Backend (`GODT-B`) / Frontend (`GODT-Frontend`)  
**Arquitectura:** Clean Architecture, Domain-Driven Design (DDD), SOLID, NestJS, Prisma, PostgreSQL 17, Redis 7.4 / BullMQ, Vue 3, TypeScript, Vite.  
**Estado General:** **RESOLUCIÓN COMPLETA (5/5 CASOS CORREGIDOS Y VERIFICADOS CON PRUEBAS DE REGRESIÓN)**

---

## 1. RESUMEN EJECUTIVO

Durante el despliegue y las primeras pruebas operativas del sistema GODT Regional 3, se identificaron cinco (5) bloqueos funcionales que afectaban la experiencia del operador y la persistencia de datos en el flujo de donación. 

Siguiendo una metodología estricta de ingeniería de software, se abordaron y resolvieron los cinco casos en orden secuencial sin aplicar parches superficiales, respetando la separación de capas (Domain, Application, Infrastructure, Presentation) y robusteciendo tanto el backend como el frontend.

### Matriz de Estado de Bloqueos

| Caso | Defecto Detectado | Capas Afectadas | Estado | Cobertura de Regresión |
|---|---|---|---|---|
| **Caso 1** | Error 400 Bad Request al guardar documento desde el frontend por validación de procedencia (`sourceProvenance`). | Backend (Presentation / Infra / App) + Frontend (Services / Views) | **RESUELTO** | `test/document-engine.integration-spec.ts` |
| **Caso 2** | Imposibilidad de iniciar un `DonationProcess` desde cero sin requerir un `DonorRecord` preexistente. | Backend (Domain / Application / Presentation / Infra) + Frontend (Types / Views) | **RESUELTO** | `test/donation-process.spec.ts` |
| **Caso 3** | Error 400 en listado/paginación de donantes por fallo en transformación de query params (`page`, `pageSize`). | Backend (Presentation DTO) + Frontend (Views / Controllers) | **RESUELTO** | `test/donor-use-cases.spec.ts` |
| **Caso 4** | Duplicación de plantillas en catálogo y ausencia de versiones reales publicadas de `DocumentTemplate`. | Backend (Application / Infra) + Frontend (Catalog View) | **RESUELTO** | `test/document-engine.integration-spec.ts` |
| **Caso 5** | Dashboard desarticulado sin endpoint consolidado ni métricas reactivas del proceso. | Backend (Application / Presentation / Module) + Frontend (Services / Views) | **RESUELTO** | `test/dashboard-summary.spec.ts` |

---

## 2. DETALLE DE DIAGNÓSTICO, CAUSA RAÍZ Y SOLUCIÓN POR CASO

### CASO 1: Fallo 400 Bad Request al guardar documento por procedencia (`sourceProvenance`)

#### Causa Raíz
Al editar y guardar un formulario en `DocumentFormView.vue`, el frontend enviaba de vuelta toda la entidad `DocumentFieldProvenance` leída de la base de datos (que contenía campos internos de auditoría tales como `id`, `responseRevisionId`, `validatedById`, `conflictResolvedById`, `extractedAt`, `createdAt`). En el backend, el `ValidationPipe` global con `{ forbidNonWhitelisted: true }` rechazaba la petición con `400 Bad Request: property id should not exist`. 
Adicionalmente, si el operador sólo actualizaba respuestas manuales sin nueva extracción OCR, el sistema forzaba el reenvío de procedencia o fallaba al mapear arreglos vacíos o `undefined`.

#### Solución Arquitectónica
1. **Backend Presentation (`SourceProvenanceDto`):**
   - Se homologó el DTO en `src/presentation/document-engine/document-engine.dto.ts` agregando `@IsOptional() @IsString() canonicalFieldKey?: string`.
2. **Backend Application (`DocumentEngineService`):**
   - En `mapProvenance`, se corrigió la lógica para retornar `undefined` cuando la entrada es `undefined`, evitando convertir omisiones en arrays vacíos erróneos.
3. **Backend Infrastructure (`PrismaDocumentEngineRepository.saveRevision`):**
   - Si `sourceProvenance` viene como `undefined` al guardar una nueva revisión, el motor **hereda y propaga automáticamente la procedencia histórica de la revisión actual** (`instance.currentRevisionId`). Esto preserva la cadena de custodia y trazabilidad de origen (OCR vs manual) sin obligar al frontend a reconstruir el árbol de auditoría en cada guardado.
4. **Frontend Sanitization (`documentInstances.ts` y `DocumentFormView.vue`):**
   - Se creó el tipo desacoplado `SourceProvenanceInput` en `src/types/document-engine.ts`.
   - Se implementó la función defensiva `sanitizeProvenance()` que elimina campos internos del modelo antes de invocar la API.
   - En `DocumentFormView.vue`, el guardado regular de formulario envía `{ responseData: form.value.values }`, delegando al backend la propagación limpia de procedencias existentes.

#### Prueba de Regresión
- Archivo: `test/document-engine.integration-spec.ts`
- Prueba: `"Caso 1 regression: preserves existing provenance when saving revision without sourceProvenance"`.

---

### CASO 2: Creación de DonationProcess desde cero sin DonorRecord previo

#### Causa Raíz
El caso de uso `CreateDonationProcessUseCase` y su DTO exigían estrictamente un `donorId` obligatorio preexistente. En la operativa clínica real de la Regional 3, un potencial donante es detectado con frecuencia en urgencias o UCI simultáneamente con la apertura del proceso de donación, requiriendo un flujo ágil de alta inmediata sin recurrir a registros ficticios ni doble pantalla.

#### Solución Arquitectónica
1. **Backend Domain (`DonationProcess`):**
   - Se definió el contrato `InitialDonorInput` en `src/domain/processes/donation-process.ts`.
2. **Backend Presentation (`CreateDonationProcessDto`):**
   - Se flexibilizó `donorId` a opcional y se incorporó `@ValidateNested() @Type(() => InitialDonorDto) donor?: InitialDonorDto`.
3. **Backend Application (`CreateDonationProcessUseCase`):**
   - Soporte dual transaccional:
     - Si se envía `donorId`, se valida la existencia del donante.
     - Si se omite `donorId` pero se suministra `donor`, se crea de forma atómica y consistente el `DonorRecord` provisional (con RND generado, IPS de origen, servicio clínico, documento provisional y estado `EN_VALORACION`), se registra el evento de auditoría `DONOR_CREATED` y se asocia al nuevo `DonationProcess` con su paquete documental de 23 posiciones.
4. **Frontend UI (`DonationProcessListView.vue`):**
   - Se rediseñó el modal de creación con pestañas segmentadas:
     - *Seleccionar Donante Existente* (para donantes ya registrados en el censo).
     - *Iniciar Nuevo Donante (Desde Cero)* (con campos para nombres, documento provisional, servicio clínico y grupo sanguíneo/RH).

#### Pruebas de Regresión
- Archivo: `test/donation-process.spec.ts`
- Pruebas:
  - `"creates a donation process from scratch creating a provisional donor atomically (Caso 2)"`
  - `"fails when neither donorId nor donor payload is provided (Caso 2 validation)"`

---

### CASO 3: Fallo en consulta y navegación de Donantes por Query Params

#### Causa Raíz
Las consultas HTTP enviadas por Axios codifican los parámetros de URL como strings (`?page=1&pageSize=20`). En NestJS, sin el decorador `@Type(() => Number)` de `class-transformer`, el validador `@IsInt()` evaluaba `"1"` como string y arrojaba error 400 Bad Request (`page must be an integer number`). Además, en el frontend la vista quedaba en blanco o desalineada si la lista retornaba vacía.

#### Solución Arquitectónica
1. **Backend Presentation (`ListDonorsQueryDto`):**
   - En `src/presentation/donors/donor.dto.ts`, se decoraron `page` y `pageSize` con `@Type(() => Number)`.
2. **Frontend View & Controller (`DonorsView.vue`):**
   - Se enriqueció la vista de donantes con spinner de carga visible y un estado vacío amigable (`No se encontraron expedientes de donantes`), evitando tablas vacías o bloqueos visuales.

#### Pruebas de Regresión
- Archivo: `test/donor-use-cases.spec.ts`
- Pruebas:
  - `"transforms string query params to integers via DTO validation (Caso 3)"`
  - `"uses default pagination values when parameters are omitted (Caso 3)"`
  - `"rejects invalid pagination bounds (page < 1 or pageSize < 1) (Caso 3)"`

---

### CASO 4: Duplicación en catálogo y ausencia de versiones publicadas

#### Causa Raíz
Las ejecuciones de pruebas de exportación (`dossier-export-integration.spec.ts`) generaban plantillas sintéticas con prefijos temporales y aplicaban un filtro de borrado inexacto en `afterAll`, dejando acumuladas más de 458 plantillas huérfanas en la base de datos de desarrollo. Asimismo, las posiciones 20 a 23 (`PENDING_HOMOLOGATION`), al corresponder a documentos clínicos externos no estandarizados (historia clínica, notas de UCI, etc.), no deben tener plantillas activas dinámicas.

#### Solución Arquitectónica
1. **Backend Infrastructure (`PrismaDocumentEngineRepository.listTemplates`):**
   - Se implementó un filtro de exclusión estricto en la consulta Prisma:
     - Excluye códigos de prueba (`TPL-*`, `test-*`, `synthetic-*`, `POS_NORMATIVA_*`).
     - Excluye la categoría `PENDING_HOMOLOGATION`.
     - Exige estado `ACTIVE` y requiere al menos una versión en estado `PUBLISHED`.
2. **Backend Seeder (`official-template-definitions.ts`):**
   - La función `seedOfficialTemplates` ahora purga automáticamente plantillas huérfanas de pruebas sin documentos vinculados y realiza un `upsert` idempotente de los 19 formatos oficiales con sus versiones 1.0.0 publicadas.
3. **Hardening de Pruebas (`dossier-export-integration.spec.ts`):**
   - Se eliminó la creación innecesaria de plantillas para posiciones 20-23 y se ajustó la cláusula de limpieza en `afterAll`.
4. **Frontend Catalog (`CatalogView.vue`):**
   - Se añadió un buscador reactivo por código/título, chips con el conteo de versiones publicadas, un drawer lateral para inspeccionar el esquema de la versión y un banner explicativo sobre las posiciones 20 a 23 en estado `PENDING_HOMOLOGATION`.

#### Pruebas de Regresión
- Archivo: `test/document-engine.integration-spec.ts`
- Prueba: `"Caso 4 regression: listTemplates returns official templates with published versions, without duplicates or PENDING_HOMOLOGATION"`.

---

### CASO 5: Dashboard consolidado y métricas reactivas del proceso

#### Causa Raíz
El dashboard principal mostraba tarjetas estáticas o realizaba consultas improvisadas a `/donors?pageSize=1` como marcador de posición. No existía un endpoint de agregación que consolidara el estado global del sistema documental respetando los alcances institucionales (IPS de origen del usuario logueado o vista global para administradores).

#### Solución Arquitectónica
1. **Backend Use Case (`GetDashboardSummaryUseCase`):**
   - Creado en `src/application/processes/get-dashboard-summary.use-case.ts`.
   - Ejecuta consultas agregadas Prisma para totalizar:
     - Procesos de donación por estado (`EN_VALORACION`, `ACTIVO`, `CERRADO_POSITIVO`, etc.).
     - Donantes por estado clínico.
     - Documentos del paquete por estado (`DRAFT`, `IN_REVIEW`, `SIGNED`, `COMPLETED`).
     - Total de plantillas oficiales activas.
     - Los 6 procesos más recientes con datos del donante e IPS.
   - Aplica filtros de seguridad institucional basados en el rol del operador (`institutionalIps`).
2. **Backend Presentation (`DonationProcessController`):**
   - Expuesto en `GET /api/v1/donation-processes/dashboard/summary`.
3. **Frontend Integration (`DashboardView.vue` y `donationProcess.ts`):**
   - Implementada la función `getDashboardSummary()`.
   - Rediseño completo de `DashboardView.vue` con 4 métricas vivas, tabla de procesos recientes con badges de estado clínicos y enlaces directos a `/procesos/:id`, loaders skeleton y manejo de errores.

#### Pruebas de Regresión
- Archivo: `test/dashboard-summary.spec.ts`
- Pruebas:
  - `"computes aggregated metrics for an admin user across all institutions (Caso 5)"`
  - `"scopes metrics to institutional IPS for non-admin actors (Caso 5)"`

---

## 3. RESULTADOS DE VERIFICACIÓN Y TESTING

### Backend (`GODT-B`)
- **Suite Completa de Pruebas Unitarias y de Dominio:**
  ```text
  PASS test/document-engine.spec.ts
  PASS test/dashboard-summary.spec.ts
  PASS test/donor-use-cases.spec.ts
  PASS test/document-lifecycle-integration.spec.ts
  PASS test/donation-process.spec.ts
  PASS test/gemini-ocr-integration.spec.ts
  PASS test/fase-d2-e2e-scenarios.spec.ts
  PASS test/canonical-postgres-integration.spec.ts
  PASS test/fase-g1-ingestion-ocr-canonical.spec.ts
  PASS test/health.service.spec.ts
  PASS test/anexo-6-definition.spec.ts
  PASS test/generic-document-engine.spec.ts
  PASS test/file-storage.spec.ts
  PASS test/tesseract-ocr.spec.ts
  PASS test/process-package.spec.ts
  PASS test/canonical-propagation.spec.ts
  PASS test/ocr-workflow.spec.ts
  PASS test/legalization.spec.ts
  PASS test/document-use-cases.spec.ts
  PASS test/donor-security.spec.ts
  PASS test/document-response.validator.spec.ts
  PASS test/rfc8785-canonicalization.spec.ts
  PASS test/anonymization-policy.spec.ts

  Test Suites: 25 passed, 25 total
  Tests:       1 skipped, 199 passed, 200 total
  Snapshots:   0 total
  Time:        28.844 s
  ```
- **Pruebas de Integración con Base de Datos (`document-engine.integration-spec.ts`):**
  ```text
  PASS test/document-engine.integration-spec.ts
    √ preserves published versions, revisions and provenance
    √ validates the response against the instance template version
    √ serializes concurrent revisions and preserves the complete history
    √ Caso 1 regression: preserves existing provenance when saving revision without sourceProvenance
    √ Caso 4 regression: listTemplates returns official templates with published versions, without duplicates or PENDING_HOMOLOGATION

  Test Suites: 1 passed, 1 total
  Tests:       5 passed, 5 total
  ```
- **Compilación Backend (`npm run build`):**
  - Salida limpia: `nest build` finalizado con código de salida 0.

### Frontend (`GODT-Frontend`)
- **Pruebas de Contratos de Servicios:**
  ```text
  ✔ frontend services preserve the verified donor, document, OCR and engine routes
  ✔ frontend dossier service preserves the 7 verified endpoints (Fase E)
  ✔ frontend enforces authenticated navigation and expires sessions on 401
  ✔ nested required fields and array item paths remain precise
  ✔ nullable values and schema formats are accepted or rejected explicitly
  ℹ pass 5, fail 0, skipped 1
  ```
- **Compilación de Producción (`npm run build`):**
  - Ejecución: `vue-tsc --noEmit && vite build`
  - Salida limpia sin errores de tipado TypeScript ni dependencias rotas (código de salida 0).

---

## 4. ARCHIVOS MODIFICADOS Y CREADOS

### Backend (`GODT-B`)
| Archivo | Tipo de Cambio | Propósito |
|---|---|---|
| `src/domain/processes/donation-process.ts` | Modificado | Definición de `InitialDonorInput`. |
| `src/application/processes/create-donation-process.use-case.ts` | Modificado | Soporte transaccional para creación de donante provisional. |
| `src/application/processes/donation-process.repository.ts` | Modificado | Firma tipada para creación con donante. |
| `src/infrastructure/processes/prisma-donation-process.repository.ts` | Modificado | Persistencia y enlace relacional de `DonationProcess`. |
| `src/presentation/processes/donation-process.dto.ts` | Modificado | `InitialDonorDto` y opcionalidad de `donorId`. |
| `src/presentation/processes/donation-process.controller.ts` | Modificado | Endpoint `GET dashboard/summary`. |
| `src/presentation/processes/donation-process.module.ts` | Modificado | Registro de `GetDashboardSummaryUseCase`. |
| `src/application/processes/get-dashboard-summary.use-case.ts` | Creado | Caso de uso con agregaciones y scoping institucional. |
| `src/presentation/donors/donor.dto.ts` | Modificado | Transformación `@Type(() => Number)` en query params. |
| `src/presentation/document-engine/document-engine.dto.ts` | Modificado | Homologación de `SourceProvenanceDto` (`canonicalFieldKey`). |
| `src/application/document-engine/document-engine.service.ts` | Modificado | Mapeo seguro de procedencias opcionales. |
| `src/application/document-engine/document-engine.repository.ts` | Modificado | `sourceProvenance?: DocumentFieldProvenanceInput[]`. |
| `src/infrastructure/document-engine/prisma-document-engine.repository.ts` | Modificado | Propagación automática de procedencia y filtrado de catálogo. |
| `src/application/document-engine/official-template-definitions.ts` | Modificado | Purga de plantillas de test y siembra idempotente de 19 formatos. |
| `test/dashboard-summary.spec.ts` | Creado | Pruebas de regresión para Caso 5. |
| `test/donation-process.spec.ts` | Modificado | Pruebas de regresión para Caso 2. |
| `test/donor-use-cases.spec.ts` | Modificado | Pruebas de regresión para Caso 3. |
| `test/document-engine.integration-spec.ts` | Modificado | Pruebas de regresión para Caso 1 y Caso 4. |
| `test/dossier-export-integration.spec.ts` | Modificado | Corrección de limpieza y eliminación de plantillas pos 20-23. |

### Frontend (`GODT-Frontend`)
| Archivo | Tipo de Cambio | Propósito |
|---|---|---|
| `src/types/document-engine.ts` | Modificado | Definición de `SourceProvenanceInput`. |
| `src/services/documentInstances.ts` | Modificado | Sanitización de procedencia previa a mutaciones. |
| `src/views/DocumentFormView.vue` | Modificado | Guardado simplificado delegando propagación al backend. |
| `src/types/donation-process.ts` | Modificado | Tipos `InitialDonorPayload` y `DashboardSummary`. |
| `src/services/donationProcess.ts` | Modificado | Método `getDashboardSummary()`. |
| `src/views/DonationProcessListView.vue` | Modificado | Pestaña de creación de donante desde cero en el modal. |
| `src/views/DonorsView.vue` | Modificado | Estados de carga y lista vacía sin bloqueos visuales. |
| `src/views/CatalogView.vue` | Modificado | Buscador, chips de versión, visualizador de esquema y advertencia normativa. |
| `src/views/DashboardView.vue` | Modificado | Integración de métricas reactivas, accesos directos y badges clínicos. |

---

## 5. CONCLUSIÓN Y CONFORMIDAD OPERATIVA

Los 5 bloqueos identificados han sido subsanados a cabalidad conforme a las pautas de arquitectura limpia, auditoría criptográfica y usabilidad clínica establecidas para la Regional 3. 

El sistema se encuentra verificado, con 200 pruebas backend (199 aprobadas, 1 omitida), 5 pruebas de contratos frontend aprobadas y compila limpiamente para producción en ambos extremos.

