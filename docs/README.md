# Documentación — GODT-B

Documentación técnica y de seguimiento del backend GODT Regional 3.

## Documentos vigentes

| Documento | Propósito |
|---|---|
| [Arquitectura](./arquitectura.md) | Arquitectura implementada y diagramas Mermaid de contexto y contenedores. |
| [Requisitos](./requisitos.md) | Historias, criterios de aceptación y requisitos no funcionales. |
| [ADR-001](./adr/ADR-001-stack.md) | Decisión de lenguaje y frameworks. |
| [ADR-002](./adr/ADR-002-datos-y-despliegue.md) | Decisión de base de datos y despliegue. |
| [Contrato de API documental](./document-api-contract.md) | Contratos del módulo documental. |
| [Modelo de datos documental](./document-data-model.md) | Entidades y relaciones documentales. |
| [Ciclo de vida documental](./document-lifecycle.md) | Estados y reglas de transición. |
| [Catálogo dinámico](./dynamic-document-catalog.md) | Plantillas y formularios dinámicos. |
| [Postman](./postman/README.md) | Colección y ambiente de pruebas de API. |

## Histórico de sprints

Los documentos existentes de seguimiento se conservaron y agruparon por sprint:

- [Sprint 01](./sprints/sprint-01/README.md)
- [Sprint 02](./sprints/sprint-02/README.md)
- [Sprint 03](./sprints/sprint-03/README.md)
- [Sprint 04](./sprints/sprint-04/README.md)
- [Sprint 05](./sprints/sprint-05/)
- [Sprint 06](./sprints/sprint-06/)
- [Sprint 07](./sprints/sprint-07/)
- [Sprint 08](./sprints/sprint-08/)
- [Sprint 09](./sprints/sprint-09/)

## Auditorías y referencias técnicas

Los informes FASE_* permanecen en el directorio principal de `docs/` como evidencia de auditorías y etapas técnicas; no se mezclan con el historial de Sprints. Los inventarios, matrices, reglas de dependencia y diseños del motor documental también permanecen en `docs/`.

## Convención

- Arquitectura, requisitos y ADR son documentación vigente.
- `docs/sprints/sprint-NN/` contiene el seguimiento histórico de cada sprint.
- `docs/postman/` contiene artefactos para probar los contratos HTTP.
- Los documentos históricos se reubicaron sin reescribir su contenido.
