import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { OcrCandidate, OCR_PROVIDER, OcrProviderPort } from "./ocr-provider.port";
import { LocalRulesExtractionProvider } from "./local-rules-extraction.provider";
import { extractTextFromDocx } from "./docx-extractor";
import { extractTextLayerFromPdf } from "./pdf-text-layer-extractor";
import { PDF_RASTERIZER, PdfRasterizerPort } from "./pdf-rasterizer.port";
import { FILE_STORAGE_PORT, FileStoragePort } from "../documents/file-storage.port";
import { GeminiOcrAdapter } from "../../infrastructure/ocr/gemini-ocr.adapter";

export interface DocumentUnderstandingInput {
  buffer: Buffer;
  mimeType: string;
  sourceDocumentId?: string;
  processId?: string;
  templateCode?: string;
}

export interface DocumentUnderstandingOutput {
  rawText: string;
  candidates: OcrCandidate[];
  strategyUsed: "PDF_DIGITAL" | "PDF_SCANNED" | "IMAGE_OCR" | "DOCX_PARSER";
  pagesProcessed: number;
}

@Injectable()
export class DocumentUnderstandingService {
  private readonly logger = new Logger(DocumentUnderstandingService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly localRules: LocalRulesExtractionProvider,
    @Optional() @Inject(OCR_PROVIDER) private readonly fallbackOcrProvider?: OcrProviderPort,
    @Optional() @Inject(PDF_RASTERIZER) private readonly rasterizer?: PdfRasterizerPort,
    @Optional() @Inject(FILE_STORAGE_PORT) private readonly storage?: FileStoragePort,
    @Optional() private readonly geminiAdapter?: GeminiOcrAdapter,
  ) {}

  async analyze(input: DocumentUnderstandingInput): Promise<DocumentUnderstandingOutput> {
    const { buffer, mimeType } = input;
    let rawText = "";
    let strategyUsed: DocumentUnderstandingOutput["strategyUsed"] = "IMAGE_OCR";
    let pagesProcessed = 1;
    let localOcrCandidates: OcrCandidate[] = [];

    // 1. DOCX: Extracción estructurada nativa de párrafos y tablas
    if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimeType === "application/msword" ||
      (buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])))
    ) {
      try {
        const docxResult = extractTextFromDocx(buffer);
        rawText = docxResult.text;
        strategyUsed = "DOCX_PARSER";
        this.logger.log(
          `Documento DOCX procesado exitosamente (${docxResult.paragraphs.length} párrafos, ${docxResult.tables.length} tablas).`,
        );
      } catch (error) {
        this.logger.warn(
          `Fallo al parsear DOCX como OpenXML: ${error instanceof Error ? error.message : "Error desconocido"}`,
        );
      }
    }

    // 2. PDF: Evaluar capa de texto digital primero; si es escaneado, recurrir a rasterizador/OCR local
    if (!rawText && mimeType === "application/pdf") {
      const pdfTextResult = extractTextLayerFromPdf(buffer);
      pagesProcessed = pdfTextResult.pageCount;

      if (pdfTextResult.hasTextLayer) {
        rawText = pdfTextResult.text;
        strategyUsed = "PDF_DIGITAL";
        this.logger.log(
          `PDF digital procesado mediante extracción directa de capa de texto (${rawText.length} caracteres, ${pagesProcessed} páginas).`,
        );
      } else {
        strategyUsed = "PDF_SCANNED";
        this.logger.log(
          `PDF sin capa digital suficiente. Ejecutando motor OCR local para PDF escaneado (${pagesProcessed} páginas).`,
        );

        if (this.fallbackOcrProvider) {
          try {
            localOcrCandidates = await this.fallbackOcrProvider.process({ buffer, mimeType });
          } catch (ocrErr) {
            this.logger.warn(
              `Fallo en proveedor OCR local: ${ocrErr instanceof Error ? ocrErr.message : "Error desconocido"}`,
            );
          }
        }
      }
    }

    // 3. Imágenes directas (PNG / JPEG)
    if (!rawText && (mimeType === "image/png" || mimeType === "image/jpeg" || mimeType === "image/jpg")) {
      strategyUsed = "IMAGE_OCR";
      if (this.fallbackOcrProvider) {
        try {
          localOcrCandidates = await this.fallbackOcrProvider.process({ buffer, mimeType });
        } catch (ocrErr) {
          this.logger.warn(
            `Fallo en OCR de imagen: ${ocrErr instanceof Error ? ocrErr.message : "Error desconocido"}`,
          );
        }
      }
    }

    // 4. Extracción determinista mediante reglas canónicas y normalización local
    const ruleCandidates = this.localRules.extract(rawText, {
      pageNumber: 1,
      templateCode: input.templateCode,
    });

    // 5. Invocación controlada del proveedor de IA Gemini (si está habilitado y en entorno autorizado)
    let aiCandidates: OcrCandidate[] = [];
    if (this.geminiAdapter) {
      try {
        if (this.geminiAdapter.isEnabled()) {
          this.logger.log(
            `Invocando análisis semántico con Google Gemini para documento ${strategyUsed}...`,
          );
          aiCandidates = await this.geminiAdapter.process({
            buffer,
            mimeType,
            rawText: rawText || undefined,
          });
          this.logger.log(
            `Análisis semántico con Gemini completado: ${aiCandidates.length} candidatos propuestos.`,
          );
        }
      } catch (geminiError) {
        // Fallback controlado: Preservar el OCR/reglas locales ante cualquier fallo externo
        this.logger.warn(
          `Extracción semántica externa falló (${
            geminiError instanceof Error ? geminiError.message : "error"
          }). Continuando con extracción local offline sin interrupción.`,
        );
      }
    }

    // 6. Consolidación y desduplicación de candidatos
    const candidateMap = new Map<string, OcrCandidate>();

    // A. Incorporar candidatos de OCR / TSV local
    for (const cand of localOcrCandidates) {
      candidateMap.set(cand.canonicalFieldKey, cand);
    }

    // B. Incorporar candidatos de reglas clínicas locales (deterministas)
    for (const cand of ruleCandidates) {
      const existing = candidateMap.get(cand.canonicalFieldKey);
      if (!existing || cand.confidenceScore >= existing.confidenceScore) {
        candidateMap.set(cand.canonicalFieldKey, cand);
      }
    }

    // C. Incorporar candidatos validados de Gemini si aportan mayor confianza o campos no detectados
    for (const cand of aiCandidates) {
      const existing = candidateMap.get(cand.canonicalFieldKey);
      if (!existing || cand.confidenceScore >= existing.confidenceScore) {
        candidateMap.set(cand.canonicalFieldKey, cand);
      }
    }

    const finalCandidates = Array.from(candidateMap.values());

    return {
      rawText,
      candidates: finalCandidates,
      strategyUsed,
      pagesProcessed,
    };
  }
}
