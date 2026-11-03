import { Injectable } from "@nestjs/common";
import { OcrExtractedField, Prisma } from "@prisma/client";
import { OcrCandidate } from "../../application/ocr/ocr-provider.port";
import { OcrRepository } from "../../application/ocr/ocr.repository";
import {
  OcrConcurrencyError,
  OcrValidationError,
} from "../../application/ocr/ocr-errors";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PrismaOcrRepository implements OcrRepository {
  constructor(private readonly prisma: PrismaService) {}

  createJob(input: Parameters<OcrRepository["createJob"]>[0]) {
    return this.prisma.ocrProcessingJob.create({
      data: { ...input, status: "EN_COLA" },
    });
  }
  findJob(id: string) {
    return this.prisma.ocrProcessingJob.findUnique({ where: { id } });
  }
  findQueuedJob(sourceDocumentId: string) {
    return this.prisma.ocrProcessingJob.findFirst({
      where: { sourceDocumentId, status: "EN_COLA" },
      orderBy: { createdAt: "desc" },
    });
  }
  listQueuedJobs() {
    return this.prisma.ocrProcessingJob.findMany({
      where: { status: "EN_COLA" },
      orderBy: { createdAt: "asc" },
    });
  }
  listFields(jobId: string) {
    return this.prisma.ocrExtractedField.findMany({
      where: { ocrJobId: jobId },
      orderBy: { id: "asc" },
    });
  }
  async saveCandidates(
    jobId: string,
    sourceDocumentId: string,
    donorId: string,
    candidates: OcrCandidate[],
  ) {
    await this.prisma.ocrExtractedField.createMany({
      data: candidates.map((candidate) => ({
        ocrJobId: jobId,
        sourceDocumentId,
        donorId,
        canonicalFieldKey: candidate.canonicalFieldKey,
        candidateValue: candidate.candidateValue,
        confidenceScore: candidate.confidenceScore,
        boundingBox: candidate.boundingBox as Prisma.InputJsonValue | undefined,
        validationStatus: "PENDIENTE",
      })),
    });
  }
  async completeJob(id: string) {
    await this.prisma.ocrProcessingJob.update({
      where: { id },
      data: { status: "COMPLETADO" },
    });
  }
  async failJob(id: string, errorCode: string) {
    await this.prisma.ocrProcessingJob.update({
      where: { id },
      data: { status: "FALLIDO", errorCode },
    });
  }
  async validateField(
    id: string,
    input: Parameters<OcrRepository["validateField"]>[1],
  ) {
    if (input.status === "MODIFICADO" && !input.confirmedValue?.trim())
      throw new OcrValidationError("Modified fields require a confirmed value");
    if (input.status === "CONFIRMADO" && input.confirmedValue !== undefined)
      throw new OcrValidationError(
        "Confirmed fields cannot replace the OCR value",
      );
    return this.prisma.$transaction(async (transaction) => {
      const current = await transaction.ocrExtractedField.findUnique({
        where: { id },
        select: { candidateValue: true },
      });
      if (!current) throw new OcrValidationError("OCR field not found");
      const updated = await transaction.ocrExtractedField.updateMany({
        where: { id, validationStatus: "PENDIENTE" },
        data: {
          validationStatus: input.status,
          confirmedValue:
            input.status === "CONFIRMADO"
              ? current.candidateValue
              : input.status === "MODIFICADO"
                ? input.confirmedValue
                : null,
          validatedById: input.userId,
          validatedAt: new Date(),
        },
      });
      if (updated.count !== 1)
        throw new OcrConcurrencyError(
          "OCR field was already validated by another request",
        );
      const field = await transaction.ocrExtractedField.findUniqueOrThrow({
        where: { id },
      });
      await transaction.auditEvent.create({
        data: {
          actorUserId: input.userId,
          action: `OCR_FIELD_${input.status}`,
          entityType: "OCR_EXTRACTED_FIELD",
          entityId: id,
          correlationId: field.ocrJobId,
          metadata: { sourceDocumentId: field.sourceDocumentId },
        },
      });
      return field;
    });
  }
  async propagateField(id: string, userId: string): Promise<OcrExtractedField> {
    return this.prisma.$transaction(async (transaction) => {
      const field = await transaction.ocrExtractedField.findUnique({
        where: { id },
      });
      if (!field) throw new OcrValidationError("OCR field not found");
      if (
        field.validationStatus !== "CONFIRMADO" &&
        field.validationStatus !== "MODIFICADO"
      )
        throw new OcrValidationError(
          "Only confirmed or modified fields can be propagated",
        );
      if (field.validatedById !== userId)
        throw new OcrValidationError(
          "Only the validating user can propagate this field",
        );
      const donor = await transaction.donorRecord.findUnique({
        where: { id: field.donorId },
        select: { clinicalData: true },
      });
      const clinicalData =
        donor?.clinicalData &&
        typeof donor.clinicalData === "object" &&
        !Array.isArray(donor.clinicalData)
          ? (donor.clinicalData as Record<string, unknown>)
          : {};
      if (clinicalData[field.canonicalFieldKey] !== undefined)
        throw new OcrValidationError("Clinical field already has a value");
      const value =
        field.validationStatus === "MODIFICADO"
          ? field.confirmedValue
          : field.candidateValue;
      if (value === null || value === undefined)
        throw new OcrValidationError("Validated value is missing");
      await transaction.donorRecord.update({
        where: { id: field.donorId },
        data: {
          clinicalData: {
            ...clinicalData,
            [field.canonicalFieldKey]: value,
          } as Prisma.InputJsonValue,
        },
      });
      await transaction.auditEvent.create({
        data: {
          actorUserId: userId,
          action: "OCR_FIELD_PROPAGATED",
          entityType: "DONOR_RECORD",
          entityId: field.donorId,
          correlationId: field.ocrJobId,
          metadata: {
            fieldId: field.id,
            sourceDocumentId: field.sourceDocumentId,
            canonicalFieldKey: field.canonicalFieldKey,
          },
        },
      });
      return field;
    });
  }
}
