import { Inject, Injectable } from "@nestjs/common";
import {
  DocumentAccessDeniedError,
  DocumentNotFoundError,
} from "./document-errors";
import { DOCUMENT_REPOSITORY, DocumentRepository } from "./document.repository";
import { FILE_STORAGE_PORT, FileStoragePort } from "./file-storage.port";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";

@Injectable()
export class GetSourceDocumentUseCase {
  constructor(
    @Inject(DOCUMENT_REPOSITORY) private readonly documents: DocumentRepository,
    @Inject(FILE_STORAGE_PORT) private readonly storage: FileStoragePort,
    private readonly prisma: PrismaService,
  ) {}

  async list(donorId: string, actor: AuthenticatedUser) {
    await this.assertAccess(donorId, actor);
    return this.prisma.sourceDocument.findMany({
      where: { donorId },
      include: {
        ocrJobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { extractedFields: true },
        },
      },
      orderBy: { uploadedAt: "desc" },
    });
  }

  async listByProcessId(processId: string, actor: AuthenticatedUser) {
    const process = await this.prisma.donationProcess.findUnique({
      where: { id: processId },
      select: { id: true, donorId: true, primaryIpsName: true },
    });
    if (!process) throw new DocumentNotFoundError();
    if (
      actor.role !== "ADMIN" &&
      !actor.institutionalIps?.includes(process.primaryIpsName)
    ) {
      throw new DocumentAccessDeniedError();
    }
    return this.prisma.sourceDocument.findMany({
      where: {
        OR: [{ processId }, { donorId: process.donorId }],
      },
      include: {
        ocrJobs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          include: { extractedFields: true },
        },
      },
      orderBy: { uploadedAt: "desc" },
    });
  }

  async get(id: string, actor: AuthenticatedUser) {
    const document = await this.documents.findById(id);
    if (!document) throw new DocumentNotFoundError();
    await this.assertAccess(document.donorId, actor);
    return document;
  }

  async download(id: string, actor: AuthenticatedUser) {
    const document = await this.get(id, actor);
    return {
      document,
      buffer: await this.storage.get(document.objectStorageKey),
    };
  }

  private async assertAccess(donorId: string, actor: AuthenticatedUser) {
    const donor = await this.prisma.donorRecord.findUnique({
      where: { id: donorId },
      select: { originatingIpsName: true },
    });
    if (!donor) throw new DocumentNotFoundError();
    if (
      actor.role !== "ADMIN" &&
      !actor.institutionalIps?.includes(donor.originatingIpsName)
    ) {
      throw new DocumentAccessDeniedError();
    }
  }
}
