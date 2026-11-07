import AdmZip from "adm-zip";

export interface DocxExtractionResult {
  text: string;
  paragraphs: string[];
  tables: string[][];
}

/**
 * Extrae texto, párrafos y tablas preservando la estructura de documentos DOCX (OpenXML)
 * sin requerir dependencias externas del sistema operativo.
 */
export function extractTextFromDocx(buffer: Buffer): DocxExtractionResult {
  if (!buffer || buffer.length < 4) {
    throw new Error("Buffer inválido para extracción DOCX");
  }

  let zip: AdmZip;
  try {
    zip = new AdmZip(buffer);
  } catch (error) {
    throw new Error(
      `Archivo DOCX corrupto o formato no compatible: ${
        error instanceof Error ? error.message : "Error de descompresión"
      }`,
    );
  }

  const documentXmlEntry = zip.getEntry("word/document.xml");
  if (!documentXmlEntry) {
    throw new Error("Estructura DOCX inválida: word/document.xml no encontrado");
  }

  const xmlContent = documentXmlEntry.getData().toString("utf-8");

  const paragraphs: string[] = [];
  const tables: string[][] = [];

  // 1. Extraer tablas (<w:tbl> ... </w:tbl>)
  const tableRegex = /<w:tbl[\s>][\s\S]*?<\/w:tbl>/gi;
  let tableMatch: RegExpExecArray | null;
  while ((tableMatch = tableRegex.exec(xmlContent)) !== null) {
    const tableXml = tableMatch[0];
    const rowRegex = /<w:tr[\s>][\s\S]*?<\/w:tr>/gi;
    let rowMatch: RegExpExecArray | null;
    const tableRows: string[] = [];
    while ((rowMatch = rowRegex.exec(tableXml)) !== null) {
      const rowXml = rowMatch[0];
      const cellRegex = /<w:tc[\s>][\s\S]*?<\/w:tc>/gi;
      let cellMatch: RegExpExecArray | null;
      const cells: string[] = [];
      while ((cellMatch = cellRegex.exec(rowXml)) !== null) {
        const cellText = cleanXmlTags(cellMatch[0]).trim();
        if (cellText) cells.push(cellText);
      }
      if (cells.length > 0) {
        tableRows.push(cells.join(" | "));
      }
    }
    if (tableRows.length > 0) {
      tables.push(tableRows);
    }
  }

  // 2. Extraer párrafos (<w:p> ... </w:p>)
  const paragraphRegex = /<w:p[\s>][\s\S]*?<\/w:p>/gi;
  let pMatch: RegExpExecArray | null;
  while ((pMatch = paragraphRegex.exec(xmlContent)) !== null) {
    const pText = cleanXmlTags(pMatch[0]).trim();
    if (pText) {
      paragraphs.push(pText);
    }
  }

  const text = paragraphs.join("\n");

  return {
    text,
    paragraphs,
    tables,
  };
}

/**
 * Limpia etiquetas XML respetando espacios y saltos de línea básicos
 */
function cleanXmlTags(xml: string): string {
  return xml
    .replace(/<w:tab\/>/gi, "\t")
    .replace(/<w:br\/>/gi, "\n")
    .replace(/<\/w:p>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}
