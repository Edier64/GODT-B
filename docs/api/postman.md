# Pruebas de API con Postman

## Archivos

- [Colección GODT](./postman/GODT.postman_collection.json)
- [Entorno local](./postman/GODT.postman_environment.json)

## Importación

1. Abrir Postman.
2. Seleccionar **Import**.
3. Importar ambos archivos JSON.
4. Seleccionar el entorno **GODT - Local**.
5. Configurar `jwtToken` con un JWT válido.

La API no tiene un endpoint propio de login. El token debe provenir del
proveedor de identidad configurado y contener:

```json
{
  "sub": "UUID_DEL_USUARIO",
  "role": "ADMIN",
  "institutionalIps": ["IPS E2E"]
}
```

Roles válidos: `ADMIN`, `COORDINATOR`, `SURGEON` y `TECHNICIAN`.

## Flujo recomendado

1. **Health / Health check**: confirma API, PostgreSQL y Redis.
2. **Donantes / Crear expediente**: crea datos sintéticos y guarda `donorId`.
3. **Documentos fuente / Cargar documento**: selecciona un archivo local.
4. **OCR**: inicia el trabajo, consulta campos y valida resultados.
5. **Catálogo documental**: crea una plantilla y versión como `ADMIN`.
6. Valida y publica la versión.
7. **Instancias documentales**: crea y guarda revisiones.
8. Valida la instancia y consulta el historial.

Los tests de la colección guardan automáticamente los identificadores
devueltos por la API en variables del entorno cuando la respuesta contiene
`id`.

## Endpoints disponibles

### Salud

| Método | Ruta | Auth |
|---|---|---|
| GET | `/health` | No |

### Donantes

| Método | Ruta |
|---|---|
| POST | `/api/v1/donors` |
| GET | `/api/v1/donors` |
| GET | `/api/v1/donors/:id` |
| PATCH | `/api/v1/donors/:id` |

### Documentos fuente

| Método | Ruta |
|---|---|
| POST | `/api/v1/donors/:donorId/documents` |
| GET | `/api/v1/donors/:donorId/documents` |
| GET | `/api/v1/documents/:id` |
| GET | `/api/v1/documents/:id/download` |

### OCR

| Método | Ruta |
|---|---|
| POST | `/api/v1/documents/:documentId/ocr` |
| GET | `/api/v1/ocr/jobs/:jobId` |
| GET | `/api/v1/ocr/jobs/:jobId/fields` |
| PATCH | `/api/v1/ocr/fields/:fieldId/validation` |
| POST | `/api/v1/donors/:donorId/clinical-data/propagate` |

### Legalización

| Método | Ruta |
|---|---|
| POST | `/api/v1/donors/:donorId/legalization` |

Requiere rol `ADMIN` o `COORDINATOR`.

### Catálogo e instancias

La creación, modificación, validación y publicación de plantillas requiere
rol `ADMIN`.

| Método | Ruta |
|---|---|
| GET | `/api/v1/document-catalog` |
| POST | `/api/v1/document-catalog` |
| PATCH | `/api/v1/document-catalog/:id` |
| POST | `/api/v1/document-catalog/:id/versions` |
| GET | `/api/v1/document-catalog/:id/versions` |
| POST | `/api/v1/document-catalog/:id/versions/:versionId/validate` |
| POST | `/api/v1/document-catalog/:id/versions/:versionId/publish` |
| POST | `/api/v1/donors/:donorId/document-instances` |
| GET | `/api/v1/donors/:donorId/document-instances` |
| GET | `/api/v1/document-instances/:id` |
| PATCH | `/api/v1/document-instances/:id` |
| POST | `/api/v1/document-instances/:id/validate` |
| POST | `/api/v1/document-instances/:id/conflicts/resolve` |

## Respuestas frecuentes

- `401`: falta el header `Authorization: Bearer {{jwtToken}}` o el JWT es
  inválido.
- `403`: rol insuficiente o expediente fuera del alcance IPS.
- `404`: recurso inexistente.
- `409`: conflicto de unicidad, concurrencia o conflicto documental pendiente.
- `422`: DTO, esquema, OCR o regla de negocio inválida.

Usa únicamente datos sintéticos al probar y elimina los registros creados
cuando termines.
