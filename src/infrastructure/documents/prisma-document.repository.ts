import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { DocumentRepository } from "../../application/documents/document.repository";
import { DuplicateDocumentError } from "../../application/documents/document-errors";

@Injectable()
export class PrismaDocumentRepository implements DocumentRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(input: Parameters<DocumentRepository["create"]>[0]) {
    return this.prisma.sourceDocument
      .create({
        data: { ...input, status: "RECIBIDO" },
      })
      .catch((error: unknown) => {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === "P2002"
        ) {
          throw new DuplicateDocumentError("Document already exists");
        }
        throw error;
      });
  }
  findById(id: string) {
    return this.prisma.sourceDocument.findUnique({ where: { id } });
  }
  findByDonorId(donorId: string) {
    return this.prisma.sourceDocument.findMany({
      where: { donorId },
      orderBy: { uploadedAt: "desc" },
    });
  }
  findByHash(donorId: string, sha256Hash: string) {
    return this.prisma.sourceDocument.findFirst({
      where: { donorId, sha256Hash },
    });
  }
}
