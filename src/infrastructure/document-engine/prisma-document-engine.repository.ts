import { Injectable } from "@nestjs/common";
import { Prisma, OcrValidationStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  DocumentEngineAccessDeniedError,
  DocumentConflictError,
  DocumentEngineNotFoundError,
  DocumentEngineValidationError,
} from "../../application/document-engine/document-engine.errors";
import {
  DocumentAccessContext,
  DocumentEngineRepository,
} from "../../application/document-engine/document-engine.repository";
import { DocumentResponseValidator } from "../../application/document-engine/document-response.validator";

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly responseValidator: DocumentResponseValidator = new DocumentResponseValidator(),
  ) {}

  listTemplates(access: DocumentAccessContext) {
    this.assertInstitutionalAccess(access);
    return this.prisma.documentTemplate.findMany({
      where: {
        status: "ACTIVE",
        category: { notIn: ["PENDING_HOMOLOGATION", "TEST", "RESERVED"] },
        NOT: [
          { templateCode: { startsWith: "TPL-" } },
          { templateCode: { startsWith: "POS_NORMATIVA_" } },
          { templateCode: { contains: "test-" } },
          { templateCode: { contains: "synthetic-" } },
        ],
        versions: access.isAdmin
          ? undefined
          : { some: { status: "PUBLISHED" } },
      },
      include: {
        versions: {
          where: access.isAdmin ? undefined : { status: "PUBLISHED" },
          orderBy: { createdAt: "desc" },
        },
      },
      orderBy: { templateCode: "asc" },
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

  listVersions(templateId: string, access: DocumentAccessContext) {
    this.assertInstitutionalAccess(access);
    return this.prisma.templateVersion.findMany({
      where: {
        templateId,
        ...(access.isAdmin ? {} : { status: "PUBLISHED" }),
      },
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
    return this.prisma.$transaction(
      async (tx) => {
        const version = await tx.templateVersion.findUnique({ where: { id } });
        if (!version)
          throw new DocumentEngineNotFoundError("Version not found");
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
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
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
      this.assertScope(donor?.originatingIpsName, input.access);
      const version = await tx.templateVersion.findUnique({
        where: { id: input.templateVersionId },
        include: { template: true },
      });
      if (!version) throw new DocumentEngineNotFoundError("Version not found");
      const draftPilotEnabled =
        process.env.NODE_ENV === "development" &&
        process.env.DOCUMENT_ENGINE_ALLOW_DRAFT_INSTANCES === "true" &&
        input.access.isAdmin;
      if (version.status !== "PUBLISHED" && !draftPilotEnabled) {
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

  async listInstances(donorId: string, access: DocumentAccessContext) {
    await this.assertDonorAccess(donorId, access);
    return this.prisma.documentInstance.findMany({
      where: { donorId },
      include: { currentRevision: true, templateVersion: true },
      orderBy: { updatedAt: "desc" },
    });
  }

  async getInstance(id: string, access: DocumentAccessContext) {
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
    await this.assertDonorAccess(instance.donorId, access);
    return instance;
  }

  async saveRevision(
    input: Parameters<DocumentEngineRepository["saveRevision"]>[0],
  ) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const instance = await tx.documentInstance.findUnique({
              where: { id: input.instanceId },
              include: { currentRevision: true, templateVersion: true },
            });
            if (!instance)
              throw new DocumentEngineNotFoundError("Instance not found");
            await this.assertDonorAccess(instance.donorId, input.access, tx);
            this.assertProtectedFieldsUnchanged(
              instance.templateVersion.uiSchema,
              instance.currentRevision?.responseData,
              input.responseData,
            );
            if (input.sourceProvenance && input.sourceProvenance.length > 0) {
              await this.validateProvenance(
                tx,
                instance.donorId,
                input.sourceProvenance,
              );
            }
            const pending = await tx.documentFieldProvenance.findFirst({
              where: {
                responseRevision: {
                  documentInstanceId: instance.id,
                  id: instance.currentRevisionId ?? undefined,
                },
                conflictStatus: "PENDING",
              },
            });
            if (pending) {
              throw new DocumentConflictError(
                "Pending field conflicts must be resolved before saving a new revision",
              );
            }
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
            if (input.sourceProvenance !== undefined) {
              await this.createProvenance(
                tx,
                revision.id,
                input.sourceProvenance,
              );
            } else if (instance.currentRevisionId) {
              // Carry forward existing provenance from the current revision
              const priorProvenance = await tx.documentFieldProvenance.findMany({
                where: { responseRevisionId: instance.currentRevisionId },
              });
              if (priorProvenance.length > 0) {
                await Promise.all(
                  priorProvenance.map((p) =>
                    tx.documentFieldProvenance.create({
                      data: {
                        responseRevisionId: revision.id,
                        fieldPath: p.fieldPath,
                        canonicalFieldKey: p.canonicalFieldKey,
                        sourceKind: p.sourceKind,
                        sourceEntityId: p.sourceEntityId,
                        sourceDocumentId: p.sourceDocumentId,
                        ocrFieldId: p.ocrFieldId,
                        sourceValue: p.sourceValue as Prisma.InputJsonValue,
                        validatedById: p.validatedById,
                        validatedAt: p.validatedAt,
                        conflictStatus: p.conflictStatus,
                        conflictDetails:
                          p.conflictDetails as Prisma.InputJsonValue,
                        conflictResolvedById: p.conflictResolvedById,
                        conflictResolvedAt: p.conflictResolvedAt,
                        conflictDecision: p.conflictDecision,
                        conflictJustification: p.conflictJustification,
                      },
                    }),
                  ),
                );
              }
            }
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
          },
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2034" &&
          attempt < 2
        ) {
          continue;
        }
        throw error;
      }
    }
    throw new Error("Serializable transaction retry limit exceeded");
  }

  async validateInstance(id: string, access: DocumentAccessContext) {
    return this.prisma.$transaction(async (tx) => {
      const instance = await tx.documentInstance.findUnique({
        where: { id },
        include: { currentRevision: true },
      });
      if (!instance?.currentRevision)
        throw new DocumentEngineNotFoundError("Instance or revision not found");
      await this.assertDonorAccess(instance.donorId, access, tx);
      const schema = await tx.templateVersion.findUnique({
        where: { id: instance.templateVersionId },
        select: { jsonSchema: true },
      });
      if (!schema) {
        throw new DocumentEngineNotFoundError("Template version not found");
      }
      const validation = this.responseValidator.validate(
        schema.jsonSchema,
        instance.currentRevision.responseData,
      );
      const missingFields = validation.errors
        .filter((error) => error.keyword === "required")
        .map((error) => error.path);
      const summary = {
        valid: validation.valid,
        missingFields,
        errors: validation.errors,
      };
      const revision = await tx.documentResponseRevision.update({
        where: { id: instance.currentRevision.id },
        data: {
          validationSummary: summary as unknown as Prisma.InputJsonValue,
        },
      });
      if (!validation.valid)
        return {
          ...revision,
          valid: false,
          missingFields,
          errors: validation.errors,
        };
      const result = await tx.documentInstance.update({
        where: { id },
        data: { status: "IN_REVIEW", updatedById: access.userId },
      });
      await this.audit(
        tx,
        access.userId,
        "DOCUMENT_INSTANCE_VALIDATED",
        id,
        randomCorrelation(),
      );
      return { ...result, valid: true, missingFields: [] };
    });
  }

  async resolveConflict(
    input: Parameters<DocumentEngineRepository["resolveConflict"]>[0],
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const instance = await tx.documentInstance.findUnique({
          where: { id: input.instanceId },
          select: { donorId: true, currentRevisionId: true },
        });
        if (!instance?.currentRevisionId) {
          throw new DocumentEngineNotFoundError(
            "Instance or revision not found",
          );
        }
        await this.assertDonorAccess(instance.donorId, input.access, tx);
        if (!input.justification.trim()) {
          throw new DocumentEngineValidationError(
            "Conflict justification is required",
          );
        }
        const provenance = await tx.documentFieldProvenance.findFirst({
          where: {
            responseRevisionId: instance.currentRevisionId,
            fieldPath: input.fieldPath,
            conflictStatus: "PENDING",
          },
        });
        if (!provenance) {
          throw new DocumentConflictError("Pending conflict was not found");
        }
        const result = await tx.documentFieldProvenance.update({
          where: { id: provenance.id },
          data: {
            conflictStatus: "RESOLVED",
            conflictResolvedById: input.access.userId,
            conflictResolvedAt: new Date(),
            conflictDecision: input.decision,
            conflictJustification: input.justification,
          },
        });
        await this.audit(
          tx,
          input.access.userId,
          "DOCUMENT_CONFLICT_RESOLVED",
          input.instanceId,
          input.correlationId,
        );
        return result;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  private async validateProvenance(
    tx: Prisma.TransactionClient,
    donorId: string,
    values?: Parameters<
      DocumentEngineRepository["createInstance"]
    >[0]["sourceProvenance"],
  ) {
    if (!values || !values.length) return;
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
    values?: Parameters<
      DocumentEngineRepository["createInstance"]
    >[0]["sourceProvenance"],
  ) {
    if (!values || !values.length) return Promise.resolve([]);
    const fieldValues = new Map<string, Set<string>>();
    for (const value of values) {
      if (value.sourceValue === undefined) continue;
      const serialized = JSON.stringify(value.sourceValue);
      const current = fieldValues.get(value.fieldPath) ?? new Set<string>();
      current.add(serialized);
      fieldValues.set(value.fieldPath, current);
    }
    const conflictingFields = new Set(
      [...fieldValues.entries()]
        .filter(([, sourceValues]) => sourceValues.size > 1)
        .map(([fieldPath]) => fieldPath),
    );
    return Promise.all(
      values.map((value) =>
        (async () => {
          const ocrField = value.ocrFieldId
            ? await tx.ocrExtractedField.findUnique({
                where: { id: value.ocrFieldId },
                select: { validatedById: true, validatedAt: true },
              })
            : null;
          return tx.documentFieldProvenance.create({
            data: {
              responseRevisionId: revisionId,
              fieldPath: value.fieldPath,
              canonicalFieldKey: value.canonicalFieldKey,
              sourceKind: value.sourceKind,
              sourceEntityId: value.sourceEntityId,
              sourceDocumentId: value.sourceDocumentId,
              ocrFieldId: value.ocrFieldId,
              sourceValue: value.sourceValue,
              validatedById: ocrField?.validatedById,
              validatedAt: ocrField?.validatedAt,
              conflictStatus: conflictingFields.has(value.fieldPath)
                ? "PENDING"
                : (value.conflictStatus ?? "NONE"),
              conflictDetails: value.conflictDetails,
            },
          });
        })(),
      ),
    );
  }

  private async assertDonorAccess(
    donorId: string,
    access: DocumentAccessContext,
    tx: Prisma.TransactionClient | PrismaService = this.prisma,
  ) {
    const donor = await tx.donorRecord.findUnique({
      where: { id: donorId },
      select: { originatingIpsName: true },
    });
    this.assertScope(donor?.originatingIpsName, access);
  }

  private assertInstitutionalAccess(access: DocumentAccessContext) {
    if (!access.isAdmin && access.institutionalIps.length === 0) {
      throw new DocumentEngineAccessDeniedError("Institutional scope denied");
    }
  }

  private assertProtectedFieldsUnchanged(
    uiSchema: unknown,
    currentResponse: unknown,
    nextResponse: unknown,
  ) {
    if (!this.isRecord(uiSchema) || !this.isRecord(uiSchema.fieldConfigs)) {
      return;
    }
    for (const [path, config] of Object.entries(uiSchema.fieldConfigs)) {
      if (!this.isRecord(config) || config.readonly !== true) continue;
      const currentValues = this.readPathValues(currentResponse, path);
      const nextValues = this.readPathValues(nextResponse, path);
      if (JSON.stringify(currentValues) !== JSON.stringify(nextValues)) {
        throw new DocumentEngineValidationError(
          `Readonly field '${path}' cannot be modified`,
        );
      }
    }
  }

  private readPathValues(value: unknown, path: string): unknown[] {
    if (!path.startsWith("$.")) return [];
    const segments = path.slice(2).split(".").filter(Boolean);
    const read = (current: unknown, index: number): unknown[] => {
      if (index === segments.length) return [current];
      if (!this.isRecord(current)) return [undefined];
      const segment = segments[index];
      if (segment.endsWith("[]")) {
        const arrayValue = current[segment.slice(0, -2)];
        if (!Array.isArray(arrayValue)) return [undefined];
        return arrayValue.flatMap((item) => read(item, index + 1));
      }
      return read(current[segment], index + 1);
    };
    return read(value, 0);
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }

  private assertScope(
    ipsName: string | undefined,
    access: DocumentAccessContext,
  ) {
    if (!ipsName) throw new DocumentEngineNotFoundError("Donor not found");
    if (!access.isAdmin && !access.institutionalIps.includes(ipsName)) {
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
