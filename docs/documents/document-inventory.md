# Inventario documental GODT Regional 3

## Alcance y método

Se analizó el contenido textual, la paginación, la presencia de tablas,
casillas, líneas de diligenciamiento, firmas y recursos gráficos de los 23
archivos del paquete `rvexternalfwdanexosgestionoperativadeladonacion.zip`.
Los ejemplos diligenciados no se reproducen por contener datos personales y
clínicos.

El catálogo observado es una fotografía del material recibido; no es una lista
cerrada. Cada documento debe tener un identificador interno estable y
versiones independientes.

## Inventario

| # | Archivo | Tipo/páginas | Estado observado | Clasificación | Tratamiento inicial |
|---:|---|---|---|---|---|
| 1 | Anexo 1 — valoración y alerta de posible donante | PDF, 2 | Plantilla vacía | A | Formulario dinámico con secciones y tablas repetibles |
| 2 | Anexo 2 — notificación a deudos/legalización | PDF, 2 | Plantilla vacía | B | Generación asistida con firmas y constancias |
| 3 | Anexo 3 — consentimiento familiar/legalización | PDF, 2 | Plantilla vacía | B | Formulario condicionado por mecanismo legal |
| 4 | Anexo 4 — registro y oferta de órganos/tejidos | PDF, 4 | Plantilla vacía | C | Generación parcial; anonimización determinista |
| 5 | Anexo 5 — remisión de muestras | DOCX | Plantilla con tablas | D | Formulario dinámico y generación controlada |
| 6 | Anexo 6 — registro general de extracción | PDF, 2 | Plantilla vacía | C | Formulario con órganos, tejidos y personal |
| 7 | Anexo 7 — rescate de tejido ocular | PDF, 2 | Plantilla vacía | C | Variante de acta de tejido |
| 8 | Anexo 7 — rescate de tejido cardiovascular | PDF, 3 | Plantilla vacía | C | Variante de acta de tejido |
| 9 | Anexo 7 — rescate de tejido osteomuscular | PDF, 3 | Plantilla vacía | C | Variante de acta de tejido |
| 10 | Anexo 7 — rescate de tejido piel | PDF, 3 | Plantilla vacía | C | Variante de acta de tejido |
| 11 | Anexo 7 — extracción de corazón/cardiectomía | PDF, 1 | Plantilla vacía | C | Variante de ficha de órgano |
| 12 | Anexo 7 — extracción de hígado/hepatectomía | PDF, 1 | Plantilla vacía | C | Variante de ficha de órgano |
| 13 | Anexo 7 — extracción de otros órganos | PDF, 1 | Plantilla vacía | C | Variante con componente y lateralidad |
| 14 | Anexo 7 — extracción de páncreas | PDF, 1 | Plantilla vacía | C | Variante de ficha de órgano |
| 15 | Anexo 7 — extracción de pulmón/neumonectomía | PDF, 1 | Plantilla vacía | C | Variante con lateralidad |
| 16 | Anexo 7 — riñón derecho/nefrectomía | PDF, 1 | Plantilla vacía | C | Variante con medidas y estructuras renales |
| 17 | Anexo 7 — riñón izquierdo/nefrectomía | PDF, 1 | Plantilla vacía | C | Misma estructura que riñón derecho; lateralidad distinta |
| 18 | Anexo 8 — cadena de custodia | PDF, 2 apaisadas | Plantilla vacía | E | Registro secuencial; no simplificar |
| 19 | Anexo 9 — entrega de cuerpo a INMLCF | PDF, 1 | Plantilla vacía | E | Carta generada con anexos y firmas |
| 20 | Cálculo de hemodilución | DOCX | Ejemplo diligenciado | F | Fuente de análisis; no publicar como plantilla |
| 21 | Evaluación riesgo COVID-19 Tissue Bank | DOCX | Ejemplo diligenciado | F | Fuente clínica; cargar solo como documento fuente |
| 22 | HC Donante 2024 | DOCX | Ejemplo diligenciado | F | Historia clínica; documento sensible, solo fuente |
| 23 | Historia Clínica Tissue Bank | DOCX | Ejemplo diligenciado | F | Historia clínica; documento sensible, solo fuente |

## Perfil visual y de captura

- Los PDF oficiales usan líneas de diligenciamiento, casillas `SI/NO`,
  tablas de selección, bloques de observaciones y firmas manuscritas.
- Los anexos 1 y 4 son formularios extensos verticales con tablas clínicas,
  laboratorios y antecedentes.
- Anexos 2, 3 y 9 son documentos narrativos con campos intercalados y firmas.
- Anexo 8 es apaisado y contiene una tabla secuencial de custodia; requiere
  repetición de hojas.
- Las cuatro actas de tejidos comparten portada clínica, valoración
  medicolegal, autorización y procedimiento, pero divergen en anatomía.
- Las siete fichas de órganos son de una página, con texto técnico y firma del
  cirujano; no contienen el mismo conjunto de campos.
- Los DOCX complementarios contienen tablas reales y, en los ejemplos 21–23,
  respuestas diligenciadas. No deben convertirse automáticamente en plantillas.

## Datos sensibles

Los archivos 21, 22 y 23 contienen datos identificables, clínicos y de
contacto. El archivo 20 contiene valores de ejemplo clínico. Deben conservarse
en almacenamiento privado, con acceso restringido y sin enviarse a Gemini.
Los fixtures de desarrollo deben ser sintéticos o anonimizados.
