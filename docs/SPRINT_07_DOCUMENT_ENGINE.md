# Sprint 07 — Motor documental

El motor vigente usa `DocumentTemplate`, `TemplateVersion`,
`DocumentInstance`, `DocumentResponseRevision` y
`DocumentFieldProvenance`. Las versiones publicadas se consultan para
usuarios no administradores y las instancias guardan el `templateVersionId`
exacto.

## Contratos vigentes

- `GET /api/v1/document-catalog`
- `GET /api/v1/document-catalog/:id/versions`
- `POST /api/v1/donors/:donorId/document-instances`
- `GET /api/v1/donors/:donorId/document-instances`
- `GET /api/v1/document-instances/:id`
- `PATCH /api/v1/document-instances/:id`
- `POST /api/v1/document-instances/:id/validate`

La validación de respuesta usa JSON Schema en backend. La interfaz solo
proporciona retroalimentación inmediata y no sustituye
`POST .../validate`.
