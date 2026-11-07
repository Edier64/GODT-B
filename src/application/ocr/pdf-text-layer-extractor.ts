import { inflateSync } from "zlib";

export interface PdfTextLayerResult {
  hasTextLayer: boolean;
  text: string;
  pageCount: number;
}

/**
 * Inspecciona un archivo PDF para extraer texto de su capa digital directa.
 * Si el documento tiene capa digital adecuada,
 * permite procesarlo sin necesidad de rasterización a imágenes ni OCR externo.
 */
export function extractTextLayerFromPdf(buffer: Buffer): PdfTextLayerResult {
  if (!buffer || buffer.length < 5 || buffer.subarray(0, 5).toString() !== "%PDF-") {
    return { hasTextLayer: false, text: "", pageCount: 0 };
  }

  const rawStr = buffer.toString("binary");
  const extractedChunks: string[] = [];

  // Contar páginas aproximadas buscando /Type /Page
  const pageMatches = rawStr.match(/\/Type\s*\/Page\b/g);
  const pageCount = pageMatches ? pageMatches.length : 1;

  // 1. Extraer streams utilizando índices en el Buffer para evitar corrupción de bytes binarios
  let searchPos = 0;
  const streamMarker = Buffer.from("stream");
  const endStreamMarker = Buffer.from("endstream");

  while (searchPos < buffer.length) {
    const streamIdx = buffer.indexOf(streamMarker, searchPos);
    if (streamIdx === -1) break;

    // Saltar el marcador "stream" y los delimitadores de salto de línea (\r?\n)
    let contentStart = streamIdx + streamMarker.length;
    if (buffer[contentStart] === 0x0d && buffer[contentStart + 1] === 0x0a) {
      contentStart += 2;
    } else if (buffer[contentStart] === 0x0a || buffer[contentStart] === 0x0d) {
      contentStart += 1;
    }

    const endStreamIdx = buffer.indexOf(endStreamMarker, contentStart);
    if (endStreamIdx === -1) break;

    let contentEnd = endStreamIdx;
    if (contentEnd > contentStart && buffer[contentEnd - 1] === 0x0a) {
      contentEnd--;
    }
    if (contentEnd > contentStart && buffer[contentEnd - 1] === 0x0d) {
      contentEnd--;
    }

    const streamChunk = buffer.subarray(contentStart, contentEnd);
    searchPos = endStreamIdx + endStreamMarker.length;

    let streamText = "";
    try {
      const uncompressed = inflateSync(streamChunk);
      streamText = uncompressed.toString("latin1");
    } catch {
      streamText = streamChunk.toString("latin1");
    }

    if (streamText.includes("BT") && streamText.includes("ET")) {
      const textFromBt = extractTextFromBtBlocks(streamText);
      if (textFromBt.trim()) {
        extractedChunks.push(textFromBt);
      }
    }
  }

  // 2. Si no se extrajeron bloques de streams comprimidos, buscar directamente en texto plano
  if (extractedChunks.length === 0) {
    const directText = extractTextFromBtBlocks(rawStr);
    if (directText.trim()) {
      extractedChunks.push(directText);
    }
  }

  const combinedText = extractedChunks.join("\n").replace(/\r/g, "").trim();
  const hasTextLayer = combinedText.length >= 20;

  return {
    hasTextLayer,
    text: combinedText,
    pageCount: Math.max(1, pageCount),
  };
}

/**
 * Extrae cadenas de texto de operadores PDF (Tj, TJ) dentro de bloques BT ... ET,
 * soportando tanto cadenas literales (...) como codificadas en hexadecimal <...>.
 */
function extractTextFromBtBlocks(content: string): string {
  const textPieces: string[] = [];
  const btRegex = /BT[\s\S]*?ET/g;
  let btMatch: RegExpExecArray | null;

  while ((btMatch = btRegex.exec(content)) !== null) {
    const block = btMatch[0];

    // Operador Tj con paréntesis literal: (Texto) Tj
    const tjLiteralRegex = /\((.*?)\)\s*Tj/g;
    let tjLitMatch: RegExpExecArray | null;
    while ((tjLitMatch = tjLiteralRegex.exec(block)) !== null) {
      const cleaned = cleanPdfString(tjLitMatch[1]);
      if (cleaned) textPieces.push(cleaned);
    }

    // Operador Tj con hexadecimal: <484F4C41> Tj
    const tjHexRegex = /<([0-9A-Fa-f\s]+)>\s*Tj/g;
    let tjHexMatch: RegExpExecArray | null;
    while ((tjHexMatch = tjHexRegex.exec(block)) !== null) {
      const decoded = decodePdfHexString(tjHexMatch[1]);
      if (decoded) textPieces.push(decoded);
    }

    // Operador TJ con arreglos: [(Texto) -10 <484F4C41>] TJ
    const tjArrayRegex = /\[(.*?)\]\s*TJ/g;
    let arrayMatch: RegExpExecArray | null;
    while ((arrayMatch = tjArrayRegex.exec(block)) !== null) {
      const inner = arrayMatch[1];
      const itemRegex = /(?:\((.*?)\)|<([0-9A-Fa-f\s]+)>)/g;
      let itemMatch: RegExpExecArray | null;
      const subPiece: string[] = [];
      while ((itemMatch = itemRegex.exec(inner)) !== null) {
        if (itemMatch[1] !== undefined) {
          const cleaned = cleanPdfString(itemMatch[1]);
          if (cleaned) subPiece.push(cleaned);
        } else if (itemMatch[2] !== undefined) {
          const decoded = decodePdfHexString(itemMatch[2]);
          if (decoded) subPiece.push(decoded);
        }
      }
      if (subPiece.length > 0) {
        textPieces.push(subPiece.join(" "));
      }
    }
  }

  return textPieces.join("\n");
}

function cleanPdfString(str: string): string {
  return str
    .replace(/\\([0-7]{1,3})/g, (_, oct) => String.fromCharCode(parseInt(oct, 8)))
    .replace(/\\n/g, "\n")
    .replace(/\\r/g, "\r")
    .replace(/\\t/g, "\t")
    .replace(/\\([()\\])/g, "$1")
    .trim();
}

function decodePdfHexString(hexRaw: string): string {
  let hex = hexRaw.replace(/\s+/g, "");
  if (hex.length % 2 !== 0) {
    hex += "0"; // Según PDF spec 1.7, si hay número impar de dígitos hex, se asume un '0' final
  }
  try {
    const buf = Buffer.from(hex, "hex");
    // Filtrar caracteres no imprimibles preservando acentos y puntuación
    return buf.toString("latin1").trim();
  } catch {
    return "";
  }
}
