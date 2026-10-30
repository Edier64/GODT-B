import { Inject, Injectable } from "@nestjs/common";
import { DonorRecordStatus } from "../../domain/donors/donor-record";
import {
  DONOR_RECORD_REPOSITORY,
  DonorRecordRepository,
} from "./donor-record.repository";
import { DonorActor } from "./get-donor.use-case";

@Injectable()
export class ListDonorsUseCase {
  constructor(
    @Inject(DONOR_RECORD_REPOSITORY)
    private readonly repository: DonorRecordRepository,
  ) {}

  execute(
    input: {
      status?: DonorRecordStatus;
      rndCode?: string;
      page: number;
      pageSize: number;
    },
    actor: DonorActor,
  ) {
    return this.repository.findMany({
      ...input,
      institutionalIps:
        actor.role === "ADMIN" ? undefined : actor.institutionalIps,
    });
  }
}
