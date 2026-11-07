import { Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import {
  DossierAccessDeniedError,
  DossierNotFoundError,
} from "../../domain/dossier/dossier.types";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";

@Injectable()
export class ListDossierExportsUseCase {
  constructor(private readonly prisma: PrismaService) {}

  async execute(processId: string, user: AuthenticatedUser) {
    const process = await this.prisma.donationProcess.findUnique({
      where: { id: processId },
    });

    if (!process) {
      throw new DossierNotFoundError(`Proceso '${processId}' no encontrado`);
    }

    if (
      user.role !== "ADMIN" &&
      !user.institutionalIps?.includes(process.primaryIpsName)
    ) {
      throw new DossierAccessDeniedError("No tiene autorización para listar exportaciones de este proceso");
    }

    const exports = await this.prisma.processDossierExport.findMany({
      where: { processId },
      orderBy: { createdAt: "desc" },
      include: {
        requestedBy: true,
      },
    });

    return exports.map((e) => ({
      ...e,
      zipSizeBytes: e.zipSizeBytes ? Number(e.zipSizeBytes) : null,
      requestedBy: {
        id: e.requestedBy.id,
        fullName: e.requestedBy.fullName,
        email: e.requestedBy.email,
        role: e.requestedBy.role,
      },
    }));
  }
}
