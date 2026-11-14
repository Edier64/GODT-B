# Documentación — GODT-B

Índice de la documentación técnica, funcional y de seguimiento del backend GODT Regional 3.

## Documentación principal

| Documento | Contenido |
|---|---|
| [Arquitectura](./arquitectura.md) | Diagrama de contexto, diagrama de contenedores, tecnologías y protocolos. |
| [Requisitos](./requisitos.md) | Historias de usuario, criterios de aceptación y requisitos no funcionales. |
| [Análisis de arquitectura y revisión senior](./analisis-arquitectura-y-revision.md) | Contraste con entregables iniciales, dependencias, decisiones y revisión OCR. |

## Decisiones arquitectónicas

- [ADR-001 — Stack de lenguaje y frameworks](./adr/ADR-001-stack.md)
- [ADR-002 — Base de datos y plataforma de despliegue](./adr/ADR-002-datos-y-despliegue.md)
- [ADR-004 — Diccionario canónico y propagación](./adr/ADR-004-canonical-dictionary-and-propagation.md)
- [ADR-005 — Ciclo de vida, snapshots y firmas](./adr/ADR-005-document-lifecycle-snapshots-and-signatures.md)

## Documentación por área

| Carpeta | Qué contiene |
|---|---|
| [domain/](./domain/) | Modelo y conceptos del dominio, proceso de donación y diccionario canónico. |
| [documents/](./documents/) | Motor documental, plantillas, dependencias, formularios, campos, PDF y ciclo de vida. |
| [ocr/](./ocr/) | Diseño del flujo de ingesta y OCR asistido. |
| [api/](./api/) | Contrato documental, guía Postman, colección y ambiente. |
| [Despliegue Azure Container Apps](./deployment/azure-container-apps.md) | Arquitectura cloud, recursos y procedimiento de despliegue. |
| [audits/](./audits/) | Informes de Fases D, E, F, G1 y notas de correcciones técnicas. |

## Pruebas y calidad

- [Sesión 3 — Pruebas e integración continua](./testing/sesion-3-pruebas-e-integracion-continua.md): pruebas unitarias, pruebas HTTP y workflow CI.

## Histórico de sprints

Los documentos de seguimiento se agrupan por sprint, conservando su contenido original:

- [Sprint 01](./sprints/sprint-01/README.md)
- [Sprint 02](./sprints/sprint-02/README.md)
- [Sprint 03](./sprints/sprint-03/README.md)
- [Sprint 04](./sprints/sprint-04/README.md)
- [Sprint 05](./sprints/sprint-05/)
- [Sprint 06](./sprints/sprint-06/)
- [Sprint 07](./sprints/sprint-07/)
- [Sprint 08](./sprints/sprint-08/)
- [Sprint 09](./sprints/sprint-09/)

## Guía de organización

- Los documentos principales se conservan en la raíz de `docs/`.
- Los ADR se agrupan en `docs/adr/`.
- Los informes históricos de sprint se guardan en `docs/sprints/sprint-NN/`.
- Las auditorías se agrupan por fase en `docs/audits/phase-*/`.
- Los documentos del dominio, motor documental, OCR, API y despliegue se separan por responsabilidad.
- Los documentos fueron reubicados conservando el contenido; los cambios de nombre solo normalizan rutas y convenciones de documentación.
