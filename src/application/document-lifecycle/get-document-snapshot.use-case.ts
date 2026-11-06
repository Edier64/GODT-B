import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { FILE_STORAGE_PORT, FileStoragePort } from "../documents/file-storage.port";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";
import {
  DonationProcessAccessDeniedError,
  DonationProcessNotFoundError,
} from "../../domain/processes/donation-process";

@Injectable()
export class GetDocumentSnapshotUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(FILE_STORAGE_PORT)
    private readonly storage: FileStoragePort,
  ) {}

  async listSnapshots(instanceId: string, user: AuthenticatedUser) {
    const instance = await this.prisma.documentInstance.findUnique({
      where: { id: instanceId },
      include: { process: true },
    });

    if (!instance) {
      throw new DonationProcessNotFoundError(`Instancia '${instanceId}' no encontrada`);
    }

    if (
      user.role !== "ADMIN" &&
      instance.process &&
      !user.institutionalIps?.includes(instance.process.primaryIpsName)
    ) {
      throw new DonationProcessAccessDeniedError("No tiene autorización sobre este proceso");
    }

    return this.prisma.generatedPdfDocument.findMany({
      where: { documentInstanceId: instanceId },
      include: {
        generatedBy: { select: { id: true, fullName: true, role: true } },
        approvedBy: { select: { id: true, fullName: true, role: true } },
        signatures: {
          include: {
            participant: true,
          },
        },
      },
      orderBy: { versionNumber: "desc" },
    });
  }

  async getSnapshot(snapshotId: string, user: AuthenticatedUser) {
    const snapshot = await this.prisma.generatedPdfDocument.findUnique({
      where: { id: snapshotId },
      include: {
        process: true,
        documentInstance: true,
        generatedBy: { select: { id: true, fullName: true, role: true } },
        approvedBy: { select: { id: true, fullName: true, role: true } },
        signatures: {
          include: { participant: true },
        },
      },
    });

    if (!snapshot) {
      throw new DonationProcessNotFoundError(`Snapshot '${snapshotId}' no encontrado`);
    }

    if (
      user.role !== "ADMIN" &&
      snapshot.process &&
      !user.institutionalIps?.includes(snapshot.process.primaryIpsName)
    ) {
      throw new DonationProcessAccessDeniedError("No tiene autorización sobre este proceso");
    }

    return snapshot;
  }

  async downloadPdf(snapshotId: string, user: AuthenticatedUser) {
    const snapshot = await this.getSnapshot(snapshotId, user);
    const buffer = await this.storage.get(snapshot.objectStorageKey);

    return {
      buffer,
      filename: `${snapshot.documentCode}_v${snapshot.versionNumber}.pdf`,
      sha256Hash: snapshot.sha256Hash,
      mimeType: "application/pdf",
    };
  }
}
