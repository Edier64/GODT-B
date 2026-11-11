import { Inject, Module, OnModuleDestroy } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module";
import { DocumentsModule } from "../documents/documents.module";
import { CanonicalDictionaryModule } from "../canonical/canonical-dictionary.module";
import { OCR_PROVIDER } from "../../application/ocr/ocr-provider.port";
import { PDF_RASTERIZER } from "../../application/ocr/pdf-rasterizer.port";
import { OCR_QUEUE, OCR_QUEUE_NAME } from "../../application/ocr/ocr.queue";
import { OCR_REPOSITORY } from "../../application/ocr/ocr.repository";
import { PrismaOcrRepository } from "../../infrastructure/ocr/prisma-ocr.repository";
import { GeminiOcrAdapter } from "../../infrastructure/ocr/gemini-ocr.adapter";
import { TesseractOcrAdapter } from "../../infrastructure/ocr/tesseract-ocr.adapter";
import { LocalPdfRasterizerAdapter } from "../../infrastructure/ocr/local-pdf-rasterizer.adapter";
import { OcrWorker } from "../../infrastructure/ocr/ocr-worker";
import { StartOcrUseCase } from "../../application/ocr/start-ocr.use-case";
import { OcrWorkflowUseCase } from "../../application/ocr/ocr-workflow.use-case";
import { OcrController } from "./ocr.controller";
import { LocalRulesExtractionProvider } from "../../application/ocr/local-rules-extraction.provider";
import { DocumentUnderstandingService } from "../../application/ocr/document-understanding.service";
import { createBullmqQueue } from "../../infrastructure/runtime/bullmq-backend";

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    PrismaModule,
    DocumentsModule,
    CanonicalDictionaryModule,
  ],
  controllers: [OcrController],
  providers: [
    PrismaOcrRepository,
    GeminiOcrAdapter,
    TesseractOcrAdapter,
    LocalPdfRasterizerAdapter,
    LocalRulesExtractionProvider,
    DocumentUnderstandingService,
    OcrWorker,
    StartOcrUseCase,
    OcrWorkflowUseCase,
    { provide: OCR_REPOSITORY, useExisting: PrismaOcrRepository },
    { provide: PDF_RASTERIZER, useExisting: LocalPdfRasterizerAdapter },
    {
      provide: OCR_PROVIDER,
      inject: [ConfigService, GeminiOcrAdapter, TesseractOcrAdapter],
      useFactory: (
        config: ConfigService,
        gemini: GeminiOcrAdapter,
        tesseract: TesseractOcrAdapter,
      ) =>
        config.get("OCR_PROVIDER", "tesseract") === "gemini"
          ? gemini
          : tesseract,
    },
    {
      provide: OCR_QUEUE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const queue = createBullmqQueue(OCR_QUEUE_NAME, config);
        queue.on("error", () => undefined);
        return queue;
      },
    },
  ],
  exports: [
    OCR_PROVIDER,
    OCR_REPOSITORY,
    StartOcrUseCase,
    OcrWorkflowUseCase,
    GeminiOcrAdapter,
    DocumentUnderstandingService,
    LocalRulesExtractionProvider,
  ],
})
export class OcrModule implements OnModuleDestroy {
  constructor(@Inject(OCR_QUEUE) private readonly ocrQueue: Queue) {}

  async onModuleDestroy(): Promise<void> {
    await this.ocrQueue.close().catch(() => undefined);
  }
}
