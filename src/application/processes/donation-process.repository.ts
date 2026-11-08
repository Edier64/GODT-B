import {
  AddProcessInstitutionInput,
  AddProcessParticipantInput,
  CreateDonationProcessInput,
  DonationProcess,
  DonationProcessStatus,
  ProcessInstitution,
  ProcessParticipant,
  UpdateDonationProcessInput,
} from "../../domain/processes/donation-process";
import { CreateDonorRecordInput } from "../../domain/donors/donor-record";
import { PackagePositionDefinition } from "../../domain/packages/process-package";

export interface CreateProcessTransactionalInput {
  processInput: CreateDonationProcessInput;
  provisionalDonorInput?: CreateDonorRecordInput;
  donorId?: string;
  openedById: string;
  processCode: string;
  packageVersionId?: string;
  positions: PackagePositionDefinition[];
  auditEvents: Array<{
    actorUserId: string;
    action: string;
    entityType: string;
    correlationId: string;
    metadata?: Record<string, unknown>;
  }>;
}

export interface DonationProcessRepository {
  create(
    input: CreateDonationProcessInput & { donorId: string },
    openedById: string,
    processCode: string,
  ): Promise<DonationProcess>;

  createTransactional?(
    input: CreateProcessTransactionalInput,
  ): Promise<DonationProcess>;

  findById(id: string): Promise<DonationProcess | null>;

  findByCode(processCode: string): Promise<DonationProcess | null>;

  findMany(query: {
    status?: DonationProcessStatus;
    donorId?: string;
    primaryIpsName?: string;
    institutionalIps?: string[];
    page: number;
    pageSize: number;
  }): Promise<{ items: DonationProcess[]; total: number }>;

  update(id: string, input: UpdateDonationProcessInput): Promise<DonationProcess>;

  addInstitution(
    processId: string,
    input: AddProcessInstitutionInput,
  ): Promise<ProcessInstitution>;

  removeInstitution(processId: string, institutionId: string): Promise<void>;

  addParticipant(
    processId: string,
    input: AddProcessParticipantInput,
  ): Promise<ProcessParticipant>;

  removeParticipant(processId: string, participantId: string): Promise<void>;

  countByYear(year: number): Promise<number>;
}

export const DONATION_PROCESS_REPOSITORY = Symbol("DONATION_PROCESS_REPOSITORY");

