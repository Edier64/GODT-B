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

export interface DossierSignatureItem {
  signerRole: string;
  signerName: string;
  signerDocument?: string | null;
  signatureType: string;
  signedAt?: string | null;
  snapshotSha256: string;
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
  };
  consolidatedPdf?: {
    fileName: string;
    sha256: string;
    sizeBytes: number;
    pageCount: number;
  } | null;
  zipPackage?: {
    fileName: string;
    sha256: string;
    sizeBytes: number;
  } | null;
  documents: DossierDocumentItem[];
  sourceDocuments: DossierSourceDocumentItem[];
  manifestSha256?: string;
}
