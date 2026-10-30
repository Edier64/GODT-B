import {
  Inject,
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Job, Worker } from "bullmq";
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
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class OcrWorker implements OnModuleInit, OnModuleDestroy {
  private worker?: Worker;
  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    @Inject(FILE_STORAGE_PORT) private readonly storage: FileStoragePort,
    @Inject(OCR_PROVIDER) private readonly provider: OcrProviderPort,
    @Inject(OCR_REPOSITORY) private readonly repository: OcrRepository,
  ) {}

  onModuleInit() {
    this.worker = new Worker(OCR_QUEUE_NAME, async (job) => this.process(job), {
      connection: this.connection(),
      concurrency: Number(this.config.get("OCR_CONCURRENCY", 1)),
    });
  }
  async onModuleDestroy() {
    await this.worker?.close();
  }

  private async process(job: Job<{ jobId: string }>) {
    const ocrJob = await this.repository.findJob(job.data.jobId);
    if (!ocrJob) throw new Error("OCR job not found");
    const document = await this.prisma.sourceDocument.findUnique({
      where: { id: ocrJob.sourceDocumentId },
    });
    if (!document) throw new Error("OCR source document not found");
    try {
      const candidates = await this.provider.process({
        buffer: await this.storage.get(document.objectStorageKey),
        mimeType: document.mimeType,
      });
      const allowed = new Set(
        this.config
          .get<string>("OCR_ALLOWED_FIELDS", "")
          .split(",")
          .map((key) => key.trim())
          .filter(Boolean),
      );
      const safeCandidates = candidates.filter((candidate) =>
        allowed.has(candidate.canonicalFieldKey),
      );
      if (safeCandidates.length !== candidates.length)
        throw new Error("OCR response contains an unknown canonical field");
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
  private connection() {
    const url = new URL(
      this.config.get<string>("REDIS_URL", "redis://localhost:6379"),
    );
    return {
      host: url.hostname,
      port: Number(url.port || 6379),
      password: url.password || undefined,
    };
  }
}
