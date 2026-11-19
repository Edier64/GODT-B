# Sprint 08 — comparación visual del Anexo 6

## Método

Se revisó el PDF original en visor PDF y se comparó con la estructura que
generaría el renderer existente a partir de `uiSchema.sections` y
`fieldConfigs`. No se enviaron documentos a servicios externos ni se copió el
original al frontend.

## Comparación

| Elemento | Documento original | Formulario dinámico propuesto | Estado |
|---|---|---|---|
| Encabezado institucional | Logos, título, código y número de página | Título y campos de identificación | Parcial |
| Ciudad e IPS | Una línea en encabezado | Campos separados | Representado |
| Fechas de cirugía | Tabla 2x2 | Sección con cuatro campos datetime | Representado estructuralmente |
| Órganos rescatados | Tabla fija de ocho filas | Tabla dinámica de objetos | Representado con diferencia de interacción |
| Personal | Tabla por procedimiento y tres columnas | Tabla dinámica de objetos | Representado con diferencia de interacción |
| Anestesiólogo/perfusionista | Campos debajo de la tabla | Campos escalares | Representado |
| Resección bazo/ganglios | Selección SI/NO | Enumeración SI/NO | Representado |
| Soluciones | Tabla de ocho filas, tipo y cantidad | Tabla con destino, tipo y cantidad | Representado estructuralmente |
| Tejidos | Tabla de cinco filas | Tabla dinámica de objetos | Representado con diferencia de interacción |
| Hallazgos | Líneas libres | Textarea | Representado |
| Firma y c.c. | Espacio para firma manuscrita y nombre | Nombre y c.c. | Firma no reproducida |
| Logos, bordes y paginación | Elementos institucionales del PDF | No forman parte del schema | No reproducido |

## Diferencias y riesgos

1. El PDF tiene filas preimpresas; el renderer muestra acciones “Agregar” y
   “Quitar” para arreglos. Esto es funcionalmente útil, pero no es fidelidad
   visual completa.
2. El PDF usa etiquetas en español; los valores internos de enumeración son
   códigos estables en inglés. La UI debe usar etiquetas aprobadas en
   `fieldConfigs` o en la capa de presentación antes de publicar.
3. La firma manuscrita no se convierte en firma electrónica ni en imagen.
4. Los logos, número de resolución, pie de página y saltos de página no están
   modelados por `uiSchema`.
5. El documento permite campos que podrían depender del tipo de rescate; no se
   activan dependencias sin regla institucional.

## Conclusión visual

La propuesta reproduce la agrupación, los campos y las tablas principales, pero
queda **validada técnicamente, no validada visualmente**. La aprobación visual
requiere una sesión institucional con el PDF y una instancia sintética
renderizada lado a lado.
