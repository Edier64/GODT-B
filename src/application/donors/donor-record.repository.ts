import {
  CreateDonorRecordInput,
  DonorRecord,
  DonorRecordStatus,
  UpdateDonorRecordInput,
} from "../../domain/donors/donor-record";
import { AuditEventInput } from "../audit/audit-event.port";

export interface DonorRecordRepository {
  create(
    input: CreateDonorRecordInput,
    createdById: string,
  ): Promise<DonorRecord>;
  findById(id: string): Promise<DonorRecord | null>;
  findMany(input: {
    status?: DonorRecordStatus;
    rndCode?: string;
    createdById?: string;
    institutionalIps?: string[];
    page: number;
    pageSize: number;
  }): Promise<{ items: DonorRecord[]; total: number }>;
  update(id: string, input: UpdateDonorRecordInput): Promise<DonorRecord>;
  updateWithAudit(
    id: string,
    input: UpdateDonorRecordInput,
    audit: AuditEventInput,
  ): Promise<DonorRecord>;
  delete?(id: string): Promise<void>;
}

export const DONOR_RECORD_REPOSITORY = Symbol("DONOR_RECORD_REPOSITORY");
