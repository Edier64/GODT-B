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
      !["ADMIN", "COORDINATOR"].includes(actor.role) &&
      existing.createdById !== actor.userId
    ) {
      throw new DonorAccessDeniedError();
    }
    return this.repository.update(id, input);
  }
}
