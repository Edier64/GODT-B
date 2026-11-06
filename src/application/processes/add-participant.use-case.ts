import { Inject, Injectable } from "@nestjs/common";
import {
  AddProcessParticipantInput,
  DonationProcessAccessDeniedError,
  DonationProcessNotFoundError,
  ProcessParticipant,
} from "../../domain/processes/donation-process";
import {
  DONATION_PROCESS_REPOSITORY,
  DonationProcessRepository,
} from "./donation-process.repository";
import { AUDIT_EVENT_PORT, AuditEventPort } from "../audit/audit-event.port";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";

@Injectable()
export class AddProcessParticipantUseCase {
  constructor(
    @Inject(DONATION_PROCESS_REPOSITORY)
    private readonly repository: DonationProcessRepository,
    @Inject(AUDIT_EVENT_PORT)
    private readonly audit: AuditEventPort,
  ) {}

  async execute(
    processId: string,
    input: AddProcessParticipantInput,
    user: AuthenticatedUser,
  ): Promise<ProcessParticipant> {
    const existing = await this.repository.findById(processId);
    if (!existing) {
      throw new DonationProcessNotFoundError(
        `Proceso de donación '${processId}' no encontrado`,
      );
    }

    if (
      user.role !== "ADMIN" &&
      !user.institutionalIps?.includes(existing.primaryIpsName)
    ) {
      throw new DonationProcessAccessDeniedError(
        "No tiene autorización para modificar este proceso de donación",
      );
    }

    const participant = await this.repository.addParticipant(processId, input);

    await this.audit.record({
      actorUserId: user.userId,
      action: "PROCESS_PARTICIPANT_ADDED",
      entityType: "PROCESS_PARTICIPANT",
      entityId: participant.id,
      correlationId: processId,
      metadata: {
        fullName: input.fullName,
        role: input.role,
      },
    });

    return participant;
  }
}

