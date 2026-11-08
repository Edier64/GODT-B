import { ForbiddenException } from "@nestjs/common";
import { InstitutionService } from "../src/application/institutions/institution.service";
import { AuthenticatedUser } from "../src/presentation/auth/auth.types";

describe("InstitutionService - RBAC & Institutional Isolation Audit", () => {
  let service: InstitutionService;
  let mockPrisma: any;

  const mockInstitutions = [
    {
      id: "inst-1",
      name: "Clínica Imbanaco",
      normalizedName: "clinica imbanaco",
      code: "7600100001",
      city: "Cali",
      department: "Valle del Cauca",
      complexityLevel: "NIVEL_3_ALTA",
      status: "ACTIVE",
      aliases: [{ id: "alias-1", alias: "Imbanaco", normalizedAlias: "imbanaco" }],
      userScopes: [],
    },
    {
      id: "inst-2",
      name: "Hospital Universitario del Valle",
      normalizedName: "hospital universitario del valle",
      code: "7600100002",
      city: "Cali",
      department: "Valle del Cauca",
      complexityLevel: "NIVEL_3_ALTA",
      status: "ACTIVE",
      aliases: [{ id: "alias-2", alias: "HUV", normalizedAlias: "huv" }],
      userScopes: [],
    },
  ];

  beforeEach(() => {
    mockPrisma = {
      institutionEntity: {
        findMany: jest.fn().mockImplementation((args) => {
          // Si filtra por userScopes approved
          const userId = args?.include?.userScopes?.where?.userId;
          return Promise.resolve(
            mockInstitutions.map((inst) => {
              const scopes: any[] = [];
              if (userId === "coord-a" && inst.id === "inst-1") {
                scopes.push({ userId: "coord-a", institutionId: "inst-1", status: "APPROVED" });
              }
              return { ...inst, userScopes: scopes };
            }),
          );
        }),
      },
      userInstitutionScope: {
        findUnique: jest.fn().mockImplementation((args) => {
          const { userId, institutionId } = args.where.userId_institutionId;
          if (userId === "coord-pending" && institutionId === "inst-2") {
            return Promise.resolve({ userId, institutionId, status: "PENDING" });
          }
          if (userId === "coord-rejected" && institutionId === "inst-2") {
            return Promise.resolve({ userId, institutionId, status: "REJECTED" });
          }
          return Promise.resolve(null);
        }),
      },
    };

    service = new InstitutionService(mockPrisma);
  });

  const adminUser: AuthenticatedUser = {
    userId: "admin-1",
    role: "ADMIN",
  };

  const coordinatorA: AuthenticatedUser = {
    userId: "coord-a",
    role: "COORDINATOR",
    institutionalIps: ["Clínica Imbanaco"],
  };

  const coordinatorPending: AuthenticatedUser = {
    userId: "coord-pending",
    role: "COORDINATOR",
  };

  const coordinatorRejected: AuthenticatedUser = {
    userId: "coord-rejected",
    role: "COORDINATOR",
  };

  it("1. ADMIN tiene alcance global transversal sobre cualquier IPS maestra", async () => {
    const res1 = await service.resolveIpsForProcess("Clínica Imbanaco", adminUser);
    expect(res1.canonicalName).toBe("Clínica Imbanaco");
    expect(res1.institutionId).toBe("inst-1");

    const res2 = await service.resolveIpsForProcess("Hospital Universitario del Valle", adminUser);
    expect(res2.canonicalName).toBe("Hospital Universitario del Valle");
    expect(res2.institutionId).toBe("inst-2");

    // ADMIN puede registrar una IPS que aún no esté en catálogo
    const res3 = await service.resolveIpsForProcess("Nueva Clínica Transversal", adminUser);
    expect(res3.canonicalName).toBe("Nueva Clínica Transversal");
  });

  it("2. COORDINADOR autorizado puede abrir procesos en su IPS asignada", async () => {
    const res = await service.resolveIpsForProcess("Clínica Imbanaco", coordinatorA);
    expect(res.canonicalName).toBe("Clínica Imbanaco");
    expect(res.institutionId).toBe("inst-1");

    // También mediante alias reconocido
    const resAlias = await service.resolveIpsForProcess("Imbanaco", coordinatorA);
    expect(resAlias.canonicalName).toBe("Clínica Imbanaco");
  });

  it("3. COORDINADOR NO puede abrir procesos en una IPS ajena sin autorización", async () => {
    await expect(
      service.resolveIpsForProcess("Hospital Universitario del Valle", coordinatorA),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      service.resolveIpsForProcess("Hospital Universitario del Valle", coordinatorA),
    ).rejects.toThrow(/actualmente no tienes autorización aprobada/);
  });

  it("4. Solicitud en estado PENDIENTE bloquea la apertura de procesos", async () => {
    await expect(
      service.resolveIpsForProcess("Hospital Universitario del Valle", coordinatorPending),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      service.resolveIpsForProcess("Hospital Universitario del Valle", coordinatorPending),
    ).rejects.toThrow(/estado PENDIENTE/);
  });

  it("5. Solicitud en estado RECHAZADA bloquea la apertura de procesos", async () => {
    await expect(
      service.resolveIpsForProcess("Hospital Universitario del Valle", coordinatorRejected),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      service.resolveIpsForProcess("Hospital Universitario del Valle", coordinatorRejected),
    ).rejects.toThrow(/fue RECHAZADA/);
  });

  it("6. Coincidencia aproximada NUNCA otorga autorización automática", async () => {
    // Error tipográfico "Clinica Inbanaco"
    await expect(
      service.resolveIpsForProcess("Clinica Inbanaco", coordinatorPending),
    ).rejects.toThrow(ForbiddenException);

    await expect(
      service.resolveIpsForProcess("Clinica Inbanaco", coordinatorPending),
    ).rejects.toThrow(/coincidencias aproximadas no conceden autorización automática/);
  });
});
