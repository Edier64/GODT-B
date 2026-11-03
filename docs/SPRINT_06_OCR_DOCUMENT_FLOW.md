# Sprint 06 — Flujo documental y OCR

## Implementado

- La ingesta conserva validación de tamaño máximo de 10 MiB, MIME permitido,
  firma binaria, hash SHA-256, deduplicación por donante y almacenamiento
  privado.
- Los documentos no se publican mediante URL permanente.
- El rasterizador PDF local usa `pdfinfo` y `pdftoppm` configurables.
- Se aplican límites configurables de páginas, DPI, tiempo de ejecución y
  tamaño total de las imágenes rasterizadas antes de cargarlas en memoria.
- Los archivos temporales de rasterización y Tesseract se eliminan siempre.
- Tesseract usa salida TSV y solo genera candidatos mediante
  `OCR_FIELD_ALIASES`, un diccionario explícito de homologación.
- Cada candidato conserva clave, valor, confianza calculada desde TSV, página y
  caja delimitadora.
- Los trabajos persistidos `EN_COLA` se reencolan al iniciar el worker con el
  mismo `jobId`, preservando idempotencia y reintentos BullMQ.
- La validación humana mantiene `PENDIENTE`, `CONFIRMADO`, `MODIFICADO` y
  `RECHAZADO`; solo confirmados/modificados pueden propagarse mediante el
  endpoint existente.

## Configuración requerida para Tesseract/PDF

```text
TESSERACT_BIN=tesseract
TESSERACT_LANG=eng
PDFINFO_BIN=pdfinfo
PDFTOPPM_BIN=pdftoppm
OCR_PDF_MAX_PAGES=10
OCR_PDF_DPI=150
OCR_PDF_TIMEOUT_MS=30000
TESSERACT_TIMEOUT_MS=30000
OCR_FIELD_ALIASES={"bloodGroup":["Blood group"],"rhFactor":["Rh factor"]}
```

`OCR_FIELD_ALIASES` no tiene valores por defecto para evitar inferir campos
clínicos o crear homologaciones no aprobadas. Si falta, el trabajo falla de
forma explícita y queda sujeto a reintento controlado.

## Limitaciones y bloqueos

- El entorno de esta sesión no tiene PostgreSQL, Redis, backend NestJS,
  Tesseract, `pdfinfo` ni `pdftoppm` activos/disponibles; no se declara una
  prueba E2E real.
- No existe integración antivirus/ClamAV en la infraestructura auditada. No se
  simula un resultado “limpio”; la incorporación de cuarentena y análisis real
  queda bloqueada para despliegues no confiables.
- Gemini requiere credenciales y aprobación institucional; no se usa en
  pruebas ni se envían documentos clínicos reales.
- La propagación clínica sigue siendo explícita y separada de la extracción.
