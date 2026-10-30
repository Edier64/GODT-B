import { Injectable } from "@nestjs/common";
import { Prisma, OcrValidationStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  DocumentEngineAccessDeniedError,
  DocumentEngineNotFoundError,
  DocumentEngineValidationError,
} from "../../application/document-engine/document-engine.errors";
import { DocumentEngineRepository } from "../../application/document-engine/document-engine.repository";

const SAFE_SOURCE_KINDS = new Set([
  "MANUAL",
  "DONOR_RECORD",
  "SOURCE_DOCUMENT",
  "OCR_CONFIRMED",
  "OCR_MODIFIED",
  "CALCULATED",
]);

@Injectable()
export class PrismaDocumentEngineRepository implements DocumentEngineRepository {
  constructor(private readonly prisma: PrismaService) {}

  listTemplates() {
    return this.prisma.documentTemplate.findMany({
      include: { versions: { orderBy: { createdAt: "desc" } } },
      orderBy: { createdAt: "desc" },
    });
  }

  async createTemplate(
    input: Parameters<DocumentEngineRepository["createTemplate"]>[0],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const template = await tx.documentTemplate.create({
        data: {
          templateCode: input.templateCode,
          name: input.name,
          category: input.category,
          metadata: input.metadata,
        },
      });
      await this.audit(
        tx,
        input.actorUserId,
        "DOCUMENT_TEMPLATE_CREATED",
        template.id,
        input.correlationId,
      );
      return template;
    });
  }

  async updateTemplate(
    id: string,
    input: Parameters<DocumentEngineRepository["updateTemplate"]>[1],
    actorUserId: string,
    correlationId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.documentTemplate.findUnique({ where: { id } });
      if (!current) throw new DocumentEngineNotFoundError("Template not found");
      const template = await tx.documentTemplate.update({
        where: { id },
        data: input,
      });
      await this.audit(
        tx,
        actorUserId,
        "DOCUMENT_TEMPLATE_UPDATED",
        id,
        correlationId,
      );
      return template;
    });
  }

  async createVersion(
    input: Parameters<DocumentEngineRepository["createVersion"]>[0],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const template = await tx.documentTemplate.findUnique({
        where: { id: input.templateId },
      });
      if (!template)
        throw new DocumentEngineNotFoundError("Template not found");
      const version = await tx.templateVersion.create({
        data: {
          templateId: input.templateId,
          versionNumber: input.versionNumber,
          effectiveFrom: input.effectiveFrom,
          status: "DRAFT",
          jsonSchema: input.jsonSchema,
          uiSchema: input.uiSchema,
          mappingConfig: input.mappingConfig,
          dependencyConfig: input.dependencyConfig,
          generationConfig: input.generationConfig,
          definitionHash: input.definitionHash,
          authorizedById: input.actorUserId,
          createdById: input.actorUserId,
        },
      });
      await this.audit(
        tx,
        input.actorUserId,
        "TEMPLATE_VERSION_CREATED",
        version.id,
        input.correlationId,
      );
      return version;
    });
  }

  listVersions(templateId: string) {
    return this.prisma.templateVersion.findMany({
      where: { templateId },
      orderBy: { createdAt: "desc" },
    });
  }

  findVersion(id: string) {
    return this.prisma.templateVersion.findUnique({ where: { id } });
  }

  async validateVersion(
    id: string,
    actorUserId: string,
    correlationId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const version = await tx.templateVersion.findUnique({ where: { id } });
      if (!version) throw new DocumentEngineNotFoundError("Version not found");
      if (version.status === "PUBLISHED") return version;
      if (version.status !== "DRAFT") {
        throw new DocumentEngineValidationError(
          "Only draft versions can be validated",
        );
      }
      const result = await tx.templateVersion.update({
        where: { id },
        data: { status: "VALIDATED" },
      });
      await this.audit(
        tx,
        actorUserId,
        "TEMPLATE_VERSION_VALIDATED",
        id,
        correlationId,
      );
      return result;
    });
  }

  async publishVersion(id: string, actorUserId: string, correlationId: string) {
    return this.prisma.$transaction(async (tx) => {
      const version = await tx.templateVersion.findUnique({ where: { id } });
      if (!version) throw new DocumentEngineNotFoundError("Version not found");
      if (version.status === "PUBLISHED") return version;
      if (version.status !== "VALIDATED") {
        throw new DocumentEngineValidationError(
          "Version must be validated before publication",
        );
      }
      const result = await tx.templateVersion.update({
        where: { id },
        data: {
          status: "PUBLISHED",
          publishedAt: new Date(),
          authorizedById: actorUserId,
        },
      });
      await this.audit(
        tx,
        actorUserId,
        "TEMPLATE_VERSION_PUBLISHED",
        id,
        correlationId,
      );
      return result;
    });
  }

  async createInstance(
    input: Parameters<DocumentEngineRepository["createInstance"]>[0],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const donor = await tx.donorRecord.findUnique({
        where: { id: input.donorId },
        select: { originatingIpsName: true },
      });
      this.assertScope(donor?.originatingIpsName, input.institutionalIps);
      const version = await tx.templateVersion.findUnique({
        where: { id: input.templateVersionId },
        include: { template: true },
      });
      if (!version) throw new DocumentEngineNotFoundError("Version not found");
      if (version.status !== "PUBLISHED") {
        throw new DocumentEngineValidationError(
          "Only published versions can create normal instances",
        );
      }
      await this.validateProvenance(tx, input.donorId, input.sourceProvenance);
      const instance = await tx.documentInstance.create({
        data: {
          donorId: input.donorId,
          templateId: version.templateId,
          templateVersionId: version.id,
          documentCode: version.template.templateCode,
          status: "DRAFT",
          createdById: input.actorUserId,
          updatedById: input.actorUserId,
        },
      });
      const revision = await tx.documentResponseRevision.create({
        data: {
          documentInstanceId: instance.id,
          revisionNumber: 1,
          responseData: input.responseData,
          validationSummary: { valid: false, incomplete: true },
          createdById: input.actorUserId,
        },
      });
      await this.createProvenance(tx, revision.id, input.sourceProvenance);
      const result = await tx.documentInstance.update({
        where: { id: instance.id },
        data: { currentRevisionId: revision.id },
        include: { currentRevision: true, templateVersion: true },
      });
      await this.audit(
        tx,
        input.actorUserId,
        "DOCUMENT_INSTANCE_CREATED",
        instance.id,
        input.correlationId,
      );
      return result;
    });
  }

  async listInstances(
    donorId: string,
    actorUserId: string,
    institutionalIps?: string[],
  ) {
    await this.assertDonorAccess(donorId, institutionalIps);
    return this.prisma.documentInstance.findMany({
      where: { donorId },
      include: { currentRevision: true, templateVersion: true },
      orderBy: { updatedAt: "desc" },
    });
  }

  async getInstance(
    id: string,
    actorUserId: string,
    institutionalIps?: string[],
  ) {
    const instance = await this.prisma.documentInstance.findUnique({
      where: { id },
      include: {
        currentRevision: { include: { provenance: true } },
        revisions: {
          include: { provenance: true },
          orderBy: { revisionNumber: "desc" },
        },
        templateVersion: true,
      },
    });
    if (!instance) return null;
    await this.assertDonorAccess(instance.donorId, institutionalIps);
    return instance;
  }

  async saveRevision(
    input: Parameters<DocumentEngineRepository["saveRevision"]>[0],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const instance = await tx.documentInstance.findUnique({
        where: { id: input.instanceId },
      });
      if (!instance)
        throw new DocumentEngineNotFoundError("Instance not found");
      await this.assertDonorAccess(
        input.instanceId,
        input.institutionalIps,
        tx,
        true,
      );
      await this.validateProvenance(
        tx,
        instance.donorId,
        input.sourceProvenance,
      );
      const latest = await tx.documentResponseRevision.findFirst({
        where: { documentInstanceId: instance.id },
        orderBy: { revisionNumber: "desc" },
        select: { revisionNumber: true },
      });
      const revision = await tx.documentResponseRevision.create({
        data: {
          documentInstanceId: instance.id,
          revisionNumber: (latest?.revisionNumber ?? 0) + 1,
          responseData: input.responseData,
          validationSummary: { valid: false, incomplete: true },
          createdById: input.actorUserId,
        },
      });
      await this.createProvenance(tx, revision.id, input.sourceProvenance);
      const result = await tx.documentInstance.update({
        where: { id: instance.id },
        data: {
          currentRevisionId: revision.id,
          updatedById: input.actorUserId,
        },
        include: { currentRevision: { include: { provenance: true } } },
      });
      await this.audit(
        tx,
        input.actorUserId,
        "DOCUMENT_REVISION_CREATED",
        instance.id,
        input.correlationId,
      );
      return result;
    });
  }

  async validateInstance(
    id: string,
    actorUserId: string,
    institutionalIps?: string[],
  ) {
    return this.prisma.$transaction(async (tx) => {
      const instance = await tx.documentInstance.findUnique({
        where: { id },
        include: { currentRevision: true },
      });
      if (!instance?.currentRevision)
        throw new DocumentEngineNotFoundError("Instance or revision not found");
      await this.assertDonorAccess(instance.donorId, institutionalIps, tx);
      const schema = await tx.templateVersion.findUnique({
        where: { id: instance.templateVersionId },
        select: { jsonSchema: true },
      });
      const missing = this.requiredFields(
        schema?.jsonSchema,
        instance.currentRevision.responseData,
      );
      const summary = { valid: missing.length === 0, missingFields: missing };
      const revision = await tx.documentResponseRevision.update({
        where: { id: instance.currentRevision.id },
        data: { validationSummary: summary },
      });
      if (missing.length > 0)
        return { ...revision, valid: false, missingFields: missing };
      const result = await tx.documentInstance.update({
        where: { id },
        data: { status: "IN_REVIEW", updatedById: actorUserId },
      });
      await this.audit(
        tx,
        actorUserId,
        "DOCUMENT_INSTANCE_VALIDATED",
        id,
        randomCorrelation(),
      );
      return { ...result, valid: true, missingFields: [] };
    });
  }

  private async validateProvenance(
    tx: Prisma.TransactionClient,
    donorId: string,
    values: Parameters<
      DocumentEngineRepository["createInstance"]
    >[0]["sourceProvenance"],
  ) {
    for (const value of values) {
      if (!SAFE_SOURCE_KINDS.has(value.sourceKind)) {
        throw new DocumentEngineValidationError(
          "Unsupported provenance source",
        );
      }
      if (value.sourceKind.startsWith("OCR_")) {
        if (!value.ocrFieldId)
          throw new DocumentEngineValidationError("OCR source requires field");
        const field = await tx.ocrExtractedField.findUnique({
          where: { id: value.ocrFieldId },
          select: {
            donorId: true,
            sourceDocumentId: true,
            validationStatus: true,
          },
        });
        if (
          !field ||
          field.donorId !== donorId ||
          (value.sourceKind === "OCR_CONFIRMED" &&
            field.validationStatus !== OcrValidationStatus.CONFIRMADO) ||
          (value.sourceKind === "OCR_MODIFIED" &&
            field.validationStatus !== OcrValidationStatus.MODIFICADO)
        ) {
          throw new DocumentEngineValidationError(
            "OCR field is not an approved source",
          );
        }
        if (
          value.sourceDocumentId &&
          value.sourceDocumentId !== field.sourceDocumentId
        ) {
          throw new DocumentEngineValidationError(
            "OCR provenance document does not match the OCR field",
          );
        }
      }
      if (value.sourceDocumentId) {
        const sourceDocument = await tx.sourceDocument.findUnique({
          where: { id: value.sourceDocumentId },
          select: { donorId: true },
        });
        if (!sourceDocument || sourceDocument.donorId !== donorId) {
          throw new DocumentEngineValidationError(
            "Source document is not part of the donor record",
          );
        }
      }
    }
  }

  private createProvenance(
    tx: Prisma.TransactionClient,
    revisionId: string,
    values: Parameters<
      DocumentEngineRepository["createInstance"]
    >[0]["sourceProvenance"],
  ) {
    if (!values.length) return Promise.resolve([]);
    return Promise.all(
      values.map((value) =>
        tx.documentFieldProvenance.create({
          data: {
            responseRevisionId: revisionId,
            fieldPath: value.fieldPath,
            sourceKind: value.sourceKind,
            sourceEntityId: value.sourceEntityId,
            sourceDocumentId: value.sourceDocumentId,
            ocrFieldId: value.ocrFieldId,
            conflictStatus: value.conflictStatus ?? "NONE",
            conflictDetails: value.conflictDetails,
          },
        }),
      ),
    );
  }

  private requiredFields(
    schema: Prisma.JsonValue | undefined,
    data: Prisma.JsonValue,
  ): string[] {
    if (
      !schema ||
      typeof schema !== "object" ||
      Array.isArray(schema) ||
      !data ||
      typeof data !== "object" ||
      Array.isArray(data)
    )
      return [];
    const required = Array.isArray(schema.required) ? schema.required : [];
    return required.filter(
      (key): key is string =>
        typeof key === "string" &&
        (!(key in data) || data[key] === null || data[key] === ""),
    );
  }

  private async assertDonorAccess(
    donorId: string,
    institutionalIps?: string[],
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
    instanceId = false,
  ) {
    const donor = await (instanceId
      ? (tx as Prisma.TransactionClient).donorRecord.findUnique({
          where: {
            id: (
              await (
                tx as Prisma.TransactionClient
              ).documentInstance.findUnique({
                where: { id: donorId },
                select: { donorId: true },
              })
            )?.donorId,
          },
          select: { originatingIpsName: true },
        })
      : (tx as Prisma.TransactionClient | PrismaService).donorRecord.findUnique(
          {
            where: { id: donorId },
            select: { originatingIpsName: true },
          },
        ));
    this.assertScope(donor?.originatingIpsName, institutionalIps);
  }

  private assertScope(
    ipsName: string | undefined,
    institutionalIps?: string[],
  ) {
    if (!ipsName) throw new DocumentEngineNotFoundError("Donor not found");
    if (institutionalIps && !institutionalIps.includes(ipsName)) {
      throw new DocumentEngineAccessDeniedError("Institutional scope denied");
    }
  }

  private audit(
    tx: Prisma.TransactionClient,
    actorUserId: string,
    action: string,
    entityId: string,
    correlationId: string,
  ) {
    return tx.auditEvent.create({
      data: {
        actorUserId,
        action,
        entityType: "DOCUMENT_ENGINE",
        entityId,
        correlationId,
        metadata: { action },
      },
    });
  }
}

function randomCorrelation(): string {
  return `document-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}
