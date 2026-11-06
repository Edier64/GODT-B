export type ProcessDocumentStatus =
  | "PENDIENTE"
  | "EN_DILIGENCIAMIENTO"
  | "EN_REVISION"
  | "BLOQUEADO"
  | "FIRMADO"
  | "COMPLETADO"
  | "NO_APLICA";

export type DocumentApplicability =
  | "APLICABLE"
  | "NO_APLICA"
  | "CONDICIONAL"
  | "PENDIENTE_CRITERIO";

export type DependencyRelationType =
  | "REQUIRED"
  | "OPTIONAL"
  | "CONDITIONAL"
  | "VARIANT"
  | "PARALLEL"
  | "VALIDATED_INPUT";

export interface PackagePositionDefinition {
  positionNumber: number;
  documentCode: string;
  title: string;
  category: string;
  isMandatory: boolean;
  orderIndex: number;
  defaultApplicability: DocumentApplicability;
  rules?: {
    relationType: DependencyRelationType;
    dependsOn?: string;
    condition?: {
      field: string;
      equals?: unknown;
      in?: unknown[];
    };
    component?: string;
    description?: string;
  };
  templateCode?: string;
}

export interface ProcessPackage {
  id: string;
  code: string;
  name: string;
  description?: string | null;
  isActive: boolean;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
  versions?: ProcessPackageVersion[];
}

export interface ProcessPackageVersion {
  id: string;
  packageId: string;
  versionNumber: string;
  status: "DRAFT" | "VALIDATED" | "PUBLISHED" | "RETIRED";
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  description?: string | null;
  definitionHash?: string | null;
  positionsConfig: PackagePositionDefinition[];
  createdById: string;
  authorizedById?: string | null;
  publishedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcessDocument {
  id: string;
  processId: string;
  positionNumber: number;
  documentCode: string;
  title: string;
  category: string;
  status: ProcessDocumentStatus;
  applicabilityStatus: DocumentApplicability;
  nonApplicabilityReason?: string | null;
  isMandatory: boolean;
  orderIndex: number;
  rules?: PackagePositionDefinition["rules"] | null;
  templateId?: string | null;
  templateVersionId?: string | null;
  currentInstanceId?: string | null;
  createdAt: Date;
  updatedAt: Date;
  template?: {
    id: string;
    templateCode: string;
    name: string;
    category: string;
  } | null;
  templateVersion?: {
    id: string;
    versionNumber: string;
    status: string;
  } | null;
  currentInstance?: {
    id: string;
    status: string;
    currentRevisionId?: string | null;
    createdAt: Date;
    updatedAt: Date;
  } | null;
  instances?: Array<{
    id: string;
    status: string;
    createdAt: Date;
    updatedAt: Date;
  }>;
}

export const OFFICIAL_REGIONAL_3_POSITIONS: ReadonlyArray<PackagePositionDefinition> = [
  {
    positionNumber: 1,
    documentCode: "ANEXO_1",
    title: "Anexo 1 — Formato de valoración y alerta de posible donante",
    category: "CLINICAL",
    isMandatory: true,
    orderIndex: 1,
    defaultApplicability: "APLICABLE",
    rules: { relationType: "PARALLEL" },
  },
  {
    positionNumber: 2,
    documentCode: "ANEXO_2",
    title: "Anexo 2 — Notificación a deudos / Legalización por presunción legal",
    category: "LEGAL",
    isMandatory: false,
    orderIndex: 2,
    defaultApplicability: "CONDICIONAL",
    rules: {
      relationType: "CONDITIONAL",
      condition: { field: "legalization.mechanism", equals: "PRESUNCION_LEGAL" },
      description: "Aplica cuando la donación se legaliza por presunción legal",
    },
  },
  {
    positionNumber: 3,
    documentCode: "ANEXO_3",
    title: "Anexo 3 — Consentimiento informado de donación / Legalización familiar",
    category: "LEGAL",
    isMandatory: false,
    orderIndex: 3,
    defaultApplicability: "CONDICIONAL",
    rules: {
      relationType: "CONDITIONAL",
      condition: { field: "legalization.mechanism", equals: "CONSENTIMIENTO_FAMILIAR" },
      description: "Aplica cuando la donación se legaliza por consentimiento de deudos",
    },
  },
  {
    positionNumber: 4,
    documentCode: "ANEXO_4",
    title: "Anexo 4 — Registro de donante y oferta de órganos y tejidos",
    category: "CLINICAL",
    isMandatory: true,
    orderIndex: 4,
    defaultApplicability: "APLICABLE",
    rules: { relationType: "REQUIRED", dependsOn: "ANEXO_1" },
  },
  {
    positionNumber: 5,
    documentCode: "ANEXO_5",
    title: "Anexo 5 — Formato de remisión de muestras para laboratorio e inmunogenética",
    category: "CLINICAL",
    isMandatory: true,
    orderIndex: 5,
    defaultApplicability: "APLICABLE",
    rules: { relationType: "PARALLEL" },
  },
  {
    positionNumber: 6,
    documentCode: "ANEXO_6",
    title: "Anexo 6 — Registro general de extracción de órganos y tejidos",
    category: "SURGERY",
    isMandatory: true,
    orderIndex: 6,
    defaultApplicability: "APLICABLE",
    rules: { relationType: "REQUIRED", dependsOn: "ANEXO_4" },
    templateCode: "anexo-6-extraccion-componentes-v0",
  },
  {
    positionNumber: 7,
    documentCode: "ANEXO_7_OCULAR",
    title: "Anexo 7 — Acta de rescate de tejido ocular",
    category: "TISSUE",
    isMandatory: false,
    orderIndex: 7,
    defaultApplicability: "CONDICIONAL",
    rules: { relationType: "VARIANT", component: "OCULAR" },
  },
  {
    positionNumber: 8,
    documentCode: "ANEXO_7_CARDIOVASCULAR",
    title: "Anexo 7 — Acta de rescate de tejido cardiovascular",
    category: "TISSUE",
    isMandatory: false,
    orderIndex: 8,
    defaultApplicability: "CONDICIONAL",
    rules: { relationType: "VARIANT", component: "CARDIOVASCULAR" },
  },
  {
    positionNumber: 9,
    documentCode: "ANEXO_7_OSTEOMUSCULAR",
    title: "Anexo 7 — Acta de rescate de tejido osteomuscular",
    category: "TISSUE",
    isMandatory: false,
    orderIndex: 9,
    defaultApplicability: "CONDICIONAL",
    rules: { relationType: "VARIANT", component: "OSTEOMUSCULAR" },
  },
  {
    positionNumber: 10,
    documentCode: "ANEXO_7_PIEL",
    title: "Anexo 7 — Acta de rescate de tejido piel",
    category: "TISSUE",
    isMandatory: false,
    orderIndex: 10,
    defaultApplicability: "CONDICIONAL",
    rules: { relationType: "VARIANT", component: "PIEL" },
  },
  {
    positionNumber: 11,
    documentCode: "ANEXO_7_CORAZON",
    title: "Anexo 7 — Ficha de extracción de corazón (Cardiectomía)",
    category: "ORGAN",
    isMandatory: false,
    orderIndex: 11,
    defaultApplicability: "CONDICIONAL",
    rules: { relationType: "VARIANT", component: "HEART" },
  },
  {
    positionNumber: 12,
    documentCode: "ANEXO_7_HIGADO",
    title: "Anexo 7 — Ficha de extracción de hígado (Hepatectomía)",
    category: "ORGAN",
    isMandatory: false,
    orderIndex: 12,
    defaultApplicability: "CONDICIONAL",
    rules: { relationType: "VARIANT", component: "LIVER" },
  },
  {
    positionNumber: 13,
    documentCode: "ANEXO_7_OTROS_ORGANOS",
    title: "Anexo 7 — Ficha de extracción de otros órganos",
    category: "ORGAN",
    isMandatory: false,
    orderIndex: 13,
    defaultApplicability: "CONDICIONAL",
    rules: { relationType: "VARIANT", component: "OTHER" },
  },
  {
    positionNumber: 14,
    documentCode: "ANEXO_7_PANCREAS",
    title: "Anexo 7 — Ficha de extracción de páncreas",
    category: "ORGAN",
    isMandatory: false,
    orderIndex: 14,
    defaultApplicability: "CONDICIONAL",
    rules: { relationType: "VARIANT", component: "PANCREAS" },
  },
  {
    positionNumber: 15,
    documentCode: "ANEXO_7_PULMON",
    title: "Anexo 7 — Ficha de extracción de pulmón (Neumonectomía)",
    category: "ORGAN",
    isMandatory: false,
    orderIndex: 15,
    defaultApplicability: "CONDICIONAL",
    rules: { relationType: "VARIANT", component: "LUNG" },
  },
  {
    positionNumber: 16,
    documentCode: "ANEXO_7_RINON_DERECHO",
    title: "Anexo 7 — Ficha de extracción riñón derecho (Nefrectomía)",
    category: "ORGAN",
    isMandatory: false,
    orderIndex: 16,
    defaultApplicability: "CONDICIONAL",
    rules: { relationType: "VARIANT", component: "RIGHT_KIDNEY" },
  },
  {
    positionNumber: 17,
    documentCode: "ANEXO_7_RINON_IZQUIERDO",
    title: "Anexo 7 — Ficha de extracción riñón izquierdo (Nefrectomía)",
    category: "ORGAN",
    isMandatory: false,
    orderIndex: 17,
    defaultApplicability: "CONDICIONAL",
    rules: { relationType: "VARIANT", component: "LEFT_KIDNEY" },
  },
  {
    positionNumber: 18,
    documentCode: "ANEXO_8",
    title: "Anexo 8 — Formato cadena de custodia EMP y evidencias",
    category: "CUSTODY",
    isMandatory: true,
    orderIndex: 18,
    defaultApplicability: "APLICABLE",
    rules: { relationType: "PARALLEL" },
  },
  {
    positionNumber: 19,
    documentCode: "ANEXO_9",
    title: "Anexo 9 — Carta de entrega de cuerpo a INMLCF",
    category: "LEGAL",
    isMandatory: false,
    orderIndex: 19,
    defaultApplicability: "CONDICIONAL",
    rules: {
      relationType: "CONDITIONAL",
      condition: { field: "donor.causeOfDeathMedicolegal", equals: true },
      description: "Aplica únicamente para fallecimientos con implicación médico-legal",
    },
  },
  {
    positionNumber: 20,
    documentCode: "POS_NORMATIVA_20",
    title: "Posición Normativa 20 — [Pendiente de homologación institucional]",
    category: "PENDING_HOMOLOGATION",
    isMandatory: false,
    orderIndex: 20,
    defaultApplicability: "CONDICIONAL",
    rules: { relationType: "OPTIONAL" },
  },
  {
    positionNumber: 21,
    documentCode: "POS_NORMATIVA_21",
    title: "Posición Normativa 21 — [Pendiente de homologación institucional]",
    category: "PENDING_HOMOLOGATION",
    isMandatory: false,
    orderIndex: 21,
    defaultApplicability: "CONDICIONAL",
    rules: { relationType: "OPTIONAL" },
  },
  {
    positionNumber: 22,
    documentCode: "POS_NORMATIVA_22",
    title: "Posición Normativa 22 — [Pendiente de homologación institucional]",
    category: "PENDING_HOMOLOGATION",
    orderIndex: 22,
    isMandatory: false,
    defaultApplicability: "CONDICIONAL",
    rules: { relationType: "OPTIONAL" },
  },
  {
    positionNumber: 23,
    documentCode: "POS_NORMATIVA_23",
    title: "Posición Normativa 23 — [Pendiente de homologación institucional]",
    category: "PENDING_HOMOLOGATION",
    orderIndex: 23,
    isMandatory: false,
    defaultApplicability: "CONDICIONAL",
    rules: { relationType: "OPTIONAL" },
  },
];

export class ProcessPackageNotFoundError extends Error {
  constructor(message = "Paquete documental no encontrado") {
    super(message);
    this.name = "ProcessPackageNotFoundError";
  }
}

export class ProcessPackageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProcessPackageValidationError";
  }
}

export class ProcessDocumentNotFoundError extends Error {
  constructor(message = "Posición documental no encontrada") {
    super(message);
    this.name = "ProcessDocumentNotFoundError";
  }
}

export class ProcessDocumentConflictError extends Error {
  constructor(message = "Conflicto en la posición documental") {
    super(message);
    this.name = "ProcessDocumentConflictError";
  }
}

