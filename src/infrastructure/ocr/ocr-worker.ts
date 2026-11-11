import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Optional,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job, Queue, Worker } from "bullmq";
import { Logger } from "@nestjs/common";
import {
  FILE_STORAGE_PORT,
  FileStoragePort,
} from "../../application/documents/file-storage.port";
import {
  OCR_PROVIDER,
  OcrProviderPort,
} from "../../application/ocr/ocr-provider.port";
import { OCR_QUEUE_NAME } from "../../application/ocr/ocr.queue";
import {
  OCR_REPOSITORY,
  OcrRepository,
} from "../../application/ocr/ocr.repository";
import { OCR_QUEUE } from "../../application/ocr/ocr.queue";
import { PrismaService } from "../prisma/prisma.service";
import { DocumentUnderstandingService } from "../../application/ocr/document-understanding.service";
import {
  areQueueWorkersEnabled,
  resolveAppMode,
} from "../runtime/app-mode";
import { createBullmqWorker } from "../runtime/bullmq-backend";

@Injectable()
export class OcrWorker implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker;
  private readonly logger = new Logger(OcrWorker.name);
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(FILE_STORAGE_PORT) private readonly storage: FileStoragePort,
    @Inject(OCR_PROVIDER) private readonly provider: OcrProviderPort,
    @Inject(OCR_REPOSITORY) private readonly repository: OcrRepository,
    @Inject(OCR_QUEUE) private readonly queue: Queue,
    @Optional() private readonly documentUnderstanding?: DocumentUnderstandingService,
  ) {}

  onModuleInit() {
    if (!areQueueWorkersEnabled(this.config)) {
      this.logger.log(
        `Consumidor OcrWorker deshabilitado en modo APP_MODE=${resolveAppMode(this.config)} (solo productor activo).`,
      );
      return;
    }

    this.worker = createBullmqWorker<{ jobId: string }>(
      OCR_QUEUE_NAME,
      async (job) => this.process(job),
      this.config,
      { concurrency: Number(this.config.get("OCR_CONCURRENCY", 1)) },
    );
    this.worker.on("error", (err) => {
      this.logger.error(`Error en worker OCR: ${err?.message ?? "error"}`);
    });
    this.worker.on("failed", (job, err) => {
      this.logger.error(
        `Job OCR ${job?.id ?? "desconocido"} falló: ${err?.message ?? "error"}`,
      );
    });
    void this.requeuePersistedJobs().catch((error: unknown) => {
      this.logger.error(
        `Unable to requeue persisted OCR jobs: ${
          error instanceof Error ? error.message : "unknown error"
        }`,
      );
    });
  }
  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async requeuePersistedJobs() {
    const jobs = await this.repository.listQueuedJobs();
    await Promise.all(
      jobs.map((job) =>
        this.queue.add(
          "process-document",
          { jobId: job.id },
          {
            jobId: job.id,
            attempts: 3,
            backoff: { type: "exponential", delay: 1000 },
          },
        ),
      ),
    );
  }

  private async process(job: Job<{ jobId: string }>) {
    const ocrJob = await this.repository.findJob(job.data.jobId);
    if (!ocrJob) throw new Error("OCR job not found");
    const document = await this.prisma.sourceDocument.findUnique({
      where: { id: ocrJob.sourceDocumentId },
    });
    if (!document) throw new Error("OCR source document not found");
    try {
      const buffer = await this.storage.get(document.objectStorageKey);
      let candidates = [];

      if (this.documentUnderstanding) {
        const result = await this.documentUnderstanding.analyze({
          buffer,
          mimeType: document.mimeType,
          sourceDocumentId: document.id,
          processId: document.processId || undefined,
        });
        candidates = result.candidates;
      } else {
        candidates = await this.provider.process({
          buffer,
          mimeType: document.mimeType,
        });
      }

      const rawAllowed = this.config.get<string>("OCR_ALLOWED_FIELDS", "");
      let safeCandidates = candidates;
      if (rawAllowed && rawAllowed.trim()) {
        const allowed = new Set(
          rawAllowed
            .split(",")
            .map((key) => key.trim())
            .filter(Boolean),
        );
        safeCandidates = candidates.filter((candidate) =>
          allowed.has(candidate.canonicalFieldKey),
        );
      }

      await this.repository.saveCandidates(
        ocrJob.id,
        document.id,
        document.donorId,
        safeCandidates,
      );
      await this.repository.completeJob(ocrJob.id);
    } catch (error) {
      if (job.attemptsMade + 1 >= (job.opts.attempts ?? 1))
        await this.repository.failJob(
          ocrJob.id,
          error instanceof Error ? error.name : "OCR_PROCESSING_FAILED",
        );
      throw error;
    }
  }
}
