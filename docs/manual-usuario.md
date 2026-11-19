# GODT Regional 3 — Manual Integral de Usuario y Operación Asistencial

**Plataforma de Gestión y Trazabilidad Documental de Procesos de Donación y Trasplante**  
**Regional 3 — Colombia**  
**Versión:** 1.0.0 (Release Sesiones 4 y 5)  
**Clasificación:** Documentación Oficial de Usuario / Asistencial  

---

## 1. Introducción

El **Sistema GODT Regional 3** es una solución digital de alto impacto diseñada para la Red de Donación y Trasplantes de Colombia. Su misión central es erradicar el diligenciamiento manual disperso, reducir los tiempos críticos en la coordinación de donantes, automatizar la extracción de datos desde historias clínicas fuente mediante Inteligencia Artificial (Google Gemini) y asegurar la inmutabilidad jurídica de los expedientes clínicos conforme a la normativa sanitaria colombiana (Ley 1805 de 2016, Decreto 2493 de 2004 y Resolución 2640 de 2005).

### Principios Fundamentales
- **Human-In-The-Loop (Revisión Humana Obligatoria):** Ninguna sugerencia de IA se incorpora al expediente sin la validación previa, explícita y trazable de un coordinador operativo.
- **Trazabilidad Canónica:** Cada dato clínico conserva su documento de procedencia, su versión temporal y el autor de su validación.
- **Aislamiento Institucional Multi-Tenant:** Cada IPS u hospital solo puede acceder a la información y expedientes que le competen según su autorización.
- **Inmutabilidad Documental:** Todo documento cerrado o firmado genera un hash criptográfico SHA-256 irrevocable.

---

## 2. Acceso Institucional y Gestión de Sesión

### 2.1 Credenciales y Política de Seguridad
El acceso a GODT Regional 3 se realiza exclusivamente mediante cuentas institucionales previamente aprovisionadas por la Coordinación Regional:
1. Ingrese a la URL oficial suministrada por el administrador (ej: `https://godt.regional3.gov.co` o entorno desplegado en Azure).
2. Introduzca su **Correo Institucional** y su **Contraseña**.
3. Las contraseñas se almacenan mediante el algoritmo criptográfico **Argon2id**.
4. Al autenticarse, el backend emite un token JWT de corta duración custodiado únicamente en memoria volátil de la aplicación web, complementado con una cookie segura `HttpOnly`, `SameSite=Strict` y `Secure` para renovación automática (Refresh Token Rotation).

![Pantalla de Acceso Institucional](/screenshots/fase-d4/login-1920x1080-desktop.png)
*(Captura real: Interfaz de Autenticación Institucional en resolución Desktop 1920×1080)*

### 2.2 Cierre de Sesión y Expiración
- Si transcurre el período de inactividad establecido, el sistema cerrará la sesión de forma transparente protegiendo la confidencialidad de la estación de trabajo.
- Para cerrar la sesión voluntariamente, haga clic en su nombre en la esquina superior derecha y seleccione **Cerrar Sesión**. Esto revoca la familia de tokens en el servidor.

---

## 3. Tablero de Control (Dashboard)

El **Dashboard Principal** proporciona una visión consolidada y en tiempo real de la actividad de donación en la Regional:
- **Métricas Operativas:** Total de donantes captados, procesos activos, procesos completados y tasa de efectividad documental.
- **Alertas Clínicas:** Indicadores sobre documentos pendientes de firma, pruebas de histocompatibilidad en curso o alertas de hemodilución.
- **Acceso Rápido:** Vínculos directos a expedientes de donantes en curso y creación de nuevos procesos de donación.

![Tablero de Procesos](/screenshots/fase-d4/procesos-list-1920x1080-desktop.png)
*(Captura real: Vista del Tablero y Listado de Procesos de Donación)*

---

## 4. Gestión de Expedientes de Donantes

1. En el menú de navegación lateral, seleccione **Donantes**.
2. Para registrar un nuevo donante potencial:
   - Haga clic en el botón **+ Nuevo Donante**.
   - Complete la información básica: Tipo de documento (CC, TI, CE, Pasaporte), Número de identificación, Nombres y Apellidos, Sexo biológico y Fecha de nacimiento.
   - Registre la IPS generadora donde se encuentra el donante (ej: Hospital San Vicente Fundación, Hospital Pablo Tobón Uribe).
3. **Consulta de Voluntad (RND):**
   - Registre el código de consulta emitido por el Instituto Nacional de Salud (RND) que certifica la consulta de presunción legal o consentimiento.

---

## 5. Gestión de Procesos de Donación

Cada proceso de donación agrupa la evolución clínica, operativa y legal de un donante específico:
- **Estados del Proceso:**
  - `EVALUACION`: Donante potencial en fase de mantenimiento y valoración diagnóstica.
  - `EN_QUIROFANO`: Procedimiento quirúrgico de rescate de órganos y tejidos en curso.
  - `LEGALIZACION`: Consolidación documental posterior al rescate.
  - `CERRADO`: Proceso completado con expediente digital consolidado.
- **Asignación de Participantes:** Permite vincular médicos extractores, coordinadores operativos, cirujanos de trasplante y personal de enfermería con sus respectivos registros profesionales.

![Detalle de Proceso de Donación](/screenshots/fase-d4/proceso-detalle-1920x1080-desktop.png)
*(Captura real: Panel de Detalle del Proceso de Donación y Pestaña de Paquete Documental)*

---

## 6. Gestión Documental e Ingesta de Fuentes

El módulo documental permite adjuntar archivos fuente originales (Historias Clínicas en formato PDF, Word DOCX o imágenes de notas de evolución) para su custodia e interpretación asistida:
1. Ingrese al proceso de donación y abra la pestaña **Documentos Fuente**.
2. Haga clic en **Cargar Documento**.
3. Seleccione el archivo desde su equipo:
   - Formatos admitidos: PDF digital o escaneado, DOCX de historia clínica, imágenes JPG, PNG o WEBP.
   - Límite de tamaño: 25 MB por archivo.
4. El backend calcula de inmediato el digest **SHA-256** del archivo para garantizar su inmutabilidad y lo almacena de manera privada y aislada.

---

## 7. Formularios Institucionales y Catálogo Oficial

GODT implementa de manera estricta los formatos oficiales aprobados por la Red de Donación y Trasplantes:
- **19 Formatos Activos:**
  - **Anexo 1:** Protocolo de Muerte Encefálica.
  - **Anexo 2:** Notificación a Deudos sobre la Ley 1805 de 2016.
  - **Anexo 3:** Consentimiento Informado Familiar de Donación.
  - **Anexo 4:** Evaluación Clínica y Biológica del Donante.
  - **Anexo 5:** Registro de Donante de Tejidos.
  - **Anexo 6:** Lista de Chequeo y Extracción Quirúrgica.
  - **Anexo 7 (Órganos y Tejidos):** Fichas técnicas específicas (Corazón, Pulmón, Hígado, Riñón Derecho, Riñón Izquierdo, Páncreas, Ocular, Cardiovascular, Osteomuscular, Piel, Otros Órganos).
  - **Anexo 8:** Acta de Entrega y Cadena de Custodia.
  - **Anexo 9:** Formato de Destino Final INMLCF.
- **Posiciones 20 a 23:**
  - Se encuentran identificadas normativamente bajo el estado **`PENDING_HOMOLOGATION`** (Pendientes de homologación técnica por la Coordinación Regional). El sistema respeta su estado y no permite diligenciamientos artificiales.

---

## 8. OCR Asistido por Google Gemini (Motor Principal de IA)

GODT Regional 3 utiliza **Google Gemini** como motor principal de Inteligencia Artificial para el análisis semántico de documentos no estructurados.

### Flujo de Ejecución del OCR Inteligente
1. Al pulsar **Iniciar OCR** sobre un documento cargado, el backend inicia un trabajo asíncrono gestionado mediante BullMQ.
2. El sistema aplica una secuencia transparente de etapas:
   - **Etapa 1:** Validación de integridad del archivo y verificación de aislamiento de IPS.
   - **Etapa 2:** Detección de estrategia (Extracción directa de capa de texto PDF, OpenXML nativo para DOCX o rasterización para documentos escaneados).
   - **Etapa 3:** Invocación a Gemini AI con guardrails clínicos estrictos y aislamiento de prompts.
   - **Etapa 4:** Normalización estructurada al diccionario canónico.
   - **Etapa 5:** Verificación de evidencia textual (*anti-alucinación*): si un dato propuesto no cuenta con respaldo textual exacto en el documento base, se descarta preventivamente.
   - **Mecanismo de Respaldo (Fallback):** Si el servicio de IA no estuviera disponible (por límites de cuota externa o falta de conexión), el sistema ejecuta de manera automática el motor local de reglas deterministas y Tesseract OCR, informando al usuario de la fuente secundaria utilizada.

---

## 9. Revisión y Corrección Humana de Datos Extraídos

Todo dato extraído por Gemini o el motor local ingresa en estado **`PENDIENTE`**:
1. Abra el panel de **Revisión de Extracción OCR / IA**.
2. Cada campo presenta:
   - **Clave Canónica:** Nombre técnico del parámetro (ej: `donor.identity.document_number`, `donor.clinical.blood_group`).
   - **Valor Extraído:** Dato identificado en el documento.
   - **Motor de Procedencia:** Distintivo visual claro (`✨ Gemini AI` o `⚙️ Reglas Locales (Fallback)`).
   - **Porcentaje de Confianza:** Si la confianza es inferior al 85%, el sistema muestra una advertencia visual destacada: `⚠️ Valor dudoso`.
   - **Fragmento de Evidencia:** Texto literal del documento de donde se obtuvo el dato.
3. **Acciones del Coordinador:**
   - **Aceptar:** Confirma que el valor extraído es verídico y exacto.
   - **Editar:** Permite ingresar el valor correcto si hubo alguna errata tipográfica en el documento original.
   - **Rechazar:** Descarta el candidato si no corresponde al donante.
   - **Propagar:** Inyecta los valores confirmados en el diccionario canónico del proceso para que prellenen de inmediato todos los formularios institucionales.

---

## 10. Trazabilidad y Procedencia Canónica de la Información

El sistema mantiene una matriz canónica que registra la procedencia (*provenance*) de cada campo:
- **Alcance Donante (`DONOR`):** Parámetros biológicos esenciales (documento, nombres, hemoclasificación, edad) que persisten en la ficha central del donante.
- **Alcance Proceso (`PROCESS`):** Datos circunstanciales (fechas de notificación, IPS generadora, tiempos de isquemia).
- **Resolución de Conflictos:** Si dos documentos presentan discrepancias (ej: dos valores distintos de creatinina sérica tomados a diferentes horas), el sistema advierte el conflicto y exige que el profesional elija qué valor prevalece registrando la justificación.

---

## 11. Finalización y Ciclo de Vida Documental

Cada formulario institucional transita por estados formales que garantizan su rigor médico-legal:
1. **`BORRADOR`:** Formulario en proceso de diligenciamiento; los campos admiten edición continua.
2. **`COMPLETADO`:** Todos los campos requeridos por el JSON Schema han sido validados exitosamente.
3. **`FIRMADO`:** Los participantes requeridos han estampado su firma electrónica o digital.
4. **`MODO SÓLO LECTURA (SELLADO)`:** El documento queda sellado de forma irreversible.
5. **Reapertura Técnica Justificada:** En caso excepcional de auditoría médica, un usuario con rol `ADMIN` o `COORDINATOR` puede solicitar una reapertura técnica, debiendo registrar una justificación obligatoria que queda grabada en la bitácora de auditoría inmutable.

![Documento Sellado en Modo Sólo Lectura](/screenshots/fase-d4/documento-sellado-1920x1080-desktop.png)
*(Captura real: Visualización de Documento Sellado en Modo Sólo Lectura)*

---

## 12. Firmas Electrónicas y Participantes

El Anexo 6 y los anexos quirúrgicos exigen la concurrencia de firmas del equipo de rescate:
1. Abra el formulario en estado `COMPLETADO` y haga clic en **Firmar Documento**.
2. Seleccione la modalidad de firma:
   - **Firma Electrónica Simple con Atestación:** El profesional revisa la declaración legal de veracidad y redacta una manifestación expresa (mínimo 10 caracteres).
   - **Firma Digital Biométrica / ONAC:** Compatible con certificados reconocidos.
3. El sistema registra el identificador del usuario, fecha, hora legal colombiana (COT / UTC-5) y el hash de contenido al momento de firmar.

![Modal de Firma Institucional](/screenshots/fase-d4/modal-firma-1920x1080-desktop.png)
*(Captura real: Modal de Firma Electrónica con Atestación Legal)*

---

## 13. Cadena de Custodia (Anexo 8)

El **Anexo 8 (Acta de Entrega y Cadena de Custodia de Componentes Anatómicos)** es vital para el transporte seguro de órganos y tejidos:
- **Visualización Apaisada (Landscape):** La interfaz web dispone de un visor adaptativo horizontal para facilitar la lectura de la bitácora de custodia sin cortes.
- **Registro de Eventos de Custodia:** Cada transferencia (ej: de Quirófano de Rescate a Transportador Terrestre/Aéreo, y de este a la IPS Trasplantadora) registra:
  - Órgano o tejido involucrado.
  - Temperatura de conservación (°C) y preservante utilizado.
  - Responsable que entrega y responsable que recibe (con documento y cargo).
  - Fecha y hora exacta en zona horaria de Colombia (`COT / UTC-5`).

![Cadena de Custodia Anexo 8](/screenshots/fase-d4/anexo8-custodia-1920x1080-desktop.png)
*(Captura real: Formato Apaisado de Cadena de Custodia con Zona Horaria Local)*

---

## 14. Expediente Consolidado (Dossier) y Exportación PDF / ZIP

Una vez concluido el rescate, se genera el **Dossier Clínico Consolidado**:
1. Ingrese a la pestaña **Dossier / Expediente** del proceso de donación.
2. Haga clic en **Solicitar Generación de Dossier**.
3. El worker asíncrono:
   - Compila todos los snapshots en un único documento maestro PDF con foliado institucional.
   - Genera un archivo comprimido **ZIP** que contiene los anexos individuales, los documentos fuente autorizados y un archivo `manifest.json`.
   - Calcula el resumen criptográfico **SHA-256** del paquete.
4. **Descarga Segura:**
   - Descargue el archivo ZIP o el PDF consolidado. Cada archivo cuenta con verificación de integridad ante el tribunal médico o autoridad sanitaria.

---

## 15. Preguntas Frecuentes y Solución de Problemas

### 15.1 ¿Qué hacer si el OCR indica "Proveedor de IA multimodal no disponible"?
El sistema aplica automáticamente el mecanismo de respaldo con reglas locales y Tesseract OCR. Sus documentos se procesarán de todos modos. Verifique con el administrador que la variable `AI_EXTERNAL_PROVIDER_ENABLED=true` y la clave de API estén configuradas en el entorno.

### 15.2 ¿Por qué un campo aparece con la etiqueta "⚠️ Valor dudoso"?
Indica que el motor de IA extrajo el dato con un nivel de confianza inferior al 85% (por ejemplo, debido a baja resolución del escaneo o caligrafía médica compleja). Debe verificar el fragmento de evidencia antes de hacer clic en **Aceptar**.

### 15.3 ¿Cómo corregir un dato que fue extraído incorrectamente por el OCR?
Haga clic en el botón **Editar** en la fila del campo en el modal de revisión, escriba el valor exacto y presione **Guardar modificación**. El sistema marcará el campo como `MODIFICADO` y mantendrá la referencia al valor original.

### 15.4 ¿Por qué no puedo editar un formulario que dice "Documento Sellado"?
Los documentos en estado `COMPLETADO` o `FIRMADO` se bloquean para preservar la cadena de custodia legal. Si se requiere una corrección clínica de fuerza mayor, solicite al Coordinador Regional una **Reapertura Técnica Justificada**.

### 15.5 ¿Puedo enviar historias clínicas reales a Google Gemini?
Conforme a la Ley 1581 de 2012 de Colombia, el envío de datos clínicos reales a proveedores externos en entornos productivos requiere consentimiento institucional explícito (`AI_CLINICAL_DATA_PROCESSING_AUTHORIZED=true`). Para demostraciones y evaluaciones académicas, el sistema opera con datos desidentificados o sintéticos bajo la modalidad segura autorizada.

---

*Manual elaborado y certificado por el Equipo de Arquitectura e Ingeniería de Software de GODT Regional 3 — Noviembre 2026.*
