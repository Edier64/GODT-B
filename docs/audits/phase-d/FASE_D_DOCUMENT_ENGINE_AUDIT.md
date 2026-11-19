# Auditoría Técnica y Arquitectónica del Motor Documental — Fase D

## 1. Funcionalidades Existentes (Sprints 01 a 09 + Fases A, B, C, C.1)

1. **Gestión de Catálogo y Definición de Plantillas (`DocumentEngineService`):**
   - Modelos `DocumentTemplate` y `TemplateVersion` con estados `DRAFT`, `VALIDATED`, `PUBLISHED`, `RETIRED`.
   - Validación estructural mediante `DocumentDefinitionValidator` (valida JSON Schema draft-2020-12, `uiSchema`, `mappingConfig`, `dependencyConfig`).
   - Cálculo criptográfico del hash de definición (`definitionHash` SHA-256).
2. **Ciclo de Formulario e Instancias Documentales:**
   - Creación de `DocumentInstance` vinculada a `DonorRecord`, y opcionalmente a `DonationProcess` y `ProcessDocument`.
   - Sistema append-only de revisiones (`DocumentResponseRevision`) con `revisionNumber` secuencial.
   - Sistema de procedencia campo por campo (`DocumentFieldProvenance`) con trazabilidad (`sourceKind`, `ocrFieldId`, `sourceDocumentId`, `conflictStatus`).
   - Validación de respuestas contra el JSON Schema de la versión en `DocumentResponseValidator` (Ajv).
3. **Paquete Documental de 23 Posiciones (`ProcessPackage` & `ProcessDocument`):**
   - Entidad `ProcessDocument` representando cada una de las 23 posiciones normativas del proceso.
   - Caso de uso `InitiateProcessDocumentUseCase`: enlaza `ProcessDocument` con la `TemplateVersion` publicada, precarga valores canónicos vigentes (`CanonicalPropagationEngine.preloadCanonicalValues`), crea la instancia y revisión 1 en `DRAFT`, y actualiza `currentInstanceId` y `status: "EN_DILIGENCIAMIENTO"`.
   - Control de aplicabilidad (`APLICABLE`, `NO_APLICA`, `PENDIENTE_EVALUACION`) y dependencias entre documentos.
4. **Almacenamiento de Archivos y Rasterización:**
   - Puertos y adaptadores `FileStoragePort` con `LocalPrivateStorageAdapter` (almacenamiento en `storage/private`) y `R2StorageAdapter` (Cloudflare R2 / S3 API).
   - Rasterizador `LocalPdfRasterizerAdapter` (`pdftoppm` y `pdfinfo`) para procesamiento OCR de historias clínicas.
5. **Formatos Institucionales Reales:**
   - Disponibilidad completa de los formatos originales en `docs/documentos-reales/`:
     - Anexo 1 (alerta y valoración), Anexo 2 (notificación deudos), Anexo 3 (consentimiento), Anexo 4 (oferta), Anexo 5 (remisión muestras), Anexo 6 (extracción general), Anexo 7 (9 variantes de órganos y tejidos), Anexo 8 (cadena de custodia), Anexo 9 (entrega INMLCF).
     - Documentos complementarios identificados como fuentes externas: HC Donante, HC Tissue Bank, Evaluación COVID, Cálculo Hemodilución (SourceDocument).

---

## 2. Modelos Reutilizables

| Modelo Prisma | Estado Actual | Rol en Fase D |
|---|---|---|
| `DocumentTemplate` | Implementado | Catálogo maestro de formatos y códigos de plantilla |
| `TemplateVersion` | Implementado | Especificación inmutable de esquema, uiSchema, mappingConfig y generación |
| `DocumentInstance` | Implementado | Instancia de trabajo de un documento para un donante y proceso |
| `DocumentResponseRevision` | Implementado | Historial inmutable de guardados intermedios y respuestas del formulario |
| `DocumentFieldProvenance` | Implementado | Procedencia granular de cada valor en el formulario |
| `GeneratedPdfDocument` | Esquema parcial | **Evidencia inmutable del snapshot documental y PDF generado** |
| `ProcessDocument` | Implementado | Posición del paquete de 23 posiciones con control de ciclo de vida |
| `ProcessParticipant` | Implementado | Participantes del proceso de donación general |
| `AuditEvent` | Implementado | Trazabilidad forense inmutable de todas las transiciones y firmas |

---

## 3. Brechas y Funcionalidades Incompletas

1. **Máquina de Estados Incompleta:**
   - `DocumentInstance.status` y `ProcessDocument.status` solo soportan cadenas libres o limitadas (`DRAFT`, `EN_DILIGENCIAMIENTO`, `COMPLETADO`, `FIRMADO`).
   - Falta el flujo formal estandarizado:
     `BORRADOR` $\rightarrow$ `VALIDADO` $\rightarrow$ `COMPLETADO` $\rightarrow$ `PENDIENTE_FIRMAS` $\rightarrow$ `FIRMADO` $\rightarrow$ `LIBERADO` (o `CANCELADO`).
   - No existen validaciones de prerrequisitos ni reglas de transición protegidas por rol institucional en un caso de uso unificado.
2. **Generación de Snapshots y Renderizado PDF:**
   - La tabla `GeneratedPdfDocument` no cuenta con lógica de negocio en `src/`. No se capturan snapshots con valores canónicos y mediciones repetibles asociadas.
   - No existe un motor de renderizado PDF que traduzca las respuestas a los formatos institucionales reales.
3. **Participantes y Firmas a Nivel Documental:**
   - No existe relación entre un documento específico y los roles que deben firmarlo.
   - No existe modelo de firma/atestación vinculada al hash del snapshot inmutable.
4. **Cadena de Custodia (Anexo 8):**
   - Actualmente modelada como tabla dentro de un formulario estático; el requisito clínico exige una secuencia cronológica append-only inmutable de eventos de custodia.

---

## 4. Restricciones Técnicas

1. **Entorno de Ejecución:** Windows / PowerShell. La base de datos PostgreSQL 17.6 corre en Docker (`godt-b-postgres-1`) en el puerto 5432. Comandos que requieren red/puerto usan `BypassSandbox: true`.
2. **Seguridad y Rendimiento PDF:** Se evita Puppeteer (por overhead masivo de Chromium en entornos de servidor restringidos). Se utiliza `pdf-lib` para generación determinística, vectorizada, compatible y sin dependencias binarias externas.
3. **Inmutabilidad Absoluta:** Un documento `FIRMADO` o `LIBERADO` jamás puede modificarse, regenerarse sobreescribiendo el mismo archivo ni reutilizar firmas para un snapshot distinto.
4. **Seguridad de Datos Clínicos:** Queda prohibido el uso de datos personales reales en fixtures o capturas; únicamente se emplean datos sintéticos anonimizados.

---

## 5. Componentes que Requieren Modificación

- **Backend:**
  - `prisma/schema.prisma`: Incorporar entidades `DocumentParticipant`, `DocumentSignature`, `CustodyEvent` y enriquecer `GeneratedPdfDocument` con `processId`, `versionNumber`, `status`.
  - `src/application/document-lifecycle/`: Nueva máquina de estados con casos de uso:
    - `validate-document.use-case.ts`
    - `complete-document.use-case.ts`
    - `generate-document-snapshot.use-case.ts`
    - `request-signatures.use-case.ts`
    - `sign-document.use-case.ts`
    - `release-document.use-case.ts`
  - `src/application/pdf/`: Motor de renderizado PDF fiel a los formatos originales (`PdfRenderEngineService`).
  - `src/application/custody/`: Casos de uso de cadena de custodia para el Anexo 8.
- **Frontend:**
  - `src/views/DocumentFormView.vue`: Integración de acciones del ciclo de vida, modal de asignación de participantes, panel de firmas y atestaciones, y visualización del snapshot.
  - `src/views/DonationProcessDetailView.vue`: Indicadores de estado de ciclo de vida (`COMPLETADO`, `PENDIENTE_FIRMAS`, `FIRMADO`, `LIBERADO`) y acceso al visor PDF.
  - `src/components/PdfViewerModal.vue`: Visor seguro de PDF inmutable con descarga autenticada y hash SHA-256.

---

## 6. Nuevas Entidades Estrictamente Necesarias

1. **`DocumentParticipant`:** Vincula a una persona (usuario o participante externo de `ProcessParticipant`) con una `DocumentInstance` concreta, indicando su rol documental, si es firmante obligatorio y orden de firma.
2. **`DocumentSignature`:** Registro inmutable de la firma o atestación sobre un `GeneratedPdfDocument` específico, guardando `signatureType`, `snapshotHash`, `signedAt` y evidencia.
3. **`CustodyEvent`:** Secuencia histórica inmutable de entregas, transportes y recepciones para el Anexo 8.

---

## 7. Decisiones que Requieren Homologación Institucional

1. **Modalidades de Firma:** Se soportan técnicamente `ATESTACION_USUARIO`, `MANUSCRITA_PRESENCIAL` y `DIBUJADA_UI`. La modalidad de `DIGITAL_CERTIFICADA` (PKI / firma digital con token de entidad certificadora) permanece abierta y marcada como `PENDING_HOMOLOGATION` hasta que la Coordinación Regional defina el proveedor PKI oficial.
2. **Posiciones 20 a 23:** Permanecen en estado `PENDING_HOMOLOGATION` sin simular plantillas normativas no existentes.
