import { Inject, Injectable } from "@nestjs/common";
import {
  AddProcessInstitutionInput,
  DonationProcessAccessDeniedError,
  DonationProcessNotFoundError,
  ProcessInstitution,
} from "../../domain/processes/donation-process";
import {
  DONATION_PROCESS_REPOSITORY,
  DonationProcessRepository,
} from "./donation-process.repository";
import { AUDIT_EVENT_PORT, AuditEventPort } from "../audit/audit-event.port";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";

@Injectable()
export class AddProcessInstitutionUseCase {
  constructor(
    @Inject(DONATION_PROCESS_REPOSITORY)
    private readonly repository: DonationProcessRepository,
    @Inject(AUDIT_EVENT_PORT)
    private readonly audit: AuditEventPort,
  ) {}

  async execute(
    processId: string,
    input: AddProcessInstitutionInput,
    user: AuthenticatedUser,
  ): Promise<ProcessInstitution> {
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

    const institution = await this.repository.addInstitution(processId, input);

    await this.audit.record({
      actorUserId: user.userId,
      action: "PROCESS_INSTITUTION_ADDED",
      entityType: "PROCESS_INSTITUTION",
      entityId: institution.id,
      correlationId: processId,
      metadata: {
        institutionName: input.institutionName,
        role: input.role,
      },
    });

    return institution;
  }
}

