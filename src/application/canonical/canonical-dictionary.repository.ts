import {
  CanonicalFieldDefinition,
  CanonicalSourceKind,
  ProcessCanonicalHistory,
  ProcessCanonicalValue,
} from "../../domain/canonical/canonical-dictionary";

export interface CanonicalDictionaryRepository {
  listCatalog(): Promise<CanonicalFieldDefinition[]>;

  findFieldByKey(canonicalFieldKey: string): Promise<CanonicalFieldDefinition | null>;

  seedDefaultCatalog(actorUserId?: string): Promise<void>;

  findProcessValues(processId: string): Promise<ProcessCanonicalValue[]>;

  findProcessValueByKey(
    processId: string,
    canonicalFieldKey: string,
  ): Promise<ProcessCanonicalValue | null>;

  upsertProcessValue(data: {
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
    tx?: unknown;
  }): Promise<ProcessCanonicalValue>;

  addHistoryEntry(data: {
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
    tx?: unknown;
  }): Promise<ProcessCanonicalHistory>;

  listHistory(
    processId: string,
    canonicalFieldKey: string,
  ): Promise<ProcessCanonicalHistory[]>;

  listObservations(
    processId: string,
    canonicalFieldKey: string,
    contextFilter?: string,
  ): Promise<ProcessCanonicalHistory[]>;

  updateConflictStatus(
    processId: string,
    canonicalFieldKey: string,
    status: "NONE" | "CONFLICT_DETECTED" | "RESOLVED",
    details?: Record<string, unknown> | null,
    actorUserId?: string,
    tx?: unknown,
  ): Promise<ProcessCanonicalValue>;
}

export const CANONICAL_DICTIONARY_REPOSITORY = Symbol("CANONICAL_DICTIONARY_REPOSITORY");

