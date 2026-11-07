export interface OcrCandidate {
  canonicalFieldKey: string;
  candidateValue: string;
  confidenceScore: number;
  pageNumber?: number;
  boundingBox?: Record<string, unknown>;
}

export interface OcrProviderPort {
  readonly name: string;
  process(input: { buffer: Buffer; mimeType: string }): Promise<OcrCandidate[]>;
}

export const OCR_PROVIDER = Symbol("OCR_PROVIDER");
