import { deflateSync, crc32 } from "zlib";

function createPngChunk(type: string, data: Buffer): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const lenBuf = Buffer.alloc(4);
  lenBuf.writeUInt32BE(data.length, 0);

  const crcTarget = Buffer.concat([typeBuf, data]);
  const crcVal = crc32(crcTarget);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crcVal, 0);

  return Buffer.concat([lenBuf, typeBuf, data, crcBuf]);
}

/**
 * Convierte un mapa de bits BMP (24 o 32 bpp, sin comprimir) a PNG en memoria pura.
 */
export function bmpToPng(bmp: Buffer): Buffer {
  if (bmp.length < 54 || bmp[0] !== 0x42 || bmp[1] !== 0x4d) {
    throw new Error("Firma de archivo BMP inválida");
  }
  const pixelOffset = bmp.readUInt32LE(10);
  const width = Math.abs(bmp.readInt32LE(18));
  const rawHeight = bmp.readInt32LE(22);
  const height = Math.abs(rawHeight);
  const isTopDown = rawHeight < 0;
  const bpp = bmp.readUInt16LE(28);

  if (width === 0 || height === 0) {
    throw new Error("Dimensiones de BMP inválidas");
  }

  const bytesPerPixel = Math.floor(bpp / 8);
  const rowStride = Math.floor((bpp * width + 31) / 32) * 4;

  const rawScanlines: Buffer[] = [];

  for (let y = 0; y < height; y++) {
    const srcY = isTopDown ? y : height - 1 - y;
    const rowOffset = pixelOffset + srcY * rowStride;
    const scanline = Buffer.alloc(1 + width * 4);
    scanline[0] = 0; // Filter: None

    for (let x = 0; x < width; x++) {
      const pxOffset = rowOffset + x * bytesPerPixel;
      if (pxOffset + 2 >= bmp.length) continue;
      const b = bmp[pxOffset];
      const g = bmp[pxOffset + 1];
      const r = bmp[pxOffset + 2];
      const a = bytesPerPixel === 4 && pxOffset + 3 < bmp.length ? bmp[pxOffset + 3] : 255;

      const outOffset = 1 + x * 4;
      scanline[outOffset] = r;
      scanline[outOffset + 1] = g;
      scanline[outOffset + 2] = b;
      scanline[outOffset + 3] = a;
    }
    rawScanlines.push(scanline);
  }

  const idatData = deflateSync(Buffer.concat(rawScanlines));
  const pngSig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // 8 bits por canal
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // compresión standard deflate
  ihdrData[11] = 0; // filtro none
  ihdrData[12] = 0; // no entrelazado

  const ihdrChunk = createPngChunk("IHDR", ihdrData);
  const idatChunk = createPngChunk("IDAT", idatData);
  const iendChunk = createPngChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([pngSig, ihdrChunk, idatChunk, iendChunk]);
}

/**
 * Convierte un TIFF baseline sin comprimir (RGB o escala de grises) a PNG en memoria.
 */
export function tiffToPng(tiff: Buffer): Buffer {
  if (tiff.length < 8) {
    throw new Error("Encabezado TIFF incompleto");
  }
  const isLittle = tiff[0] === 0x49 && tiff[1] === 0x49; // II
  const isBig = tiff[0] === 0x4d && tiff[1] === 0x4d; // MM
  if (!isLittle && !isBig) {
    throw new Error("Firma de archivo TIFF inválida");
  }

  const readU16 = (off: number) => (isLittle ? tiff.readUInt16LE(off) : tiff.readUInt16BE(off));
  const readU32 = (off: number) => (isLittle ? tiff.readUInt32LE(off) : tiff.readUInt32BE(off));

  const magic = readU16(2);
  if (magic !== 42) {
    throw new Error("Número de versión TIFF no corresponde a 42");
  }

  const ifdOffset = readU32(4);
  if (ifdOffset >= tiff.length) {
    throw new Error("Offset de IFD fuera de límites");
  }

  const numEntries = readU16(ifdOffset);
  let width = 0;
  let height = 0;
  let samplesPerPixel = 1;
  let stripOffsets: number[] = [];
  let stripByteCounts: number[] = [];

  for (let i = 0; i < numEntries; i++) {
    const entryOffset = ifdOffset + 2 + i * 12;
    if (entryOffset + 12 > tiff.length) break;
    const tag = readU16(entryOffset);
    const count = readU32(entryOffset + 4);
    const valueOffset = entryOffset + 8;

    if (tag === 256) {
      // ImageWidth
      width = count === 1 ? (readU16(entryOffset + 2) === 3 ? readU16(valueOffset) : readU32(valueOffset)) : 0;
    } else if (tag === 257) {
      // ImageLength (height)
      height = count === 1 ? (readU16(entryOffset + 2) === 3 ? readU16(valueOffset) : readU32(valueOffset)) : 0;
    } else if (tag === 277) {
      // SamplesPerPixel
      samplesPerPixel = readU16(valueOffset);
    } else if (tag === 273) {
      // StripOffsets
      if (count === 1) {
        stripOffsets.push(readU32(valueOffset));
      } else {
        const ptr = readU32(valueOffset);
        for (let j = 0; j < count; j++) {
          stripOffsets.push(readU32(ptr + j * 4));
        }
      }
    } else if (tag === 279) {
      // StripByteCounts
      if (count === 1) {
        stripByteCounts.push(readU32(valueOffset));
      } else {
        const ptr = readU32(valueOffset);
        for (let j = 0; j < count; j++) {
          stripByteCounts.push(readU32(ptr + j * 4));
        }
      }
    }
  }

  if (width === 0 || height === 0 || stripOffsets.length === 0) {
    throw new Error("Metadatos TIFF esenciales no encontrados o corruptos");
  }

  const rawPixels: Buffer[] = [];
  for (let s = 0; s < stripOffsets.length; s++) {
    const off = stripOffsets[s];
    const len = stripByteCounts[s] || width * height * samplesPerPixel;
    if (off + len <= tiff.length) {
      rawPixels.push(tiff.subarray(off, off + len));
    }
  }
  const pixelData = Buffer.concat(rawPixels);

  const rawScanlines: Buffer[] = [];
  for (let y = 0; y < height; y++) {
    const scanline = Buffer.alloc(1 + width * 4);
    scanline[0] = 0; // Filter: None
    const rowOffset = y * width * samplesPerPixel;

    for (let x = 0; x < width; x++) {
      const srcOffset = rowOffset + x * samplesPerPixel;
      let r = 0, g = 0, b = 0, a = 255;
      if (samplesPerPixel >= 3) {
        r = pixelData[srcOffset] ?? 0;
        g = pixelData[srcOffset + 1] ?? 0;
        b = pixelData[srcOffset + 2] ?? 0;
        a = samplesPerPixel >= 4 ? pixelData[srcOffset + 3] ?? 255 : 255;
      } else {
        const gray = pixelData[srcOffset] ?? 0;
        r = gray; g = gray; b = gray;
      }
      const outOffset = 1 + x * 4;
      scanline[outOffset] = r;
      scanline[outOffset + 1] = g;
      scanline[outOffset + 2] = b;
      scanline[outOffset + 3] = a;
    }
    rawScanlines.push(scanline);
  }

  const idatData = deflateSync(Buffer.concat(rawScanlines));
  const pngSig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;

  const ihdrChunk = createPngChunk("IHDR", ihdrData);
  const idatChunk = createPngChunk("IDAT", idatData);
  const iendChunk = createPngChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([pngSig, ihdrChunk, idatChunk, iendChunk]);
}

export interface ImageNormalizationResult {
  buffer: Buffer;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  wasTranscoded: boolean;
}

/**
 * Detecta y normaliza imágenes (.jpg, .jpeg, .png, .webp, .tif, .tiff, .bmp)
 * para garantizar compatibilidad con los proveedores de IA multimodal (Gemini).
 */
export function normalizeImageForAi(
  buffer: Buffer,
  declaredMimeType: string,
): ImageNormalizationResult {
  if (!buffer || buffer.length < 4) {
    throw new Error("Buffer de imagen vacío o inválido");
  }

  // 1. PNG
  if (buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return { buffer, mimeType: "image/png", wasTranscoded: false };
  }

  // 2. JPEG
  if (buffer.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) {
    return { buffer, mimeType: "image/jpeg", wasTranscoded: false };
  }

  // 3. WebP (RIFF....WEBP)
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString() === "RIFF" &&
    buffer.subarray(8, 12).toString() === "WEBP"
  ) {
    return { buffer, mimeType: "image/webp", wasTranscoded: false };
  }

  // 4. BMP (BM)
  if (buffer[0] === 0x42 && buffer[1] === 0x4d) {
    const pngBuf = bmpToPng(buffer);
    return { buffer: pngBuf, mimeType: "image/png", wasTranscoded: true };
  }

  // 5. TIFF (II*\0 o MM\0*)
  if (
    (buffer[0] === 0x49 && buffer[1] === 0x49 && buffer[2] === 0x2a && buffer[3] === 0x00) ||
    (buffer[0] === 0x4d && buffer[1] === 0x4d && buffer[2] === 0x00 && buffer[3] === 0x2a)
  ) {
    const pngBuf = tiffToPng(buffer);
    return { buffer: pngBuf, mimeType: "image/png", wasTranscoded: true };
  }

  // Si el MIME declarado es PNG, JPEG o WebP conocido, respetar
  if (declaredMimeType === "image/png" || declaredMimeType === "image/jpeg" || declaredMimeType === "image/webp") {
    return { buffer, mimeType: declaredMimeType, wasTranscoded: false };
  }

  throw new Error(`Formato de imagen no soportado o firma mágica desconocida (${declaredMimeType})`);
}

