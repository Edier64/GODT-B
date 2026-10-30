import { Inject, Injectable } from "@nestjs/common";
import { createHash, randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import {
  DocumentEngineAccessDeniedError,
  DocumentEngineValidationError,
} from "./document-engine.errors";
import {
  DOCUMENT_ENGINE_REPOSITORY,
  DocumentAccessContext,
  DocumentEngineRepository,
} from "./document-engine.repository";
import { DocumentDefinitionValidator } from "./document-definition.validator";

type ProvenanceInput = {
  fieldPath: string;
  sourceKind: string;
  sourceEntityId?: string;
  sourceDocumentId?: string;
  ocrFieldId?: string;
  conflictStatus?: string;
  conflictDetails?: Record<string, unknown>;
  sourceValue?: unknown;
};

@Injectable()
export class DocumentEngineService {
  constructor(
    @Inject(DOCUMENT_ENGINE_REPOSITORY)
    private readonly repository: DocumentEngineRepository,
    private readonly validator: DocumentDefinitionValidator,
  ) {}

  listTemplates(access: DocumentAccessContext) {
    return this.repository.listTemplates(access);
  }

  createTemplate(input: {
    templateCode: string;
    name: string;
    category: string;
    metadata?: Record<string, unknown>;
    actorUserId: string;
  }) {
    return this.repository.createTemplate({
      ...input,
      metadata: input.metadata as Prisma.InputJsonValue | undefined,
      correlationId: randomUUID(),
    });
  }

  updateTemplate(
    id: string,
    input: {
      name?: string;
      category?: string;
      status?: string;
      metadata?: Record<string, unknown>;
    },
    actorUserId: string,
  ) {
    return this.repository.updateTemplate(
      id,
      {
        ...input,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
      actorUserId,
      randomUUID(),
    );
  }

  createVersion(input: {
    templateId: string;
    versionNumber: string;
    effectiveFrom: Date;
    jsonSchema: Record<string, unknown>;
    uiSchema: Record<string, unknown>;
    mappingConfig: unknown[];
    dependencyConfig?: unknown;
    generationConfig?: Record<string, unknown>;
    actorUserId: string;
  }) {
    this.validator.validate(
      input.jsonSchema,
      input.uiSchema,
      input.mappingConfig,
      input.dependencyConfig,
    );
    const definition = JSON.stringify({
      jsonSchema: input.jsonSchema,
      uiSchema: input.uiSchema,
      mappingConfig: input.mappingConfig,
      dependencyConfig: input.dependencyConfig,
      generationConfig: input.generationConfig,
    });
    return this.repository.createVersion({
      ...input,
      jsonSchema: input.jsonSchema as Prisma.InputJsonValue,
      uiSchema: input.uiSchema as Prisma.InputJsonValue,
      mappingConfig: input.mappingConfig as Prisma.InputJsonValue,
      dependencyConfig: input.dependencyConfig as
        Prisma.InputJsonValue | undefined,
      generationConfig: input.generationConfig as
        Prisma.InputJsonValue | undefined,
      definitionHash: createHash("sha256").update(definition).digest("hex"),
      correlationId: randomUUID(),
    });
  }

  listVersions(templateId: string, access: DocumentAccessContext) {
    return this.repository.listVersions(templateId, access);
  }

  async validateVersion(id: string, actorUserId: string) {
    const version = await this.repository.findVersion(id);
    if (!version) throw new DocumentEngineValidationError("Version not found");
    const record = version as Record<string, unknown>;
    this.validator.validate(
      record.jsonSchema,
      record.uiSchema,
      record.mappingConfig,
      record.dependencyConfig,
    );
    return this.repository.validateVersion(id, actorUserId, randomUUID());
  }

  async publishVersion(id: string, actorUserId: string) {
    const version = await this.repository.findVersion(id);
    if (!version) throw new DocumentEngineValidationError("Version not found");
    const record = version as Record<string, unknown>;
    this.validator.validate(
      record.jsonSchema,
      record.uiSchema,
      record.mappingConfig,
      record.dependencyConfig,
    );
    return this.repository.publishVersion(id, actorUserId, randomUUID());
  }

  createInstance(input: {
    donorId: string;
    templateVersionId: string;
    actorUserId: string;
    access: DocumentAccessContext;
    responseData: Record<string, unknown>;
    sourceProvenance?: ProvenanceInput[];
  }) {
    if (
      input.sourceProvenance?.some((source) => {
        const kind = source.sourceKind;
        return (
          (kind === "OCR_CONFIRMED" || kind === "OCR_MODIFIED") &&
          typeof source.ocrFieldId !== "string"
        );
      })
    ) {
      throw new DocumentEngineValidationError(
        "OCR provenance requires an OCR field reference",
      );
    }
    return this.repository.createInstance({
      ...input,
      correlationId: randomUUID(),
      responseData: input.responseData as Prisma.InputJsonValue,
      sourceProvenance: this.mapProvenance(input.sourceProvenance),
    });
  }

  listInstances(donorId: string, access: DocumentAccessContext) {
    return this.repository.listInstances(donorId, access);
  }

  async getInstance(id: string, access: DocumentAccessContext) {
    const result = await this.repository.getInstance(id, access);
    if (!result)
      throw new DocumentEngineAccessDeniedError("Instance not found");
    return result;
  }

  saveRevision(input: {
    instanceId: string;
    access: DocumentAccessContext;
    responseData: Record<string, unknown>;
    sourceProvenance?: ProvenanceInput[];
  }) {
    return this.repository.saveRevision({
      ...input,
      actorUserId: input.access.userId,
      responseData: input.responseData as Prisma.InputJsonValue,
      sourceProvenance: this.mapProvenance(input.sourceProvenance),
      correlationId: randomUUID(),
    });
  }

  validateInstance(id: string, access: DocumentAccessContext) {
    return this.repository.validateInstance(id, access);
  }

  resolveConflict(input: {
    instanceId: string;
    fieldPath: string;
    decision: string;
    justification: string;
    access: DocumentAccessContext;
  }) {
    return this.repository.resolveConflict({
      ...input,
      correlationId: randomUUID(),
    });
  }

  private mapProvenance(values: ProvenanceInput[] | undefined): Array<{
    fieldPath: string;
    sourceKind: string;
    sourceEntityId?: string;
    sourceDocumentId?: string;
    ocrFieldId?: string;
    conflictStatus?: string;
    conflictDetails?: Prisma.InputJsonValue;
    sourceValue?: Prisma.InputJsonValue;
  }> {
    return (values ?? []).map((value) => {
      return {
        fieldPath: value.fieldPath,
        sourceKind: value.sourceKind,
        sourceEntityId: this.optionalString(value.sourceEntityId),
        sourceDocumentId: this.optionalString(value.sourceDocumentId),
        ocrFieldId: this.optionalString(value.ocrFieldId),
        conflictStatus: this.optionalString(value.conflictStatus),
        conflictDetails: value.conflictDetails as
          Prisma.InputJsonValue | undefined,
        sourceValue: value.sourceValue as Prisma.InputJsonValue | undefined,
      };
    });
  }

  private optionalString(value: unknown): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== "string") {
      throw new DocumentEngineValidationError(
        "Provenance identifiers must be strings",
      );
    }
    return value;
  }
}
