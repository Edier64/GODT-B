# REGISTRO DE COBERTURA FUNCIONAL DOCUMENTAL — FASE D.3
## GODT REGIONAL 3 — SISTEMA CLÍNICO-DOCUMENTAL DE DONACIÓN Y TRASPLANTES

**Fecha:** Noviembre 2026  
**Versión:** 1.0.0 (Fase D.3)  
**Entorno:** Backend NestJS + PostgreSQL + Redis / Frontend Vue 3 + Pinia + Vite + Tailwind  
**Responsable:** Arquitecto de Software Senior y Desarrollador Full Stack  

---

## 1. RESUMEN EJECUTIVO DE COBERTURA DOCUMENTAL

En la Fase D.3 se logró el cierre y completitud funcional de los **10 formatos clasificados previamente como parciales**, alcanzando una cobertura del **100% de los 19 formatos normativos institucionales** de GODT Regional 3 en estado **`COMPLETE`**.

### Resumen Numérico
- **Formatos normativos evaluados:** 19
- **Formatos en estado `COMPLETE`:** 19 (100%)
- **Formatos en estado `PARTIAL`:** 0 (0%)
- **Posiciones reservadas PENDING_HOMOLOGATION (20 a 23):** 4 (estrictamente reservadas, sin invención artificial)
- **Documentos clínicos de soporte como SourceDocument:** 4 (Cálculo Hemodilución, Evaluación riesgo COVID-19, HC Donante 2024, Historia Clínica Tissue Bank)
- **Pruebas HTTP reales automatizadas:** 20 operaciones ejecutadas contra PostgreSQL y Redis reales (100% aprobadas)
- **Pruebas de navegador E2E automatizadas:** Flujo completo con Google Chrome headless CDP (100% aprobado)

---

## 2. MATRIZ MAESTRA DE LOS 19 FORMATOS NORMATIVOS

| # | Código Formato | Título Oficial / Fuente | Plantilla Seed | Campos | Validaciones | Marcadores Canónicos | Firmas / Rol | PDF Engine | Estado D.3 |
|---|---|---|---|---|---|---|---|---|---|
| 1 | `ANEXO_1` | Valoración y alerta de posible donante | `TPL-ANEXO-1` (v1.0.0) | 16 campos | JSON Schema / Tipos | 6 marcadores | Coord. Operativo | `renderAnexo1` | **COMPLETE** |
| 2 | `ANEXO_2` | Notificación a deudos (Ley 1805/2016) | `TPL-ANEXO-2` (v1.0.0) | 12 campos | JSON Schema / Cédulas | 4 marcadores | Testigo / Notificado | `renderAnexo2` | **COMPLETE** |
| 3 | `ANEXO_3` | Consentimiento informado familiar | `TPL-ANEXO-3` (v1.0.0) | 13 campos | JSON Schema / Parentesco | 4 marcadores | Familiar / Coord. | `renderAnexo3` | **COMPLETE** |
| 4 | `ANEXO_4` | Registro de donante y oferta de componentes | `TPL-ANEXO-4` (v1.0.0) | 15 campos | JSON Schema / RND | 7 marcadores | Médico Tratante / Coord. | `renderAnexo4` | **COMPLETE** |
| 5 | `ANEXO_5` | Remisión de muestras para laboratorio | `TPL-ANEXO-5` (v1.0.0) | 14 campos | Tablas DOCX / Array | 3 marcadores | Bacteriólogo / Courier | `renderAnexo5` | **COMPLETE** |
| 6 | `ANEXO_6` | Registro de inicio y fin de extracción | `TPL-ANEXO-6` (v1.0.0) | 14 campos | Cirugía / Tiempos isquemia | 3 marcadores | Cirujano / Anestesiólogo | `renderAnexo6` | **COMPLETE** |
| 7 | `ANEXO_7_CARDIOVASCULAR` | Acta rescate tejido cardiovascular | `TPL-ANEXO-7-CARDIO` (v1.0.0) | 13 campos | Segmentos valvulares | 3 marcadores | Cirujano Rescate Tejidos | `renderAnexo7Cardiovascular` | **COMPLETE** |
| 8 | `ANEXO_7_CORAZON` | Ficha técnica cardiectomía | `TPL-ANEXO-7-CORAZON` (v1.0.0) | 14 campos | Isquemia / Preservación | 3 marcadores | Cirujano Cardíaco | `renderAnexo7Corazon` | **COMPLETE** |
| 9 | `ANEXO_7_HIGADO` | Ficha técnica hepatectomía | `TPL-ANEXO-7-HIGADO` (v1.0.0) | 14 campos | Anatomía vascular | 3 marcadores | Cirujano Hepático | `renderAnexo7Higado` | **COMPLETE** |
| 10 | `ANEXO_7_OCULAR` | Ficha técnica enucleación ocular | `TPL-ANEXO-7-OCULAR` (v1.0.0) | 11 campos | Cámara anterior / Córneas | 3 marcadores | Oftalmólogo / Extractor | `renderAnexo7Ocular` | **COMPLETE** |
| 11 | `ANEXO_7_OSTEOMUSCULAR` | Acta rescate tejido osteomuscular | `TPL-ANEXO-7-OSTEO` (v1.0.0) | 13 campos | Huesos largos / Embalaje | 3 marcadores | Cirujano Ortopédico | `renderAnexo7Osteomuscular` | **COMPLETE** |
| 12 | `ANEXO_7_OTROS_ORGANOS` | Ficha extracción multiorgánica | `TPL-ANEXO-7-OTROS` (v1.0.0) | 12 campos | Órgano especificado | 3 marcadores | Cirujano Rescate | `renderAnexo7OtrosOrganos` | **COMPLETE** |
| 13 | `ANEXO_7_PANCREAS` | Ficha técnica extracción páncreas | `TPL-ANEXO-7-PANCREAS` (v1.0.0) | 14 campos | Duodeno / Isquemia | 3 marcadores | Cirujano Páncreas | `renderAnexo7Pancreas` | **COMPLETE** |
| 14 | `ANEXO_7_PIEL` | Acta rescate tejido piel | `TPL-ANEXO-7-PIEL` (v1.0.0) | 13 campos | Dermátomo / Área (cm²) | 3 marcadores | Equipo Rescate Piel | `renderAnexo7Piel` | **COMPLETE** |
| 15 | `ANEXO_7_PULMON` | Ficha extracción neumonectomía | `TPL-ANEXO-7-PULMON` (v1.0.0) | 14 campos | Bronquio / Gasometría | 3 marcadores | Cirujano Torácico | `renderAnexo7Pulmon` | **COMPLETE** |
| 16 | `ANEXO_7_RINON_DERECHO` | Ficha técnica nefrectomía derecha | `TPL-ANEXO-7-RINON-DER` (v1.0.0) | 14 campos | Arteria / Vena / Uréter | 3 marcadores | Cirujano Renal | `renderAnexo7Rinon` | **COMPLETE** |
| 17 | `ANEXO_7_RINON_IZQUIERDO` | Ficha técnica nefrectomía izquierda | `TPL-ANEXO-7-RINON-IZQ` (v1.0.0) | 14 campos | Arteria / Vena / Uréter | 3 marcadores | Cirujano Renal | `renderAnexo7Rinon` | **COMPLETE** |
| 18 | `ANEXO_8` | Cadena de custodia EMP y evidencias | `TPL-ANEXO-8` (v1.0.0) | 15 campos | Eventos / Sellos / Hallazgos | 3 marcadores | Perito / Custodio | `renderAnexo8` (Landscape) | **COMPLETE** |
| 19 | `ANEXO_9` | Entrega de cuerpo a INMLCF / Fiscalía | `TPL-ANEXO-9` (v1.0.0) | 12 campos | Causa médico-legal / Acta | 4 marcadores | Fiscal / Forense / Coord. | `renderAnexo9` | **COMPLETE** |

---

## 3. DETALLE DE LOS 10 FORMATOS COMPLETADOS EN FASE D.3

### 3.1. Anexo 2 — Notificación a deudos (Ley 1805/2016)
- **Fuente original:** `Anexo 2 Notificación a deudos.docx`.
- **Propósito clínico-legal:** Notificación del fallecimiento y aplicación de la presunción legal de donación conforme al marco legal colombiano vigente (Ley 1805 de 2016).
- **Esquema JSON:** Contempla datos del coordinador notificante, verificación obligatoria de la consulta en el Registro Nacional de Donantes (RND), identificación del familiar o deudo notificado, parentesco y constancia expresa de no oposición válida previa registrada.
- **Validaciones:** Cédulas obligatorias, obligatoriedad del código de consulta RND y datos del notificado.
- **PDF Engine:** `renderAnexo2` reproduce la estructura de encabezado legal, fundamentación en Ley 1805/2016, declaración del coordinador y bloque de firmas con atestación.
- **Estado:** `COMPLETE`.

### 3.2. Anexo 3 — Consentimiento informado familiar
- **Fuente original:** `Anexo 3 Consentimiento familiar.docx`.
- **Propósito clínico-legal:** Declaración voluntaria de consentimiento de los familiares para la donación de órganos y tejidos con fines de trasplante o investigación.
- **Esquema JSON:** Identificación del otorgante, parentesco con el donante según orden de prelación legal (cónyuge, hijos, padres, hermanos), selección de componentes anatómicos autorizados, propósito (trasplante terapéutico, investigación, docencia) y atestación de comprensión y voluntariedad.
- **Validaciones:** Parentesco obligatorio, documento del familiar, selección de al menos un órgano/tejido consentido.
- **PDF Engine:** `renderAnexo3` renderiza el texto legal de autorización, tabla de órganos autorizados y bloque de firma del representante deudo y del coordinador.
- **Estado:** `COMPLETE`.

### 3.3. Anexo 4 — Registro de donante y oferta de componentes
- **Fuente original:** `Anexo 4 Registro de donante y oferta de componentes.docx`.
- **Propósito clínico-legal:** Ficha de caracterización clínica del potencial donante, verificación de muerte encefálica y registro de oferta de componentes anatómicos a las IPS trasplantadoras de la Red Regional.
- **Esquema JSON:** Causa de muerte, hora de confirmación de muerte encefálica, hemodinamia, soporte inotrópico, estudios complementarios (Doppler transcraneal / arteriografía), oferta multiorgánica y distribución de órganos (corazón, pulmones, hígado, riñones, páncreas, tejidos).
- **Validaciones:** Causa de muerte obligatoria, confirmación de muerte encefálica (booleano requerido).
- **PDF Engine:** `renderAnexo4` estructura el resumen clínico, parámetros hemodinámicos y asignación de órganos a receptores.
- **Estado:** `COMPLETE`.

### 3.4. Anexo 5 — Remisión de muestras para laboratorio e inmunogenética
- **Fuente original:** `Anexo 5 Remisión de muestras para laboratorio.docx`.
- **Propósito clínico-legal:** Acompañamiento, rotulado y remisión de tubos sanguíneos y fragmentos de ganglio/bazo hacia el Laboratorio de Inmunogenética y Banco de Sangre para tipificación HLA y pruebas cruzadas.
- **Esquema JSON:** Reproducción fiel de la tabla DOCX original: tipos de tubos (tapa roja, tapa morada, tapa amarilla), volumen en mL, temperatura de transporte (°C), hora de toma, destino de análisis (serología, hemoclasificación, HLA clase I y II, crossmatch).
- **Validaciones:** Número de muestras mayor o igual a 1, hora de recolección en formato ISO.
- **PDF Engine:** `renderAnexo5` dibuja una tabla con cuadrícula formal idéntica al documento físico, especificando tubo por tubo, volumen y condiciones térmicas.
- **Estado:** `COMPLETE`.

### 3.5. Anexo 7 — Cardiovascular (Acta de rescate de tejido)
- **Fuente original:** `Anexo 7 Cardiovascular.docx`.
- **Propósito clínico-legal:** Registro quirúrgico del procedimiento de extracción de tejidos cardiovasculares (válvula aórtica, válvula pulmonar, conductos y parches pericárdicos) destinados a Banco de Tejidos.
- **Esquema JSON Schema aislado:** Segmentos valvulares extraídos, soluciones de preservación empleadas, temperatura de empaque, evaluación macroscópica de calcificaciones y fenestraciones valvulares.
- **Validaciones:** Cirujano de rescate obligatorio, solución de preservación.
- **PDF Engine:** `renderAnexo7Cardiovascular` emite el acta técnica de rescate quirúrgico con sellado criptográfico.
- **Estado:** `COMPLETE`.

### 3.6. Anexo 7 — Osteomuscular (Acta de rescate de tejido)
- **Fuente original:** `Anexo 7 Osteomuscular.docx`.
- **Propósito clínico-legal:** Acta formal de extracción de tejido óseo y osteotendinoso (fémur, tibia, peroné, hemipelvis, tendones rotuliano y de Aquiles).
- **Esquema JSON Schema aislado:** Segmentos esqueléticos disecados, técnica de reconstrucción corporal, apósitos y vendajes, solución de transporte estéril y rotulado de cajas térmicas.
- **Validaciones:** Lista de piezas anatómicas, técnica de reconstrucción estética obligatoria.
- **PDF Engine:** `renderAnexo7Osteomuscular` genera la constancia médico-quirúrgica de donación osteomuscular.
- **Estado:** `COMPLETE`.

### 3.7. Anexo 7 — Piel (Acta de rescate de tejido)
- **Fuente original:** `Anexo 7 Piel.docx`.
- **Propósito clínico-legal:** Extracción de tejido tegumentario mediante dermátomo para procesamiento de apósitos biológicos en banco de piel.
- **Esquema JSON Schema aislado:** Zonas donantes (muslos, espalda), grosor de las láminas cutáneas (milésimas de pulgada), área total extraída en centímetros cuadrados (cm²), solución de inmersión y gasas de embalaje.
- **Validaciones:** Área de piel extraída mayor a 0 cm², solución de conservación.
- **PDF Engine:** `renderAnexo7Piel` emite el acta de dermolipectomía y rescate cutáneo con trazabilidad de banco.
- **Estado:** `COMPLETE`.

### 3.8. Anexo 7 — Páncreas (Ficha técnica extracción quirúrgica)
- **Fuente original:** `Anexo 7 Pancreas.docx`.
- **Propósito clínico-legal:** Protocolo quirúrgico de pancreatectomía para trasplante de órgano entero o islotes pancreáticos.
- **Esquema JSON Schema aislado:** Preservación con UW/Celsior, perfusión de aorta abdominal y arteria mesentérica, longitud de parche vascular duodenal, tiempo de isquemia fría y valoración de esteatosis o pancreatitis traumática.
- **Validaciones:** Solución de perfusión requerida, tiempo de inicio de perfusión.
- **PDF Engine:** `renderAnexo7Pancreas` refleja las condiciones anatómicas y el control de isquemia fría.
- **Estado:** `COMPLETE`.

### 3.9. Anexo 7 — Pulmón (Ficha técnica extracción neumonectomía)
- **Fuente original:** `Anexo 7 Pulmon.docx`.
- **Propósito clínico-legal:** Protocolo de neumonectomía bilateral o unilateral para trasplante pulmonar.
- **Esquema JSON Schema aislado:** Gasometría arterial final con FiO2 al 100%, relación PaO2/FiO2, secreciones bronquiales evaluadas mediante fibrobroncoscopia, perfusión con Perfadex y tiempos de isquemia.
- **Validaciones:** FiO2, PaO2/FiO2, evaluación broncoscópica obligatoria.
- **PDF Engine:** `renderAnexo7Pulmon` documenta los índices funcionales respiratorios y los hallazgos en quirófano.
- **Estado:** `COMPLETE`.

### 3.10. Anexo 9 — Entrega del cuerpo a INMLCF / Fiscalía
- **Fuente original:** `Anexo 9 Entrega del cuerpo a INMLCF.docx`.
- **Propósito clínico-legal:** Constancia formal y entrega técnica del cuerpo de un donante fallecido por causas violentas o sospechosas (médico-legal) a los funcionarios del Instituto Nacional de Medicina Legal y Ciencias Forenses o Fiscalía General de la Nación.
- **Esquema JSON:** Número de oficio de inspección técnica a cadáver (SPOA), número de acta de entrega, fijación fotográfica, estado de suturas de toracotomía/laparotomía, embalaje del cuerpo y entrega de evidencias asociadas (proyectiles, prendas, tubos de sangre forense).
- **Validaciones:** Número de noticia criminal / SPOA obligatorio, nombre y credencial del funcionario receptor forense.
- **PDF Engine:** `renderAnexo9` genera el acta forense oficial con sello inmutable y advertencias legales.
- **Estado:** `COMPLETE`.

---

## 4. POSICIONES 20 A 23: PENDING_HOMOLOGATION

Conforme a la directriz arquitectónica estricta, las posiciones 20 a 23 **no fueron inventadas ni sustituidas artificialmente**:

| Posición | Código Reservado | Título Registrado | Categoría del Paquete | Estado de Plantilla | Comportamiento del Sistema |
|---|---|---|---|---|---|
| **20** | `POS_NORMATIVA_20` | Posición Reservada 20 — [Pendiente de homologación institucional] | `PENDING_HOMOLOGATION` | Sin plantilla (NULL) | Bloqueado para diligenciamiento; emite advertencia técnica si se intenta iniciar |
| **21** | `POS_NORMATIVA_21` | Posición Reservada 21 — [Pendiente de homologación institucional] | `PENDING_HOMOLOGATION` | Sin plantilla (NULL) | Bloqueado para diligenciamiento; emite advertencia técnica si se intenta iniciar |
| **22** | `POS_NORMATIVA_22` | Posición Reservada 22 — [Pendiente de homologación institucional] | `PENDING_HOMOLOGATION` | Sin plantilla (NULL) | Bloqueado para diligenciamiento; emite advertencia técnica si se intenta iniciar |
| **23** | `POS_NORMATIVA_23` | Posición Reservada 23 — [Pendiente de homologación institucional] | `PENDING_HOMOLOGATION` | Sin plantilla (NULL) | Bloqueado para diligenciamiento; emite advertencia técnica si se intenta iniciar |

---

## 5. DOCUMENTOS FUENTE COMPLEMENTARIOS (SourceDocument)

Los siguientes 4 archivos no corresponden a formatos o anexos normativos del paquete de donación, sino a registros clínicos auxiliares cargados como evidencia de soporte:

1. **`Cálculo Hemodilución.docx`:** Calculadora hemodinámica clínica para estimar dilución plasmática previa a toma de muestras serológicas. Se preserva como soporte adjunto (`SourceDocument`).
2. **`Evaluación de riesgo COVID 19 Tissue Bank.docx`:** Formulario de cribado epidemiológico transitorio hospitalario. Se preserva como soporte adjunto (`SourceDocument`).
3. **`HC Donante 2024.docx`:** Epicrisis e historia clínica de origen hospitalario del donante. Se almacena como evidencia documental fuente (`SourceDocument`).
4. **`Historia Clínica Tissue Bank.docx`:** Anamnesis y antecedentes de banco de tejidos. Se almacena como evidencia documental fuente (`SourceDocument`).

---

## 6. EVIDENCIA DE PRUEBAS AUTOMATIZADAS REALES

### 6.1. Suite HTTP API (20 Operaciones en Base de Datos Real)
- **Archivo de prueba:** `Backend/GODT-B/test/real-http-api-operations.spec.ts`
- **Infraestructura:** NestJS en puerto efímero + PostgreSQL (puerto 5432) + Redis (puerto 6379).
- **Resultados:** 20 suites ejecutadas, **126 pruebas unitarias y de integración aprobadas (100% éxito)**.
- **Operaciones cubiertas:**
  1. `POST /api/v1/auth/login` (Autenticación institucional).
  2. `POST /api/v1/donation-processes` (Creación de proceso operativo).
  3. `GET /api/v1/donation-processes` (Listado y filtrado de procesos).
  4. `GET /api/v1/donation-processes/:id` (Consulta de detalle del proceso).
  5. `GET /api/v1/donation-processes/:id/documents` (Consulta de las 23 posiciones del paquete).
  6. `PATCH /api/v1/donation-processes/:id/documents/:docId/applicability` (Modificación de aplicabilidad).
  7. `POST /api/v1/donation-processes/:id/documents/:docId/initiate` (Iniciación de instancia documental).
  8. `GET /api/v1/document-catalog/:templateId/versions` (Consulta de versión de plantilla).
  9. `PATCH /api/v1/document-instances/:id` (Guardado de borrador / revisión con datos clínicos).
  10. `POST /api/v1/document-instances/:id/lifecycle/validate` (Validación formal de estructura documental).
  11. `POST /api/v1/document-instances/:id/lifecycle/complete` (Completitud formal del ciclo de vida).
  12. `POST /api/v1/document-instances/:id/lifecycle/snapshot` (Generación de snapshot inmutable y PDF).
  13. `GET /api/v1/document-instances/:id/lifecycle/snapshots/:snapId/download` (Descarga y verificación de binario PDF `%PDF-`).
  14. `POST /api/v1/document-instances/:id/lifecycle/participants` (Asignación de firmante / participante).
  15. `POST /api/v1/document-instances/:id/lifecycle/snapshots/:snapId/sign` (Estampado de firma digital).
  16. `POST /api/v1/document-instances/:id/lifecycle/custody-events` (Registro de evento en cadena de custodia).
  17. `GET /api/v1/document-instances/:id/lifecycle/custody-events` (Consulta de cadena de custodia secuencial).
  18. `POST /api/v1/document-instances/:id/canonical-values` (Propagación automática de marcadores).
  19. `GET /api/v1/donation-processes/:id/canonical-values` (Consulta de valores canónicos consolidados).
  20. `POST /api/v1/donation-processes/:id/canonical-values/resolve-conflict` (Resolución de conflicto canónico).

### 6.2. Suite E2E Navegador Real (Headless Chrome via DevTools Protocol)
- **Archivo de prueba:** `Frontend/tests/browser-workflow.test.mjs`
- **Entorno de ejecución:** Headless Chrome 156 + Vite Preview (5173) + NestJS (3000) + PostgreSQL (5432).
- **Resultados:** 1 suite ejecutada, **100% aprobada en 15.57s**.
- **Flujo verificado paso a paso:**
  1. Apertura de vista institucional en `/acceso`.
  2. Diligenciamiento de formulario de credenciales con `coordinador@godt.gov.co`.
  3. Redirección autenticada hacia `/dashboard` tras verificación de JWT.
  4. Navegación a `/procesos` y creación de proceso donante sintético.
  5. Navegación a `/procesos/:id` y renderizado de las 23 posiciones del paquete en la interfaz web.
  6. Comprobación de que las posiciones 20 a 23 reflejan `PENDING_HOMOLOGATION`.
  7. Iniciación y apertura de Anexo 1 hacia el formulario dinámico `/expedientes/:donorId/instancias/:instanceId`.
  8. Diligenciamiento y guardado de borrador vía `PATCH /api/v1/document-instances/:id`.
  9. Validación formal vía `POST .../lifecycle/validate` (Estado: `VALIDADO`).
  10. Finalización vía `POST .../lifecycle/complete` (Estado: `COMPLETADO`).
  11. Generación de snapshot inmutable vía `POST .../lifecycle/snapshot` con hash SHA-256 verificado.
  12. Descarga autenticada del PDF oficial comprobando firma mágica binaria `%PDF-`.

---

## 7. CONCLUSIÓN Y DECLARACIÓN DE ESTADO

Con la sustentación técnica de esquemas, campos clínicos, validaciones formales, motores de renderizado PDF de alta fidelidad, pruebas HTTP de base de datos real y validación E2E en navegador Chrome:

**ESTADO OFICIAL FASE D.3: `COBERTURA FUNCIONAL COMPLETA`**
