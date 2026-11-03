# Inventario local de documentos institucionales

## Alcance y protección

La inspección se realizó sobre la carpeta local ignorada por Git:

`docs/documentos-reales/`

Los archivos originales no fueron eliminados, movidos, renombrados,
modificados, copiados al frontend ni incorporados al índice Git. La legibilidad
se evaluó mediante extracción local de texto: PDF con `pypdf` y DOCX mediante
`word/document.xml`. Esto confirma texto estructural, no una homologación
visual o jurídica completa.

## Inventario

| Archivo | Formato | Tamaño | Páginas/tablas | Identificación | Legibilidad | Estado |
|---|---:|---:|---:|---|---|---|
| `anexo-1-formato-de-valoracion-alerta-posible-donante.pdf` | PDF | 332,075 B | 2 | Anexo 1 | Texto extraído | Estructura analizada |
| `anexo-2-notificacion-a-los-deudos-legalizacion-de-donacion.pdf` | PDF | 410,000 B | 2 | Anexo 2 | Texto extraído | Estructura analizada |
| `anexo-3-formato-consentimiento-donacion-legalizacion.pdf` | PDF | 324,239 B | 2 | Anexo 3 | Texto extraído | Estructura analizada |
| `anexo-4-registro-de-donante-y-oferta-organos-y-tejidos.pdf` | PDF | 435,672 B | 4 | Anexo 4 | Texto extraído | Estructura analizada |
| `anexo-5-formato-de-remision-de-muestras.docx` | DOCX | 67,503 B | 2 tablas | Anexo 5 | Texto y tablas extraídos | Estructura analizada |
| `anexo-6-registro-general-de-extraccion.pdf` | PDF | 187,975 B | 2 | Anexo 6 | Texto extraído | Estructura analizada |
| `anexo-7- formato-acta-de-rescate-de-tejido-ocular.pdf` | PDF | 145,529 B | 2 | Anexo 7 / ocular | Texto extraído | Variante identificada |
| `anexo-7-formato-acta-de-rescate-de-tejido-cardiovascular.pdf` | PDF | 170,771 B | 3 | Anexo 7 / cardiovascular | Texto extraído | Variante identificada |
| `anexo-7-formato-acta-de-rescate-de-tejido-osteomuscular.pdf` | PDF | 191,247 B | 3 | Anexo 7 / osteomuscular | Texto extraído | Variante identificada |
| `anexo-7-formato-acta-de-rescate-de-tejido-piel.pdf` | PDF | 178,296 B | 3 | Anexo 7 / piel | Texto extraído | Variante identificada |
| `anexo-7-registro-extraccion-corazon-cardiectomia.pdf` | PDF | 155,110 B | 1 | Anexo 7 / corazón | Texto extraído | Variante identificada |
| `anexo-7-registro-extraccion-higado-hepatectomia.pdf` | PDF | 156,419 B | 1 | Anexo 7 / hígado | Texto extraído | Variante identificada |
| `anexo-7-registro-extraccion-otros-organos.pdf` | PDF | 147,900 B | 1 | Anexo 7 / otros órganos | Texto extraído | Variante identificada |
| `anexo-7-registro-extraccion-pancreas.pdf` | PDF | 156,248 B | 1 | Anexo 7 / páncreas | Texto extraído | Variante identificada |
| `anexo-7-registro-extraccion-pulmon-neumonectomia.pdf` | PDF | 154,790 B | 1 | Anexo 7 / pulmón | Texto extraído | Variante identificada |
| `anexo-7-registro-extraccion-rinon-derecho-nefrectomia.pdf` | PDF | 157,957 B | 1 | Anexo 7 / riñón derecho | Texto extraído | Variante identificada |
| `anexo-7-registro-extraccion-rinon-izquierdo-nefrectomia.pdf` | PDF | 159,251 B | 1 | Anexo 7 / riñón izquierdo | Texto extraído | Variante identificada |
| `anexo-8-formato-cadena-de-custodia.pdf` | PDF | 182,831 B | 2 | Anexo 8 | Texto extraído | Estructura analizada |
| `anexo-9-carta-inmlcf-entrega-cuerpo-procesos-medico-legales.pdf` | PDF | 181,019 B | 1 | Anexo 9 | Texto extraído | Estructura analizada |
| `Cálculo Hemodilución.docx` | DOCX | 86,892 B | 7 tablas | Documento auxiliar | Texto y tablas extraídos | Ejemplo/auxiliar, no plantilla |
| `Evaluación de riesgo COVID 19 Tissue Bank.docx` | DOCX | 271,367 B | 2 tablas | Documento auxiliar | Texto y tablas extraídos | Evaluación fuente, no plantilla |
| `HC Donante 2024.docx` | DOCX | 294,348 B | 15 tablas | Historia clínica | Texto y tablas extraídos | Sensible, solo fuente |
| `Historia Clínica Tissue Bank.docx` | DOCX | 138,065 B | 9 tablas | Historia clínica Tissue Bank | Texto y tablas extraídos | Sensible, solo fuente |

## Integridad de las fuentes

Se calcularon hashes SHA-256 durante la inspección. Los hashes completos se
permiten repetir la comparación antes de una futura carga; no se generó una
copia de los archivos.

| Archivo | SHA-256 |
|---|---|
| `anexo-1-formato-de-valoracion-alerta-posible-donante.pdf` | `359EF826D284AC0B77DD0A7B16A0317E921BD2DB0E10B08F48CF4913DC77884C` |
| `anexo-2-notificacion-a-los-deudos-legalizacion-de-donacion.pdf` | `195E098221C53A3A909E7DB6D176EBB9028FB0C5034CB039D3E97027AA0CCDFC` |
| `anexo-3-formato-consentimiento-donacion-legalizacion.pdf` | `FE4E7A25ADE4247BFB2D822CF6FFEC113598F5509DE7E2B16AEBDD3FAF2C0403` |
| `anexo-4-registro-de-donante-y-oferta-organos-y-tejidos.pdf` | `12B351B30D139C3D80E940C35E8988D967E5F94912895A7F7A8B9CF645223122` |
| `anexo-5-formato-de-remision-de-muestras.docx` | `25EE36C8E86CFBF1DBC5A3595D81D485062116B724BEC8A8C8FF4C947E84B422` |
| `anexo-6-registro-general-de-extraccion.pdf` | `2AD0386EF94E66D0F48BF4F975B7179B601B1F2B716555E5C17445E282CFE09D` |
| `anexo-7- formato-acta-de-rescate-de-tejido-ocular.pdf` | `1EC41A945718DEC408E68C2640BBB6614F41F73ECC7DFF416FC8C7C7C0A4D796` |
| `anexo-7-formato-acta-de-rescate-de-tejido-cardiovascular.pdf` | `2820CC85C79FF77979E0491AC17EFE537B1198A4A7FC226D1B42F423FD06BD69` |
| `anexo-7-formato-acta-de-rescate-de-tejido-osteomuscular.pdf` | `789C0F3249B3693EFDD6429B94371C3DACD9C4EE93CE7C8EFF1C30BD7F0738C5` |
| `anexo-7-formato-acta-de-rescate-de-tejido-piel.pdf` | `428A92AC6EF7E9D0E152D7E4A18671B177C1D0F2CF5A5E6A9C63B861D89242EB` |
| `anexo-7-registro-extraccion-corazon-cardiectomia.pdf` | `B0C59E086272FBA93DB867EDA8B81BBC1203D45F39FFE34DAD907D98CDD4728C` |
| `anexo-7-registro-extraccion-higado-hepatectomia.pdf` | `CA4B5102BDCB5FD355DA69636FF4D2A52A8029A17A9743CD9C21825B7A84AA89` |
| `anexo-7-registro-extraccion-otros-organos.pdf` | `D724A614C413D002582F19E8BE2F67E26AC23189CE06A9599D63F0E9DEA579DD` |
| `anexo-7-registro-extraccion-pancreas.pdf` | `D892A9FB0C8B67CD6CEB43564A73BC14F8DCBA92A86B5B74C3751E9A04C8E285` |
| `anexo-7-registro-extraccion-pulmon-neumonectomia.pdf` | `25BD1C02F64D41A5CB9A57B3DD71157D16A559DBEC4C28334C5338225F311BE3` |
| `anexo-7-registro-extraccion-rinon-derecho-nefrectomia.pdf` | `534C00C76C5AA3A23779CD20F013DE7CC796E733D7AE72C518D514B9541D90A0` |
| `anexo-7-registro-extraccion-rinon-izquierdo-nefrectomia.pdf` | `DA98D44E19352583085395AD199C9EBF8E7E1F437951EF7AED5CFA48869B2CB0` |
| `anexo-8-formato-cadena-de-custodia.pdf` | `81B2E4A74B22D086E49E1146F26DE0B1A72B7DC022BE181AD6363102D6C538FD` |
| `anexo-9-carta-inmlcf-entrega-cuerpo-procesos-medico-legales.pdf` | `FFAA79B67ABC02707643C4DA0BF08FACBABF800723098CE2DE74E9B65ED2CFCD` |
| `Cálculo Hemodilución.docx` | `C8295B4C70B4283C2C307159118380FF258E4F4941A9635B6571B93550DEA45E` |
| `Evaluación de riesgo COVID 19 Tissue Bank.docx` | `7D4A78E4615B7E7DD8A3B27D8D0FCE7B326E13BA453950E5536ED62217424DE7` |
| `HC Donante 2024.docx` | `83F347CC46DBC1ABAE6660D7778C6287A273CFF130F0E6CB4B59071F8AD0684D` |
| `Historia Clínica Tissue Bank.docx` | `60CD89E66F90A667CC06CC9BF45CCD60A4A5C80681B5D147440741E0162E680E` |

## Hallazgos de formato

- Los PDF institucionales son formularios con casillas, líneas, firmas y
  tablas; la extracción de texto no conserva completamente su geometría.
- El Anexo 8 contiene una secuencia de cadena de custodia y no debe reducirse
  a una fila fija.
- Los DOCX de historias clínicas y ejemplos contienen respuestas diligenciadas
  y no deben convertirse en fixtures ni plantillas publicables.
- No se encontró un modelo Prisma `DocumentSource`; el modelo vigente para
  archivos fuente es `SourceDocument`, relacionado con `DonorRecord`.
