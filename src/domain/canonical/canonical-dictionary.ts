export type CanonicalDataType =
  | "string"
  | "number"
  | "boolean"
  | "date-time"
  | "object"
  | "array";

export type CanonicalScope = "DONOR" | "PROCESS" | "DOCUMENT";

export type CanonicalCardinality = "SINGLE" | "REPEATABLE";

export type CanonicalSharingPolicy =
  | "SHARED"
  | "COPY_ONCE"
  | "LOCAL"
  | "READONLY_DERIVED";

export type CanonicalSourceKind =
  | "MANUAL"
  | "DONOR_RECORD"
  | "PROCESS_CANONICAL"
  | "OCR_CONFIRMED"
  | "OCR_MODIFIED"
  | "CALCULATED"
  | "DOCUMENT_LOCAL";

export type ConflictResolutionStrategy =
  | "ACCEPT_CANDIDATE"
  | "KEEP_CURRENT"
  | "MANUAL_OVERRIDE";

export interface CanonicalFieldDefinition {
  id: string;
  canonicalFieldKey: string;
  displayName: string;
  description?: string | null;
  dataType: CanonicalDataType;
  unit?: string | null;
  scope: CanonicalScope;
  cardinality: CanonicalCardinality;
  sharingPolicy: CanonicalSharingPolicy;
  allowedSources: CanonicalSourceKind[];
  writable: boolean;
  validationRules?: Record<string, unknown> | null;
  status: "ACTIVE" | "DEPRECATED" | "DRAFT";
  version: number;
  createdById?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProcessCanonicalValue {
  id: string;
  processId: string;
  canonicalFieldKey: string;
  currentValue: unknown;
  unit?: string | null;
  effectiveAt: Date;
  sampleContext?: string | null;
  sourceKind: CanonicalSourceKind;
  sourceInstanceId?: string | null;
  sourceRevisionId?: string | null;
  versionNumber: number;
  conflictStatus: "NONE" | "CONFLICT_DETECTED" | "RESOLVED";
  conflictDetails?: Record<string, unknown> | null;
  updatedById: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface ProcessCanonicalHistory {
  id: string;
  processId: string;
  canonicalFieldKey: string;
  value: unknown;
  unit?: string | null;
  effectiveAt: Date;
  sampleContext?: string | null;
  sourceKind: CanonicalSourceKind;
  sourceInstanceId?: string | null;
  sourceRevisionId?: string | null;
  sourceDocumentId?: string | null;
  versionNumber: number;
  createdById: string;
  createdAt: Date;
}

export type RepeatableSelectionStrategy =
  | "MANUAL_SELECTION"
  | "SAMPLE_CONTEXT_MATCH"
  | "TIME_WINDOW"
  | "DETERMINISTIC_RULE";

export interface CanonicalFieldMapping {
  schemaPath: string; // JSON path in form schema (e.g. "patient.fullName" or "$.patient.fullName")
  canonicalFieldKey: string;
  scope: CanonicalScope;
  bindingPolicy: CanonicalSharingPolicy;
  dataType: CanonicalDataType;
  unit?: string;
  readOnly?: boolean;
  allowedSources?: CanonicalSourceKind[];
  cardinality?: CanonicalCardinality;
  repeatableSelectionStrategy?: RepeatableSelectionStrategy;
  sampleContextFilter?: string; // e.g. "GASOMETRIA_BASAL", "UCI_INGRESO"
  timeWindowHours?: number;
  deterministicRule?: "BASELINE" | "PRE_OP" | "POST_CLAMP" | "FINAL";
  requiresHumanSelection?: boolean;
  homologationStatus?: "VALIDATED" | "PENDING_HOMOLOGATION";
  transform?: {
    type: "UPPERCASE" | "LOWERCASE" | "ROUND" | "BOOLEAN_INVERT";
    params?: Record<string, unknown>;
  };
}

export interface CanonicalObservation {
  id: string;
  processId: string;
  canonicalFieldKey: string;
  value: unknown;
  unit?: string | null;
  effectiveAt: Date;
  sampleContext?: string | null;
  sourceKind: CanonicalSourceKind;
  sourceInstanceId?: string | null;
  sourceRevisionId?: string | null;
  sourceDocumentId?: string | null;
  versionNumber: number;
  createdById: string;
  createdAt: Date;
}

export interface PropagationResult {
  canonicalFieldKey: string;
  currentValue: unknown;
  scope: CanonicalScope;
  sharingPolicy: CanonicalSharingPolicy;
  versionNumber: number;
  propagatedCount: number;
  propagatedInstances: Array<{
    instanceId: string;
    documentCode: string;
    fieldPath: string;
    status: "UPDATED" | "CONFLICT" | "SKIPPED_LOCKED";
  }>;
  conflicts: Array<{
    instanceId: string;
    documentCode: string;
    fieldPath: string;
    existingValue: unknown;
    proposedValue: unknown;
  }>;
}

export const HOMOLOGATED_CANONICAL_FIELDS: ReadonlyArray<
  Omit<CanonicalFieldDefinition, "id" | "createdAt" | "updatedAt">
> = [
  {
    canonicalFieldKey: "donor.identity.full_name",
    displayName: "Nombre Completo del Donante",
    description: "Nombres y apellidos completos del donante identificados o certificados",
    dataType: "string",
    scope: "DONOR",
    cardinality: "SINGLE",
    sharingPolicy: "SHARED",
    allowedSources: ["MANUAL", "DONOR_RECORD", "OCR_CONFIRMED"],
    writable: true,
    status: "ACTIVE",
    version: 1,
  },
  {
    canonicalFieldKey: "donor.identity.document_number",
    displayName: "Número de Documento de Identidad",
    description: "Número de identificación ciudadana o documento legal del donante",
    dataType: "string",
    scope: "DONOR",
    cardinality: "SINGLE",
    sharingPolicy: "SHARED",
    allowedSources: ["MANUAL", "DONOR_RECORD", "OCR_CONFIRMED"],
    writable: true,
    status: "ACTIVE",
    version: 1,
  },
  {
    canonicalFieldKey: "donor.identity.document_type",
    displayName: "Tipo de Documento",
    description: "Tipo de documento legal (CC, CE, TI, PASAPORTE, MS)",
    dataType: "string",
    scope: "DONOR",
    cardinality: "SINGLE",
    sharingPolicy: "SHARED",
    allowedSources: ["MANUAL", "DONOR_RECORD", "OCR_CONFIRMED"],
    writable: true,
    status: "ACTIVE",
    version: 1,
  },
  {
    canonicalFieldKey: "donor.identity.birth_date",
    displayName: "Fecha de Nacimiento",
    description: "Fecha de nacimiento registrada del donante",
    dataType: "date-time",
    scope: "DONOR",
    cardinality: "SINGLE",
    sharingPolicy: "SHARED",
    allowedSources: ["MANUAL", "DONOR_RECORD", "OCR_CONFIRMED"],
    writable: true,
    status: "ACTIVE",
    version: 1,
  },
  {
    canonicalFieldKey: "donor.demographics.sex",
    displayName: "Sexo Biológico",
    description: "Sexo biológico del donante (MASCULINO, FEMENINO, INDETERMINADO)",
    dataType: "string",
    scope: "DONOR",
    cardinality: "SINGLE",
    sharingPolicy: "SHARED",
    allowedSources: ["MANUAL", "DONOR_RECORD", "OCR_CONFIRMED"],
    writable: true,
    status: "ACTIVE",
    version: 1,
  },
  {
    canonicalFieldKey: "donor.demographics.age",
    displayName: "Edad en Años",
    description: "Edad cronológica del donante al momento de la valoración",
    dataType: "number",
    unit: "años",
    scope: "DONOR",
    cardinality: "SINGLE",
    sharingPolicy: "SHARED",
    allowedSources: ["MANUAL", "DONOR_RECORD", "CALCULATED", "OCR_CONFIRMED"],
    writable: true,
    status: "ACTIVE",
    version: 1,
  },
  {
    canonicalFieldKey: "donor.registration.rnd_code",
    displayName: "Código Nacional RND",
    description: "Código oficial de consulta y radicación en la Red Nacional de Donación",
    dataType: "string",
    scope: "DONOR",
    cardinality: "SINGLE",
    sharingPolicy: "READONLY_DERIVED",
    allowedSources: ["DONOR_RECORD", "MANUAL"],
    writable: false,
    status: "ACTIVE",
    version: 1,
  },
  {
    canonicalFieldKey: "donor.clinical.blood_group",
    displayName: "Grupo Sanguíneo (ABO)",
    description: "Grupo sanguíneo del donante (O, A, B, AB)",
    dataType: "string",
    scope: "DONOR",
    cardinality: "SINGLE",
    sharingPolicy: "SHARED",
    allowedSources: ["MANUAL", "DONOR_RECORD", "OCR_CONFIRMED"],
    writable: true,
    status: "ACTIVE",
    version: 1,
  },
  {
    canonicalFieldKey: "donor.clinical.rh_factor",
    displayName: "Factor Rh",
    description: "Factor Rh del donante (POSITIVO, NEGATIVO)",
    dataType: "string",
    scope: "DONOR",
    cardinality: "SINGLE",
    sharingPolicy: "SHARED",
    allowedSources: ["MANUAL", "DONOR_RECORD", "OCR_CONFIRMED"],
    writable: true,
    status: "ACTIVE",
    version: 1,
  },
  {
    canonicalFieldKey: "donor.institution.originating_ips",
    displayName: "IPS Generadora / Remitente",
    description: "Institución prestadora de salud donde se identifica o genera el donante",
    dataType: "string",
    scope: "PROCESS",
    cardinality: "SINGLE",
    sharingPolicy: "SHARED",
    allowedSources: ["MANUAL", "DONOR_RECORD", "PROCESS_CANONICAL"],
    writable: true,
    status: "ACTIVE",
    version: 1,
  },
  {
    canonicalFieldKey: "donor.clinical.clinical_service",
    displayName: "Servicio Clínico de Origen",
    description: "Servicio hospitalario de estancia (UCI Adultos, Urgencias, etc.)",
    dataType: "string",
    scope: "PROCESS",
    cardinality: "SINGLE",
    sharingPolicy: "SHARED",
    allowedSources: ["MANUAL", "PROCESS_CANONICAL"],
    writable: true,
    status: "ACTIVE",
    version: 1,
  },
  {
    canonicalFieldKey: "donor.clinical.cause_of_death",
    displayName: "Causa de Muerte Encefálica",
    description: "Diagnóstico médico o causa lesional de la muerte encefálica",
    dataType: "string",
    scope: "PROCESS",
    cardinality: "SINGLE",
    sharingPolicy: "SHARED",
    allowedSources: ["MANUAL", "PROCESS_CANONICAL", "OCR_CONFIRMED"],
    writable: true,
    status: "ACTIVE",
    version: 1,
  },
  {
    canonicalFieldKey: "donor.clinical.arterial_ph",
    displayName: "pH Arterial",
    description: "Medición gasométrica seriada de pH arterial del donante",
    dataType: "number",
    unit: "pH",
    scope: "PROCESS",
    cardinality: "REPEATABLE",
    sharingPolicy: "SHARED",
    allowedSources: ["MANUAL", "PROCESS_CANONICAL", "OCR_CONFIRMED"],
    writable: true,
    status: "ACTIVE",
    version: 1,
  },
  {
    canonicalFieldKey: "donor.clinical.creatinine",
    displayName: "Creatinina Sérica",
    description: "Resultado de creatinina sérica seriada del donante",
    dataType: "number",
    unit: "mg/dL",
    scope: "PROCESS",
    cardinality: "REPEATABLE",
    sharingPolicy: "SHARED",
    allowedSources: ["MANUAL", "PROCESS_CANONICAL", "OCR_CONFIRMED"],
    writable: true,
    status: "ACTIVE",
    version: 1,
  },
  {
    canonicalFieldKey: "process.recovery.aortic_clamp_at",
    displayName: "Fecha y Hora de Clampeo Aórtico",
    description: "Momento quirúrgico exacto del clampeo aórtico (inicio de isquemia fría)",
    dataType: "date-time",
    scope: "PROCESS",
    cardinality: "SINGLE",
    sharingPolicy: "SHARED",
    allowedSources: ["MANUAL", "PROCESS_CANONICAL"],
    writable: true,
    status: "ACTIVE",
    version: 1,
  },
  {
    canonicalFieldKey: "process.recovery.cardiac_arrest_at",
    displayName: "Fecha y Hora de Paro Cardíaco",
    description: "Momento quirúrgico exacto del paro cardíaco (inicio de isquemia caliente)",
    dataType: "date-time",
    scope: "PROCESS",
    cardinality: "SINGLE",
    sharingPolicy: "SHARED",
    allowedSources: ["MANUAL", "PROCESS_CANONICAL"],
    writable: true,
    status: "ACTIVE",
    version: 1,
  },
];

export class CanonicalFieldNotFoundError extends Error {
  constructor(message = "Marcador canónico no encontrado") {
    super(message);
    this.name = "CanonicalFieldNotFoundError";
  }
}

export class CanonicalValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CanonicalValidationError";
  }
}

export class CanonicalConflictError extends Error {
  constructor(message = "Conflicto detectado en valor canónico compartido") {
    super(message);
    this.name = "CanonicalConflictError";
  }
}

export class CanonicalConcurrencyError extends Error {
  constructor(message = "Conflicto de concurrencia: el valor canónico fue modificado simultáneamente") {
    super(message);
    this.name = "CanonicalConcurrencyError";
  }
}

