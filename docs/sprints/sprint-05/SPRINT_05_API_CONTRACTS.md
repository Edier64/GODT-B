# Sprint 05 — Matriz de contratos API

Todos los endpoints listados requieren JWT. El alcance por IPS se valida en los
casos de uso; las operaciones administrativas del catálogo requieren `ADMIN`.

| Módulo | Endpoint | Método | Resultado | Estado |
|---|---|---|---|---|
| Donantes | `/api/v1/donors` | GET/POST | Página de donantes / donante creado | Correcto |
| Donantes | `/api/v1/donors/:id` | GET/PATCH | Donante / donante actualizado | Correcto |
| Documentos | `/api/v1/donors/:donorId/documents` | GET/POST | Metadatos / documento creado | Correcto |
| Documentos | `/api/v1/documents/:id` | GET | Metadatos privados autorizados | Correcto |
| Documentos | `/api/v1/documents/:id/download` | GET | Blob privado autorizado | Correcto |
| OCR | `/api/v1/documents/:documentId/ocr` | POST | Trabajo `EN_COLA` | Correcto |
| OCR | `/api/v1/ocr/jobs/:jobId` | GET | Estado, error y campos | Corregido |
| OCR | `/api/v1/ocr/jobs/:jobId/fields` | GET | Campos extraídos | Correcto |
| OCR | `/api/v1/ocr/fields/:fieldId/validation` | PATCH | Campo validado | Correcto |
| Catálogo | `/api/v1/document-catalog` | GET | Catálogo autorizado | Correcto |
| Versiones | `/api/v1/document-catalog/:id/versions` | GET | Historial de versiones | Correcto |
| Instancias | `/api/v1/donors/:donorId/document-instances` | GET/POST | Instancias / instancia creada | Correcto |
| Instancias | `/api/v1/document-instances/:id` | GET/PATCH | Instancia / revisión creada | Correcto |
| Instancias | `/api/v1/document-instances/:id/validate` | POST | Resultado de validación | Correcto |
| Legalización | `/api/v1/donors/:donorId/legalization` | POST | Registro autorizado | Correcto y sujeto a reglas reales |

Errores específicos observados: `401`, `403`, `404`, `409` y `422`. La prueba
de `413` de Multer requiere servidor activo y queda pendiente de verificación
HTTP real.
