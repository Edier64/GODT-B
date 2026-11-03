# Sprint 08 — informe de implementación

## Resultado

Se seleccionó el Anexo 6 como piloto y se produjo una definición conservadora
de `jsonSchema`, `uiSchema` y `mappingConfig` compatible con el motor
documental actual. La definición permanece fuera de PostgreSQL, en estado
`DRAFT`, y no se publicó.

## Clasificación

| Área | Estado | Evidencia |
|---|---|---|
| Selección del piloto | Implementado | `SPRINT_08_PILOT_SELECTION.md` |
| Inventario y fuente | Validado técnicamente | Inventario Sprint 07, hash y PDF original local |
| Matriz campo a campo | Implementado | `SPRINT_08_FIELD_HOMOLOGATION.md` |
| JSON Schema | Validado técnicamente como propuesta | `DocumentDefinitionValidator` acepta tipos, objetos, arreglos, enums y formatos |
| UI Schema | Validado técnicamente como propuesta | Secciones y `fieldConfigs` de tablas cumplen el contrato vigente |
| Mappings | Validado técnicamente como propuesta | Solo `rndCode` e `originatingIpsName` del catálogo canónico |
| Renderizado | Disponible | `DynamicField.vue` y `useDynamicFormController.ts` ya soportan los tipos usados |
| Catálogo API | Disponible | `GET /api/v1/document-catalog` y versiones autenticadas |
| Instanciación | Condicionada | El backend solo permite instancias normales con versión `PUBLISHED` |
| Caché | Disponible | IndexedDB conserva definiciones autorizadas; no contiene respuestas clínicas |
| Comparación visual | Parcial | Estructura comparada; no se validaron logos, paginación ni firma |
| Aprobación institucional | Pendiente | No existe evidencia de homologación formal |
| Publicación | Bloqueada intencionalmente | La plantilla no se inserta ni publica automáticamente |

## Contratos utilizados

- `GET /api/v1/document-catalog`
- `GET /api/v1/document-catalog/:id/versions`
- `POST /api/v1/document-catalog` (solo ADMIN; no ejecutado)
- `POST /api/v1/document-catalog/:id/versions` (solo ADMIN; no ejecutado)
- `POST /api/v1/document-catalog/:id/versions/:versionId/validate`
- `POST /api/v1/document-catalog/:id/versions/:versionId/publish`
- `POST /api/v1/donors/:donorId/document-instances` únicamente para versiones
  publicadas

No se modificaron endpoints, DTO, modelos Prisma, permisos ni migraciones.

## Pruebas y validación

Durante este incremento se realizó:

- Inspección visual del PDF original Anexo 6.
- Extracción estructural y contraste con la inspección visual.
- Revisión de `DocumentDefinitionValidator`,
  `DocumentResponseValidator`, `DocumentEngineService` y repositorio Prisma.
- Revisión del renderer Vue, controlador dinámico, servicios de catálogo,
  caché y vistas.
- Confirmación de que la fuente original permanece local e ignorada por Git.

No se ejecutaron operaciones HTTP reales contra PostgreSQL/Redis/backend
porque no se confirmó infraestructura disponible. No se afirma integración
real ni publicación.

## Pendientes para aprobación

1. Confirmar obligatoriedad campo a campo.
2. Confirmar catálogos y etiquetas institucionales.
3. Decidir si las filas fijas deben permanecer fijas en la UI.
4. Definir relación de persistencia con `OrganRecoverySurgery` y
   `TissueRecoveryProcedure`, sin ampliar mappings no aprobados.
5. Definir firma institucional fuera del alcance de este motor.
6. Ejecutar validación de versión por ADMIN y revisión institucional.
7. Solo después, decidir si corresponde publicar una versión.

## Estado de cierre

**PARCIAL.** El proceso de homologación produjo un primer anexo real y una
propuesta técnica reproducible, pero no existe aprobación institucional,
publicación ni evidencia de ejecución contra backend real.
