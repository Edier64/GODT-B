# Estrategia de versionamiento de plantillas

- Estados sugeridos: `DRAFT`, `VALIDATED`, `PUBLISHED`, `RETIRED`; deben ser
  homologados antes de convertirlos en catálogo institucional.
- Solo una versión publicada puede seleccionarse para nuevas instancias.
- Una versión publicada es inmutable en datos, schema, UI, mappings y recursos.
- Cambios crean una nueva versión y requieren auditoría.
- Las instancias y PDFs guardan la versión exacta.
- No se actualizan automáticamente drafts o documentos históricos.
- Una migración de draft debe ser explícita, revisada y auditable; si no existe
  mapeo seguro, se conserva el draft anterior.
