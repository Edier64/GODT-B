import { GetDashboardSummaryUseCase } from "../src/application/processes/get-dashboard-summary.use-case";
import { PrismaDashboardSummaryRepository } from "../src/infrastructure/processes/prisma-dashboard-summary.repository";
import { AuthenticatedUser } from "../src/presentation/auth/auth.types";
import { DashboardSummaryPort } from "../src/application/processes/dashboard-summary.port";

describe("DashboardSummary — Clean Architecture & Scope Verification (Auditoría G.1.2)", () => {
  const adminUser: AuthenticatedUser = {
    userId: "00000000-0000-0000-0000-000000000001",
    role: "ADMIN",
    institutionalIps: [],
  };

  const coordinatorUser: AuthenticatedUser = {
    userId: "00000000-0000-0000-0000-000000000002",
    role: "COORDINATOR",
    institutionalIps: ["Hospital Universitario del Valle"],
  };

  const unassignedUser: AuthenticatedUser = {
    userId: "00000000-0000-0000-0000-000000000003",
    role: "COORDINATOR",
    institutionalIps: [],
  };

  describe("GetDashboardSummaryUseCase (Application Layer)", () => {
    it("delega la obtención de métricas exclusivamente al puerto de dominio sin depender de Prisma", async () => {
      const mockPort: DashboardSummaryPort = {
        getSummary: jest.fn().mockResolvedValue({
          processes: { total: 10, byStatus: { EN_VALORACION: 10 } },
          donors: { total: 5, byStatus: { EN_VALORACION: 5 } },
          documents: { total: 23, byStatus: { PENDING: 23 } },
          recentProcesses: [],
        }),
      };

      const useCase = new GetDashboardSummaryUseCase(mockPort);
      const result = await useCase.execute(adminUser);

      expect(mockPort.getSummary).toHaveBeenCalledWith(adminUser);
      expect(result.processes.total).toBe(10);
    });
  });

  describe("PrismaDashboardSummaryRepository (Infrastructure Layer)", () => {
    let mockPrisma: any;
    let repo: PrismaDashboardSummaryRepository;

    beforeEach(() => {
      mockPrisma = {
        donationProcess: {
          count: jest.fn().mockResolvedValue(12),
          groupBy: jest.fn().mockResolvedValue([
            { status: "EN_VALORACION", _count: { id: 3 } },
            { status: "EN_CURSO", _count: { id: 5 } },
            { status: "COMPLETADO", _count: { id: 4 } },
          ]),
          findMany: jest.fn().mockResolvedValue([
            {
              id: "proc-1",
              processCode: "PROC-2026-0001",
              status: "EN_CURSO",
              primaryIpsName: "Hospital Universitario del Valle",
              openedAt: new Date("2026-02-01T10:00:00Z"),
              updatedAt: new Date("2026-02-01T12:00:00Z"),
              donor: { fullName: "Donante Test", rndCode: "RND-2026-001" },
            },
          ]),
        },
        donorRecord: {
          count: jest.fn().mockResolvedValue(8),
          groupBy: jest.fn().mockResolvedValue([
            { status: "EN_VALORACION", _count: { id: 2 } },
            { status: "ACTIVO", _count: { id: 4 } },
            { status: "CERRADO", _count: { id: 2 } },
          ]),
        },
        processDocument: {
          count: jest.fn().mockResolvedValue(46),
          groupBy: jest.fn().mockResolvedValue([
            { status: "PENDIENTE", _count: { id: 20 } },
            { status: "EN_DILIGENCIAMIENTO", _count: { id: 10 } },
            { status: "EN_REVISION", _count: { id: 6 } },
            { status: "FIRMADO", _count: { id: 4 } },
            { status: "LIBERADO", _count: { id: 6 } },
          ]),
        },
      };

      repo = new PrismaDashboardSummaryRepository(mockPrisma);
    });

    it("debe retornar métricas globales para ADMIN", async () => {
      const summary = await repo.getSummary(adminUser);

      expect(summary.processes.total).toBe(12);
      expect(summary.processes.byStatus.EN_CURSO).toBe(5);
      expect(summary.processes.byStatus.COMPLETADO).toBe(4);
      expect(summary.donors.total).toBe(8);
      expect(summary.donors.byStatus.ACTIVO).toBe(4);
      expect(summary.documents.total).toBe(46);
      expect(summary.documents.byStatus.LIBERADO).toBe(6);
      expect(summary.documents.byStatus.EN_DILIGENCIAMIENTO).toBe(10);
      expect(summary.recentProcesses).toHaveLength(1);
      expect(summary.recentProcesses[0].processCode).toBe("PROC-2026-0001");

      expect(mockPrisma.donationProcess.count).toHaveBeenCalledWith({ where: {} });
      expect(mockPrisma.donorRecord.count).toHaveBeenCalledWith({ where: {} });
      expect(mockPrisma.processDocument.count).toHaveBeenCalledWith({ where: {} });
    });

    it("debe filtrar métricas por el alcance institucional del usuario coordinador", async () => {
      const summary = await repo.getSummary(coordinatorUser);

      expect(mockPrisma.donationProcess.count).toHaveBeenCalledWith({
        where: { primaryIpsName: { in: ["Hospital Universitario del Valle"] } },
      });
      expect(mockPrisma.donorRecord.count).toHaveBeenCalledWith({
        where: { originatingIpsName: { in: ["Hospital Universitario del Valle"] } },
      });
      expect(mockPrisma.processDocument.count).toHaveBeenCalledWith({
        where: {
          process: { primaryIpsName: { in: ["Hospital Universitario del Valle"] } },
        },
      });
      expect(summary.processes.total).toBe(12);
    });

    it("debe limitar a conjunto vacío si el usuario coordinador no tiene IPS asignada", async () => {
      await repo.getSummary(unassignedUser);

      expect(mockPrisma.donationProcess.count).toHaveBeenCalledWith({
        where: { primaryIpsName: { in: [] } },
      });
      expect(mockPrisma.donorRecord.count).toHaveBeenCalledWith({
        where: { originatingIpsName: { in: [] } },
      });
      expect(mockPrisma.processDocument.count).toHaveBeenCalledWith({
        where: { process: { primaryIpsName: { in: [] } } },
      });
    });
  });
});
