import { Injectable } from "@nestjs/common";
import { AnonymizationPolicy, AnonymizableDonor } from "./anonymization-policy";

@Injectable()
export class AnonymizeDonorDataUseCase {
  private readonly policy = new AnonymizationPolicy();

  execute(donor: AnonymizableDonor) {
    return this.policy.apply(donor);
  }
}
