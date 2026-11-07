import { createHash } from "crypto";

export type DossierExportStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"
  | "EXPIRED";

export type DossierExportType =
  | "FULL_ZIP"
  | "CONSOLIDATED_PDF"
  | "INDEX_ONLY";

export class DossierNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DossierNotFoundError";
  }
}

export class DossierAccessDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DossierAccessDeniedError";
  }
}

export class DossierValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DossierValidationError";
  }
}

export class DossierProcessingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DossierProcessingError";
  }
}

export class DossierQueueUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DossierQueueUnavailableError";
  }
}

export interface DossierSignatureItem {
  participantId?: string;
  signerRole: string;
  signerName: string;
  signerDocument?: string | null;
  signatureType: string;
  signedAt?: string | null;
  snapshotSha256: string | null;
  hasCryptographicSignature: boolean;
  attestationLevel: "ATESTA_MANUAL_INTERNA" | "FIRMA_ELECTRONICA_SIMPLE" | "DIGITAL_CERTIFICADA_BLOQUEADA";
}

export interface DossierDocumentItem {
  positionNumber: number;
  documentCode: string;
  title: string;
  status: string;
  applicabilityStatus: string;
  nonApplicabilityReason?: string | null;
  category: string;
  includedInConsolidatedPdf: boolean;
  consolidatedPageRange?: {
    startPage: number;
    endPage: number;
  } | null;
  originalFile?: {
    fileName: string;
    sha256: string;
    sizeBytes: number;
    versionNumber: number;
    generatedAt: string;
    storageKey: string;
  } | null;
  signatures: DossierSignatureItem[];
  custodyEventsCount: number;
}

export interface DossierSourceDocumentItem {
  id: string;
  category: string;
  originalFilename: string;
  sha256: string;
  sizeBytes: number;
  uploadedAt: string;
  includedInPackage: boolean;
}

export interface DossierManifestFileItem {
  fileName: string;
  relativePath: string;
  fileType:
    | "ORIGINAL_PDF"
    | "INDEX_PDF"
    | "INDEX_JSON"
    | "CONSOLIDATED_PDF"
    | "EVIDENCE_ATTESTATIONS"
    | "CUSTODY_EVENTS"
    | "CUSTODY_REFERENCE"
    | "SOURCE_DOCUMENT"
    | "README";
  sha256: string;
  sizeBytes: number;
  documentCode?: string;
  positionNumber?: number;
  versionNumber?: number;
  status?: string;
}

export interface DossierManifest {
  manifestVersion: string;
  processId: string;
  processCode: string;
  donorId: string;
  donorRndCode?: string | null;
  primaryIpsName: string;
  generatedAt: string;
  generatedBy: {
    userId: string;
    fullName: string;
    email: string;
    role: string;
  };
  packageVersion?: string | null;
  systemVersion: string;
  summary: {
    totalPositions: number;
    normativePositions: number;
    applicableCount: number;
    releasedCount: number;
    signedCount: number;
    completedCount: number;
    nonApplicableCount: number;
    pendingHomologationCount: number;
    sourceDocumentsIncludedCount: number;
    hasConsolidatedPdf: boolean;
  };
  consolidatedPdf?: {
    fileName: string;
    sha256: string;
    sizeBytes: number;
    pageCount: number;
  } | null;
  documents: DossierDocumentItem[];
  sourceDocuments: DossierSourceDocumentItem[];
  files: DossierManifestFileItem[];
  manifestDigest?: string;
}

export interface HardenedVerificationItem {
  relativePath: string;
  fileName: string;
  itemType: string;
  expectedSha256: string;
  actualSha256: string;
  matches: boolean;
  status: "OK" | "ALTERED" | "MISSING" | "UNEXPECTED" | "MISMATCH" | "FILE_NOT_FOUND" | "ERROR";
  details?: string;
}

export interface HardenedVerificationReport {
  exportId: string;
  processCode: string;
  verifiedAt: string;
  verifiedBy: string;
  overallStatus: "INTEGRITY_VERIFIED" | "INTEGRITY_COMPROMISED" | "VERIFICATION_FAILED";
  expectedPackageSha256: string;
  actualPackageSha256: string;
  packageHashMatches: boolean;
  expectedManifestDigest: string;
  actualManifestDigest: string;
  manifestDigestMatches: boolean;
  totalFilesInspected: number;
  totalChecked: number;
  correctFilesCount: number;
  passedCount: number;
  alteredFilesCount: number;
  missingFilesCount: number;
  unexpectedFilesCount: number;
  failedCount: number;
  items: HardenedVerificationItem[];
}

/**
 * Serialización determinista y canónica de estructuras JSON (RFC 8785).
 * - Claves ordenadas recursivamente en orden alfabético.
 * - Arrays conservan su orden semántico establecido.
 * - Codificación UTF-8 normalizada.
 * - Permite excluir claves variables o autorreferenciales (ej. manifestDigest).
 */
export function canonicalJsonSerialize(
  obj: any,
  excludedKeys: Set<string> = new Set(),
): string {
  if (obj === null || obj === undefined) {
    return "null";
  }
  if (typeof obj === "number" || typeof obj === "boolean") {
    return JSON.stringify(obj);
  }
  if (typeof obj === "string") {
    return JSON.stringify(obj);
  }
  if (Array.isArray(obj)) {
    const items = obj.map((item) => canonicalJsonSerialize(item, excludedKeys));
    return `[${items.join(",")}]`;
  }
  if (typeof obj === "object") {
    const keys = Object.keys(obj)
      .filter((k) => !excludedKeys.has(k))
      .sort();
    const pairs = keys.map((key) => {
      const val = canonicalJsonSerialize(obj[key], excludedKeys);
      return `${JSON.stringify(key)}:${val}`;
    });
    return `{${pairs.join(",")}}`;
  }
  return JSON.stringify(obj);
}

/**
 * Calcula el digest criptográfico SHA-256 canónico del contenido del manifiesto.
 * Excluye explícitamente:
 * - 'manifestDigest': evita autorreferencia circular.
 * - 'manifestSha256': compatibilidad retroactiva.
 * - 'generatedAt': para verificar reproducibilidad de contenido si se requiere evaluación temporalmente invariante.
 */
export function computeCanonicalManifestDigest(
  manifest: any,
  excludeTimestamps = false,
): string {
  const excluded = new Set<string>(["manifestDigest", "manifestSha256"]);
  if (excludeTimestamps) {
    excluded.add("generatedAt");
  }
  const canonicalString = canonicalJsonSerialize(manifest, excluded);
  return createHash("sha256").update(Buffer.from(canonicalString, "utf-8")).digest("hex");
}
