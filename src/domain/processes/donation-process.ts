export type DonationProcessStatus =
  | "EN_VALORACION"
  | "EN_CURSO"
  | "COMPLETADO"
  | "CANCELADO"
  | "SUSPENDIDO";

export type ProcessInstitutionRole =
  | "IPS_GENERADORA"
  | "IPS_EXTRACTORA"
  | "BANCO_TEJIDOS"
  | "IPS_TRASPLANTADORA"
  | "INMLCF"
  | "COORDINACION_REGIONAL"
  | "OTRO";

export type ProcessParticipantRole =
  | "COORDINADOR_OPERATIVO"
  | "MEDICO_CERTIFICADOR"
  | "MEDICO_TRATANTE"
  | "CIRUJANO_RESCATE"
  | "TECNICO_TEJIDOS"
  | "DEUDO_NOTIFICADO"
  | "REPRESENTANTE_LEGAL"
  | "TESTIGO"
  | "CUSTODIO"
  | "OTRO";

export interface ProcessInstitution {
  id: string;
  processId: string;
  institutionName: string;
  role: ProcessInstitutionRole;
  notes?: string | null;
  assignedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProcessParticipant {
  id: string;
  processId: string;
  fullName: string;
  documentType?: string | null;
  documentNumber?: string | null;
  role: ProcessParticipantRole;
  professionalId?: string | null;
  institution?: string | null;
  relationshipToDonor?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  systemUserId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface DonationProcess {
  id: string;
  processCode: string;
  donorId: string;
  packageVersionId?: string | null;
  status: DonationProcessStatus;
  primaryIpsName: string;
  openedById: string;
  closedById?: string | null;
  openedAt: Date;
  closedAt?: Date | null;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
  institutions?: ProcessInstitution[];
  participants?: ProcessParticipant[];
  donor?: {
    id: string;
    rndCode: string;
    fullName: string;
    documentNumber: string;
    originatingIpsName: string;
    status: string;
  };
}

export interface CreateDonationProcessInput {
  donorId: string;
  primaryIpsName: string;
  processCode?: string;
  packageVersionId?: string;
  notes?: string;
  institutions?: Array<{
    institutionName: string;
    role: ProcessInstitutionRole;
    notes?: string;
  }>;
  participants?: Array<{
    fullName: string;
    role: ProcessParticipantRole;
    documentType?: string;
    documentNumber?: string;
    professionalId?: string;
    institution?: string;
    relationshipToDonor?: string;
    phone?: string;
    email?: string;
    notes?: string;
    systemUserId?: string;
  }>;
}

export interface UpdateDonationProcessInput {
  status?: DonationProcessStatus;
  primaryIpsName?: string;
  notes?: string;
  closedAt?: Date;
  closedById?: string;
}

export interface AddProcessInstitutionInput {
  institutionName: string;
  role: ProcessInstitutionRole;
  notes?: string;
}

export interface AddProcessParticipantInput {
  fullName: string;
  role: ProcessParticipantRole;
  documentType?: string;
  documentNumber?: string;
  professionalId?: string;
  institution?: string;
  relationshipToDonor?: string;
  phone?: string;
  email?: string;
  notes?: string;
  systemUserId?: string;
}

export class DonationProcessNotFoundError extends Error {
  constructor(message = "Proceso de donación no encontrado") {
    super(message);
    this.name = "DonationProcessNotFoundError";
  }
}

export class DonationProcessValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DonationProcessValidationError";
  }
}

export class DonationProcessAccessDeniedError extends Error {
  constructor(message = "Acceso denegado al proceso de donación") {
    super(message);
    this.name = "DonationProcessAccessDeniedError";
  }
}

export class DonationProcessConflictError extends Error {
  constructor(message = "Conflicto en el proceso de donación") {
    super(message);
    this.name = "DonationProcessConflictError";
  }
}

