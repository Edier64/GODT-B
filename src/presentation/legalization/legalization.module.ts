import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { EvaluateLegalizationUseCase } from "../../application/legalization/evaluate-legalization.use-case";
import { LEGALIZATION_REPOSITORY } from "../../application/legalization/legalization.repository";
import { PrismaLegalizationRepository } from "../../infrastructure/legalization/prisma-legalization.repository";
import { LegalizationController } from "./legalization.controller";

@Module({
  imports: [AuthModule],
  controllers: [LegalizationController],
  providers: [
    EvaluateLegalizationUseCase,
    PrismaLegalizationRepository,
    {
      provide: LEGALIZATION_REPOSITORY,
      useExisting: PrismaLegalizationRepository,
    },
  ],
})
export class LegalizationModule {}
