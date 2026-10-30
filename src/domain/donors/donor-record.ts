export type DonorRecordStatus = "EN_VALORACION" | "ACTIVO" | "CERRADO";

export interface DonorRecord {
  id: string;
  rndCode: string;
  status: DonorRecordStatus;
  originatingIpsName: string;
  clinicalService: string;
  fullName: string;
  documentNumber: string;
  anthropometry: Record<string, unknown> | null;
  bloodGroup: string | null;
  rhFactor: string | null;
  clinicalData: Record<string, unknown> | null;
  createdById: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDonorRecordInput {
  rndCode: string;
  originatingIpsName: string;
  clinicalService: string;
  fullName: string;
  documentNumber: string;
  status?: DonorRecordStatus;
  anthropometry?: Record<string, unknown>;
  bloodGroup?: string;
  rhFactor?: string;
}

export interface UpdateDonorRecordInput {
  originatingIpsName?: string;
  clinicalService?: string;
  fullName?: string;
  documentNumber?: string;
  status?: DonorRecordStatus;
  anthropometry?: Record<string, unknown>;
  bloodGroup?: string;
  rhFactor?: string;
}
