import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module";
import { DonationProcessModule } from "../processes/donation-process.module";
import { CanonicalDictionaryModule } from "../canonical/canonical-dictionary.module";
import { ProcessPackageController } from "./process-package.controller";
import { ListProcessDocumentsUseCase } from "../../application/packages/list-process-documents.use-case";
import { UpdateDocumentApplicabilityUseCase } from "../../application/packages/update-document-applicability.use-case";
import { InitiateProcessDocumentUseCase } from "../../application/packages/initiate-process-document.use-case";
import { EvaluateDocumentDependenciesUseCase } from "../../application/packages/evaluate-document-dependencies.use-case";
import { PrismaProcessPackageRepository } from "../../infrastructure/packages/prisma-process-package.repository";
import { PROCESS_PACKAGE_REPOSITORY } from "../../application/packages/process-package.repository";
import { PrismaAuditEventAdapter } from "../../infrastructure/audit/prisma-audit-event.adapter";
import { AUDIT_EVENT_PORT } from "../../application/audit/audit-event.port";

@Module({
  imports: [AuthModule, PrismaModule, DonationProcessModule, CanonicalDictionaryModule],
  controllers: [ProcessPackageController],
  providers: [
    ListProcessDocumentsUseCase,
    UpdateDocumentApplicabilityUseCase,
    InitiateProcessDocumentUseCase,
    EvaluateDocumentDependenciesUseCase,
    PrismaProcessPackageRepository,
    PrismaAuditEventAdapter,
    {
      provide: PROCESS_PACKAGE_REPOSITORY,
      useExisting: PrismaProcessPackageRepository,
    },
    {
      provide: AUDIT_EVENT_PORT,
      useExisting: PrismaAuditEventAdapter,
    },
  ],
  exports: [
    PROCESS_PACKAGE_REPOSITORY,
    ListProcessDocumentsUseCase,
    UpdateDocumentApplicabilityUseCase,
    InitiateProcessDocumentUseCase,
    EvaluateDocumentDependenciesUseCase,
  ],
})
export class ProcessPackageModule {}

