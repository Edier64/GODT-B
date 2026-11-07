import { Inject, Injectable, Logger, Optional } from "@nestjs/common";
import { OcrProcessingJob } from "@prisma/client";
import { Queue } from "bullmq";
import { OCR_REPOSITORY, OcrRepository } from "./ocr.repository";
import { OCR_QUEUE } from "./ocr.queue";
import { OcrAccessDeniedError } from "./ocr-errors";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { OcrProviderPort, OCR_PROVIDER } from "./ocr-provider.port";
import { DocumentUnderstandingService } from "./document-understanding.service";
import {
  FILE_STORAGE_PORT,
  FileStoragePort,
} from "../documents/file-storage.port";

@Injectable()
export class StartOcrUseCase {
  private readonly logger = new Logger(StartOcrUseCase.name);

  constructor(
    @Inject(OCR_REPOSITORY) private readonly repository: OcrRepository,
    @Inject(OCR_PROVIDER) private readonly provider: OcrProviderPort,
    @Inject(OCR_QUEUE) private readonly queue: Queue,
    private readonly prisma: PrismaService,
    @Optional() private readonly documentUnderstanding?: DocumentUnderstandingService,
    @Optional() @Inject(FILE_STORAGE_PORT) private readonly storage?: FileStoragePort,
  ) {}

  async execute(
    documentId: string,
    actor: AuthenticatedUser,
  ): Promise<OcrProcessingJob> {
    const document = await this.prisma.sourceDocument.findUnique({
      where: { id: documentId },
      include: { donor: { select: { originatingIpsName: true } } },
    });
    if (!document) throw new Error("Document not found");
    if (
      actor.role !== "ADMIN" &&
      !actor.institutionalIps?.includes(document.donor.originatingIpsName)
    ) {
      throw new OcrAccessDeniedError();
    }
    const queued = await this.repository.findQueuedJob(document.id);
    if (queued && queued.status === "EN_COLA") return queued;

    const job = await this.repository.createJob({
      sourceDocumentId: document.id,
      requestedById: actor.userId,
      providerName: this.provider.name,
      correlationId: `${document.id}:${Date.now()}`,
    });

    try {
      await this.queue.add(
        "process-document",
        { jobId: job.id },
        {
          jobId: job.id,
          attempts: 3,
          backoff: { type: "exponential", delay: 1000 },
        },
      );
    } catch (queueErr) {
      // En modo desarrollo o si Redis no está activo, procesar directamente en memoria
      this.logger.warn(
        `Cola BullMQ no disponible (${
          queueErr instanceof Error ? queueErr.message : "error"
        }). Procesando extracción directamente.`,
      );
      if (this.documentUnderstanding && this.storage) {
        await this.processDirectly(
          job.id,
          document.id,
          document.donorId,
          document.objectStorageKey,
          document.mimeType,
          document.processId || undefined,
        );
      }
    }

    return job;
  }

  private async processDirectly(
    jobId: string,
    docId: string,
    donorId: string,
    storageKey: string,
    mimeType: string,
    processId?: string,
  ): Promise<void> {
    try {
      const buffer = await this.storage!.get(storageKey);
      const result = await this.documentUnderstanding!.analyze({
        buffer,
        mimeType,
        sourceDocumentId: docId,
        processId,
      });

      await this.repository.saveCandidates(
        jobId,
        docId,
        donorId,
        result.candidates,
      );
      await this.repository.completeJob(jobId);
    } catch (err) {
      this.logger.error(
        `Error al procesar extracción directa: ${
          err instanceof Error ? err.message : err
        }`,
      );
      await this.repository.failJob(
        jobId,
        err instanceof Error ? err.name : "OCR_PROCESSING_FAILED",
      );
    }
  }
}
