# Contrato API documental propuesto

Los nombres son contratos de diseño; no se implementan en esta fase.

## Catálogo y versiones

| Método | Ruta | Propósito |
|---|---|---|
| GET | `/api/v1/document-catalog` | Listar documentos activos según permisos |
| POST | `/api/v1/document-catalog` | Crear definición lógica |
| PATCH | `/api/v1/document-catalog/:id` | Cambiar metadatos no históricos |
| POST | `/api/v1/document-catalog/:id/versions` | Crear versión borrador |
| GET | `/api/v1/document-catalog/:id/versions` | Consultar historial |
| POST | `/api/v1/document-catalog/:id/versions/:versionId/validate` | Validar esquema |
| POST | `/api/v1/document-catalog/:id/versions/:versionId/publish` | Publicar inmutablemente |

## Instancias y respuestas

| Método | Ruta | Propósito |
|---|---|---|
| POST | `/api/v1/donors/:donorId/document-instances` | Crear instancia con versión |
| GET | `/api/v1/donors/:donorId/document-instances` | Listar instancias |
| GET | `/api/v1/document-instances/:id` | Consultar respuesta y procedencia |
| PATCH | `/api/v1/document-instances/:id` | Guardar avance/draft |
| POST | `/api/v1/document-instances/:id/validate` | Validar requisitos |
| POST | `/api/v1/document-instances/:id/generate` | Generar PDF |
| GET | `/api/v1/generated-documents/:id/download` | Descargar PDF privado |

## Respuesta de campo precargado

```json
{
  "field": "bloodGroup",
  "value": "O",
  "source": {
    "kind": "OCR",
    "status": "CONFIRMED",
    "sourceDocumentId": "uuid",
    "ocrFieldId": "uuid",
    "validatedBy": "uuid",
    "validatedAt": "timestamp"
  },
  "conflicts": []
}
```

El backend debe rechazar escrituras de campos protegidos cuando la fuente OCR
está `PENDING` o `REJECTED`. Las rutas de administración requieren rol
específico, auditoría y control institucional.
