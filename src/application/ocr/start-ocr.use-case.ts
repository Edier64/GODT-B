import { Inject, Injectable } from "@nestjs/common";
import { OcrProcessingJob } from "@prisma/client";
import { Queue } from "bullmq";
import { OCR_REPOSITORY, OcrRepository } from "./ocr.repository";
import { OCR_QUEUE } from "./ocr.queue";
import { OcrAccessDeniedError } from "./ocr-errors";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { OcrProviderPort, OCR_PROVIDER } from "./ocr-provider.port";

@Injectable()
export class StartOcrUseCase {
  constructor(
    @Inject(OCR_REPOSITORY) private readonly repository: OcrRepository,
    @Inject(OCR_PROVIDER) private readonly provider: OcrProviderPort,
    @Inject(OCR_QUEUE) private readonly queue: Queue,
    private readonly prisma: PrismaService,
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
    if (queued) return queued;
    const job = await this.repository.createJob({
      sourceDocumentId: document.id,
      requestedById: actor.userId,
      providerName: this.provider.name,
      correlationId: `${document.id}:${Date.now()}`,
    });
    await this.queue.add(
      "process-document",
      { jobId: job.id },
      {
        jobId: job.id,
        attempts: 3,
        backoff: { type: "exponential", delay: 1000 },
      },
    );
    return job;
  }
}
