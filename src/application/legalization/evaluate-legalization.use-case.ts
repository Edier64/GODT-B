import { Inject, Injectable } from "@nestjs/common";
import {
  LegalizationAssessment,
  LegalizationPolicy,
} from "../../domain/legalization/legalization";
import {
  LEGALIZATION_REPOSITORY,
  LegalizationRepository,
} from "./legalization.repository";

@Injectable()
export class EvaluateLegalizationUseCase {
  private readonly policy = new LegalizationPolicy();

  constructor(
    @Inject(LEGALIZATION_REPOSITORY)
    private readonly repository: LegalizationRepository,
  ) {}

  execute(
    donorId: string,
    officerInChargeId: string,
    input: LegalizationAssessment,
  ) {
    this.policy.evaluate(input);
    return this.repository.createWithRepresentatives(
      donorId,
      officerInChargeId,
      input,
      {
        actorUserId: officerInChargeId,
        action: "DONATION_LEGALIZATION_CREATED",
        entityType: "DONATION_LEGALIZATION",
        entityId: donorId,
        correlationId: donorId,
        metadata: { mechanism: input.mechanism },
      },
    );
  }
}
