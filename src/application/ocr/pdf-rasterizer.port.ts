export interface PdfRasterizerPort {
  rasterize(buffer: Buffer): Promise<Buffer[]>;
}

export const PDF_RASTERIZER = Symbol("PDF_RASTERIZER");
