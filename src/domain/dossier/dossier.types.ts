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
  attestationId?: string;
  participantId?: string;
  documentInstanceId?: string;
  versionNumber?: number;
  signerRole: string;
  signerName: string;
  signerDocument?: string | null;
  signatureType: string;
  signedAt?: string | null;
  documentPdfSha256: string;
  signatureEvidenceSha256: string | null;
  attestationDigest: string;
  attestationDeclaration?: string;
  snapshotSha256?: string | null;
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
  donorDocumentMasked?: string | null;
  donorFullNameMasked?: string | null;
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
 * Validador de conformidad Unicode (RFC 8785 Sección 3.2.2.2).
 * Detecta y rechaza surrogates huérfanos (lone surrogates U+D800 a U+DFFF sin pareja válida).
 */
export function containsLoneSurrogate(str: string): boolean {
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      if (i + 1 < str.length) {
        const next = str.charCodeAt(i + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          i++; // Pareja surrogate válida (ej. emoji astral)
          continue;
        }
      }
      return true; // High surrogate sin pareja posterior
    }
    if (code >= 0xdc00 && code <= 0xdfff) {
      return true; // Low surrogate sin pareja previa
    }
  }
  return false;
}

/**
 * Serialización determinista y canónica de estructuras JSON conforme a RFC 8785 (JCS).
 * - Claves ordenadas recursivamente por unidades de código UTF-16 (Sección 3.2.3).
 * - Arrays conservan su orden semántico establecido.
 * - Rechaza valores NaN e Infinity conforme a restricciones I-JSON (Sección 3.2.2.3).
 * - Rechaza Unicode inválido y surrogates huérfanos (Sección 3.2.2.2).
 * - Normaliza cero negativo (-0) a "0".
 * - Serialización exacta de números según reglas ECMAScript 7.1.12.1.
 * - Codificación UTF-8 y escapes estrictos de cadenas (comillas, barra invertida y caracteres de control U+0000 a U+001F en minúsculas).
 * - Permite excluir claves variables o autorreferenciales (ej. manifestDigest).
 */
export function canonicalJsonSerialize(
  obj: any,
  excludedKeys: Set<string> = new Set(),
): string {
  if (obj === null || obj === undefined) {
    return "null";
  }
  if (typeof obj === "number") {
    if (Number.isNaN(obj) || !Number.isFinite(obj)) {
      throw new TypeError("RFC 8785: NaN e Infinity no son permitidos en JSON canónico");
    }
    if (Object.is(obj, -0)) {
      return "0";
    }
    return JSON.stringify(obj);
  }
  if (typeof obj === "boolean") {
    return obj ? "true" : "false";
  }
  if (typeof obj === "string") {
    if (containsLoneSurrogate(obj)) {
      throw new TypeError("RFC 8785: Lone surrogate code point detected: invalid Unicode");
    }
    return JSON.stringify(obj);
  }
  if (typeof obj === "bigint") {
    return obj.toString();
  }
  if (typeof obj === "symbol" || typeof obj === "function") {
    return "null";
  }
  if (Array.isArray(obj)) {
    const items = obj.map((item) =>
      canonicalJsonSerialize(item === undefined ? null : item, excludedKeys),
    );
    return `[${items.join(",")}]`;
  }
  if (typeof obj === "object") {
    // Si el objeto tiene método toJSON (ej. Date), invocarlo primero
    if (typeof obj.toJSON === "function") {
      return canonicalJsonSerialize(obj.toJSON(), excludedKeys);
    }
    const keys = Object.keys(obj)
      .filter((k) => !excludedKeys.has(k) && obj[k] !== undefined)
      .sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    
    for (const key of keys) {
      if (containsLoneSurrogate(key)) {
        throw new TypeError("RFC 8785: Lone surrogate in property name: invalid Unicode");
      }
    }

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
