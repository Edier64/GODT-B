# Sprint 07 — JSON Schema y configuración visual

`jsonSchema` conserva las reglas de datos y `uiSchema` conserva la
configuración de presentación. Las reglas declarativas de `dependencyConfig`
solo aceptan las claves permitidas por `DocumentDefinitionValidator`; no se
ejecuta JavaScript desde una plantilla.

El frontend soporta objetos, arreglos, tipos escalares, enumeraciones,
formatos, límites y errores con rutas JSON. Las tablas se expresan como un
arreglo de objetos cuyo `uiSchema.fieldConfigs[path]` puede declarar
`component: "table"` y sus columnas. Esto no crea campos ni reglas de negocio:
las columnas deben corresponder al `items.properties` del esquema publicado.
