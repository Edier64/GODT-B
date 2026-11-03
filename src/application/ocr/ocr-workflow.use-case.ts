import { Inject, Injectable } from "@nestjs/common";
import { OCR_REPOSITORY, OcrRepository } from "./ocr.repository";
import { OcrAccessDeniedError, OcrNotFoundError } from "./ocr-errors";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";

@Injectable()
export class OcrWorkflowUseCase {
  constructor(
    @Inject(OCR_REPOSITORY) private readonly repository: OcrRepository,
    private readonly prisma: PrismaService,
  ) {}

  async fields(jobId: string, actor: AuthenticatedUser) {
    const job = await this.repository.findJob(jobId);
    if (!job) throw new OcrNotFoundError();
    await this.assertAccess(job.sourceDocumentId, actor);
    return this.repository.listFields(jobId);
  }

  async getJob(jobId: string, actor: AuthenticatedUser) {
    const job = await this.repository.findJob(jobId);
    if (!job) throw new OcrNotFoundError();
    await this.assertAccess(job.sourceDocumentId, actor);
    const fields = await this.repository.listFields(jobId);
    return {
      jobId: job.id,
      sourceDocumentId: job.sourceDocumentId,
      status: job.status,
      errorCode: job.errorCode,
      fields,
    };
  }

  async validate(
    fieldId: string,
    input: {
      status: "CONFIRMADO" | "MODIFICADO" | "RECHAZADO";
      confirmedValue?: string;
    },
    actor: AuthenticatedUser,
  ) {
    const field = await this.prisma.ocrExtractedField.findUnique({
      where: { id: fieldId },
      include: {
        sourceDocument: {
          include: { donor: { select: { originatingIpsName: true } } },
        },
      },
    });
    if (!field) throw new OcrNotFoundError();
    this.assertInstitutionalAccess(
      field.sourceDocument.donor.originatingIpsName,
      actor,
    );
    return this.repository.validateField(fieldId, {
      ...input,
      userId: actor.userId,
    });
  }

  async propagate(donorId: string, fieldId: string, actor: AuthenticatedUser) {
    const field = await this.prisma.ocrExtractedField.findUnique({
      where: { id: fieldId },
      include: {
        sourceDocument: {
          include: { donor: { select: { originatingIpsName: true } } },
        },
      },
    });
    if (!field) throw new OcrNotFoundError();
    if (field.donorId !== donorId) throw new OcrAccessDeniedError();
    this.assertInstitutionalAccess(
      field.sourceDocument.donor.originatingIpsName,
      actor,
    );
    return this.repository.propagateField(fieldId, actor.userId);
  }

  private async assertAccess(documentId: string, actor: AuthenticatedUser) {
    const document = await this.prisma.sourceDocument.findUnique({
      where: { id: documentId },
      include: { donor: { select: { originatingIpsName: true } } },
    });
    if (!document) throw new OcrNotFoundError();
    this.assertInstitutionalAccess(document.donor.originatingIpsName, actor);
  }
  private assertInstitutionalAccess(ips: string, actor: AuthenticatedUser) {
    if (actor.role !== "ADMIN" && !actor.institutionalIps?.includes(ips))
      throw new OcrAccessDeniedError();
  }
}
