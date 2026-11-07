import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module";
import { DocumentsModule } from "../documents/documents.module";
import { DossierController } from "./dossier.controller";
import { RequestDossierExportUseCase } from "../../application/dossier/request-dossier-export.use-case";
import { GetDossierExportUseCase } from "../../application/dossier/get-dossier-export.use-case";
import { ListDossierExportsUseCase } from "../../application/dossier/list-dossier-exports.use-case";
import { VerifyDossierIntegrityUseCase } from "../../application/dossier/verify-dossier-integrity.use-case";
import { GenerateDossierIndexService } from "../../application/dossier/generate-dossier-index.service";
import { ConsolidatePdfService } from "../../application/dossier/consolidate-pdf.service";
import { BuildIntegrityManifestService } from "../../application/dossier/build-integrity-manifest.service";
import { PackageZipService } from "../../application/dossier/package-zip.service";
import { ProcessDossierExportService } from "../../application/dossier/process-dossier-export.service";
import { BullmqDossierQueueService } from "../../infrastructure/dossier/bullmq-dossier-queue.service";
import { PrismaAuditEventAdapter } from "../../infrastructure/audit/prisma-audit-event.adapter";
import { AUDIT_EVENT_PORT } from "../../application/audit/audit-event.port";

@Module({
  imports: [AuthModule, PrismaModule, DocumentsModule],
  controllers: [DossierController],
  providers: [
    GenerateDossierIndexService,
    ConsolidatePdfService,
    BuildIntegrityManifestService,
    PackageZipService,
    ProcessDossierExportService,
    BullmqDossierQueueService,
    RequestDossierExportUseCase,
    GetDossierExportUseCase,
    ListDossierExportsUseCase,
    VerifyDossierIntegrityUseCase,
    PrismaAuditEventAdapter,
    {
      provide: AUDIT_EVENT_PORT,
      useExisting: PrismaAuditEventAdapter,
    },
  ],
  exports: [
    RequestDossierExportUseCase,
    GetDossierExportUseCase,
    ListDossierExportsUseCase,
    VerifyDossierIntegrityUseCase,
  ],
})
export class DossierModule {}
