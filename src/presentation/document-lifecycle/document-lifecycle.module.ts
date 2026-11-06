import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module";
import { DocumentsModule } from "../documents/documents.module";
import { DocumentLifecycleController } from "./document-lifecycle.controller";
import { ValidateDocumentInstanceUseCase } from "../../application/document-lifecycle/validate-document-instance.use-case";
import { CompleteDocumentInstanceUseCase } from "../../application/document-lifecycle/complete-document-instance.use-case";
import { GenerateDocumentSnapshotUseCase } from "../../application/document-lifecycle/generate-document-snapshot.use-case";
import { ManageDocumentParticipantsUseCase } from "../../application/document-lifecycle/manage-document-participants.use-case";
import { SignDocumentSnapshotUseCase } from "../../application/document-lifecycle/sign-document-snapshot.use-case";
import { ReleaseDocumentInstanceUseCase } from "../../application/document-lifecycle/release-document-instance.use-case";
import { ReopenDocumentInstanceUseCase } from "../../application/document-lifecycle/reopen-document-instance.use-case";
import { ManageCustodyEventsUseCase } from "../../application/document-lifecycle/manage-custody-events.use-case";
import { GetDocumentSnapshotUseCase } from "../../application/document-lifecycle/get-document-snapshot.use-case";
import { PdfRenderEngineService } from "../../application/pdf/pdf-render-engine.service";
import { DocumentResponseValidator } from "../../application/document-engine/document-response.validator";
import { PrismaAuditEventAdapter } from "../../infrastructure/audit/prisma-audit-event.adapter";
import { AUDIT_EVENT_PORT } from "../../application/audit/audit-event.port";

@Module({
  imports: [AuthModule, PrismaModule, DocumentsModule],
  controllers: [DocumentLifecycleController],
  providers: [
    ValidateDocumentInstanceUseCase,
    CompleteDocumentInstanceUseCase,
    GenerateDocumentSnapshotUseCase,
    ManageDocumentParticipantsUseCase,
    SignDocumentSnapshotUseCase,
    ReleaseDocumentInstanceUseCase,
    ReopenDocumentInstanceUseCase,
    ManageCustodyEventsUseCase,
    GetDocumentSnapshotUseCase,
    PdfRenderEngineService,
    DocumentResponseValidator,
    PrismaAuditEventAdapter,
    {
      provide: AUDIT_EVENT_PORT,
      useExisting: PrismaAuditEventAdapter,
    },
  ],
  exports: [
    ValidateDocumentInstanceUseCase,
    CompleteDocumentInstanceUseCase,
    GenerateDocumentSnapshotUseCase,
    ManageDocumentParticipantsUseCase,
    SignDocumentSnapshotUseCase,
    ReleaseDocumentInstanceUseCase,
    ReopenDocumentInstanceUseCase,
    ManageCustodyEventsUseCase,
    GetDocumentSnapshotUseCase,
    PdfRenderEngineService,
  ],
})
export class DocumentLifecycleModule {}
