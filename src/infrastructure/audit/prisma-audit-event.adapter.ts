import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { AuditEventPort } from "../../application/audit/audit-event.port";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PrismaAuditEventAdapter implements AuditEventPort {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: {
    actorUserId: string;
    action: string;
    entityType: string;
    entityId: string;
    correlationId: string;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        actorUserId: input.actorUserId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        correlationId: input.correlationId,
        metadata: input.metadata as Prisma.InputJsonValue | undefined,
      },
    });
  }
}
