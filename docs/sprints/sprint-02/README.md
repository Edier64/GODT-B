# Sprint 2 — Gestión documental, OCR y validación humana

## Implementado y probado

- Carga multipart de PDF, PNG y JPEG.
- Validación de tamaño (10 MiB), MIME declarado y firma binaria.
- Hash SHA-256 y deduplicación por expediente.
- Restricción única en PostgreSQL para impedir duplicados concurrentes del
  mismo hash dentro de un expediente.
- Almacenamiento privado local mediante `FileStoragePort`, reemplazable por
  Supabase Storage.
- Control de acceso por IPS para listar, consultar y descargar documentos.
- Trabajos OCR asíncronos mediante Redis/BullMQ con reintentos exponenciales e
  idempotencia para trabajos en cola.
- Persistencia de `SOURCE_DOCUMENT`, `OCR_PROCESSING_JOB` y
  `OCR_EXTRACTED_FIELD` existentes; no se crearon entidades duplicadas.
- Adaptador configurable para Gemini, sujeto a credenciales y aprobación
  institucional.
- Lista blanca configurable de campos canónicos y validación estricta de
  respuestas OCR.
- Estados humanos `PENDIENTE`, `CONFIRMADO`, `MODIFICADO` y `RECHAZADO`.
- Auditoría transaccional de decisiones de validación.
- Propagación transaccional únicamente de campos confirmados o modificados.
- Protección contra sobrescritura de un valor clínico existente.
- Trazabilidad de documento, trabajo OCR y usuario validador.
- Limpieza del objeto almacenado si falla la persistencia del registro.
- Bloqueo optimista para impedir dos validaciones simultáneas del mismo campo.

## Endpoints

- `POST /api/v1/donors/:donorId/documents`
- `GET /api/v1/donors/:donorId/documents`
- `GET /api/v1/documents/:id`
- `GET /api/v1/documents/:id/download`
- `POST /api/v1/documents/:documentId/ocr`
- `GET /api/v1/ocr/jobs/:jobId`
- `GET /api/v1/ocr/jobs/:jobId/fields`
- `PATCH /api/v1/ocr/fields/:fieldId/validation`
- `POST /api/v1/donors/:donorId/clinical-data/propagate`

Todos requieren JWT Bearer y alcance institucional, salvo `ADMIN`.

## Configuración

`OCR_PROVIDER=tesseract` es la opción local predeterminada, pero el adaptador
Tesseract actual no completa el flujo de candidatos canónicos: Tesseract
devuelve texto/TSV y no un arreglo JSON con campos homologados. Para Gemini se
requieren `GEMINI_API_KEY` y, opcionalmente, `GEMINI_MODEL`. Las pruebas deben
usar documentos sintéticos o anonimizados; no se envían documentos clínicos
reales a proveedores externos sin aprobación institucional.

`OCR_ALLOWED_FIELDS` es obligatorio para aceptar candidatos y evita que un
proveedor introduzca propiedades no homologadas. Tesseract debe estar
instalado en el host o contenedor y configurado mediante `TESSERACT_BIN`.

## Implementado con limitaciones

- El adaptador local de Tesseract ahora admite PDF mediante rasterización
  controlada y convierte TSV a candidatos únicamente con `OCR_FIELD_ALIASES`.
  El soporte operativo requiere `tesseract`, `pdfinfo`, `pdftoppm` y un
  diccionario institucional configurado.
- Gemini está integrado, pero requiere credenciales y aprobación institucional
  antes de procesar información real.
- La propagación usa claves canónicas planas y no sustituye la homologación
  definitiva del diccionario INS.

## Pendiente de desarrollo

- Recuperación/reconciliación de trabajos `EN_COLA` o interrumpidos después de
  reiniciar el worker: implementada mediante reencolado por `jobId`; requiere
  Redis activo para validación operativa.
- Antivirus o cuarentena para despliegues que acepten documentos no confiables.

## Pendiente de homologación institucional

- Diccionario canónico y mappings oficiales INS.
- Aprobación de proveedores externos y tratamiento de datos.
- Límites operativos de documentos, OCR y retención.

## Dictamen

Sprint 2 **no está cerrado técnicamente**. PB-04 está implementado con
limitaciones operativas (sin antivirus/cuarentena y sin prueba E2E real).
PB-06 tiene transacción, trazabilidad y control de concurrencia implementados,
pero requiere pruebas de integración específicas. PB-05 no cumple todavía el
flujo completo con Tesseract ni PDF multipágina.
