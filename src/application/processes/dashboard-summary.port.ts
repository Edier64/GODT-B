import { AuthenticatedUser } from "../../presentation/auth/auth.types";

export interface DashboardProcessStatusCounts {
  EN_VALORACION: number;
  EN_CURSO: number;
  COMPLETADO: number;
  CANCELADO: number;
  SUSPENDIDO: number;
  [key: string]: number;
}

export interface DashboardDonorStatusCounts {
  EN_VALORACION: number;
  ACTIVO: number;
  CERRADO: number;
  [key: string]: number;
}

export interface DashboardDocumentStatusCounts {
  PENDIENTE: number;
  EN_DILIGENCIAMIENTO: number;
  EN_REVISION: number;
  BLOQUEADO: number;
  PENDIENTE_FIRMAS: number;
  FIRMADO: number;
  COMPLETADO: number;
  LIBERADO: number;
  NO_APLICA: number;
  [key: string]: number;
}

export interface RecentProcessSummary {
  id: string;
  processCode: string;
  status: string;
  primaryIpsName: string;
  donorName?: string;
  donorRndCode?: string;
  openedAt: Date;
  updatedAt: Date;
}

export interface DashboardSummaryData {
  processes: {
    total: number;
    byStatus: DashboardProcessStatusCounts;
  };
  donors: {
    total: number;
    byStatus: DashboardDonorStatusCounts;
  };
  documents: {
    total: number;
    byStatus: DashboardDocumentStatusCounts;
  };
  recentProcesses: RecentProcessSummary[];
}

export interface DashboardSummaryPort {
  getSummary(user: AuthenticatedUser): Promise<DashboardSummaryData>;
}

export const DASHBOARD_SUMMARY_PORT = Symbol("DASHBOARD_SUMMARY_PORT");

