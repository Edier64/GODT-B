import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { DOCUMENT_REPOSITORY } from "../../application/documents/document.repository";
import { PrismaDocumentRepository } from "../../infrastructure/documents/prisma-document.repository";
import { StorageModule } from "../../infrastructure/documents/storage.module";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module";
import { UploadSourceDocumentUseCase } from "../../application/documents/upload-source-document.use-case";
import { GetSourceDocumentUseCase } from "../../application/documents/get-source-document.use-case";
import { DocumentsController } from "./documents.controller";

@Module({
  imports: [AuthModule, PrismaModule, StorageModule],
  controllers: [DocumentsController],
  providers: [
    UploadSourceDocumentUseCase,
    GetSourceDocumentUseCase,
    PrismaDocumentRepository,
    { provide: DOCUMENT_REPOSITORY, useExisting: PrismaDocumentRepository },
  ],
  exports: [
    StorageModule,
    DOCUMENT_REPOSITORY,
    UploadSourceDocumentUseCase,
    GetSourceDocumentUseCase,
  ],
})
export class DocumentsModule {}
