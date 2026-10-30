import { Inject, Injectable } from "@nestjs/common";
import { DonorAccessDeniedError, DonorNotFoundError } from "./donor-errors";
import {
  DONOR_RECORD_REPOSITORY,
  DonorRecordRepository,
} from "./donor-record.repository";
import { DonorActor } from "./get-donor.use-case";
import { UpdateDonorRecordInput } from "../../domain/donors/donor-record";

@Injectable()
export class UpdateDonorUseCase {
  constructor(
    @Inject(DONOR_RECORD_REPOSITORY)
    private readonly repository: DonorRecordRepository,
  ) {}

  async execute(id: string, input: UpdateDonorRecordInput, actor: DonorActor) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new DonorNotFoundError(id);
    }
    if (
      actor.role !== "ADMIN" &&
      (!actor.institutionalIps ||
        !actor.institutionalIps.includes(existing.originatingIpsName))
    ) {
      throw new DonorAccessDeniedError();
    }
    return this.repository.updateWithAudit(id, input, {
      actorUserId: actor.userId,
      action: "DONOR_UPDATED",
      entityType: "DONOR_RECORD",
      entityId: id,
      correlationId: id,
      metadata: { changedFields: Object.keys(input) },
    });
  }
}
