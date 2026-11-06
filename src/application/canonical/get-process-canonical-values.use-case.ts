import { Inject, Injectable } from "@nestjs/common";
import {
  CanonicalFieldNotFoundError,
  ProcessCanonicalHistory,
  ProcessCanonicalValue,
} from "../../domain/canonical/canonical-dictionary";
import {
  CANONICAL_DICTIONARY_REPOSITORY,
  CanonicalDictionaryRepository,
} from "./canonical-dictionary.repository";
import {
  DONATION_PROCESS_REPOSITORY,
  DonationProcessRepository,
} from "../processes/donation-process.repository";
import {
  DonationProcessAccessDeniedError,
  DonationProcessNotFoundError,
} from "../../domain/processes/donation-process";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";

@Injectable()
export class GetProcessCanonicalValuesUseCase {
  constructor(
    @Inject(CANONICAL_DICTIONARY_REPOSITORY)
    private readonly repository: CanonicalDictionaryRepository,
    @Inject(DONATION_PROCESS_REPOSITORY)
    private readonly processRepository: DonationProcessRepository,
  ) {}

  async listValues(
    processId: string,
    user: AuthenticatedUser,
  ): Promise<ProcessCanonicalValue[]> {
    await this.verifyProcessAccess(processId, user);
    return this.repository.findProcessValues(processId);
  }

  async getValue(
    processId: string,
    fieldKey: string,
    user: AuthenticatedUser,
  ): Promise<ProcessCanonicalValue> {
    await this.verifyProcessAccess(processId, user);
    const value = await this.repository.findProcessValueByKey(processId, fieldKey);
    if (!value) {
      throw new CanonicalFieldNotFoundError(
        `No existe valor canónico registrado para '${fieldKey}' en el proceso '${processId}'`,
      );
    }
    return value;
  }

  async getHistory(
    processId: string,
    fieldKey: string,
    user: AuthenticatedUser,
  ): Promise<ProcessCanonicalHistory[]> {
    await this.verifyProcessAccess(processId, user);
    return this.repository.listHistory(processId, fieldKey);
  }

  async getObservations(
    processId: string,
    fieldKey: string,
    user: AuthenticatedUser,
    contextFilter?: string,
  ): Promise<ProcessCanonicalHistory[]> {
    await this.verifyProcessAccess(processId, user);
    return this.repository.listObservations(processId, fieldKey, contextFilter);
  }

  async getConflicts(
    processId: string,
    user: AuthenticatedUser,
  ): Promise<ProcessCanonicalValue[]> {
    await this.verifyProcessAccess(processId, user);
    const values = await this.repository.findProcessValues(processId);
    return values.filter((v) => v.conflictStatus === "CONFLICT_DETECTED");
  }

  private async verifyProcessAccess(
    processId: string,
    user: AuthenticatedUser,
  ): Promise<void> {
    const process = await this.processRepository.findById(processId);
    if (!process) {
      throw new DonationProcessNotFoundError(`Proceso '${processId}' no encontrado`);
    }

    if (
      user.role !== "ADMIN" &&
      !user.institutionalIps?.includes(process.primaryIpsName)
    ) {
      throw new DonationProcessAccessDeniedError(
        "No tiene autorización para consultar los valores canónicos de este proceso",
      );
    }
  }
}

