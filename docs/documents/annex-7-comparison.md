# Comparación del Anexo 7

## Conclusión

Los 11 archivos no deben implementarse como 11 formularios codificados, pero
tampoco deben fusionarse en un formulario único. La solución debe compartir
secciones y componentes mediante definiciones versionadas y conservar esquemas
específicos por variante.

## Actas de rescate de tejidos

### Secciones comunes

1. Información general del donante.
2. Procedencia del cadáver: INMLCF/IPS, historia, SIRDEC y noticia criminal
   cuando aplique.
3. Valoración medicolegal conjunta.
4. Fenómenos cadavéricos.
5. Prendas, pertenencias y evidencias.
6. Autorización médica y mecanismo de donación.
7. Inicio/finalización del procedimiento.
8. Checklist de fotografías, material y EMP/EF.
9. Hallazgos y notas.
10. Firmas de médico, forense y técnico de banco.

### Diferencias específicas

| Variante | Estructura exclusiva |
|---|---|
| Ocular | Iris, pupilas, región periorbitaria, globos y botones corneoesclerales, humor vítreo |
| Cardiovascular | Sitios torácicos/abdominales, corazón, pericardio y segmentos vasculares |
| Osteomuscular | Tabla anatómica extensa por lateralidad, huesos, tendones y fascias |
| Piel | Regiones de brazos, piernas, dorso y glúteos con anterior/dorsal |

## Fichas técnicas de órganos

### Campos comunes

- Código donante.
- IPS generadora.
- Fecha.
- Técnica quirúrgica.
- Hallazgos intraoperatorios o en banco.
- Observaciones.
- Nombre, firma y documento del cirujano.

### Campos exclusivos

| Variante | Campos exclusivos |
|---|---|
| Corazón | Cardiectomía, hallazgos intraoperatorios y hallazgos en banco |
| Hígado | Parénquima, arteria hepática, vena porta, vena hepática y biopsia |
| Otros órganos | Componente y lateralidad |
| Páncreas | Parénquima, hemorragias, esteatonecrosis, edema y tejido graso |
| Pulmón | Lateralidad y neumonectomía |
| Riñón derecho/izquierdo | Longitud, anchura, grosor, parénquima, arteria, vena, uréter y biopsia |

Los riñones comparten estructura y difieren por lateralidad; deben ser una
misma definición parametrizada, no dos implementaciones independientes.

## Arquitectura recomendada

- `tissue-rescue-base`: secciones comunes.
- `tissue-rescue-ocular`, `tissue-rescue-cardiovascular`,
  `tissue-rescue-osteomuscular`, `tissue-rescue-skin`: extensiones de variante.
- `organ-extraction-base`: campos comunes.
- `organ-heart`, `organ-liver`, `organ-other`, `organ-pancreas`,
  `organ-lung`, `organ-kidney`: extensiones.
- Cada definición referencia un recurso visual/versionado y un JSON Schema
  propio.
- Los componentes visuales comunes se reutilizan en Vue; la fidelidad del PDF
  se conserva mediante un recurso de renderizado por variante.
