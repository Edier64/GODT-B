export type DocumentLifecycleStatus =
  | "BORRADOR"
  | "VALIDADO"
  | "COMPLETADO"
  | "PENDIENTE_FIRMAS"
  | "FIRMADO"
  | "LIBERADO"
  | "CANCELADO";

export type SignatureType =
  | "ATESTACION_USUARIO"
  | "MANUSCRITA_PRESENCIAL"
  | "DIBUJADA_UI"
  | "DIGITAL_CERTIFICADA";

export type CustodyEventType =
  | "RECOLECCION"
  | "TRANSPORTE"
  | "ENTREGA"
  | "RECEPCION"
  | "DISPOSICION";

export interface DocumentSnapshotMetadata {
  processId: string;
  positionNumber: number;
  documentCode: string;
  instanceId: string;
  templateVersionId: string;
  templateVersionNumber: string;
  definitionHash: string;
  revisionNumber: number;
  responseData: Record<string, unknown>;
  provenance: Array<{
    fieldPath: string;
    sourceKind: string;
    canonicalFieldKey?: string;
  }>;
  canonicalValues: Record<string, unknown>;
  repeatableObservations: Array<{
    canonicalFieldKey: string;
    observationId: string;
    value: unknown;
    sampleContext?: string;
    effectiveAt: string;
    unit?: string;
  }>;
  participants: Array<{
    id: string;
    fullName: string;
    signerRole: string;
    isSigner: boolean;
    signatureRequired: boolean;
    signatureOrder?: number;
    status: string;
  }>;
  generatedById: string;
  generatedAt: string;
  renderEngine: string;
}

export class InvalidLifecycleTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidLifecycleTransitionError";
  }
}

export class DocumentLockedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentLockedError";
  }
}

export class MissingRequiredSignaturesError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MissingRequiredSignaturesError";
  }
}

export class DocumentParticipantNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumentParticipantNotFoundError";
  }
}

export class SnapshotIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SnapshotIntegrityError";
  }
}

export class CustodySequenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CustodySequenceError";
  }
}

export const ALLOWED_TRANSITIONS: Record<DocumentLifecycleStatus, DocumentLifecycleStatus[]> = {
  BORRADOR: ["VALIDADO", "CANCELADO"],
  VALIDADO: ["BORRADOR", "COMPLETADO", "CANCELADO"],
  COMPLETADO: ["PENDIENTE_FIRMAS", "LIBERADO", "CANCELADO"],
  PENDIENTE_FIRMAS: ["FIRMADO", "CANCELADO"],
  FIRMADO: ["LIBERADO"],
  LIBERADO: [], // Estado terminal inmutable
  CANCELADO: [], // Estado terminal inmutable
};

export function canTransition(
  fromStatus: string,
  toStatus: DocumentLifecycleStatus,
): boolean {
  // Normalizar estados existentes hacia los estados canónicos
  let normalizedFrom: DocumentLifecycleStatus = "BORRADOR";
  if (fromStatus === "DRAFT" || fromStatus === "EN_DILIGENCIAMIENTO" || fromStatus === "PENDIENTE") {
    normalizedFrom = "BORRADOR";
  } else if (fromStatus === "VALIDADO" || fromStatus === "VALIDATED") {
    normalizedFrom = "VALIDADO";
  } else if (fromStatus === "COMPLETADO" || fromStatus === "COMPLETED") {
    normalizedFrom = "COMPLETADO";
  } else if (fromStatus === "PENDIENTE_FIRMAS" || fromStatus === "PENDING_SIGNATURES") {
    normalizedFrom = "PENDIENTE_FIRMAS";
  } else if (fromStatus === "FIRMADO" || fromStatus === "SIGNED") {
    normalizedFrom = "FIRMADO";
  } else if (fromStatus === "LIBERADO" || fromStatus === "RELEASED") {
    normalizedFrom = "LIBERADO";
  } else if (fromStatus === "CANCELADO" || fromStatus === "CANCELLED") {
    normalizedFrom = "CANCELADO";
  }

  const allowed = ALLOWED_TRANSITIONS[normalizedFrom] || [];
  return allowed.includes(toStatus);
}

export function isDocumentLocked(status: string): boolean {
  const s = status.toUpperCase();
  return (
    s === "COMPLETADO" ||
    s === "COMPLETED" ||
    s === "PENDIENTE_FIRMAS" ||
    s === "PENDING_SIGNATURES" ||
    s === "FIRMADO" ||
    s === "SIGNED" ||
    s === "LIBERADO" ||
    s === "RELEASED" ||
    s === "CANCELADO" ||
    s === "CANCELLED"
  );
}
