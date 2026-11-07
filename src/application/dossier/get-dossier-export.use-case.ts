import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import {
  DossierAccessDeniedError,
  DossierNotFoundError,
} from "../../domain/dossier/dossier.types";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";
import { AUDIT_EVENT_PORT, AuditEventPort } from "../audit/audit-event.port";

@Injectable()
export class GetDossierExportUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_EVENT_PORT)
    private readonly audit: AuditEventPort,
  ) {}

  async execute(exportId: string, user: AuthenticatedUser) {
    const record = await this.prisma.processDossierExport.findUnique({
      where: { id: exportId },
      include: {
        process: {
          include: {
            donor: true,
          },
        },
        requestedBy: true,
      },
    });

    if (!record) {
      throw new DossierNotFoundError(`Exportación '${exportId}' no encontrada`);
    }

    if (
      user.role !== "ADMIN" &&
      !user.institutionalIps?.includes(record.process.primaryIpsName)
    ) {
      throw new DossierAccessDeniedError("No tiene autorización para consultar esta exportación");
    }

    return {
      ...record,
      zipSizeBytes: record.zipSizeBytes ? Number(record.zipSizeBytes) : null,
    };
  }
}
