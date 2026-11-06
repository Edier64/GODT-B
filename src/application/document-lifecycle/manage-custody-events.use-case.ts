import { Inject, Injectable } from "@nestjs/common";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AUDIT_EVENT_PORT, AuditEventPort } from "../audit/audit-event.port";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";
import {
  CustodyEventType,
  CustodySequenceError,
  DocumentLockedError,
  isDocumentLocked,
} from "../../domain/document-lifecycle/document-lifecycle";
import {
  DonationProcessAccessDeniedError,
  DonationProcessNotFoundError,
} from "../../domain/processes/donation-process";

@Injectable()
export class ManageCustodyEventsUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_EVENT_PORT)
    private readonly audit: AuditEventPort,
  ) {}

  async append(input: {
    instanceId: string;
    eventType: CustodyEventType;
    itemDescription: string;
    containerCode?: string;
    sealNumber?: string;
    temperatureCelsius?: number;
    transferorName: string;
    transferorId?: string;
    transferorInstitution?: string;
    receiverName: string;
    receiverId?: string;
    receiverInstitution?: string;
    occurredAt: Date;
    location: string;
    integrityVerified?: boolean;
    verifierNotes?: string;
    observations?: string;
    user: AuthenticatedUser;
  }) {
    const instance = await this.prisma.documentInstance.findUnique({
      where: { id: input.instanceId },
      include: { process: true },
    });

    if (!instance) {
      throw new DonationProcessNotFoundError(`Instancia '${input.instanceId}' no encontrada`);
    }

    if (
      input.user.role !== "ADMIN" &&
      input.user.role !== "COORDINATOR" &&
      input.user.role !== "TECHNICIAN" &&
      instance.process &&
      !input.user.institutionalIps?.includes(instance.process.primaryIpsName)
    ) {
      throw new DonationProcessAccessDeniedError("No tiene autorización sobre este proceso");
    }

    if (instance.status === "LIBERADO" || instance.status === "CANCELADO") {
      throw new DocumentLockedError(
        "No es posible agregar eventos de custodia a un documento liberado o cerrado",
      );
    }

    // Validación de temperatura según límites biológicos de preservación de órganos y tejidos
    if (input.temperatureCelsius !== undefined && input.temperatureCelsius !== null) {
      if (input.temperatureCelsius < -80 || input.temperatureCelsius > 45) {
        throw new CustodySequenceError(
          `La temperatura registrada (${input.temperatureCelsius} °C) está fuera de los rangos biológicos admisibles (-80 °C a 45 °C)`,
        );
      }
    }

    const now = new Date();
    const isVerified = input.integrityVerified === true;

    // Ejecución transaccional para garantizar secuencia atómica bajo concurrencia
    const event = await this.prisma.$transaction(async (tx) => {
      // Obtener último evento de manera atómica
      const lastEvent = await tx.custodyEvent.findFirst({
        where: { documentInstanceId: instance.id },
        orderBy: { sequenceNumber: "desc" },
      });

      const expectedSequence = lastEvent ? lastEvent.sequenceNumber + 1 : 1;

      // Validar coherencia temporal estricta
      if (lastEvent && input.occurredAt < lastEvent.occurredAt) {
        throw new CustodySequenceError(
          `La fecha/hora del nuevo evento (${input.occurredAt.toISOString()}) no puede ser anterior al evento previo #${lastEvent.sequenceNumber} (${lastEvent.occurredAt.toISOString()})`,
        );
      }

      return tx.custodyEvent.create({
        data: {
          documentInstanceId: instance.id,
          processId: instance.processId || instance.id,
          sequenceNumber: expectedSequence,
          eventType: input.eventType,
          itemDescription: input.itemDescription,
          containerCode: input.containerCode,
          sealNumber: input.sealNumber,
          temperatureCelsius: input.temperatureCelsius,
          transferorName: input.transferorName,
          transferorId: input.transferorId,
          transferorInstitution: input.transferorInstitution,
          receiverName: input.receiverName,
          receiverId: input.receiverId,
          receiverInstitution: input.receiverInstitution,
          occurredAt: input.occurredAt,
          location: input.location,
          integrityVerified: isVerified,
          verifiedById: isVerified ? input.user.userId : null,
          verifiedAt: isVerified ? now : null,
          verifierNotes: isVerified ? input.verifierNotes || "Verificación formal de integridad y cadena de frío conforme" : null,
          observations: input.observations,
          recordedById: input.user.userId,
        },
      });
    });

    await this.audit.record({
      actorUserId: input.user.userId,
      action: "CUSTODY_EVENT_RECORDED",
      entityType: "CUSTODY_EVENT",
      entityId: event.id,
      correlationId: instance.processId || instance.id,
      metadata: {
        sequenceNumber: event.sequenceNumber,
        eventType: event.eventType,
        itemDescription: event.itemDescription,
        transferorName: event.transferorName,
        receiverName: event.receiverName,
        integrityVerified: event.integrityVerified,
      },
    });

    return event;
  }

  async list(instanceId: string) {
    return this.prisma.custodyEvent.findMany({
      where: { documentInstanceId: instanceId },
      include: {
        recordedBy: {
          select: { id: true, fullName: true, role: true },
        },
        verifiedBy: {
          select: { id: true, fullName: true, role: true },
        },
      },
      orderBy: { sequenceNumber: "asc" },
    });
  }
}
