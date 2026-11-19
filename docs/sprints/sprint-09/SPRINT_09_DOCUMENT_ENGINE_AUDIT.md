# Sprint 09 — Auditoría del motor documental

## 1. Estado inicial

La auditoría se realizó sobre la rama `Feature/Legalizacion`, tomando como
referencia el motor usado por el piloto Anexo 6 y fixtures sintéticos
independientes. El modelo persistente reutiliza `DocumentTemplate`,
`TemplateVersion`, `DocumentInstance`, `DocumentResponseRevision`,
`DocumentFieldProvenance` y `AuditEvent`; no se crearon entidades nuevas.

El motor ya separa definición (`jsonSchema`), presentación (`uiSchema`),
mapping, dependencias y generación. El renderer Vue no contiene código
específico del Anexo 6. Las principales brechas encontradas fueron la
validación incompleta de referencias UI anidadas y la falta de aplicación
genérica de `readonly` desde UI Schema.

## 2. Matriz de capacidades

| Capacidad | Estado | Evidencia y responsable | Prueba | Riesgo / limitación |
|---|---|---|---|---|
| Strings | Soportada | JSON Schema/AJV y `DynamicField` | `generic-document-engine.spec.ts` | Sin editor especializado adicional |
| Números | Soportada | JSON Schema/AJV y renderer numérico | `generic-document-engine.spec.ts` | Mensajes dependen de AJV |
| Fechas | Parcial | `format` en AJV y input de fecha en `DynamicField` | `generic-document-engine.spec.ts` | Cobertura de formatos visuales limitada |
| Horas | Parcial | Formatos aceptados por AJV; UI comparte control de fecha | Fixture Anexo 6 y validador | No existe control horario dedicado demostrado |
| Booleanos | Soportada | Checkbox genérico | `generic-document-engine.spec.ts` | Sin variante visual configurable |
| Enums | Soportada | `enum` en schema y select genérico | `generic-document-engine.spec.ts` | No se demostró catálogo externo de opciones |
| Nullable | Soportada | Unions JSON Schema y `allowUnionTypes` | `generic-document-engine.spec.ts` y contratos frontend | Validación frontend propia puede divergir de AJV |
| Objetos anidados | Soportada | Recorrido recursivo del schema y paths JSON | `generic-document-engine.spec.ts` | UI Schema de secciones solo referencia propiedades raíz |
| Arreglos | Soportada | `items` y controles dinámicos | Fixture genérico y Anexo 6 | UX de arreglos complejos requiere más cobertura |
| Tablas dinámicas | Soportada | `fieldConfigs.component=table` y columnas configurables | `generic-document-engine.spec.ts` y validación visual 08.3 | No hay paginación interna ni filas fijas configurables |
| Campos condicionales | Parcial | `dependencyConfig` se valida como reglas declarativas | Auditoría de definición | No se demostró evaluación genérica en renderer |
| Secciones | Soportada | `uiSchema.sections` se consume dinámicamente | Anexo 6 y fixture genérico | No hay layout avanzado independiente del renderer |
| Validaciones | Soportada | `DocumentDefinitionValidator` y `DocumentResponseValidator` con AJV | 41 unitarias y E2E | Frontend mantiene una segunda implementación reducida |
| Ayudas y descripciones | Soportada | `description` y configuración UI se muestran en campo | Anexo 6 visual | No hay catálogo de textos localizado |
| Solo lectura | Soportada | `UiFieldConfig.readonly` deshabilita controles | Fixture genérico y `DynamicField` | No se demostró protección de escritura en un PATCH específico |
| Valores calculados | No soportada | `CALCULATED` existe en catálogo de procedencia | Inspección de servicio/repository | No existe motor de cálculo; no debe inferirse en frontend |
| Firma y responsables | No soportada | No hay renderer genérico ni contrato de firma probado | Inspección de componentes y controller | Requiere contrato institucional separado |
| Versionamiento | Soportada | Estados DRAFT/VALIDATED/PUBLISHED e inmutabilidad publicada | E2E HTTP: publicación e inmutabilidad | El modo DRAFT es solo local y administrativo |
| Procedencia | Parcial | Persistencia de `DocumentFieldProvenance` y validación de fuentes | E2E y repository | No todas las fuentes tienen UI de captura genérica |
| Auditoría | Soportada | Eventos transaccionales de creación, validación, publicación y revisiones | E2E y registros del motor | No se auditó un flujo institucional externo en este sprint |

`Soportada` significa que existe implementación y una prueba concreta; no se
consideró suficiente que una propiedad aparezca únicamente en un schema.

## 3. Hallazgos priorizados

### Alta

1. **Divergencia potencial de validación frontend/backend.** El frontend
   mantiene validación propia en `useDynamicFormController.ts`, mientras que
   el backend usa AJV. Una definición válida en backend puede producir mensajes
   distintos o una aceptación distinta en Vue.

### Media

2. **Dependencias declarativas sin evaluación comprobada.** El backend valida
   la forma de `dependencyConfig`, pero no se demostró que el renderer o el
   servicio oculten/muestren campos de forma genérica.
3. **Alternativas `oneOf`/`anyOf` sin selector UI genérico.** La estructura es
   validada, pero el renderer no ofrece una experiencia específica para elegir
   variantes.
4. **Procedencia y generación incompletas en presentación.** La persistencia
   de procedencia existe, pero no todos los tipos tienen captura visual
   genérica; `generationConfig` no tiene ejecución demostrada.

### Baja

5. **Capacidades visuales avanzadas no demostradas.** Firma, responsables,
   paginación interna de tablas y layouts complejos permanecen fuera del
   alcance actual.

## 4. Mejoras implementadas

- `DocumentDefinitionValidator` ahora:
  - rechaza tipos desconocidos y tipos duplicados;
  - recorre `oneOf` y `anyOf`;
  - rechaza `required` y campos de sección inexistentes;
  - rechaza secciones duplicadas;
  - valida rutas completas de `fieldConfigs`, incluidos objetos y arreglos;
  - mantiene mappings restringidos al catálogo canónico.
- `UiFieldConfig` incorpora `readonly?: boolean`.
- `DynamicField.vue` aplica `readonly` a inputs, selects, checkboxes,
  textareas y controles de filas sin añadir lógica específica del Anexo 6.
- Se añadieron `generic-document-definition.json` y
  `generic-document-engine.spec.ts`, sin registrar ni publicar una plantilla.

## 5. Pruebas ejecutadas

| Comprobación | Resultado |
|---|---|
| Backend build | PASS |
| Backend lint | PASS |
| Backend unitarias | PASS — 13 suites, 41 pruebas |
| Backend E2E HTTP con PostgreSQL/Redis locales | PASS — 1 suite, 7 pruebas |
| Backend integración | OMITIDA — 4 suites y 9 pruebas skipped por configuración de integración |
| Prisma validate | PASS |
| Frontend typecheck | PASS |
| Frontend build | PASS |
| Frontend contract tests | PASS — 4; 1 smoke test omitido por variable de API real |
| Fixtures genéricos | PASS — incluidos en las pruebas unitarias |

Las pruebas E2E usaron usuarios, donantes y plantillas temporales sintéticas,
con limpieza posterior. No se modificó ni publicó el Anexo 6, ni se alteraron
versiones publicadas existentes.

## 6. Regresiones y limitaciones

El piloto Anexo 6 conserva su comportamiento validado: su definición, tablas,
campos nullable, enums, versionamiento DRAFT y recorrido dinámico continúan
cubiertos por las pruebas existentes. No se detectaron regresiones en build,
lint, unitarias, E2E o contratos.

Persisten estas limitaciones:

- no existe una validación frontend basada directamente en AJV compartida con
  backend;
- dependencias, cálculo, firmas y variantes `oneOf`/`anyOf` no tienen una
  experiencia genérica completa;
- las pruebas de integración dedicadas quedaron skipped por su configuración;
- no se ejecutó un escenario institucional adicional, porque el objetivo era
  probar generalización sin registrar nuevos anexos.

## 7. Recomendación

El siguiente anexo debería seleccionarse mediante la matriz documental
institucional, priorizando una fuente con estructura tabular clara, campos
identificables, reglas de obligatoriedad explícitas y sin requerir firma o
cálculo automático en la primera iteración. Antes de registrarlo, debe pasar
por homologación campo a campo y por fixtures sintéticos; no se recomienda
seleccionarlo automáticamente solo por similitud visual con Anexo 6.

## 8. Estado final

**PARCIALMENTE COMPLETADO.** El motor demuestra generalización para las
estructuras cubiertas por los fixtures y el piloto no presenta regresiones.
La auditoría identifica y documenta las brechas de capacidades avanzadas que
deben resolverse antes de afirmar soporte genérico completo.
