import { Inject, Injectable } from "@nestjs/common";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";
import {
  DASHBOARD_SUMMARY_PORT,
  DashboardSummaryData,
  DashboardSummaryPort,
} from "./dashboard-summary.port";

export type DashboardSummary = DashboardSummaryData;

@Injectable()
export class GetDashboardSummaryUseCase {
  constructor(
    @Inject(DASHBOARD_SUMMARY_PORT)
    private readonly dashboardSummaryPort: DashboardSummaryPort,
  ) {}

  async execute(user: AuthenticatedUser): Promise<DashboardSummary> {
    return this.dashboardSummaryPort.getSummary(user);
  }
}
