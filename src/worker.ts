import { Inject, Logger, Module, OnModuleDestroy } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { Queue } from "bullmq";
import { AUDIT_EVENT_PORT } from "./application/audit/audit-event.port";
import { BuildIntegrityManifestService } from "./application/dossier/build-integrity-manifest.service";
import { ConsolidatePdfService } from "./application/dossier/consolidate-pdf.service";
import { GenerateDossierIndexService } from "./application/dossier/generate-dossier-index.service";
import { PackageZipService } from "./application/dossier/package-zip.service";
import { ProcessDossierExportService } from "./application/dossier/process-dossier-export.service";
import { DocumentUnderstandingService } from "./application/ocr/document-understanding.service";
import { LocalRulesExtractionProvider } from "./application/ocr/local-rules-extraction.provider";
import { OCR_PROVIDER } from "./application/ocr/ocr-provider.port";
import { OCR_QUEUE, OCR_QUEUE_NAME } from "./application/ocr/ocr.queue";
import { OCR_REPOSITORY } from "./application/ocr/ocr.repository";
import { PDF_RASTERIZER } from "./application/ocr/pdf-rasterizer.port";
import { PrismaAuditEventAdapter } from "./infrastructure/audit/prisma-audit-event.adapter";
import { StorageModule } from "./infrastructure/documents/storage.module";
import { BullmqDossierQueueService } from "./infrastructure/dossier/bullmq-dossier-queue.service";
import { GeminiOcrAdapter } from "./infrastructure/ocr/gemini-ocr.adapter";
import { LocalPdfRasterizerAdapter } from "./infrastructure/ocr/local-pdf-rasterizer.adapter";
import { OcrWorker } from "./infrastructure/ocr/ocr-worker";
import { PrismaOcrRepository } from "./infrastructure/ocr/prisma-ocr.repository";
import { TesseractOcrAdapter } from "./infrastructure/ocr/tesseract-ocr.adapter";
import { PrismaModule } from "./infrastructure/prisma/prisma.module";
import {
  createBullmqQueue,
  resolveBullmqBackend,
} from "./infrastructure/runtime/bullmq-backend";

/**
 * WorkerAppModule — contexto NestJS sin servidor HTTP ni controladores.
 *
 * Registra exclusivamente los consumidores BullMQ y sus dependencias de dominio:
 *   - OcrWorker                  (cola OCR)
 *   - BullmqDossierQueueService  (cola dossier-exports)
 *   - PrismaModule / StorageModule
 *
 * No importa AuthModule, SwaggerModule ni controladores HTTP.
 */
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    StorageModule,
  ],
  providers: [
    // OCR Worker & dependencias
    PrismaOcrRepository,
    GeminiOcrAdapter,
    TesseractOcrAdapter,
    LocalPdfRasterizerAdapter,
    LocalRulesExtractionProvider,
    DocumentUnderstandingService,
    OcrWorker,
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

    // Dossier Worker & dependencias
    GenerateDossierIndexService,
    ConsolidatePdfService,
    BuildIntegrityManifestService,
    PackageZipService,
    ProcessDossierExportService,
    BullmqDossierQueueService,
    PrismaAuditEventAdapter,
    { provide: AUDIT_EVENT_PORT, useExisting: PrismaAuditEventAdapter },
  ],
})
class WorkerAppModule implements OnModuleDestroy {
  constructor(@Inject(OCR_QUEUE) private readonly ocrQueue: Queue) {}

  async onModuleDestroy(): Promise<void> {
    await this.ocrQueue.close().catch(() => undefined);
  }
}

async function bootstrap(): Promise<void> {
  const logger = new Logger("WorkerBootstrap");

  const requestedMode = (process.env.APP_MODE || "worker").trim().toLowerCase();
  if (requestedMode === "api" || requestedMode === "migrate") {
    logger.error(
      `[CRITICAL] worker.ts no puede ejecutarse con APP_MODE=${requestedMode}. Use APP_MODE=worker.`,
    );
    process.exit(1);
  }
  process.env.APP_MODE = "worker";

  if (!process.env.DATABASE_URL) {
    logger.error("[CRITICAL] DATABASE_URL no está configurada.");
    process.exit(1);
  }

  const isProduction =
    (process.env.NODE_ENV || "").trim().toLowerCase() === "production" ||
    (process.env.NODE_ENV || "").trim().toLowerCase() === "staging";

  const bullmqBackend = resolveBullmqBackend();
  if (isProduction && bullmqBackend === "redis" && !process.env.REDIS_URL) {
    logger.error("[CRITICAL] REDIS_URL es obligatoria para godt-worker cuando BULLMQ_BACKEND=redis.");
    process.exit(1);
  }

  const app = await NestFactory.createApplicationContext(WorkerAppModule, {
    logger: isProduction
      ? ["log", "warn", "error"]
      : ["log", "warn", "error", "debug", "verbose"],
  });

  app.enableShutdownHooks();

  logger.log(
    `Worker GODT inicializado sin servidor HTTP (entorno: ${process.env.NODE_ENV || "development"}, backend BullMQ: ${bullmqBackend}).`,
  );

  // Mantener vivo el event loop mientras los workers esperan jobs
  const keepAlive = setInterval(() => undefined, 60_000);
  let shuttingDown = false;

  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    clearInterval(keepAlive);
    logger.log(`Señal ${signal} recibida. Cerrando workers BullMQ y conexión Prisma...`);
    try {
      await app.close();
      logger.log("Cierre ordenado completado.");
      process.exit(0);
    } catch (error) {
      logger.error(
        `Error durante cierre ordenado del worker: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));
}

void bootstrap();
