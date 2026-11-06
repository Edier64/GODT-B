import { Module, forwardRef } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module";
import { DonationProcessModule } from "../processes/donation-process.module";
import { CanonicalDictionaryController } from "./canonical-dictionary.controller";
import { ListCanonicalCatalogUseCase } from "../../application/canonical/list-canonical-catalog.use-case";
import { GetProcessCanonicalValuesUseCase } from "../../application/canonical/get-process-canonical-values.use-case";
import { ApplyCanonicalValueUseCase } from "../../application/canonical/apply-canonical-value.use-case";
import { ResolveCanonicalConflictUseCase } from "../../application/canonical/resolve-canonical-conflict.use-case";
import { CanonicalPropagationEngine } from "../../application/canonical/canonical-propagation.engine";
import { PrismaCanonicalDictionaryRepository } from "../../infrastructure/canonical/prisma-canonical-dictionary.repository";
import { CANONICAL_DICTIONARY_REPOSITORY } from "../../application/canonical/canonical-dictionary.repository";
import { PrismaAuditEventAdapter } from "../../infrastructure/audit/prisma-audit-event.adapter";
import { AUDIT_EVENT_PORT } from "../../application/audit/audit-event.port";

@Module({
  imports: [AuthModule, PrismaModule, forwardRef(() => DonationProcessModule)],
  controllers: [CanonicalDictionaryController],
  providers: [
    ListCanonicalCatalogUseCase,
    GetProcessCanonicalValuesUseCase,
    ApplyCanonicalValueUseCase,
    ResolveCanonicalConflictUseCase,
    CanonicalPropagationEngine,
    PrismaCanonicalDictionaryRepository,
    PrismaAuditEventAdapter,
    {
      provide: CANONICAL_DICTIONARY_REPOSITORY,
      useExisting: PrismaCanonicalDictionaryRepository,
    },
    {
      provide: AUDIT_EVENT_PORT,
      useExisting: PrismaAuditEventAdapter,
    },
  ],
  exports: [
    CANONICAL_DICTIONARY_REPOSITORY,
    CanonicalPropagationEngine,
    ListCanonicalCatalogUseCase,
    GetProcessCanonicalValuesUseCase,
    ApplyCanonicalValueUseCase,
    ResolveCanonicalConflictUseCase,
  ],
})
export class CanonicalDictionaryModule {}

