import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";
import {
  DashboardSummaryData,
  DashboardSummaryPort,
} from "../../application/processes/dashboard-summary.port";

@Injectable()
export class PrismaDashboardSummaryRepository implements DashboardSummaryPort {
  constructor(private readonly prisma: PrismaService) {}

  async getSummary(user: AuthenticatedUser): Promise<DashboardSummaryData> {
    const isGlobal = user.role === "ADMIN";
    const ipsList = user.institutionalIps || [];

    // Filter by institutional scope if not admin
    const processWhere = isGlobal
      ? {}
      : { primaryIpsName: { in: ipsList } };

    const donorWhere = isGlobal
      ? {}
      : { originatingIpsName: { in: ipsList } };

    const documentWhere = isGlobal
      ? {}
      : { process: { primaryIpsName: { in: ipsList } } };

    // 1. Processes breakdown
    const [processTotal, processGroups, recentProcesses] = await Promise.all([
      this.prisma.donationProcess.count({ where: processWhere }),
      this.prisma.donationProcess.groupBy({
        by: ["status"],
        where: processWhere,
        _count: { id: true },
      }),
      this.prisma.donationProcess.findMany({
        where: processWhere,
        orderBy: { updatedAt: "desc" },
        take: 6,
        select: {
          id: true,
          processCode: true,
          status: true,
          primaryIpsName: true,
          openedAt: true,
          updatedAt: true,
          donor: {
            select: {
              fullName: true,
              rndCode: true,
            },
          },
        },
      }),
    ]);

    const processByStatus: DashboardSummaryData["processes"]["byStatus"] = {
      EN_VALORACION: 0,
      EN_CURSO: 0,
      COMPLETADO: 0,
      CANCELADO: 0,
      SUSPENDIDO: 0,
    };
    for (const group of processGroups) {
      processByStatus[group.status] = group._count.id;
    }

    // 2. Donors breakdown
    const [donorTotal, donorGroups] = await Promise.all([
      this.prisma.donorRecord.count({ where: donorWhere }),
      this.prisma.donorRecord.groupBy({
        by: ["status"],
        where: donorWhere,
        _count: { id: true },
      }),
    ]);

    const donorByStatus: DashboardSummaryData["donors"]["byStatus"] = {
      EN_VALORACION: 0,
      ACTIVO: 0,
      CERRADO: 0,
    };
    for (const group of donorGroups) {
      donorByStatus[group.status] = group._count.id;
    }

    // 3. Process documents breakdown (Aligned with real domain enums)
    const [documentTotal, documentGroups] = await Promise.all([
      this.prisma.processDocument.count({ where: documentWhere }),
      this.prisma.processDocument.groupBy({
        by: ["status"],
        where: documentWhere,
        _count: { id: true },
      }),
    ]);

    const documentByStatus: DashboardSummaryData["documents"]["byStatus"] = {
      PENDIENTE: 0,
      EN_DILIGENCIAMIENTO: 0,
      EN_REVISION: 0,
      BLOQUEADO: 0,
      PENDIENTE_FIRMAS: 0,
      FIRMADO: 0,
      COMPLETADO: 0,
      LIBERADO: 0,
      NO_APLICA: 0,
    };
    for (const group of documentGroups) {
      documentByStatus[group.status] = group._count.id;
    }

    return {
      processes: {
        total: processTotal,
        byStatus: processByStatus,
      },
      donors: {
        total: donorTotal,
        byStatus: donorByStatus,
      },
      documents: {
        total: documentTotal,
        byStatus: documentByStatus,
      },
      recentProcesses: recentProcesses.map((p) => ({
        id: p.id,
        processCode: p.processCode,
        status: p.status,
        primaryIpsName: p.primaryIpsName,
        donorName: p.donor?.fullName,
        donorRndCode: p.donor?.rndCode,
        openedAt: p.openedAt,
        updatedAt: p.updatedAt,
      })),
    };
  }
}

