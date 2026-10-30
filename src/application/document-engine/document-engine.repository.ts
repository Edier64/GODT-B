import { Prisma } from "@prisma/client";

export const DOCUMENT_ENGINE_REPOSITORY = Symbol("DOCUMENT_ENGINE_REPOSITORY");

export interface DocumentEngineRepository {
  listTemplates(): Promise<unknown[]>;
  createTemplate(input: {
    templateCode: string;
    name: string;
    category: string;
    metadata?: Prisma.InputJsonValue;
    actorUserId: string;
    correlationId: string;
  }): Promise<unknown>;
  updateTemplate(
    id: string,
    input: {
      name?: string;
      category?: string;
      status?: string;
      metadata?: Prisma.InputJsonValue;
    },
    actorUserId: string,
    correlationId: string,
  ): Promise<unknown>;
  createVersion(input: {
    templateId: string;
    versionNumber: string;
    effectiveFrom: Date;
    jsonSchema: Prisma.InputJsonValue;
    uiSchema: Prisma.InputJsonValue;
    mappingConfig: Prisma.InputJsonValue;
    dependencyConfig?: Prisma.InputJsonValue;
    generationConfig?: Prisma.InputJsonValue;
    definitionHash: string;
    actorUserId: string;
    correlationId: string;
  }): Promise<unknown>;
  listVersions(templateId: string): Promise<unknown[]>;
  findVersion(id: string): Promise<unknown | null>;
  validateVersion(
    id: string,
    actorUserId: string,
    correlationId: string,
  ): Promise<unknown>;
  publishVersion(
    id: string,
    actorUserId: string,
    correlationId: string,
  ): Promise<unknown>;
  createInstance(input: {
    donorId: string;
    templateVersionId: string;
    actorUserId: string;
    institutionalIps?: string[];
    correlationId: string;
    responseData: Prisma.InputJsonValue;
    sourceProvenance: Array<{
      fieldPath: string;
      sourceKind: string;
      sourceEntityId?: string;
      sourceDocumentId?: string;
      ocrFieldId?: string;
      conflictStatus?: string;
      conflictDetails?: Prisma.InputJsonValue;
    }>;
  }): Promise<unknown>;
  listInstances(
    donorId: string,
    actorUserId: string,
    institutionalIps?: string[],
  ): Promise<unknown[]>;
  getInstance(
    id: string,
    actorUserId: string,
    institutionalIps?: string[],
  ): Promise<unknown | null>;
  saveRevision(input: {
    instanceId: string;
    actorUserId: string;
    institutionalIps?: string[];
    responseData: Prisma.InputJsonValue;
    sourceProvenance: Array<{
      fieldPath: string;
      sourceKind: string;
      sourceEntityId?: string;
      sourceDocumentId?: string;
      ocrFieldId?: string;
      conflictStatus?: string;
      conflictDetails?: Prisma.InputJsonValue;
    }>;
    correlationId: string;
  }): Promise<unknown>;
  validateInstance(
    id: string,
    actorUserId: string,
    institutionalIps?: string[],
  ): Promise<unknown>;
}
