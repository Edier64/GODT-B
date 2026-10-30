import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { LegalizationAssessment } from "../../domain/legalization/legalization";
import { LegalizationRepository } from "../../application/legalization/legalization.repository";
import { PrismaService } from "../prisma/prisma.service";
import { AuditEventInput } from "../../application/audit/audit-event.port";

@Injectable()
export class PrismaLegalizationRepository implements LegalizationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createWithRepresentatives(
    donorId: string,
    officerInChargeId: string,
    input: LegalizationAssessment,
    audit: AuditEventInput,
  ): Promise<{ id: string; donorId: string }> {
    return this.prisma.$transaction(async (transaction) => {
      const legalization = await transaction.donationLegalization.create({
        data: {
          donorId,
          officerInChargeId,
          mechanism: input.mechanism,
          status: "LEGALIZADA",
          representatives: {
            create: input.representatives.map((representative) => ({
              ...representative,
              signedAt: representative.signedAt,
            })),
          },
        },
        select: { id: true, donorId: true },
      });
      await transaction.auditEvent.create({
        data: {
          actorUserId: audit.actorUserId,
          action: audit.action,
          entityType: audit.entityType,
          entityId: legalization.id,
          correlationId: audit.correlationId,
          metadata: audit.metadata as Prisma.InputJsonValue | undefined,
        },
      });
      return legalization;
    });
  }
}
