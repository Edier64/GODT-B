# Ciclo de vida documental

```text
CATALOG_DRAFT
  -> VERSION_DRAFT
  -> VALIDATED
  -> PUBLISHED
  -> INSTANCE_DRAFT
  -> IN_REVIEW
  -> APPROVED
  -> GENERATED
  -> ARCHIVED
```

Una transición debe verificar permisos, versión, datos obligatorios,
procedencia y auditoría. El retiro de una plantilla no elimina instancias ni
archivos generados. Una instancia histórica conserva su definición, respuesta,
actor, timestamps, fuente de datos y hash del PDF.

Las excepciones clínicas o jurídicas no se resuelven cambiando el estado desde
el frontend; deben pasar por un caso de uso y quedar auditadas.
