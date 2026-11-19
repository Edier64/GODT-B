# Referencias de almacenamiento y migración posterior a R2

## Estado local

Los documentos institucionales de análisis permanecen en la ruta local
ignorada `docs/documentos-reales/`. No forman parte del artefacto Git ni deben
considerarse disponibles en Render.

Los documentos cargados por la aplicación usan `FileStoragePort` y el
`LocalPrivateStorageAdapter` con claves internas. El frontend no recibe rutas
físicas. Los documentos fuente se relacionan con `SourceDocument`; no se
duplica una entidad `DocumentSource`.

## Procedimiento futuro

1. Verificar autorización institucional para cada archivo.
2. Calcular y conservar SHA-256 antes de la migración.
3. Configurar `STORAGE_PROVIDER=r2` y las credenciales solo en backend.
4. Subir cada objeto con una clave interna estable bajo una categoría
   controlada, sin usar el nombre original como autorización.
5. Confirmar hash, tamaño, MIME y lectura del objeto.
6. Actualizar únicamente `objectStorageKey` mediante una operación auditable.
7. Probar descarga autenticada por IPS.
8. Mantener el almacenamiento local hasta completar reconciliación y
   aprobación.
9. No eliminar los originales locales sin autorización y copia verificada.

R2 debe permanecer privado. No se deben publicar URLs permanentes ni incluir
credenciales en el frontend. La migración no publica automáticamente
plantillas: el archivo fuente y la definición de plantilla son artefactos
distintos y cada versión requiere validación institucional.
