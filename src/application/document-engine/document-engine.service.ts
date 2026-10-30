import { Inject, Injectable } from "@nestjs/common";
import { createHash, randomUUID } from "crypto";
import { Prisma } from "@prisma/client";
import {
  DocumentEngineAccessDeniedError,
  DocumentEngineValidationError,
} from "./document-engine.errors";
import {
  DOCUMENT_ENGINE_REPOSITORY,
  DocumentEngineRepository,
} from "./document-engine.repository";
import { DocumentDefinitionValidator } from "./document-definition.validator";

@Injectable()
export class DocumentEngineService {
  constructor(
    @Inject(DOCUMENT_ENGINE_REPOSITORY)
    private readonly repository: DocumentEngineRepository,
    private readonly validator: DocumentDefinitionValidator,
  ) {}

  listTemplates() {
    return this.repository.listTemplates();
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

  listVersions(templateId: string) {
    return this.repository.listVersions(templateId);
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
    institutionalIps?: string[];
    responseData: Record<string, unknown>;
    sourceProvenance?: Array<Record<string, unknown>>;
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

  listInstances(
    donorId: string,
    actorUserId: string,
    institutionalIps?: string[],
  ) {
    return this.repository.listInstances(
      donorId,
      actorUserId,
      institutionalIps,
    );
  }

  async getInstance(
    id: string,
    actorUserId: string,
    institutionalIps?: string[],
  ) {
    const result = await this.repository.getInstance(
      id,
      actorUserId,
      institutionalIps,
    );
    if (!result)
      throw new DocumentEngineAccessDeniedError("Instance not found");
    return result;
  }

  saveRevision(input: {
    instanceId: string;
    actorUserId: string;
    institutionalIps?: string[];
    responseData: Record<string, unknown>;
    sourceProvenance?: Array<Record<string, unknown>>;
  }) {
    return this.repository.saveRevision({
      ...input,
      responseData: input.responseData as Prisma.InputJsonValue,
      sourceProvenance: this.mapProvenance(input.sourceProvenance),
      correlationId: randomUUID(),
    });
  }

  validateInstance(
    id: string,
    actorUserId: string,
    institutionalIps?: string[],
  ) {
    return this.repository.validateInstance(id, actorUserId, institutionalIps);
  }

  private mapProvenance(
    values: Array<Record<string, unknown>> | undefined,
  ): Array<{
    fieldPath: string;
    sourceKind: string;
    sourceEntityId?: string;
    sourceDocumentId?: string;
    ocrFieldId?: string;
    conflictStatus?: string;
    conflictDetails?: Prisma.InputJsonValue;
  }> {
    return (values ?? []).map((value) => {
      if (
        typeof value.fieldPath !== "string" ||
        typeof value.sourceKind !== "string"
      ) {
        throw new DocumentEngineValidationError(
          "Each provenance entry requires fieldPath and sourceKind",
        );
      }
      return {
        fieldPath: value.fieldPath,
        sourceKind: value.sourceKind,
        sourceEntityId: this.optionalString(value.sourceEntityId),
        sourceDocumentId: this.optionalString(value.sourceDocumentId),
        ocrFieldId: this.optionalString(value.ocrFieldId),
        conflictStatus: this.optionalString(value.conflictStatus),
        conflictDetails: value.conflictDetails as
          Prisma.InputJsonValue | undefined,
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
