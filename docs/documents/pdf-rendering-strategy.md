# Estrategia de generación PDF

## Comparación

| Alternativa | Fidelidad | Tablas/saltos | Firmas | Riesgos |
|---|---|---|---|---|
| Superposición sobre PDF oficial | Muy alta para formatos fijos | Limitada si el espacio es corto | Puede reservar espacios | Coordenadas frágiles ante cambios de versión |
| DOCX a PDF | Alta para documentos editables | Buena | Requiere control de fuentes | Conversión y disponibilidad de LibreOffice |
| HTML/CSS a PDF | Variable | Buena con CSS controlado | Buena para firmas como imagen | Diferencias entre motores y paginación |
| Renderizado estructurado | Alta si el layout se diseña | Muy controlable | Controlable | Mayor desarrollo inicial |

## Estrategia híbrida

1. **PDF oficial como fondo** para anexos cuyo diseño deba conservarse
   literalmente, especialmente formularios con coordenadas estables.
2. **DOCX versionado** para documentos cuyo origen sea DOCX y cuya estructura
   tabular sea más mantenible en ese formato.
3. **HTML/CSS controlado** para documentos dinámicos, tablas repetibles,
   páginas adicionales y variantes nuevas.
4. **Renderizador estructurado** para Anexo 8 y otros registros que requieren
   crecimiento de filas y páginas.

La estrategia se configura por `TemplateVersion`; no se elige por número de
anexo en código.

## Requisitos comunes

- Resolver todos los valores desde un snapshot validado.
- Fijar fuentes, tamaño de página, orientación, márgenes y zona horaria.
- Tratar firmas como referencias a archivos privados o espacios reservados;
  nunca inventar una firma.
- Crear páginas adicionales para tablas repetibles sin truncar valores.
- Conservar `rendererType`, versión del renderer, hash de recurso y hash final.
- Rechazar generación si faltan campos obligatorios o existen conflictos no
  resueltos.

## PDF/A

PDF/A-1a solo debe declararse cuando el renderizador y la cadena de conversión
demuestren conformidad real. La verificación debe incluir:

- metadatos XMP;
- fuentes embebidas;
- ausencia de transparencia, cifrado o contenido no permitido;
- perfiles de color cuando correspondan;
- validación con una herramienta especializada, por ejemplo veraPDF;
- conservación del reporte y versión del validador.

Si una plantilla oficial no es compatible con PDF/A-1a sin alterar su diseño,
la decisión debe ser institucional; no se debe etiquetar falsamente el archivo.

## Aprobación y almacenamiento

La generación produce un archivo privado temporal, lo valida, calcula SHA-256,
lo persiste y registra `GeneratedPdfDocument` en una transacción lógica. Si el
registro falla, se elimina el archivo temporal. El PDF conserva la instancia,
revisión, versión y snapshot exactos.

## Pruebas

- Comparación visual por versión y variante.
- Tablas de cero, una y muchas filas.
- Saltos de página y orientación apaisada del Anexo 8.
- Páginas adicionales del registro de custodia.
- Campos largos y caracteres acentuados.
- Firmas ausentes, presentes y no autorizadas.
- Validación PDF/A solo cuando esté exigida y soportada.
