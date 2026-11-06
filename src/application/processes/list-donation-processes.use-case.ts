import { Inject, Injectable } from "@nestjs/common";
import {
  DonationProcess,
  DonationProcessStatus,
} from "../../domain/processes/donation-process";
import {
  DONATION_PROCESS_REPOSITORY,
  DonationProcessRepository,
} from "./donation-process.repository";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";

export interface ListDonationProcessesQuery {
  status?: DonationProcessStatus;
  donorId?: string;
  primaryIpsName?: string;
  page?: number;
  pageSize?: number;
}

@Injectable()
export class ListDonationProcessesUseCase {
  constructor(
    @Inject(DONATION_PROCESS_REPOSITORY)
    private readonly repository: DonationProcessRepository,
  ) {}

  execute(
    query: ListDonationProcessesQuery,
    user: AuthenticatedUser,
  ): Promise<{ items: DonationProcess[]; total: number; page: number; pageSize: number }> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 10));

    const institutionalIps =
      user.role === "ADMIN" ? undefined : (user.institutionalIps ?? []);

    return this.repository
      .findMany({
        status: query.status,
        donorId: query.donorId,
        primaryIpsName: query.primaryIpsName,
        institutionalIps,
        page,
        pageSize,
      })
      .then((result) => ({
        ...result,
        page,
        pageSize,
      }));
  }
}

