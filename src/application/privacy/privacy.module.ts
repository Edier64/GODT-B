import { Module } from "@nestjs/common";
import { AnonymizeDonorDataUseCase } from "./anonymize-donor.use-case";
import { CanonicalMappingService } from "../documents/canonical-mapping.service";

@Module({
  providers: [AnonymizeDonorDataUseCase, CanonicalMappingService],
  exports: [AnonymizeDonorDataUseCase, CanonicalMappingService],
})
export class PrivacyModule {}
