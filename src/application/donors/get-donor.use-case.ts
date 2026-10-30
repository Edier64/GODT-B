import { Inject, Injectable } from "@nestjs/common";
import { DonorAccessDeniedError, DonorNotFoundError } from "./donor-errors";
import {
  DONOR_RECORD_REPOSITORY,
  DonorRecordRepository,
} from "./donor-record.repository";
import { DonorRecord } from "../../domain/donors/donor-record";

export interface DonorActor {
  userId: string;
  role: "COORDINATOR" | "SURGEON" | "TECHNICIAN" | "ADMIN";
}

@Injectable()
export class GetDonorUseCase {
  constructor(
    @Inject(DONOR_RECORD_REPOSITORY)
    private readonly repository: DonorRecordRepository,
  ) {}

  async execute(id: string, actor: DonorActor): Promise<DonorRecord> {
    const donor = await this.repository.findById(id);
    if (!donor) {
      throw new DonorNotFoundError(id);
    }
    if (
      !["ADMIN", "COORDINATOR"].includes(actor.role) &&
      donor.createdById !== actor.userId
    ) {
      throw new DonorAccessDeniedError();
    }
    return donor;
  }
}
