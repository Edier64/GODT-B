# Reconciliación del Inventario Documental y Matriz de Homologación — GODT Regional 3

## 1. Alcance y Metodología de Auditoría

En cumplimiento de la **Fase D.1**, se realizó un cotejo exhaustivo entre los 23 archivos originales presentes en `docs/documentos-reales/`, el inventario preliminar (`document-inventory.md`), el catálogo de marcadores canónicos (`CANONICAL_FIELD_CATALOG_MATRIX.md`), el ADR 004/005 y la definición técnica del paquete normativo `OFFICIAL_REGIONAL_3_POSITIONS` en el código fuente.

### Criterios de Clasificación y Estados de Homologación

Para evitar sobreafirmaciones técnicas o atribución indebida de validez jurídica/institucional, se establecen taxativamente los siguientes estados:

1. **`SOURCE_IDENTIFIED`**: Archivo original localizado físicamente en el repositorio con tamaño y hash SHA-256 verificados.
2. **`TECHNICALLY_MAPPED`**: Campos, tipos de datos, cardinalidades y reglas de enlace identificados a nivel de JSON Schema / UI Schema.
3. **`TECHNICALLY_VALIDATED`**: Implementado en código y validado mediante pruebas automatizadas de generación, ciclo de vida o propagación canónica.
4. **`PENDING_HOMOLOGATION`**: Implementado o mapeado técnicamente, pero pendiente de homologación y adopción formal mediante resolución o acta de la Coordinación Regional 3.
5. **`INSTITUTIONALLY_APPROVED`**: Aprobado formalmente mediante acto administrativo expedido por la autoridad sanitaria competente (actualmente **ninguna posición** cuenta con este acto publicado formalmente en el sistema, por lo que ninguna se presenta como aprobada de manera definitiva).

---

## 2. Matriz de Reconciliación Documental (23 Posiciones del Paquete y Documentos Fuente)

| ID Interno (`documentCode`) | Pos. Paquete | Archivo Fuente Original | Nombre Original en Archivo | Plantilla Técnica / Componente | Variante / Órgano | Estado Técnico | Estado Institucional | SHA-256 Original |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `ANEXO_1` | 01 | `anexo-1-formato-de-valoracion-alerta-posible-donante.pdf` | Formato de valoración y alerta de posible donante | `anexo-1-valoracion-alerta-v0` | Principal | `TECHNICALLY_VALIDATED` | `PENDING_HOMOLOGATION` | `359EF826D284AC0B77DD0A7B16A0317E921BD2DB0E10B08F48CF4913DC77884C` |
| `ANEXO_2` | 02 | `anexo-2-notificacion-a-los-deudos-legalizacion-de-donacion.pdf` | Notificación a los deudos / Legalización de donación | `anexo-2-notificacion-deudos-v0` | Principal | `TECHNICALLY_MAPPED` | `PENDING_HOMOLOGATION` | `195E098221C53A3A909E7DB6D176EBB9028FB0C5034CB039D3E97027AA0CCDFC` |
| `ANEXO_3` | 03 | `anexo-3-formato-consentimiento-donacion-legalizacion.pdf` | Formato consentimiento donación / Legalización | `anexo-3-consentimiento-v0` | Principal | `TECHNICALLY_MAPPED` | `PENDING_HOMOLOGATION` | `FE4E7A25ADE4247BFB2D822CF6FFEC113598F5509DE7E2B16AEBDD3FAF2C0403` |
| `ANEXO_4` | 04 | `anexo-4-registro-de-donante-y-oferta-organos-y-tejidos.pdf` | Registro de donante y oferta órganos y tejidos | `anexo-4-registro-oferta-v0` | Principal | `TECHNICALLY_MAPPED` | `PENDING_HOMOLOGATION` | `12B351B30D139C3D80E940C35E8988D967E5F94912895A7F7A8B9CF645223122` |
| `ANEXO_5` | 05 | `anexo-5-formato-de-remision-de-muestras.docx` | Formato de remisión de muestras | `anexo-5-remision-muestras-v0` | Principal | `TECHNICALLY_MAPPED` | `PENDING_HOMOLOGATION` | `25EE36C8E86CFBF1DBC5A3595D81D485062116B724BEC8A8C8FF4C947E84B422` |
| `ANEXO_6` | 06 | `anexo-6-registro-general-de-extraccion.pdf` | Registro general de extracción | `anexo-6-extraccion-componentes-v0` | Quirúrgico | `TECHNICALLY_VALIDATED` | `PENDING_HOMOLOGATION` | `2AD0386EF94E66D0F48BF4F975B7179B601B1F2B716555E5C17445E282CFE09D` |
| `ANEXO_7_OCULAR` | 07 | `anexo-7- formato-acta-de-rescate-de-tejido-ocular.pdf` | Formato acta de rescate de tejido ocular | `anexo-7-variantes-v0` | Tejido Ocular | `TECHNICALLY_VALIDATED` | `PENDING_HOMOLOGATION` | `1EC41A945718DEC408E68C2640BBB6614F41F73ECC7DFF416FC8C7C7C0A4D796` |
| `ANEXO_7_CARDIOVASCULAR` | 08 | `anexo-7-formato-acta-de-rescate-de-tejido-cardiovascular.pdf` | Formato acta de rescate de tejido cardiovascular | `anexo-7-variantes-v0` | Tejido Cardiovascular | `TECHNICALLY_VALIDATED` | `PENDING_HOMOLOGATION` | `2820CC85C79FF77979E0491AC17EFE537B1198A4A7FC226D1B42F423FD06BD69` |
| `ANEXO_7_OSTEOMUSCULAR` | 09 | `anexo-7-formato-acta-de-rescate-de-tejido-osteomuscular.pdf` | Formato acta de rescate de tejido osteomuscular | `anexo-7-variantes-v0` | Tejido Osteomuscular | `TECHNICALLY_VALIDATED` | `PENDING_HOMOLOGATION` | `789C0F3249B3693EFDD6429B94371C3DACD9C4EE93CE7C8EFF1C30BD7F0738C5` |
| `ANEXO_7_PIEL` | 10 | `anexo-7-formato-acta-de-rescate-de-tejido-piel.pdf` | Formato acta de rescate de tejido piel | `anexo-7-variantes-v0` | Tejido Piel | `TECHNICALLY_VALIDATED` | `PENDING_HOMOLOGATION` | `428A92AC6EF7E9D0E152D7E4A18671B177C1D0F2CF5A5E6A9C63B861D89242EB` |
| `ANEXO_7_CORAZON` | 11 | `anexo-7-registro-extraccion-corazon-cardiectomia.pdf` | Registro extracción corazón (Cardiectomía) | `anexo-7-variantes-v0` | Órgano Corazón | `TECHNICALLY_VALIDATED` | `PENDING_HOMOLOGATION` | `B0C59E086272FBA93DB867EDA8B81BBC1203D45F39FFE34DAD907D98CDD4728C` |
| `ANEXO_7_HIGADO` | 12 | `anexo-7-registro-extraccion-higado-hepatectomia.pdf` | Registro extracción hígado (Hepatectomía) | `anexo-7-variantes-v0` | Órgano Hígado | `TECHNICALLY_VALIDATED` | `PENDING_HOMOLOGATION` | `CA4B5102BDCB5FD355DA69636FF4D2A52A8029A17A9743CD9C21825B7A84AA89` |
| `ANEXO_7_OTROS_ORGANOS` | 13 | `anexo-7-registro-extraccion-otros-organos.pdf` | Registro extracción otros órganos | `anexo-7-variantes-v0` | Órganos Varios | `TECHNICALLY_VALIDATED` | `PENDING_HOMOLOGATION` | `D724A614C413D002582F19E8BE2F67E26AC23189CE06A9599D63F0E9DEA579DD` |
| `ANEXO_7_PANCREAS` | 14 | `anexo-7-registro-extraccion-pancreas.pdf` | Registro extracción páncreas | `anexo-7-variantes-v0` | Órgano Páncreas | `TECHNICALLY_VALIDATED` | `PENDING_HOMOLOGATION` | `D892A9FB0C8B67CD6CEB43564A73BC14F8DCBA92A86B5B74C3751E9A04C8E285` |
| `ANEXO_7_PULMON` | 15 | `anexo-7-registro-extraccion-pulmon-neumonectomia.pdf` | Registro extracción pulmón (Neumonectomía) | `anexo-7-variantes-v0` | Órgano Pulmón | `TECHNICALLY_VALIDATED` | `PENDING_HOMOLOGATION` | `25BD1C02F64D41A5CB9A57B3DD71157D16A559DBEC4C28334C5338225F311BE3` |
| `ANEXO_7_RINON_DERECHO` | 16 | `anexo-7-registro-extraccion-rinon-derecho-nefrectomia.pdf` | Registro extracción riñón derecho (Nefrectomía) | `anexo-7-variantes-v0` | Órgano Riñón Der. | `TECHNICALLY_VALIDATED` | `PENDING_HOMOLOGATION` | `534C00C76C5AA3A23779CD20F013DE7CC796E733D7AE72C518D514B9541D90A0` |
| `ANEXO_7_RINON_IZQUIERDO` | 17 | `anexo-7-registro-extraccion-rinon-izquierdo-nefrectomia.pdf` | Registro extracción riñón izquierdo (Nefrectomía) | `anexo-7-variantes-v0` | Órgano Riñón Izq. | `TECHNICALLY_VALIDATED` | `PENDING_HOMOLOGATION` | `DA98D44E19352583085395AD199C9EBF8E7E1F437951EF7AED5CFA48869B2CB0` |
| `ANEXO_8` | 18 | `anexo-8-formato-cadena-de-custodia.pdf` | Formato cadena de custodia | `anexo-8-cadena-custodia-v0` | Custodia Apaisada | `TECHNICALLY_VALIDATED` | `PENDING_HOMOLOGATION` | `81B2E4A74B22D086E49E1146F26DE0B1A72B7DC022BE181AD6363102D6C538FD` |
| `ANEXO_9` | 19 | `anexo-9-carta-inmlcf-entrega-cuerpo-procesos-medico-legales.pdf` | Carta INMLCF entrega cuerpo procesos médico-legales | `anexo-9-entrega-inmlcf-v0` | Legal Forense | `TECHNICALLY_MAPPED` | `PENDING_HOMOLOGATION` | `FFAA79B67ABC02707643C4DA0BF08FACBABF800723098CE2DE74E9B65ED2CFCD` |
| `POS_RESERVADA_20` | 20 | *(Sin archivo anexo homologado)* | Posición Reservada 20 — Pendiente de homologación | *(Borrador estructural)* | Reserva Técnica | `PENDING_HOMOLOGATION` | `PENDING_HOMOLOGATION` | `N/A` |
| `POS_RESERVADA_21` | 21 | *(Sin archivo anexo homologado)* | Posición Reservada 21 — Pendiente de homologación | *(Borrador estructural)* | Reserva Técnica | `PENDING_HOMOLOGATION` | `PENDING_HOMOLOGATION` | `N/A` |
| `POS_RESERVADA_22` | 22 | *(Sin archivo anexo homologado)* | Posición Reservada 22 — Pendiente de homologación | *(Borrador estructural)* | Reserva Técnica | `PENDING_HOMOLOGATION` | `PENDING_HOMOLOGATION` | `N/A` |
| `POS_RESERVADA_23` | 23 | *(Sin archivo anexo homologado)* | Posición Reservada 23 — Pendiente de homologación | *(Borrador estructural)* | Reserva Técnica | `PENDING_HOMOLOGATION` | `PENDING_HOMOLOGATION` | `N/A` |

---

## 3. Documentos Fuente y Soportes Clínicos (Independientes del Paquete Normativo)

Los siguientes 4 archivos forman parte de los insumos originales pero **NO constituyen posiciones del paquete normativo de 23 anexos**, sino evidencias complementarias y documentos fuente (`SourceDocument`):

| Archivo Fuente Original | Tipo | Propósito Operativo | Clasificación en GODT | SHA-256 Original |
| :--- | :--- | :--- | :--- | :--- |
| `Cálculo Hemodilución.docx` | DOCX | Herramienta de cálculo y estimación de hemodilución serológica | `SourceDocument` (Cálculo/Paraclínico) | `C8295B4C70B4283C2C307159118380FF258E4F4941A9635B6571B93550DEA45E` |
| `Evaluación de riesgo COVID 19 Tissue Bank.docx` | DOCX | Tamizaje epidemiológico e infeccioso del donante de tejidos | `SourceDocument` (Tamizaje Clínico) | `7D4A78E4615B7E7DD8A3B27D8D0FCE7B326E13BA453950E5536ED62217424DE7` |
| `HC Donante 2024.docx` | DOCX | Historia clínica hospitalaria del donante (confidencial) | `SourceDocument` (Historia Clínica) | `83F347CC46DBC1ABAE6660D7778C6287A273CFF130F0E6CB4B59071F8AD0684D` |
| `Historia Clínica Tissue Bank.docx` | DOCX | Historia clínica institucional del banco de tejidos | `SourceDocument` (Historia Clínica) | `60CD89E66F90A667CC06CC9BF45CCD60A4A5C80681B5D147440741E0162E680E` |

---

## 4. Hallazgos Corregidos Respecto a Reportes Previos

1. **Corrección de la Posición 13:** En reportes anteriores se mencionó equívocamente "Intestino". Se constató que el archivo real es `anexo-7-registro-extraccion-otros-organos.pdf`. La posición 13 corresponde oficialmente a `ANEXO_7_OTROS_ORGANOS` (Ficha de extracción de otros órganos), permitiendo registrar intestino, bloque multivisceral o cualquier otro órgano no tipificado individualmente.
2. **Corrección de Numeración de Anexos:** Las variantes quirúrgicas de tejidos y órganos corresponden a variantes del **Anexo 7** (Posiciones 7 a 17 del paquete). No deben crearse nomenclaturas inexistentes como "Anexo 10", "Anexo 11", etc. como si fueran anexos normativos independientes.
3. **Reserva Exclusiva de Posiciones 20 a 23:** Las posiciones 20 a 23 se denominan estrictamente **Posiciones Reservadas [Pendientes de homologación institucional]**. No se les asignan títulos que insinúen adopción o resolución oficial hasta tanto la autoridad competente emita los anexos correspondientes.
4. **Separación de Documentos Fuente:** Las historias clínicas y documentos de hemodilución/COVID jamás ocupan posiciones del paquete normativo; se procesan de forma append-only en la entidad `SourceDocument`.

