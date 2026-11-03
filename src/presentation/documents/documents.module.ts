import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PrismaModule } from "../../infrastructure/prisma/prisma.module";
import { DOCUMENT_REPOSITORY } from "../../application/documents/document.repository";
import { FILE_STORAGE_PORT } from "../../application/documents/file-storage.port";
import { PrismaDocumentRepository } from "../../infrastructure/documents/prisma-document.repository";
import { LocalPrivateStorageAdapter } from "../../infrastructure/documents/local-private-storage.adapter";
import { R2StorageAdapter } from "../../infrastructure/documents/r2-storage.adapter";
import { ConfigService } from "@nestjs/config";
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
    {
      provide: FILE_STORAGE_PORT,
      inject: [ConfigService, LocalPrivateStorageAdapter],
      useFactory: (
        config: ConfigService,
        local: LocalPrivateStorageAdapter,
      ) => {
        if (config.get("STORAGE_PROVIDER", "local") === "r2") {
          return new R2StorageAdapter(config);
        }
        return local;
      },
    },
  ],
  exports: [FILE_STORAGE_PORT, DOCUMENT_REPOSITORY],
})
export class DocumentsModule {}
