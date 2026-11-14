# Validación del modelo de datos GODT Regional 3

## Fuente y diagnóstico

La fuente revisada es `Entregable_Modulo2_Arquitectura_GODT_Regional3.pdf`,
especialmente las páginas 10 a 13. El repositorio no contenía previamente
entidades clínicas, `prisma.config.ts` ni migraciones funcionales.

El documento declara **12 tablas conectadas**, pero agrupa dos pares:

- `DOCUMENT_TEMPLATE` y `TEMPLATE_VERSION`.
- `GENERATED_PDF_DOCUMENT` y `AUDIT_EVENT`.

Por tanto, el modelo físico implementado contiene **14 tablas**, coincidiendo
con las 14 entidades requeridas. `AUDIT_EVENT` se implementó como entidad
independiente.

## Matriz de correspondencia

| Entidad documental | Modelo Prisma | Resultado |
|---|---|---|
| SYSTEM_USER | `SystemUser` | Implementada; UUID, email único, rol y estado |
| DONOR_RECORD | `DonorRecord` | Implementada; RND único, datos civiles separados de `clinicalData` |
| BRAIN_DEATH_CERTIFICATION | `BrainDeathCertification` | Implementada; `donorId` único y dos profesionales |
| DONATION_LEGALIZATION | `DonationLegalization` | Implementada; máximo una por expediente |
| DONATION_REPRESENTATIVE | `DonationRepresentative` | Implementada; relación N:1 |
| SOURCE_DOCUMENT | `SourceDocument` | Implementada; storage key y SHA-256 |
| OCR_PROCESSING_JOB | `OcrProcessingJob` | Implementada; trabajo, proveedor, estado y correlación |
| OCR_EXTRACTED_FIELD | `OcrExtractedField` | Implementada; candidato, confianza, validación y origen |
| ORGAN_RECOVERY_SURGERY | `OrganRecoverySurgery` | Implementada |
| TISSUE_RECOVERY_PROCEDURE | `TissueRecoveryProcedure` | Implementada |
| DOCUMENT_TEMPLATE | `DocumentTemplate` | Implementada como plantilla lógica |
| TEMPLATE_VERSION | `TemplateVersion` | Implementada; versión única por plantilla |
| GENERATED_PDF_DOCUMENT | `GeneratedPdfDocument` | Implementada; snapshot, hash y versión exacta |
| AUDIT_EVENT | `AuditEvent` | Implementada independientemente |

## Decisiones y límites

- Los datos civiles se mantienen en `fullName` y `documentNumber`, separados
  de `clinicalData` JSONB. La protección de acceso se implementará en casos de
  uso y guards, no mediante ocultamiento de columnas.
- `clinicalData` solo puede recibir valores OCR confirmados o modificados. La
  tabla conserva candidatos y origen, pero la propagación transaccional queda
  para los casos de uso del Sprint 1/2.
- `DONATION_REPRESENTATIVE` no puede imponer por FK el mínimo condicional de
  dos representantes del Anexo 3. Esa regla requiere validación de dominio y
  transacción de legalización; no se sustituye con una restricción incorrecta.
- Los estados no enumerados explícitamente en el documento (`status` de
  legalización, documento fuente, plantilla y PDF) permanecen como `VARCHAR`
  para evitar inventar un catálogo clínico o jurídico.
- `AUDIT_EVENT.metadata` es JSONB nullable. La prohibición de datos clínicos
  sensibles requiere un puerto/servicio de auditoría con validación de
  allowlist; PostgreSQL no puede determinar semánticamente si un JSON contiene
  información clínica.
- Las relaciones usan `RESTRICT` para preservar trazabilidad histórica. No se
  configuraron cascadas destructivas.
- Se añadieron checks SQL para intentos OCR positivos, confianza entre 0 y 1 y
  coherencia entre estado y validación. La propagación a `clinicalData` sigue
  siendo una regla transaccional de aplicación.

## Migraciones

1. `20261030044418_initial_data_model`: crea las 14 tablas, enums, relaciones,
   índices y restricciones únicas.
2. `20261030045500_integrity_checks`: agrega restricciones de integridad OCR.

Ambas migraciones fueron aplicadas con `prisma migrate deploy` contra
PostgreSQL 17.6 sin reset ni eliminación de datos.

## Pendientes funcionales

- Confirmar formalmente la obligatoriedad de cada atributo opcional del
  diccionario.
- Homologar catálogos de estados no enumerados.
- Implementar el mínimo de dos representantes para consentimiento familiar.
- Implementar validación de `metadata` de auditoría.
- Incorporar el modelo canónico de variables clínicas y sus reglas de
  propagación antes de permitir escrituras en `clinicalData`.
