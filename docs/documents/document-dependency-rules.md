# Reglas versionadas de dependencia documental

## Objetivo

Las relaciones entre documentos describen disponibilidad, requisitos y
procedencia, pero no imponen una secuencia rígida de anexos. Un expediente puede
tener documentos en paralelo, documentos opcionales o documentos que dependen
de una variante de procedimiento.

## Tipos de relación

| Tipo | Significado | Efecto |
|---|---|---|
| `REQUIRED` | El documento requerido debe existir y estar en estado aprobado | Bloquea la validación del dependiente |
| `OPTIONAL` | Puede existir, pero no es requisito | No bloquea |
| `CONDITIONAL` | Aplica si una expresión declarativa evaluada es verdadera | Bloquea solo cuando aplica |
| `VARIANT` | Selecciona una definición según procedimiento/categoría | Requiere una variante compatible |
| `PARALLEL` | Puede crearse sin esperar otro documento | No crea dependencia de orden |
| `VALIDATED_INPUT` | Requiere datos aprobados de otro documento o fuente | Bloquea solo los campos afectados |

## Persistencia propuesta

Agregar una configuración versionada asociada a `TemplateVersion`:

```text
TemplateDependencyRule
  id
  ownerTemplateVersionId
  dependencyTemplateCode
  dependencyVersionConstraint?
  relationType
  conditionExpression?
  requiredState?
  sourceFieldMappings JSONB
  ruleVersion
  status
  createdBy
  createdAt
```

La regla debe quedar congelada cuando la versión se publica. Si cambia la
condición, se crea una nueva versión de la plantilla propietaria.

## Expresiones permitidas

Las condiciones solo pueden usar un lenguaje declarativo con operadores
limitados, por ejemplo:

```json
{
  "all": [
    { "field": "procedure.kind", "equals": "TISSUE_RECOVERY" },
    { "field": "procedure.tissueCategory", "in": ["OCULAR", "PIEL"] }
  ]
}
```

No se ejecuta JavaScript, SQL ni código almacenado en una plantilla. El
evaluador debe rechazar operadores no permitidos, referencias desconocidas,
ciclos y profundidad excesiva.

## Evaluación

1. Resolver la versión exacta de la instancia.
2. Evaluar las reglas de esa versión contra un contexto mínimo.
3. Consultar existencia y estado de documentos relacionados.
4. Reportar cada incumplimiento como conflicto o requisito faltante.
5. No crear documentos automáticamente sin una orden explícita.
6. Auditar la evaluación con versión de reglas y resultado resumido.

## Ejemplos no secuenciales

- Anexo 5 y una evaluación complementaria pueden diligenciarse en paralelo.
- Anexo 8 puede crearse cuando aparece el primer elemento de custodia y crecer
  con eventos, sin esperar la generación del Anexo 9.
- Las actas de tejidos y las fichas de órganos son variantes paralelas de un
  procedimiento de recuperación.
- Anexo 9 puede requerir Anexo 6 y Anexo 7 solo si el proceso medicolegal aplica.

## Integridad

- Prohibir ciclos de dependencia en publicación.
- Versionar condiciones y mappings.
- Mantener reglas históricas para instancias antiguas.
- Distinguir “documento ausente” de “documento existente pero no aprobado”.
- Las reglas clínicas o jurídicas no documentadas no se deben inferir.
