import { Inject, Injectable, Optional } from "@nestjs/common";
import { OCR_REPOSITORY, OcrRepository } from "./ocr.repository";
import { OcrAccessDeniedError, OcrNotFoundError } from "./ocr-errors";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { CanonicalPropagationEngine } from "../canonical/canonical-propagation.engine";

@Injectable()
export class OcrWorkflowUseCase {
  constructor(
    @Inject(OCR_REPOSITORY) private readonly repository: OcrRepository,
    private readonly prisma: PrismaService,
    @Optional() private readonly propagationEngine?: CanonicalPropagationEngine,
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
          include: {
            donor: { select: { originatingIpsName: true } },
            process: true,
          },
        },
      },
    });
    if (!field) throw new OcrNotFoundError();
    if (field.donorId !== donorId) throw new OcrAccessDeniedError();
    this.assertInstitutionalAccess(
      field.sourceDocument.donor.originatingIpsName,
      actor,
    );

    if (
      typeof this.repository.validateField === "function" &&
      (field.validationStatus === "PENDIENTE" ||
        (field.validatedById && field.validatedById !== actor.userId))
    ) {
      await this.repository.validateField(fieldId, {
        status: "CONFIRMADO",
        userId: actor.userId,
      });
      const refreshed = await this.prisma.ocrExtractedField.findUnique({
        where: { id: fieldId },
      });
      if (refreshed) {
        field.validationStatus = refreshed.validationStatus;
        field.confirmedValue = refreshed.confirmedValue;
        field.validatedById = refreshed.validatedById;
      }
    }

    // 1. Actualizar repositorio OCR y registro de donante
    const result = await this.repository.propagateField(fieldId, actor.userId);

    // 2. Propagar al motor canónico si hay un proceso asociado
    const processId =
      field.sourceDocument.processId ||
      (
        await this.prisma.donationProcess.findFirst({
          where: { donorId: field.donorId },
          select: { id: true },
        })
      )?.id;

    if (processId && this.propagationEngine) {
      let val: any =
        field.validationStatus === "MODIFICADO"
          ? field.confirmedValue
          : field.candidateValue;

      const numericFields = new Set([
        "donor.demographics.age",
        "donor.clinical.creatinine",
        "donor.clinical.arterial_ph",
      ]);
      if (numericFields.has(field.canonicalFieldKey) && typeof val === "string") {
        const parsed = Number(val.replace(",", "."));
        if (!isNaN(parsed)) {
          val = parsed;
        }
      }

      try {
        await this.propagationEngine.applyAndPropagate({
          processId,
          canonicalFieldKey: field.canonicalFieldKey,
          value: val,
          sourceKind:
            field.validationStatus === "MODIFICADO"
              ? "OCR_MODIFIED"
              : "OCR_CONFIRMED",
          actorUserId: actor.userId,
        });
      } catch {
        // Preservar la propagación de donante si la regla de proceso lanza conflicto
      }
    }

    return result;
  }

  async propagateToProcess(
    processId: string,
    fieldId: string,
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
    return this.propagate(field.donorId, fieldId, actor);
  }

  async batchPropagateToProcess(
    processId: string,
    items: Array<{
      fieldId: string;
      status: "CONFIRMADO" | "MODIFICADO" | "RECHAZADO";
      confirmedValue?: string;
    }>,
    actor: AuthenticatedUser,
  ) {
    const results = [];
    for (const item of items) {
      if (item.status === "RECHAZADO") {
        const validated = await this.validate(
          item.fieldId,
          { status: "RECHAZADO" },
          actor,
        );
        results.push({
          fieldId: item.fieldId,
          status: "RECHAZADO",
          result: validated,
        });
        continue;
      }

      if (item.status === "MODIFICADO") {
        await this.validate(
          item.fieldId,
          { status: "MODIFICADO", confirmedValue: item.confirmedValue },
          actor,
        );
      } else {
        await this.validate(item.fieldId, { status: "CONFIRMADO" }, actor);
      }

      const propagated = await this.propagateToProcess(
        processId,
        item.fieldId,
        actor,
      );
      results.push({
        fieldId: item.fieldId,
        status: item.status,
        result: propagated,
      });
    }
    return results;
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
