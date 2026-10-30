import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { Queue } from "bullmq";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module";
import { DocumentsModule } from "../documents/documents.module";
import { OCR_PROVIDER } from "../../application/ocr/ocr-provider.port";
import { OCR_QUEUE, OCR_QUEUE_NAME } from "../../application/ocr/ocr.queue";
import { OCR_REPOSITORY } from "../../application/ocr/ocr.repository";
import { PrismaOcrRepository } from "../../infrastructure/ocr/prisma-ocr.repository";
import { GeminiOcrAdapter } from "../../infrastructure/ocr/gemini-ocr.adapter";
import { TesseractOcrAdapter } from "../../infrastructure/ocr/tesseract-ocr.adapter";
import { OcrWorker } from "../../infrastructure/ocr/ocr-worker";
import { StartOcrUseCase } from "../../application/ocr/start-ocr.use-case";
import { OcrWorkflowUseCase } from "../../application/ocr/ocr-workflow.use-case";
import { OcrController } from "./ocr.controller";

@Module({
  imports: [ConfigModule, AuthModule, PrismaModule, DocumentsModule],
  controllers: [OcrController],
  providers: [
    PrismaOcrRepository,
    GeminiOcrAdapter,
    TesseractOcrAdapter,
    OcrWorker,
    StartOcrUseCase,
    OcrWorkflowUseCase,
    { provide: OCR_REPOSITORY, useExisting: PrismaOcrRepository },
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
        const url = new URL(config.get("REDIS_URL", "redis://localhost:6379"));
        return new Queue(OCR_QUEUE_NAME, {
          connection: {
            host: url.hostname,
            port: Number(url.port || 6379),
            password: url.password || undefined,
          },
        });
      },
    },
  ],
  exports: [OCR_PROVIDER],
})
export class OcrModule {}
