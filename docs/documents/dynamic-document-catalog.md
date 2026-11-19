# Catálogo documental dinámico

El catálogo no se basa en una lista hardcodeada ni en el número actual de
archivos. Cada entrada tiene un UUID estable, código interno inmutable,
nombre, categoría, estado, variantes y relación con versiones.

## Incorporar un documento 24

1. Un administrador crea `documentKey=custom-document-24`.
2. Registra metadatos y categoría.
3. Crea una versión borrador con JSON Schema, UI schema, mappings y recurso.
4. El backend valida referencias, campos y reglas declarativas.
5. Un autorizador publica la versión.
6. El frontend la descubre por catálogo; no se agrega un componente específico.

Retirar un documento desactiva nuevas instancias, pero conserva versiones,
respuestas y PDFs históricos.
