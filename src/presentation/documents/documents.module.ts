import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module";
import { DOCUMENT_REPOSITORY } from "../../application/documents/document.repository";
import { FILE_STORAGE_PORT } from "../../application/documents/file-storage.port";
import { PrismaDocumentRepository } from "../../infrastructure/documents/prisma-document.repository";
import { LocalPrivateStorageAdapter } from "../../infrastructure/documents/local-private-storage.adapter";
import { UploadSourceDocumentUseCase } from "../../application/documents/upload-source-document.use-case";
import { GetSourceDocumentUseCase } from "../../application/documents/get-source-document.use-case";
import { DocumentsController } from "./documents.controller";

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [DocumentsController],
  providers: [
    UploadSourceDocumentUseCase,
    GetSourceDocumentUseCase,
    PrismaDocumentRepository,
    LocalPrivateStorageAdapter,
    { provide: DOCUMENT_REPOSITORY, useExisting: PrismaDocumentRepository },
    { provide: FILE_STORAGE_PORT, useExisting: LocalPrivateStorageAdapter },
  ],
  exports: [FILE_STORAGE_PORT, DOCUMENT_REPOSITORY],
})
export class DocumentsModule {}
