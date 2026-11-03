# Sprint 07 — Almacenamiento configurable

`FileStoragePort` sigue siendo la abstracción usada por carga, descarga y OCR.
No se agregan columnas ni modelos Prisma para el contenido binario.

## Proveedores

- `STORAGE_PROVIDER=local`: `LocalPrivateStorageAdapter`, con ruta configurable
  mediante `LOCAL_STORAGE_PATH`. `DOCUMENT_STORAGE_PATH` se conserva como
  compatibilidad de configuración.
- `STORAGE_PROVIDER=r2`: `R2StorageAdapter`, compatible con el API S3 privado
  de Cloudflare R2.

El adaptador local valida tamaño máximo, MIME no vacío, hash SHA-256 y claves
seguras fuera del árbol público. El adaptador R2 conserva claves internas y no
devuelve URLs públicas.

R2 se instancia únicamente cuando se selecciona ese proveedor y exige:
`R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` y
`R2_ENDPOINT`. La ejecución local usa exclusivamente almacenamiento local.
