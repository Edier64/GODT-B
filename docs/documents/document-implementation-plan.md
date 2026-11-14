# Plan de implementación del motor documental

## Fase 0 — Homologación

- Confirmar códigos, nombres oficiales, obligatoriedad y catálogos.
- Identificar documentos que solo son fuentes clínicas.
- Obtener versiones oficiales y reglas de vigencia.
- Aprobar tratamiento de documentos diligenciados.

## Fase 1 — Catálogo y versionamiento

- API administrativa de catálogo.
- Versiones borrador/publicada/retirada.
- JSON Schema, UI schema, mappings y recursos.
- Validación y auditoría de publicación.

## Fase 2 — Instancias y formularios

- Persistencia de drafts e instancias históricas.
- Motor de precarga desde expediente y OCR validado.
- Conflictos y procedencia.
- Componentes Vue reutilizables.

## Fase 3 — Variantes del Anexo 7

- Base de tejidos y cuatro variantes.
- Base de órganos y variantes específicas.
- Pruebas visuales contra los formatos recibidos.

## Fase 4 — Generación PDF

- Renderizador por recurso/version.
- PDF/A cuando sea requisito confirmado.
- Snapshot, hash, versión y auditoría.
- Descarga privada.

## Fase 5 — Validación integral

- Pruebas JSON Schema.
- Pruebas de permisos e IPS.
- Pruebas de inmutabilidad histórica.
- Pruebas de no propagación de OCR no validado.
- Pruebas visuales y de paginación.

## Criterio de no avance

No implementar mapeos clínicos definitivos ni reglas jurídicas no homologadas.
No convertir los 23 archivos en código individual. El documento número 24
debe incorporarse creando una entrada de catálogo y una nueva versión con
schema/UI/mapping/recurso, sin modificar los componentes centrales.
