# Sprint 08.3 — Validación visual y funcional integral del Anexo 6

## Estado final

**COMPLETADO** para el alcance técnico del piloto local. El Anexo 6 se abrió
desde Vue, se cargó desde la API real, se renderizó desde `uiSchema.sections` y
`jsonSchema`, se diligenció con datos sintéticos y se guardó mediante el backend
real. La instancia recuperada conservó la versión `0.1.0` en estado `DRAFT`.

La plantilla no fue publicada y la aceptación institucional clínica, jurídica y
visual del documento oficial permanece fuera de este sprint.

## 1. Estado inicial

Se revisó `SPRINT_08_2_VALIDATION_REPORT.md`, el estado Git de ambos repositorios,
la configuración Vite, el store de autenticación, los controladores de catálogo
y de instancias, `DynamicField.vue`, `useDynamicFormController.ts` y las rutas
del frontend.

La infraestructura local utilizada fue:

- PostgreSQL y Redis mediante el `docker-compose.yml` existente.
- Backend NestJS en `http://localhost:3000`.
- Frontend Vite en `http://127.0.0.1:5173`.
- JWT ADMIN sintético con alcance institucional vacío.
- `NODE_ENV=development`.
- `DOCUMENT_ENGINE_ALLOW_DRAFT_INSTANCES=true` únicamente en el proceso local.

No se encontró una suite Playwright/Cypress versionada en el frontend. Se
reutilizó la automatización de navegador disponible en VS Code, sin agregar
dependencias.

## 2. Componentes revisados

- `CatalogView.vue`
- `NewDocumentInstanceView.vue`
- `DocumentFormView.vue`
- `DynamicField.vue`
- `useDocumentCatalogController.ts`
- `useDocumentInstancesController.ts`
- `useDynamicFormController.ts`
- `documentCatalog.ts`
- store de autenticación y cliente Axios

La autenticación conserva el JWT en la sesión del navegador y el backend sigue
siendo responsable de autorización.

## 3. Cambios realizados

### Etiquetas de tablas

Las celdas de tablas mostraban rutas técnicas como
`$.organRecoveries[0].component`. El renderer ahora utiliza las etiquetas
de `uiSchema.fieldConfigs.columns`, por ejemplo:

- `Componente`
- `Institución responsable`
- `Causa de no extracción`
- `Procedimiento`
- `Destino`
- `Banco responsable`

Cuando una definición no proporciona etiqueta, se genera una etiqueta legible a
partir del nombre de la propiedad, sin alterar la ruta JSON.

### Claridad del estado de versión

Se ajustaron textos que afirmaban que toda versión era publicada. El formulario
ahora muestra explícitamente `v0.1.0 · DRAFT` y describe que la definición
proviene del backend. La vista de instancia indica que la estructura corresponde
a la versión exacta utilizada.

No se modificaron schemas, reglas clínicas, permisos ni contratos API.

## 4. Evidencia del recorrido visual real

Página utilizada:

```text
http://127.0.0.1:5173/catalogo-documental?donorId=789e7cc3-7f25-4c8e-a2e7-439579209309
```

Recorrido verificado:

1. Se inició sesión desde la vista Vue de acceso con JWT ADMIN sintético.
2. El catálogo mostró `Anexo 6 - Registro general de extracción`.
3. La versión `0.1.0` apareció con estado `DRAFT`.
4. Se abrió la ruta de nueva instancia desde el catálogo.
5. Se observaron las ocho secciones recibidas desde `uiSchema.sections`:
   Identificación, Cirugía de rescate o extracción, Registro de órganos
   rescatados, Personal responsable, Estudios de inmunogenética, Soluciones de
   preservación, Registro de tejidos para rescate y Hallazgos y responsable.
6. El navegador mostró cuatro tablas dinámicas, enums y campos nullable.
7. Se diligenciaron datos sintéticos:
   - código: `PILOT-A6-VUE`;
   - ciudad: `Ciudad Sintética`;
   - IPS: `IPS Sintética de Prueba`.
8. Se pulsó `Crear instancia`.
9. El navegador recibió `201` en
   `POST /api/v1/donors/:donorId/document-instances`.
10. Vue navegó a la instancia persistida y recuperó sus datos mediante
    `GET /api/v1/document-instances/:id`.
11. La instancia mostró `DRAFT`, versión `0.1.0`, el código y la ciudad
    diligenciados.

La herramienta de navegador permitió capturar evidencia visual de la vista de
instancia persistida. La captura se mantuvo como evidencia de sesión y no se
guardó como archivo del repositorio.

## 5. Endpoints reales utilizados

- `GET /api/v1/document-catalog` — `200`
- `GET /api/v1/document-catalog/:id/versions` — `200`
- `POST /api/v1/donors/:donorId/document-instances` — `201`
- `GET /api/v1/document-instances/:id` — `200`

La API fue consumida mediante el proxy Vite hacia el backend local. No se
utilizaron mocks ni respuestas hardcodeadas.

## 6. Autorización y errores HTTP

Se ejecutaron solicitudes reales con JWT sintéticos:

| Caso | Resultado |
|---|---:|
| Solicitud sin autenticación al catálogo | `401` |
| Usuario `SURGEON` intentando crear instancia DRAFT | `403` |
| ADMIN con versión inexistente | `404` (`Version not found`) |
| ADMIN con modo DRAFT deshabilitado | `422` |
| Instancia con respuesta incompatible validada | `201`, `valid: false`, 7 errores |

La creación de una respuesta incompatible puede persistirse como borrador; la
validación posterior es la que devuelve `valid: false` y los errores JSON Schema.
Esto coincide con el contrato de revisiones del motor y no se presentó como
éxito válido.

El modo DRAFT deshabilitado se probó en un segundo backend local con
`DOCUMENT_ENGINE_ALLOW_DRAFT_INSTANCES=false`. No se probó producción real, pero
la condición de código exige además `NODE_ENV=development`, por lo que la bandera
no habilita DRAFT en producción.

## 7. Resultados automatizados y regresión

### Frontend

```text
npm run build
```

- `vue-tsc --noEmit`: correcto.
- Vite build: correcto.

```text
npm run test:contracts
```

- 4 pruebas exitosas.
- 1 prueba omitida porque requiere API real.
- 0 fallos.

### Backend

Se reutilizaron los resultados del Sprint 08.2 para el backend sin cambios en
este sprint:

- build correcto;
- lint correcto;
- 12 suites Jest;
- 36 pruebas exitosas;
- PostgreSQL, Redis y flujo HTTP real verificados.

## 8. Problemas encontrados y corregidos

| Problema | Corrección |
|---|---|
| Etiquetas internas JSON visibles en celdas de tabla | Uso de labels de `fieldConfigs.columns` y fallback legible |
| Texto que describía la plantilla como publicada | Mensajes neutrales y badge explícito `DRAFT` |
| Falta de evidencia visual de instancia persistida | Recorrido navegador real y captura de la vista recuperada |

No se detectaron errores que requirieran cambios en backend, Prisma o contratos.

## 9. Seguridad y datos

- Se usaron únicamente datos sintéticos.
- No se enviaron historias clínicas a servicios externos.
- No se almacenaron respuestas clínicas en IndexedDB.
- El PDF institucional original no fue modificado, copiado ni publicado.
- No se publicó la plantilla.
- No se modificaron versiones publicadas ni otros anexos.
- No se realizaron commits, push ni cambios de rama.

El endpoint temporal usado para entregar el JWT sintético estuvo limitado a
localhost durante la prueba y se detuvo al finalizar.

## 10. Pendientes

- Crear una suite E2E versionada para CI cuando el proyecto defina credenciales
  sintéticas y estrategia de arranque de servicios.
- Realizar revisión visual institucional contra el PDF original.
- Aprobar clínica, jurídica e institucionalmente la homologación antes de
  cambiar el estado de la plantilla.
- Publicar solo mediante el flujo administrativo existente y una aprobación
  explícita.
