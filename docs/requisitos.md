# Requisitos del sistema — GODT Regional 3

**Fecha de elaboración:** 14 de noviembre de 2026  
**Alcance:** Requisitos funcionales y no funcionales compartidos por backend y frontend.  
**Repositorios:** [GODT-B](https://github.com/Edier64/GODT-B) y [GODT-Frontend](https://github.com/Edier64/GODT-Frontend).

> Este documento consolida las capacidades descritas en los README, los registros de cobertura y las decisiones arquitectónicas de los repositorios. No representa una certificación institucional ni reemplaza la homologación de los formatos. Los valores o metas marcados como **PROPUESTA** no se consideran requisitos aprobados.

## 1. Descripción del proyecto

1. GODT Regional 3 es un sistema web para apoyar la gestión operativa y documental de los procesos de donación y trasplante de órganos y tejidos.
2. Centraliza la información de donantes, los procesos de donación, las instituciones participantes y los documentos clínicos asociados.
3. Permite diligenciar formatos institucionales mediante formularios dinámicos definidos por esquemas, con validaciones y reutilización controlada de datos.
4. Apoya la lectura de historias clínicas y soportes mediante OCR e IA, manteniendo la revisión humana de los datos extraídos.
5. Gestiona el ciclo de vida documental, las atestaciones de participantes, la cadena de custodia y la consolidación de expedientes con verificación de integridad.

## 2. Funciones identificadas

Las siguientes capacidades se encuentran descritas en la documentación de los repositorios:

- **Acceso institucional:** inicio y cierre de sesión, renovación de sesión, revocación y protección de rutas.
- **Tablero operativo:** métricas de donantes en valoración, activos y cerrados; accesos a procesos abiertos y alertas institucionales.
- **Donantes y procesos:** consulta de la ficha del donante, código RND, datos antropométricos y serología; creación y consulta de procesos; asignación de IPS con roles y registro de participantes clínicos y representantes legales.
- **Documentos fuente:** carga y consulta de documentos clínicos en almacenamiento privado, con cálculo de hash SHA-256.
- **Catálogo y formularios:** catálogo de plantillas versionadas y formularios dinámicos basados en JSON Schema y UI Schema. El registro de cobertura describe 19 formatos normativos y cuatro posiciones reservadas (20 a 23) sin plantilla habilitada por estar pendientes de homologación.
- **OCR e IA:** extracción de candidatos, puntuaciones de confianza, evidencia textual y cuadros delimitadores; el usuario puede confirmar, editar o rechazar cada candidato.
- **Diccionario canónico:** valores asociados al donante, al proceso o al documento; reglas de propagación, procedencia, historial y resolución justificada de conflictos.
- **Ciclo documental:** borradores, validación, completitud, snapshots inmutables, PDF, participantes, atestaciones y liberación.
- **Cadena de custodia y dossier:** registro cronológico de eventos, consulta de trazabilidad, exportación de PDF/ZIP y verificación de integridad mediante SHA-256.

### 2.1 Stack tecnológico identificado

| Componente | Tecnologías |
|---|---|
| Frontend | Vue 3 (Composition API), TypeScript, Vite, Pinia, Vue Router, Tailwind CSS v4 y Axios |
| Backend | NestJS, TypeScript y arquitectura modular orientada al dominio |
| Persistencia | PostgreSQL y Prisma ORM |
| Procesamiento asíncrono | BullMQ |
| OCR e IA | Google Gemini multimodal y alternativas locales como Tesseract |
| Documentos | JSON Schema, UI Schema, generación PDF con pdf-lib y exportación ZIP |
| Integridad y seguridad | SHA-256, JWT, cookies HttpOnly y Argon2id |
| Despliegue y almacenamiento | Docker, Nginx, Azure Container Apps y Azure Blob Storage privado |

## 3. Historias de usuario

### HU-01. Acceso institucional y administración de sesión

**Como** usuario institucional, **quiero** iniciar y cerrar sesión de forma segura, **para** acceder únicamente a las funciones protegidas del sistema con mi sesión autorizada.

**Criterios de aceptación**

1. **Dado** que tengo una cuenta institucional habilitada, **cuando** ingreso mis credenciales correctas, **entonces** el sistema inicia la sesión y permite acceder a las rutas protegidas.
2. **Dado** que mi token de acceso vence y mi sesión de renovación sigue vigente, **cuando** realizo una operación que requiere autenticación, **entonces** el cliente intenta renovar la sesión de forma controlada antes de continuar.
3. **Dado** que solicito cerrar sesión, **cuando** el sistema procesa la solicitud, **entonces** revoca la sesión de renovación y deja de permitir el acceso a las vistas protegidas.

### HU-02. Consulta del tablero operativo

**Como** usuario institucional con acceso al tablero, **quiero** consultar el resumen de donantes y procesos abiertos, **para** tener una visión general de la actividad operativa.

**Criterios de aceptación**

1. **Dado** que inicio sesión y tengo acceso al tablero, **cuando** abro la vista principal, **entonces** puedo consultar las métricas de donantes en valoración, activos y cerrados.
2. **Dado** que existen procesos de donación abiertos o alertas institucionales, **cuando** consulto el tablero, **entonces** se muestran los accesos rápidos y las alertas disponibles.
3. **Dado** que selecciono un proceso desde el tablero, **cuando** navego a su detalle, **entonces** el sistema presenta la información del proceso correspondiente.

### HU-03. Gestión de donantes y procesos de donación

**Como** coordinador operativo, **quiero** consultar donantes y gestionar sus procesos de donación con las instituciones y participantes relacionados, **para** mantener organizada la información del operativo.

**Criterios de aceptación**

1. **Dado** que existen donantes registrados, **cuando** consulto el módulo de expedientes, **entonces** puedo acceder a su ficha con los datos disponibles, como código RND, datos antropométricos y serología.
2. **Dado** que debo iniciar un operativo, **cuando** registro un proceso de donación, **entonces** el sistema permite consultar su detalle y relacionarlo con las instituciones participantes y sus roles.
3. **Dado** que un proceso requiere responsables, **cuando** registro participantes clínicos o representantes legales, **entonces** quedan asociados al proceso para su consulta y uso en el flujo documental.

### HU-04. Gestión de documentos clínicos fuente

**Como** integrante del equipo clínico, **quiero** adjuntar y consultar documentos de soporte del donante, **para** conservar la documentación de origen relacionada con el proceso.

**Criterios de aceptación**

1. **Dado** que estoy autorizado para gestionar el expediente, **cuando** adjunto un documento fuente admitido por la aplicación, **entonces** el sistema lo almacena en el repositorio privado correspondiente.
2. **Dado** que un documento fue almacenado, **cuando** consulto sus datos o lo visualizo, **entonces** puedo identificar el documento asociado y su huella SHA-256.
3. **Dado** que no tengo autorización para acceder a un documento, **cuando** intento consultarlo o descargarlo, **entonces** el backend rechaza la operación.

### HU-05. Extracción y revisión de información mediante OCR

**Como** profesional que diligencia información clínica, **quiero** revisar los datos candidatos extraídos de historias clínicas y soportes, **para** reutilizar información sin aceptar automáticamente resultados que no haya verificado.

**Criterios de aceptación**

1. **Dado** que se ha procesado un documento compatible, **cuando** consulto el resultado OCR, **entonces** puedo revisar los candidatos, la confianza disponible y la evidencia textual asociada.
2. **Dado** que un candidato requiere verificación, **cuando** lo reviso, **entonces** puedo confirmarlo, editarlo o rechazarlo.
3. **Dado** que un dato no ha sido confirmado por una persona, **cuando** se muestra en el flujo de revisión, **entonces** permanece identificado como candidato y no se trata como un valor confirmado.

### HU-06. Diligenciamiento de anexos y reutilización controlada de datos

**Como** profesional o coordinador que diligencia un proceso, **quiero** iniciar y completar los formularios de los anexos aplicables utilizando sus campos y validaciones, **para** registrar la información del operativo de manera consistente.

**Criterios de aceptación**

1. **Dado** que una posición del paquete tiene una plantilla habilitada, **cuando** inicio su instancia documental, **entonces** el sistema presenta los campos definidos en la versión correspondiente del JSON Schema y UI Schema. Las posiciones 20 a 23, identificadas como pendientes de homologación, no se habilitan para diligenciamiento.
2. **Dado** que ingreso o modifico respuestas de un anexo, **cuando** guardo o solicito validar el documento, **entonces** el sistema conserva el borrador y aplica las reglas de estructura, obligatoriedad y aplicabilidad configuradas para la plantilla.
3. **Dado** que un valor canónico entra en conflicto con un valor local de un documento, **cuando** se solicita resolver el conflicto, **entonces** el sistema permite conservar el valor actual, aceptar el candidato o registrar una corrección manual con justificación.

### HU-07. Validación, generación y atestación de documentos

**Como** participante asignado a un documento, **quiero** completar las etapas documentales y registrar mi atestación cuando corresponda, **para** dejar constancia de la versión revisada y de los responsables del documento.

**Criterios de aceptación**

1. **Dado** que el documento cumple sus reglas y dependencias, **cuando** solicito validarlo y completarlo, **entonces** el sistema aplica las transiciones permitidas del ciclo de vida y verifica los participantes mínimos configurados.
2. **Dado** que el documento está completado, **cuando** solicito generar su versión oficial, **entonces** el sistema crea un snapshot inmutable y un PDF asociado a la versión exacta de los datos y participantes.
3. **Dado** que el snapshot requiere atestaciones, **cuando** los participantes registran las modalidades habilitadas, **entonces** cada registro queda asociado al snapshot correspondiente y el documento solo avanza según las firmas o atestaciones obligatorias configuradas. La modalidad de firma digital certificada permanece bloqueada según la documentación técnica.

### HU-08. Cadena de custodia y consolidación del expediente

**Como** responsable de la trazabilidad documental, **quiero** registrar eventos de custodia y consolidar el expediente del proceso, **para** consultar la secuencia de eventos y comprobar la integridad de los documentos entregados.

**Criterios de aceptación**

1. **Dado** que tengo autorización para registrar un evento de custodia, **cuando** ingreso sus datos, **entonces** el sistema lo incorpora a la secuencia cronológica con su número de orden y conserva el registro sin permitir su modificación o eliminación.
2. **Dado** que el expediente está disponible para exportación, **cuando** solicito su consolidación, **entonces** el sistema genera los paquetes PDF y ZIP y el manifiesto de integridad con los documentos que corresponden según las reglas de inclusión.
3. **Dado** que recibo un expediente exportado, **cuando** ejecuto la verificación de integridad, **entonces** el sistema compara las huellas y reporta si el contenido coincide o si detecta alteraciones.

## 4. Requisitos no funcionales

Los siguientes requisitos son medibles y se basan en controles o límites documentados en el repositorio:

| ID | Requisito | Medición / criterio verificable |
|---|---|---|
| RNF-01 | Seguridad de autenticación | El secreto JWT debe tener al menos 32 caracteres. Las contraseñas se protegen con Argon2id. La renovación de sesión utiliza cookie HttpOnly; en producción debe estar configurada como Secure y con política SameSite restrictiva. |
| RNF-02 | Integridad documental | Los documentos fuente y los PDF generados deben contar con huella SHA-256. La verificación debe reconocer coincidencias y detectar modificaciones del contenido; los casos de prueba de integridad deben cubrir ambos resultados. |
| RNF-03 | Adaptabilidad de interfaz | La interfaz debe superar pruebas en 1920×1080, 1366×768, 1024×768, 768×1024 y 390×844, sin desbordamiento horizontal de la página. Los componentes que lo requieren —como la tabla apaisada de cadena de custodia— pueden tener desplazamiento interno controlado. |
| RNF-04 | Protección del procesamiento de archivos | La verificación de archivos ZIP debe rechazar paquetes con más de 500 entradas o con más de 500 MB de contenido total descomprimido. |

## 5. Historias incompletas o ambiguas

Los siguientes puntos requieren confirmación antes de considerar cerrada la especificación:

1. **Homologación institucional de formatos:** la documentación de Fase D.1 indica que las posiciones normativas están pendientes de homologación institucional. El reporte D.3 describe 19 formatos técnicamente completos. Debe mantenerse la diferencia entre completitud técnica y aprobación institucional; no se debe presentar un formato como institucionalmente aprobado sin el soporte correspondiente.
2. **Campos y ubicación de los anexos:** existe una diferencia entre el reporte D.3, que registra los 19 formatos como completos, y los pendientes actuales de revisar campos faltantes y ubicación de datos en los PDF. Hace falta definir cuál inventario y versión del formato original será la referencia final, y validar anexo por anexo con evidencia visual.
3. **Posiciones 20 a 23:** están reservadas y marcadas como PENDING_HOMOLOGATION, sin plantilla habilitada. Su contenido y comportamiento futuro no pueden especificarse hasta contar con la documentación oficial y su homologación.
4. **Roles y permisos:** se mencionan perfiles como ADMIN, COORDINATOR y roles de participantes por documento o institución. Falta una matriz única que indique qué acciones puede realizar cada rol, sobre qué IPS y sobre qué procesos o documentos.
5. **Atestaciones y alcance jurídico:** las modalidades descritas incluyen atestación de usuario, firma dibujada y constancia manuscrita presencial. La firma digital certificada está bloqueada. Deben confirmarse las modalidades aceptadas por la institución y sus textos de declaración; la huella SHA-256 acredita integridad técnica, no sustituye por sí sola una firma digital certificada.
6. **OCR y revisión humana:** se muestran puntuaciones de confianza y evidencia, pero no se define un umbral para marcar un candidato como dudoso, ni el comportamiento requerido cuando la extracción no obtiene resultados suficientes.
7. **Rendimiento y disponibilidad:** los documentos revisados no fijan tiempos máximos de respuesta, concurrencia esperada, disponibilidad mensual ni objetivos de recuperación (RPO/RTO). Estos valores deben acordarse con los responsables operativos y de infraestructura.
8. **Retención y ciclo de conservación:** se describe inmutabilidad documental y almacenamiento privado, pero falta especificar por cuánto tiempo se conservan expedientes, documentos fuente, auditorías, snapshots y exportaciones, así como el procedimiento institucional de eliminación o archivo cuando aplique.

## 6. Trazabilidad con los repositorios

- **Backend — GODT-B:** autenticación, reglas de negocio, persistencia, procesos, catálogo y esquemas, diccionario canónico, OCR, ciclo documental, PDF, custodia, dossier y verificación de integridad.
- **Frontend — GODT-Frontend:** acceso institucional, tablero, vistas de donantes y procesos, carga y revisión de documentos, formularios dinámicos, revisión OCR, finalización y consulta de dossier.
- **Documentación técnica de referencia:** README de ambos repositorios; ADR_004_CANONICAL_DICTIONARY_AND_PROPAGATION.md; ADR_005_DOCUMENT_LIFECYCLE_SNAPSHOTS_AND_SIGNATURES.md; FASE_D1_DOCUMENT_INVENTORY_RECONCILIATION.md; FASE_D3_FUNCTIONAL_COVERAGE.md; FASE_F_SECURITY_AUDIT.md; y los reportes de estabilización de interfaz.

---

**Nota de alcance:** las historias describen las capacidades documentadas del producto. Los puntos señalados en la sección 5 son decisiones pendientes de precisión o validación, no funcionalidades nuevas asumidas.
