import { Inject, Injectable } from "@nestjs/common";
import {
  DonationProcess,
  DonationProcessAccessDeniedError,
  DonationProcessNotFoundError,
  UpdateDonationProcessInput,
} from "../../domain/processes/donation-process";
import {
  DONATION_PROCESS_REPOSITORY,
  DonationProcessRepository,
} from "./donation-process.repository";
import { AUDIT_EVENT_PORT, AuditEventPort } from "../audit/audit-event.port";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";

@Injectable()
export class UpdateDonationProcessUseCase {
  constructor(
    @Inject(DONATION_PROCESS_REPOSITORY)
    private readonly repository: DonationProcessRepository,
    @Inject(AUDIT_EVENT_PORT)
    private readonly audit: AuditEventPort,
  ) {}

  async execute(
    id: string,
    input: UpdateDonationProcessInput,
    user: AuthenticatedUser,
  ): Promise<DonationProcess> {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new DonationProcessNotFoundError(`Proceso de donación '${id}' no encontrado`);
    }

    if (
      user.role !== "ADMIN" &&
      !user.institutionalIps?.includes(existing.primaryIpsName)
    ) {
      throw new DonationProcessAccessDeniedError(
        "No tiene autorización para modificar este proceso de donación",
      );
    }

    const payload: UpdateDonationProcessInput = { ...input };
    if (input.status === "COMPLETADO" && !existing.closedAt) {
      payload.closedAt = new Date();
      payload.closedById = user.userId;
    }

    const updated = await this.repository.update(id, payload);

    await this.audit.record({
      actorUserId: user.userId,
      action: "PROCESS_UPDATED",
      entityType: "DONATION_PROCESS",
      entityId: id,
      correlationId: id,
      metadata: {
        changes: input,
      },
    });

    return updated;
  }
}

