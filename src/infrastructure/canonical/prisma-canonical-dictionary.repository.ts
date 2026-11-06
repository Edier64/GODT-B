import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { CanonicalDictionaryRepository } from "../../application/canonical/canonical-dictionary.repository";
import {
  CanonicalFieldDefinition,
  CanonicalSourceKind,
  HOMOLOGATED_CANONICAL_FIELDS,
  ProcessCanonicalHistory,
  ProcessCanonicalValue,
} from "../../domain/canonical/canonical-dictionary";
import { Prisma } from "@prisma/client";

@Injectable()
export class PrismaCanonicalDictionaryRepository
  implements CanonicalDictionaryRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async listCatalog(): Promise<CanonicalFieldDefinition[]> {
    const list = await this.prisma.canonicalFieldDefinition.findMany({
      where: { status: "ACTIVE" },
      orderBy: { canonicalFieldKey: "asc" },
    });
    return list.map((item) => this.mapDefinition(item));
  }

  async findFieldByKey(
    canonicalFieldKey: string,
  ): Promise<CanonicalFieldDefinition | null> {
    const found = await this.prisma.canonicalFieldDefinition.findUnique({
      where: { canonicalFieldKey },
    });
    return found ? this.mapDefinition(found) : null;
  }

  async seedDefaultCatalog(actorUserId?: string): Promise<void> {
    for (const def of HOMOLOGATED_CANONICAL_FIELDS) {
      await this.prisma.canonicalFieldDefinition.upsert({
        where: { canonicalFieldKey: def.canonicalFieldKey },
        update: {
          displayName: def.displayName,
          description: def.description,
          dataType: def.dataType,
          unit: def.unit,
          scope: def.scope,
          cardinality: def.cardinality,
          sharingPolicy: def.sharingPolicy,
          allowedSources: def.allowedSources as Prisma.InputJsonValue,
          writable: def.writable,
          status: def.status,
          version: def.version,
        },
        create: {
          canonicalFieldKey: def.canonicalFieldKey,
          displayName: def.displayName,
          description: def.description,
          dataType: def.dataType,
          unit: def.unit,
          scope: def.scope,
          cardinality: def.cardinality,
          sharingPolicy: def.sharingPolicy,
          allowedSources: def.allowedSources as Prisma.InputJsonValue,
          writable: def.writable,
          status: def.status,
          version: def.version,
          createdById: actorUserId,
        },
      });
    }
  }

  async findProcessValues(processId: string): Promise<ProcessCanonicalValue[]> {
    const values = await this.prisma.processCanonicalValue.findMany({
      where: { processId },
      orderBy: { canonicalFieldKey: "asc" },
    });
    return values.map((v) => this.mapProcessValue(v));
  }

  async findProcessValueByKey(
    processId: string,
    canonicalFieldKey: string,
  ): Promise<ProcessCanonicalValue | null> {
    const found = await this.prisma.processCanonicalValue.findUnique({
      where: {
        processId_canonicalFieldKey: {
          processId,
          canonicalFieldKey,
        },
      },
    });
    return found ? this.mapProcessValue(found) : null;
  }

  async upsertProcessValue(data: {
    processId: string;
    canonicalFieldKey: string;
    value: unknown;
    unit?: string | null;
    sampleContext?: string | null;
    effectiveAt?: Date;
    sourceKind: CanonicalSourceKind;
    sourceInstanceId?: string | null;
    sourceRevisionId?: string | null;
    expectedVersion?: number;
    actorUserId: string;
    tx?: any;
  }): Promise<ProcessCanonicalValue> {
    const client = data.tx || this.prisma;
    const existing = await client.processCanonicalValue.findUnique({
      where: {
        processId_canonicalFieldKey: {
          processId: data.processId,
          canonicalFieldKey: data.canonicalFieldKey,
        },
      },
    });

    // 1. Verificación de concurrencia optimista
    if (
      data.expectedVersion !== undefined &&
      existing &&
      existing.versionNumber !== data.expectedVersion
    ) {
      throw new Error(
        `Conflicto de concurrencia para marcador '${data.canonicalFieldKey}': versión esperada ${data.expectedVersion}, pero la versión actual en base de datos es ${existing.versionNumber}.`,
      );
    }

    // 2. Idempotencia: si ya existe exactamente el mismo valor, origen y revisión, retornar sin mutar
    if (
      existing &&
      JSON.stringify(existing.currentValue) === JSON.stringify(data.value) &&
      existing.sourceKind === data.sourceKind &&
      existing.sourceRevisionId === (data.sourceRevisionId || null) &&
      existing.conflictStatus === "NONE"
    ) {
      return this.mapProcessValue(existing);
    }

    const nextVersion = existing ? existing.versionNumber + 1 : 1;
    const effectiveAt = data.effectiveAt || new Date();

    const saved = await client.processCanonicalValue.upsert({
      where: {
        processId_canonicalFieldKey: {
          processId: data.processId,
          canonicalFieldKey: data.canonicalFieldKey,
        },
      },
      update: {
        currentValue: data.value as Prisma.InputJsonValue,
        unit: data.unit,
        sampleContext: data.sampleContext,
        effectiveAt,
        sourceKind: data.sourceKind,
        sourceInstanceId: data.sourceInstanceId,
        sourceRevisionId: data.sourceRevisionId,
        versionNumber: nextVersion,
        conflictStatus: "NONE",
        updatedById: data.actorUserId,
      },
      create: {
        processId: data.processId,
        canonicalFieldKey: data.canonicalFieldKey,
        currentValue: data.value as Prisma.InputJsonValue,
        unit: data.unit,
        sampleContext: data.sampleContext,
        effectiveAt,
        sourceKind: data.sourceKind,
        sourceInstanceId: data.sourceInstanceId,
        sourceRevisionId: data.sourceRevisionId,
        versionNumber: 1,
        conflictStatus: "NONE",
        updatedById: data.actorUserId,
      },
    });

    return this.mapProcessValue(saved);
  }

  async addHistoryEntry(data: {
    processId: string;
    canonicalFieldKey: string;
    value: unknown;
    unit?: string | null;
    sampleContext?: string | null;
    effectiveAt?: Date;
    sourceKind: CanonicalSourceKind;
    sourceInstanceId?: string | null;
    sourceRevisionId?: string | null;
    sourceDocumentId?: string | null;
    versionNumber: number;
    actorUserId: string;
    tx?: any;
  }): Promise<ProcessCanonicalHistory> {
    const client = data.tx || this.prisma;
    const created = await client.processCanonicalHistory.create({
      data: {
        processId: data.processId,
        canonicalFieldKey: data.canonicalFieldKey,
        value: data.value as Prisma.InputJsonValue,
        unit: data.unit,
        effectiveAt: data.effectiveAt || new Date(),
        sampleContext: data.sampleContext,
        sourceKind: data.sourceKind,
        sourceInstanceId: data.sourceInstanceId,
        sourceRevisionId: data.sourceRevisionId,
        sourceDocumentId: data.sourceDocumentId,
        versionNumber: data.versionNumber,
        createdById: data.actorUserId,
      },
    });

    return {
      id: created.id,
      processId: created.processId,
      canonicalFieldKey: created.canonicalFieldKey,
      value: created.value,
      unit: created.unit,
      effectiveAt: created.effectiveAt,
      sampleContext: created.sampleContext,
      sourceKind: created.sourceKind as CanonicalSourceKind,
      sourceInstanceId: created.sourceInstanceId,
      sourceRevisionId: created.sourceRevisionId,
      sourceDocumentId: created.sourceDocumentId,
      versionNumber: created.versionNumber,
      createdById: created.createdById,
      createdAt: created.createdAt,
    };
  }

  async listHistory(
    processId: string,
    canonicalFieldKey: string,
  ): Promise<ProcessCanonicalHistory[]> {
    const history = await this.prisma.processCanonicalHistory.findMany({
      where: { processId, canonicalFieldKey },
      orderBy: { effectiveAt: "asc" },
    });

    return history.map((h) => ({
      id: h.id,
      processId: h.processId,
      canonicalFieldKey: h.canonicalFieldKey,
      value: h.value,
      unit: h.unit,
      effectiveAt: h.effectiveAt,
      sampleContext: h.sampleContext,
      sourceKind: h.sourceKind as CanonicalSourceKind,
      sourceInstanceId: h.sourceInstanceId,
      sourceRevisionId: h.sourceRevisionId,
      sourceDocumentId: h.sourceDocumentId,
      versionNumber: h.versionNumber,
      createdById: h.createdById,
      createdAt: h.createdAt,
    }));
  }

  async listObservations(
    processId: string,
    canonicalFieldKey: string,
    contextFilter?: string,
  ): Promise<ProcessCanonicalHistory[]> {
    const where: Prisma.ProcessCanonicalHistoryWhereInput = {
      processId,
      canonicalFieldKey,
    };
    if (contextFilter) {
      where.sampleContext = contextFilter;
    }
    const entries = await this.prisma.processCanonicalHistory.findMany({
      where,
      orderBy: [{ effectiveAt: "desc" }, { createdAt: "desc" }],
    });

    return entries.map((h) => ({
      id: h.id,
      processId: h.processId,
      canonicalFieldKey: h.canonicalFieldKey,
      value: h.value,
      unit: h.unit,
      effectiveAt: h.effectiveAt,
      sampleContext: h.sampleContext,
      sourceKind: h.sourceKind as CanonicalSourceKind,
      sourceInstanceId: h.sourceInstanceId,
      sourceRevisionId: h.sourceRevisionId,
      sourceDocumentId: h.sourceDocumentId,
      versionNumber: h.versionNumber,
      createdById: h.createdById,
      createdAt: h.createdAt,
    }));
  }

  async updateConflictStatus(
    processId: string,
    canonicalFieldKey: string,
    status: "NONE" | "CONFLICT_DETECTED" | "RESOLVED",
    details?: Record<string, unknown> | null,
    actorUserId?: string,
    tx?: any,
  ): Promise<ProcessCanonicalValue> {
    const client = tx || this.prisma;
    const updated = await client.processCanonicalValue.update({
      where: {
        processId_canonicalFieldKey: {
          processId,
          canonicalFieldKey,
        },
      },
      data: {
        conflictStatus: status,
        conflictDetails: details as Prisma.InputJsonValue,
        ...(actorUserId ? { updatedById: actorUserId } : {}),
      },
    });

    return this.mapProcessValue(updated);
  }

  private mapDefinition(raw: any): CanonicalFieldDefinition {
    return {
      id: raw.id,
      canonicalFieldKey: raw.canonicalFieldKey,
      displayName: raw.displayName,
      description: raw.description,
      dataType: raw.dataType,
      unit: raw.unit,
      scope: raw.scope,
      cardinality: raw.cardinality,
      sharingPolicy: raw.sharingPolicy,
      allowedSources: raw.allowedSources as CanonicalSourceKind[],
      writable: raw.writable,
      validationRules: raw.validationRules as Record<string, unknown> | null,
      status: raw.status,
      version: raw.version,
      createdById: raw.createdById,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }

  private mapProcessValue(raw: any): ProcessCanonicalValue {
    return {
      id: raw.id,
      processId: raw.processId,
      canonicalFieldKey: raw.canonicalFieldKey,
      currentValue: raw.currentValue,
      unit: raw.unit,
      effectiveAt: raw.effectiveAt,
      sampleContext: raw.sampleContext,
      sourceKind: raw.sourceKind as CanonicalSourceKind,
      sourceInstanceId: raw.sourceInstanceId,
      sourceRevisionId: raw.sourceRevisionId,
      versionNumber: raw.versionNumber,
      conflictStatus: raw.conflictStatus,
      conflictDetails: raw.conflictDetails as Record<string, unknown> | null,
      updatedById: raw.updatedById,
      createdAt: raw.createdAt,
      updatedAt: raw.updatedAt,
    };
  }
}

