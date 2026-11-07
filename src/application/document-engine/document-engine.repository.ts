import { Prisma } from "@prisma/client";

export const DOCUMENT_ENGINE_REPOSITORY = Symbol("DOCUMENT_ENGINE_REPOSITORY");
export interface DocumentAccessContext {
  userId: string;
  isAdmin: boolean;
  institutionalIps: string[];
}

export interface DocumentEngineRepository {
  listTemplates(access: DocumentAccessContext): Promise<unknown[]>;
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
  listVersions(
    templateId: string,
    access: DocumentAccessContext,
  ): Promise<unknown[]>;
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
    access: DocumentAccessContext;
    correlationId: string;
    responseData: Prisma.InputJsonValue;
    sourceProvenance?: Array<{
      fieldPath: string;
      sourceKind: string;
      canonicalFieldKey?: string;
      sourceEntityId?: string;
      sourceDocumentId?: string;
      ocrFieldId?: string;
      conflictStatus?: string;
      conflictDetails?: Prisma.InputJsonValue;
      sourceValue?: Prisma.InputJsonValue;
    }>;
  }): Promise<unknown>;
  listInstances(
    donorId: string,
    access: DocumentAccessContext,
  ): Promise<unknown[]>;
  getInstance(
    id: string,
    access: DocumentAccessContext,
  ): Promise<unknown | null>;
  saveRevision(input: {
    instanceId: string;
    actorUserId: string;
    access: DocumentAccessContext;
    responseData: Prisma.InputJsonValue;
    sourceProvenance?: Array<{
      fieldPath: string;
      sourceKind: string;
      canonicalFieldKey?: string;
      sourceEntityId?: string;
      sourceDocumentId?: string;
      ocrFieldId?: string;
      conflictStatus?: string;
      conflictDetails?: Prisma.InputJsonValue;
      sourceValue?: Prisma.InputJsonValue;
    }>;
    correlationId: string;
  }): Promise<unknown>;
  validateInstance(id: string, access: DocumentAccessContext): Promise<unknown>;
  resolveConflict(input: {
    instanceId: string;
    fieldPath: string;
    decision: string;
    justification: string;
    access: DocumentAccessContext;
    correlationId: string;
  }): Promise<unknown>;
}
