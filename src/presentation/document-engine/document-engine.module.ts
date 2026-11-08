import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module";
import { DocumentEngineService } from "../../application/document-engine/document-engine.service";
import { DocumentDefinitionValidator } from "../../application/document-engine/document-definition.validator";
import { DocumentResponseValidator } from "../../application/document-engine/document-response.validator";
import { DOCUMENT_ENGINE_REPOSITORY } from "../../application/document-engine/document-engine.repository";
import { PrismaDocumentEngineRepository } from "../../infrastructure/document-engine/prisma-document-engine.repository";
import { DocumentEngineController } from "./document-engine.controller";
import { InstitutionalDocumentController } from "./institutional-document.controller";
import { InstitutionalDocumentService } from "../../application/pdf/institutional-document.service";
import { PdfRenderEngineService } from "../../application/pdf/pdf-render-engine.service";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [DocumentEngineController, InstitutionalDocumentController],
  providers: [
    DocumentEngineService,
    DocumentDefinitionValidator,
    DocumentResponseValidator,
    PrismaDocumentEngineRepository,
    InstitutionalDocumentService,
    PdfRenderEngineService,
    {
      provide: DOCUMENT_ENGINE_REPOSITORY,
      useExisting: PrismaDocumentEngineRepository,
    },
  ],
  exports: [
    InstitutionalDocumentService,
    PdfRenderEngineService,
  ],
})
export class DocumentEngineModule {}
