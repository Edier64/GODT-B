import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module";
import { DocumentEngineService } from "../../application/document-engine/document-engine.service";
import { DocumentDefinitionValidator } from "../../application/document-engine/document-definition.validator";
import { DocumentResponseValidator } from "../../application/document-engine/document-response.validator";
import { DOCUMENT_ENGINE_REPOSITORY } from "../../application/document-engine/document-engine.repository";
import { PrismaDocumentEngineRepository } from "../../infrastructure/document-engine/prisma-document-engine.repository";
import { DocumentEngineController } from "./document-engine.controller";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [DocumentEngineController],
  providers: [
    DocumentEngineService,
    DocumentDefinitionValidator,
    DocumentResponseValidator,
    PrismaDocumentEngineRepository,
    {
      provide: DOCUMENT_ENGINE_REPOSITORY,
      useExisting: PrismaDocumentEngineRepository,
    },
  ],
})
export class DocumentEngineModule {}
