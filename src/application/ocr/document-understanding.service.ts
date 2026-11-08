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
  primaryEngineUsed: "GEMINI_AI" | "LOCAL_FALLBACK";
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
    let aiCandidates: OcrCandidate[] = [];
    let fallbackCandidates: OcrCandidate[] = [];
    let aiFailed = false;
    let aiFailureReason = "";

    const isImage =
      mimeType.startsWith("image/") ||
      mimeType === "image/jpeg" ||
      mimeType === "image/png" ||
      mimeType === "image/webp" ||
      mimeType === "image/tiff" ||
      mimeType === "image/bmp" ||
      mimeType === "image/x-ms-bmp";

    // =========================================================================
    // 1. DOCX: Extracción estructurada nativa de párrafos y tablas
    // =========================================================================
    if (
      mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimeType === "application/msword" ||
      (!isImage && buffer.length >= 4 && buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])))
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

    // =========================================================================
    // 2. PDF: Evaluar capa de texto digital vs escaneado
    // =========================================================================
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
          `PDF sin capa digital suficiente (${pagesProcessed} páginas). Procesando como documento escaneado mediante IA multimodal.`,
        );
      }
    }

    // =========================================================================
    // 3. Imágenes directas (JPG, PNG, WEBP, TIFF, BMP)
    // =========================================================================
    if (isImage) {
      strategyUsed = "IMAGE_OCR";
    }

    // =========================================================================
    // 4. MECANISMO PRINCIPAL: IA MULTIMODAL (Google Gemini)
    // =========================================================================
    if (this.geminiAdapter && this.geminiAdapter.isEnabled()) {
      try {
        this.logger.log(
          `Invocando extracción principal mediante IA multimodal (Gemini) para documento ${strategyUsed}...`,
        );
        aiCandidates = await this.geminiAdapter.process({
          buffer,
          mimeType,
          rawText: rawText || undefined,
        });

        this.logger.log(
          `Extracción con IA multimodal (Gemini) completada como mecanismo principal con ${aiCandidates.length} candidatos generados.`,
        );
      } catch (geminiError) {
        aiFailed = true;
        aiFailureReason = geminiError instanceof Error ? geminiError.message : "Error desconocido";
        this.logger.warn(
          `Extracción con IA multimodal no disponible (${aiFailureReason}). Aplicando mecanismo de respaldo secundario (Tesseract/Reglas locales).`,
        );
      }
    } else {
      aiFailed = true;
      aiFailureReason = "Proveedor de IA multimodal deshabilitado o no configurado";
      this.logger.log(
        `IA multimodal no activa (${aiFailureReason}). Utilizando mecanismo de procesamiento local.`,
      );
    }

    // =========================================================================
    // 5. MECANISMO SECUNDARIO DE RESPALDO (Fallback si IA falló o campos faltantes)
    // =========================================================================
    if (aiCandidates.length === 0 || aiFailed) {
      // 5.1 Si contamos con texto extraído (PDF digital o DOCX), usar reglas clínicas locales
      if (rawText && rawText.trim().length > 0) {
        const localRuleCandidates = this.localRules.extract(rawText, {
          pageNumber: 1,
          templateCode: input.templateCode,
        });
        for (const cand of localRuleCandidates) {
          fallbackCandidates.push({
            ...cand,
            boundingBox: {
              ...(cand.boundingBox || {}),
              engine: "LOCAL_RULES_FALLBACK",
              provider: "local_rules",
              isFallback: true,
              fallbackReason: aiFailureReason,
            },
          });
        }
      }

      // 5.2 Para imágenes o PDFs escaneados donde no hay texto digital, invocar OCR local secundario si existe
      if (isImage || strategyUsed === "PDF_SCANNED") {
        if (this.fallbackOcrProvider) {
          try {
            const ocrRes = await this.fallbackOcrProvider.process({ buffer, mimeType });
            for (const cand of ocrRes) {
              fallbackCandidates.push({
                ...cand,
                boundingBox: {
                  ...(cand.boundingBox || {}),
                  engine: "LOCAL_OCR_FALLBACK",
                  provider: this.fallbackOcrProvider.name,
                  isFallback: true,
                  fallbackReason: aiFailureReason,
                },
              });
            }
          } catch (ocrErr) {
            this.logger.warn(
              `Fallback OCR local también no disponible: ${ocrErr instanceof Error ? ocrErr.message : "Error"}`,
            );
          }
        }
      }
    }

    // =========================================================================
    // 6. Consolidación de candidatos: IA tiene precedencia como mecanismo principal
    // =========================================================================
    const candidateMap = new Map<string, OcrCandidate>();

    // Primero incorporar los del mecanismo de respaldo
    for (const cand of fallbackCandidates) {
      candidateMap.set(cand.canonicalFieldKey, cand);
    }

    // La IA sobrescribe / complementa por ser el mecanismo principal
    for (const cand of aiCandidates) {
      candidateMap.set(cand.canonicalFieldKey, cand);
    }

    const finalCandidates = Array.from(candidateMap.values());
    const primaryEngineUsed: DocumentUnderstandingOutput["primaryEngineUsed"] =
      aiCandidates.length > 0 ? "GEMINI_AI" : "LOCAL_FALLBACK";

    return {
      rawText,
      candidates: finalCandidates,
      strategyUsed,
      pagesProcessed,
      primaryEngineUsed,
    };
  }
}
