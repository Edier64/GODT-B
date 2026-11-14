# INFORME TÉCNICO FASE E — CONSOLIDACIÓN, EXPORTACIÓN Y VERIFICACIÓN CRIPTOGRÁFICA DEL EXPEDIENTE DOCUMENTAL COMPLETO (GODT REGIONAL 3)

**Fecha:** 2026-11-07  
**Fase:** Fase E — Consolidación y Exportación del Expediente Documental Completo  
**Estado:** IMPLEMENTACIÓN EXITOSA Y VERIFICADA AL 100%  
**Repositorio:** `Backend/GODT-B` y `Frontend`  
**Rama de desarrollo:** `feature/fase-e-consolidated-dossier` -> integrada en `main`

---

## 1. RESUMEN EJECUTIVO

La Fase E implementa de forma íntegra y estricta el sistema de empaquetamiento, consolidación, exportación y auditoría de integridad criptográfica del expediente documental completo para el aggregate `DonationProcess` en el GODT Regional 3.

El sistema garantiza:
1. **Taxonomía Normativa en 6 Carpetas**: Organización física estructurada y estandarizada dentro de un contenedor ZIP determinista.
2. **Inmutabilidad de Binarios Originales**: Los documentos liberados en `01_DOCUMENTOS_LIBERADOS` preservan bit a bit sus binarios oficiales originales y sus firmas, sin ninguna alteración posterior.
3. **Documento Continuo de Consulta**: Generación automática mediante `pdf-lib` de `02_DOCUMENTO_CONSOLIDADO/expediente_consolidado.pdf`, con portada institucional, índice formal con paginación real, numeración secuencial de páginas y aviso legal explícito de valor de consulta (sin pretender heredar firmas electrónicas individuales).
4. **Cadena de Custodia Criptográfica**: Inclusión en `03_EVIDENCIAS/` del `manifiesto_integridad.json` (con hash SHA-256 raíz determinista) y `evidencias_atestaciones.json` con la trazabilidad forense de participantes y firmas.
5. **Seguridad y Privacidad Estricta**: La carpeta `05_FUENTES_COMPLEMENTARIAS/` (historias clínicas, epicrisis, necropsias) se excluye de forma predeterminada y solo se exporta previa confirmación bajo juramento por parte de un Coordinador o Administrador.
6. **Motor Asíncrono con Redis/BullMQ y Fallback Transparente**: Cola de exportación con control de concurrencia, idempotencia estricta para evitar trabajos duplicados y actualización de progreso en tiempo real.
7. **Verificación Integral Automatizada**: Endpoint dedicado `POST /api/v1/donation-processes/:id/dossier/exports/:exportId/verify` que comprueba cada archivo almacenado contra el manifiesto y reporta `INTEGRITY_VERIFIED` o `INTEGRITY_COMPROMISED`.

---

## 2. TAXONOMÍA REGLAMENTARIA DEL PAQUETE ZIP EXPORTABLE

El archivo generado tiene la nomenclatura reglamentaria `GODT_EXPEDIENTE_<CODIGO_PROCESO>.zip` y contiene la siguiente estructura interna de 6 carpetas:

```
GODT_EXPEDIENTE_PROC-XXXX/
├── README.txt                                    # Instrucciones de auditoría, resumen e integridad
├── 00_INDICE/
│   ├── indice_expediente.pdf                     # PDF oficial con portada, metadatos y tabla de 23 posiciones
│   └── resumen_expediente.json                   # Resumen estructurado en JSON para ingesta de interoperabilidad
├── 01_DOCUMENTOS_LIBERADOS/                      # Binarios originales e inalterados
│   ├── ANEXO_1_v1.pdf
│   ├── ANEXO_2_v1.pdf
│   └── ...
├── 02_DOCUMENTO_CONSOLIDADO/
│   └── expediente_consolidado.pdf                # PDF continuo de consulta con paginación secuencial y disclaimer
├── 03_EVIDENCIAS/
│   ├── manifiesto_integridad.json                # Manifiesto determinista con SHA-256 de cada elemento
│   └── evidencias_atestaciones.json              # Trazabilidad forense de participantes, firmas y atestaciones
├── 04_CADENA_CUSTODIA/
│   ├── anexo_8_cadena_custodia.pdf               # Anexo 8 liberado (si aplica)
│   └── eventos_custodia_inmutables.json          # Eslabones cronológicos de custodia de muestras
└── 05_FUENTES_COMPLEMENTARIAS/                   # Historias clínicas y soportes externos (solo si autorizado)
    └── HISTORIA_CLINICA_COMPLETA/
        └── historia_clinica_completa.pdf
```

---

## 3. ARQUITECTURA TÉCNICA E IMPLEMENTACIÓN BACKEND

### 3.1 Modelo de Datos PostgreSQL (Migración 13)
Se creó la tabla `PROCESS_DOSSIER_EXPORT` vinculada a `DONATION_PROCESS` y `SYSTEM_USER`:
- `id`: UUID (Primary Key)
- `process_id`: UUID (Foreign Key a `DONATION_PROCESS`)
- `requested_by_id`: UUID (Foreign Key a `SYSTEM_USER`)
- `export_type`: Enum / VarChar (`FULL_ZIP`, `CONSOLIDATED_PDF`, `INDEX_ONLY`)
- `status`: VarChar (`PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `EXPIRED`)
- `progress_percent`: Int (0 a 100)
- `current_step`: VarChar
- `error_message`: Text
- `include_source_documents`: Boolean
- `selected_document_codes`: JsonB
- `selected_source_document_ids`: JsonB
- `zip_storage_key`: VarChar
- `zip_sha256`: Char(64)
- `zip_size_bytes`: BigInt
- `consolidated_pdf_storage_key`: VarChar
- `consolidated_pdf_sha256`: Char(64)
- `manifest_data`: JsonB
- `created_at`, `completed_at`, `expires_at`: Timestamptz

### 3.2 Componentes de Aplicación y Dominio
1. `src/domain/dossier/dossier.types.ts`: Definición de tipos de dominio, interfaces de manifiesto, ítems documentales y errores de acceso y validación.
2. `src/application/dossier/generate-dossier-index.service.ts`: Ensamblaje del índice oficial paginado con `pdf-lib`, generando tabla de 23 posiciones con estado, categoría, justificación de descartes y aviso de valor de consulta.
3. `src/application/dossier/consolidate-pdf.service.ts`: Fusión continua de documentos liberados en estricto orden posicional (1 a 23), calculando rangos exactos de página y respetando dimensiones/orientaciones (vertical y horizontal).
4. `src/application/dossier/build-integrity-manifest.service.ts`: Construcción del manifiesto determinista y extracción de atestaciones de firma y custodia.
5. `src/application/dossier/package-zip.service.ts`: Motor de empaquetamiento ZIP usando `archiver` con compresión deflate nivel 9 y streaming asíncrono seguro.
6. `src/application/dossier/process-dossier-export.service.ts`: Orquestador principal de la exportación, control de transiciones (`PENDING` -> `PROCESSING` -> `COMPLETED`/`FAILED`) y persistencia en almacenamiento privado.
7. `src/infrastructure/dossier/bullmq-dossier-queue.service.ts`: Cola asíncrona dual que opera mediante BullMQ sobre Redis 6379 y conmuta limpiamente a procesamiento directo en segundo plano para entornos de testing y desarrollo offline.
8. `src/application/dossier/request-dossier-export.use-case.ts`: Validación de permisos por IPS y rol, control de duplicados idénticos y encolamiento.
9. `src/application/dossier/verify-dossier-integrity.use-case.ts`: Auditoría forense que lee todos los binarios físicos en storage, calcula su hash SHA-256 en tiempo real y los confronta con el manifiesto.

### 3.3 Endpoints HTTP Expuestos
| Método | Endpoint | Descripción | Código Éxito |
|---|---|---|---|
| POST | `/api/v1/donation-processes/:id/dossier/exports` | Solicitar exportación del expediente | 202 Accepted |
| GET | `/api/v1/donation-processes/:id/dossier/exports` | Listar historial de exportaciones | 200 OK |
| GET | `/api/v1/donation-processes/:id/dossier/exports/:exportId` | Consultar estado y progreso | 200 OK |
| GET | `/api/v1/donation-processes/:id/dossier/exports/:exportId/download` | Descargar archivo ZIP | 200 OK (Stream application/zip) |
| GET | `/api/v1/donation-processes/:id/dossier/exports/:exportId/consolidated-pdf` | Descargar PDF consolidado | 200 OK (Stream application/pdf) |
| GET | `/api/v1/donation-processes/:id/dossier/exports/:exportId/manifest` | Obtener JSON del manifiesto | 200 OK |
| POST | `/api/v1/donation-processes/:id/dossier/exports/:exportId/verify` | Verificación criptográfica SHA-256 | 200 OK |

---

## 4. INTEGRACIÓN FRONTEND (VUE 3)

1. **Servicio API (`Frontend/src/services/dossier.ts`)**: Cliente HTTP tipado con Axios que consume los 7 endpoints con manejo de blobs y errores tipados.
2. **Pestaña "Expediente Consolidado (Fase E)" en `DonationProcessDetailView.vue`**:
   - Tarjetas KPI con desglose de las 23 posiciones (Liberados, En trámite, No aplica, Homologación).
   - Banner de trabajo activo con barra de progreso reactiva y polling cada 2.5 segundos.
   - Tabla histórica de exportaciones con descarga directa de ZIP y PDF consolidado.
   - Matriz de composición de las 23 posiciones con badges de inclusión y motivos de descarte.
   - Modal de solicitud con selector de paquete y advertencia legal obligatoria para documentos fuente.
   - Modal visualizador de `manifiesto_integridad.json`.
   - Modal de auditoría forense con desglose de hashes esperados vs calculados y estatus global.

---

## 5. RESULTADOS DE PRUEBAS Y VERIFICACIÓN

### 5.1 Suite de Integración Backend (`dossier-export-integration.spec.ts`)
- **13 pruebas automatizadas ejecutadas contra PostgreSQL y LocalStorage real**:
  - `[PASS]` Rechazo a usuarios de otra IPS (`DossierAccessDeniedError`)
  - `[PASS]` Rechazo a roles no autorizados para incluir historias clínicas
  - `[PASS]` Creación y procesamiento en modo estándar (exclusión de fuentes por defecto)
  - `[PASS]` Taxonomía estricta de 6 carpetas dentro del archivo ZIP (inspección con `adm-zip`)
  - `[PASS]` Conservación inalterada de binarios originales y hashes SHA-256 en `01_DOCUMENTOS_LIBERADOS`
  - `[PASS]` Compilación de PDF consolidado continuo con portada, índice y páginas ordenadas
  - `[PASS]` Manifiesto de integridad determinista reflejando matriz de 23 posiciones y motivo de no aplicabilidad
  - `[PASS]` Inclusión autorizada de `05_FUENTES_COMPLEMENTARIAS`
  - `[PASS]` Verificación criptográfica exitosa (`INTEGRITY_VERIFIED`, 100% matches)
  - `[PASS]` Detección inmediata de manipulación o alteración de binarios (`INTEGRITY_COMPROMISED`, `MISMATCH`)
  - `[PASS]` Consulta y seguridad de endpoints

### 5.2 Suite Completa del Backend
- **Test Suites:** 21 passed, 21 total (100%)
- **Tests:** 139 passed, 139 total (100%)

### 5.3 Contratos y E2E Frontend
- **Contratos (`tests/contracts.test.mjs`)**: 4 passed, 0 failed.
- **Workflow E2E Navegador (`tests/browser-workflow.test.mjs`)**: 1 passed, 0 failed (recorrido completo de autenticación, paquete de 23 posiciones, diligenciamiento, snapshot PDF, exportación de expediente ZIP y verificación de integridad).
