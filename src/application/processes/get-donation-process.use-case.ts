import { Inject, Injectable } from "@nestjs/common";
import {
  DonationProcess,
  DonationProcessAccessDeniedError,
  DonationProcessNotFoundError,
} from "../../domain/processes/donation-process";
import {
  DONATION_PROCESS_REPOSITORY,
  DonationProcessRepository,
} from "./donation-process.repository";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";

@Injectable()
export class GetDonationProcessUseCase {
  constructor(
    @Inject(DONATION_PROCESS_REPOSITORY)
    private readonly repository: DonationProcessRepository,
  ) {}

  async execute(id: string, user: AuthenticatedUser): Promise<DonationProcess> {
    const process = await this.repository.findById(id);
    if (!process) {
      throw new DonationProcessNotFoundError(`Proceso de donación '${id}' no encontrado`);
    }

    if (
      user.role !== "ADMIN" &&
      !user.institutionalIps?.includes(process.primaryIpsName)
    ) {
      throw new DonationProcessAccessDeniedError(
        "No tiene autorización para consultar este proceso de donación",
      );
    }

    return process;
  }
}

