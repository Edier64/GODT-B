import { InstitutionService } from "../src/application/institutions/institution.service";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { AuthenticatedUser } from "../src/presentation/auth/auth.types";
import { ForbiddenException, ConflictException } from "@nestjs/common";

describe("InstitutionService — Autocomplete, Aliases & Controlled Scopes (Fase G.1.3)", () => {
  let service: InstitutionService;
  let mockPrisma: any;

  const adminUser: AuthenticatedUser = {
    userId: "user-admin-1",
    role: "ADMIN",
    institutionalIps: [],
  };

  const localDoctorUser: AuthenticatedUser = {
    userId: "user-doc-2",
    role: "SURGEON",
    institutionalIps: ["Clínica Imbanaco"],
  };

  const sampleInstitutions = [
    {
      id: "inst-1",
      name: "Hospital Universitario del Valle",
      normalizedName: "hospital universitario del valle",
      code: "HUV-001",
      city: "Cali",
      department: "Valle del Cauca",
      complexityLevel: "NIVEL_IV",
      status: "ACTIVE",
      aliases: [
        { alias: "HUV", normalizedAlias: "huv" },
        { alias: "Hospital del Valle", normalizedAlias: "hospital del valle" },
      ],
      userScopes: [],
    },
    {
      id: "inst-2",
      name: "Clínica Imbanaco",
      normalizedName: "clinica imbanaco",
      code: "IMB-002",
      city: "Cali",
      department: "Valle del Cauca",
      complexityLevel: "NIVEL_IV",
      status: "ACTIVE",
      aliases: [
        { alias: "Imbanaco", normalizedAlias: "imbanaco" },
        { alias: "Centro Médico Imbanaco", normalizedAlias: "centro medico imbanaco" },
      ],
      userScopes: [{ userId: "user-doc-2", status: "APPROVED" }],
    },
  ];

  beforeEach(() => {
    mockPrisma = {
      institutionEntity: {
        findMany: jest.fn().mockResolvedValue(sampleInstitutions),
        findFirst: jest.fn().mockResolvedValue(null),
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      userInstitutionScope: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      systemUser: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    service = new InstitutionService(mockPrisma as unknown as PrismaService);
  });

  describe("searchInstitutions (Búsqueda Inteligente y Autocompletado)", () => {
    it("debe encontrar una institución por alias exacto ('Imbanaco' -> 'Clínica Imbanaco')", async () => {
      const res = await service.searchInstitutions("Imbanaco", adminUser);
      expect(res.results.length).toBeGreaterThan(0);
      const imbanaco = res.results.find((r) => r.name === "Clínica Imbanaco");
      expect(imbanaco).toBeDefined();
      expect(imbanaco?.matchType).toBe("ALIAS");
      expect(imbanaco?.matchedAlias).toBe("Imbanaco");
    });

    it("debe encontrar una institución por búsqueda parcial ('Universitario')", async () => {
      const res = await service.searchInstitutions("Universitario", adminUser);
      expect(res.results.length).toBeGreaterThan(0);
      expect(res.results[0].name).toBe("Hospital Universitario del Valle");
      expect(res.results[0].matchType).toBe("PARTIAL");
    });

    it("debe indicar si el usuario autenticado tiene acceso o alcance asignado", async () => {
      const res = await service.searchInstitutions("Imbanaco", localDoctorUser);
      const imbanaco = res.results.find((r) => r.name === "Clínica Imbanaco");
      expect(imbanaco?.hasUserAccess).toBe(true);

      const resHuv = await service.searchInstitutions("HUV", localDoctorUser);
      const huv = resHuv.results.find((r) => r.name === "Hospital Universitario del Valle");
      expect(huv?.hasUserAccess).toBe(false);
    });
  });

  describe("resolveIpsForProcess (Prevención del 403 y Normalización Canónica)", () => {
    it("debe resolver el nombre canónico oficial cuando el usuario escribe un alias conocido", async () => {
      const resolved = await service.resolveIpsForProcess("Imbanaco", localDoctorUser);
      expect(resolved.canonicalName).toBe("Clínica Imbanaco");
      expect(resolved.institutionId).toBe("inst-2");
    });

    it("únicamente el rol ADMIN tiene alcance transversal global sobre cualquier IPS", async () => {
      const resolved = await service.resolveIpsForProcess("Hospital del Valle", adminUser);
      expect(resolved.canonicalName).toBe("Hospital Universitario del Valle");
    });

    it("el rol COORDINATOR sin alcance aprobado en la IPS solicitada es RECHAZADO con ForbiddenException", async () => {
      const coordinatorWithoutAccess: AuthenticatedUser = {
        userId: "coord-unauthorized-1",
        role: "COORDINATOR",
        institutionalIps: ["Clínica Imbanaco"],
      };

      await expect(
        service.resolveIpsForProcess("Hospital Universitario del Valle", coordinatorWithoutAccess),
      ).rejects.toThrow(ForbiddenException);
    });

    it("el rol COORDINATOR con alcance aprobado en la IPS solicitada es AUTORIZADO", async () => {
      const coordinatorWithAccess: AuthenticatedUser = {
        userId: "user-doc-2",
        role: "COORDINATOR",
        institutionalIps: ["Clínica Imbanaco"],
      };

      const resolved = await service.resolveIpsForProcess("Imbanaco", coordinatorWithAccess);
      expect(resolved.canonicalName).toBe("Clínica Imbanaco");
    });

    it("debe lanzar ForbiddenException si un usuario sin rol transversal intenta abrir proceso en IPS no autorizada", async () => {
      await expect(
        service.resolveIpsForProcess("Hospital Universitario del Valle", localDoctorUser),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe("createInstitution (Creación Controlada y Prevención de Duplicados)", () => {
    it("debe advertir y rechazar la creación si existe una institución con similitud fonética o textual >= 80%", async () => {
      await expect(
        service.createInstitution(
          {
            name: "Clinica Inbanaco",
            city: "Cali",
            confirmNonDuplicate: false,
          },
          adminUser,
        ),
      ).rejects.toThrow(ConflictException);
    });

    it("debe permitir la creación si no existe duplicado y el usuario es coordinador", async () => {
      mockPrisma.institutionEntity.create.mockResolvedValue({
        id: "inst-new-3",
        name: "Clínica de los Remedios",
        code: "REM-003",
        city: "Cali",
        department: "Valle del Cauca",
        complexityLevel: "NIVEL_III",
        aliases: [],
      });

      const created = await service.createInstitution(
        {
          name: "Clínica de los Remedios",
          code: "REM-003",
          city: "Cali",
          department: "Valle del Cauca",
        },
        adminUser,
      );

      expect(created.name).toBe("Clínica de los Remedios");
    });
  });

  describe("getClinicalServices (Servicios Clínicos Oficiales)", () => {
    it("debe retornar la lista de servicios clínicos oficiales de Regional 3", () => {
      const services = service.getClinicalServices();
      expect(services).toContain("UCI Adultos");
      expect(services).toContain("UCI Neurocríticos");
      expect(services).toContain("Urgencias / Trauma");
      expect(services).toContain("Quirófano de Extracción");
    });
  });
});
