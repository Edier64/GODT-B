import { Inject, Injectable } from "@nestjs/common";
import {
  CreateDonorRecordInput,
  DonorRecord,
} from "../../domain/donors/donor-record";
import {
  DONOR_RECORD_REPOSITORY,
  DonorRecordRepository,
} from "./donor-record.repository";
import { AuditEventPort, AUDIT_EVENT_PORT } from "../audit/audit-event.port";

@Injectable()
export class CreateDonorUseCase {
  constructor(
    @Inject(DONOR_RECORD_REPOSITORY)
    private readonly repository: DonorRecordRepository,
    @Inject(AUDIT_EVENT_PORT)
    private readonly audit: AuditEventPort,
  ) {}

  execute(
    input: CreateDonorRecordInput,
    actorUserId: string,
  ): Promise<DonorRecord> {
    return this.repository
      .create(
        {
          ...input,
          rndCode: input.rndCode.trim(),
          originatingIpsName: input.originatingIpsName.trim(),
          clinicalService: input.clinicalService.trim(),
        },
        actorUserId,
      )
      .then(async (donor) => {
        await this.audit.record({
          actorUserId,
          action: "DONOR_CREATED",
          entityType: "DONOR_RECORD",
          entityId: donor.id,
          correlationId: donor.id,
          metadata: { source: "donor-create" },
        });
        return donor;
      });
  }
}
