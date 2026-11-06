import { CreateDonationProcessUseCase } from "../src/application/processes/create-donation-process.use-case";
import { GetDonationProcessUseCase } from "../src/application/processes/get-donation-process.use-case";
import { ListDonationProcessesUseCase } from "../src/application/processes/list-donation-processes.use-case";
import { UpdateDonationProcessUseCase } from "../src/application/processes/update-donation-process.use-case";
import { AddProcessInstitutionUseCase } from "../src/application/processes/add-institution.use-case";
import { AddProcessParticipantUseCase } from "../src/application/processes/add-participant.use-case";
import {
  AddProcessInstitutionInput,
  AddProcessParticipantInput,
  CreateDonationProcessInput,
  DonationProcess,
  DonationProcessAccessDeniedError,
  DonationProcessConflictError,
  DonationProcessNotFoundError,
  DonationProcessStatus,
  ProcessInstitution,
  ProcessParticipant,
  UpdateDonationProcessInput,
} from "../src/domain/processes/donation-process";
import { DonationProcessRepository } from "../src/application/processes/donation-process.repository";
import { DonorRecordRepository } from "../src/application/donors/donor-record.repository";
import { AuditEventPort } from "../src/application/audit/audit-event.port";
import { AuthenticatedUser } from "../src/presentation/auth/auth.types";
import { DonorRecord } from "../src/domain/donors/donor-record";

describe("DonationProcess Use Cases (Phase A)", () => {
  let processes: Map<string, DonationProcess>;
  let institutions: Map<string, ProcessInstitution[]>;
  let participants: Map<string, ProcessParticipant[]>;
  let mockRepository: DonationProcessRepository;
  let mockDonorRepository: Partial<DonorRecordRepository>;
  let mockAuditPort: AuditEventPort;
  let auditLogs: unknown[];

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

  const otherHospitalUser: AuthenticatedUser = {
    userId: "00000000-0000-0000-0000-000000000003",
    role: "COORDINATOR",
    institutionalIps: ["Clínica Imbanaco"],
  };

  const mockDonor: DonorRecord = {
    id: "donor-uuid-1234",
    rndCode: "RND-2026-9999",
    status: "EN_VALORACION",
    originatingIpsName: "Hospital Universitario del Valle",
    clinicalService: "UCI Adultos",
    fullName: "Juan Pérez Donante",
    documentNumber: "12345678",
    anthropometry: null,
    bloodGroup: "O",
    rhFactor: "POSITIVO",
    clinicalData: null,
    createdById: adminUser.userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(() => {
    processes = new Map();
    institutions = new Map();
    participants = new Map();
    auditLogs = [];

    mockAuditPort = {
      record: jest.fn().mockImplementation((event) => {
        auditLogs.push(event);
        return Promise.resolve();
      }),
    };

    mockDonorRepository = {
      findById: jest.fn().mockImplementation((id: string) => {
        if (id === mockDonor.id) return Promise.resolve(mockDonor);
        return Promise.resolve(null);
      }),
    };

    mockRepository = {
      create: jest.fn().mockImplementation(
        async (
          input: CreateDonationProcessInput,
          openedById: string,
          processCode: string,
        ): Promise<DonationProcess> => {
          const id = `proc-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
          const proc: DonationProcess = {
            id,
            processCode,
            donorId: input.donorId,
            status: "EN_VALORACION",
            primaryIpsName: input.primaryIpsName,
            openedById,
            notes: input.notes,
            openedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
            institutions: (input.institutions ?? []).map((inst, idx) => ({
              id: `inst-${idx + 1}`,
              processId: id,
              institutionName: inst.institutionName,
              role: inst.role,
              notes: inst.notes,
              assignedAt: new Date(),
              createdAt: new Date(),
              updatedAt: new Date(),
            })),
            participants: (input.participants ?? []).map((p, idx) => ({
              id: `part-${idx + 1}`,
              processId: id,
              fullName: p.fullName,
              role: p.role,
              documentType: p.documentType,
              documentNumber: p.documentNumber,
              professionalId: p.professionalId,
              institution: p.institution,
              relationshipToDonor: p.relationshipToDonor,
              phone: p.phone,
              email: p.email,
              notes: p.notes,
              systemUserId: p.systemUserId,
              createdAt: new Date(),
              updatedAt: new Date(),
            })),
            donor: {
              id: mockDonor.id,
              rndCode: mockDonor.rndCode,
              fullName: mockDonor.fullName,
              documentNumber: mockDonor.documentNumber,
              originatingIpsName: mockDonor.originatingIpsName,
              status: mockDonor.status,
            },
          };
          processes.set(id, proc);
          institutions.set(id, proc.institutions ?? []);
          participants.set(id, proc.participants ?? []);
          return proc;
        },
      ),

      findById: jest.fn().mockImplementation((id: string) => {
        const found = processes.get(id);
        if (!found) return Promise.resolve(null);
        return Promise.resolve({
          ...found,
          institutions: institutions.get(id) ?? [],
          participants: participants.get(id) ?? [],
        });
      }),

      findByCode: jest.fn().mockImplementation((code: string) => {
        for (const proc of processes.values()) {
          if (proc.processCode === code) return Promise.resolve(proc);
        }
        return Promise.resolve(null);
      }),

      findMany: jest.fn().mockImplementation(
        (query: {
          status?: DonationProcessStatus;
          donorId?: string;
          primaryIpsName?: string;
          institutionalIps?: string[];
          page: number;
          pageSize: number;
        }) => {
          let list = Array.from(processes.values());
          if (query.status) {
            list = list.filter((p) => p.status === query.status);
          }
          if (query.donorId) {
            list = list.filter((p) => p.donorId === query.donorId);
          }
          if (query.primaryIpsName) {
            list = list.filter((p) => p.primaryIpsName === query.primaryIpsName);
          } else if (query.institutionalIps && query.institutionalIps.length > 0) {
            list = list.filter((p) => query.institutionalIps!.includes(p.primaryIpsName));
          }
          const total = list.length;
          const items = list.slice(
            (query.page - 1) * query.pageSize,
            query.page * query.pageSize,
          );
          return Promise.resolve({ items, total });
        },
      ),

      update: jest.fn().mockImplementation((id: string, input: UpdateDonationProcessInput) => {
        const current = processes.get(id);
        if (!current) throw new DonationProcessNotFoundError();
        const updated: DonationProcess = {
          ...current,
          ...input,
          updatedAt: new Date(),
        };
        processes.set(id, updated);
        return Promise.resolve(updated);
      }),

      addInstitution: jest.fn().mockImplementation(
        (processId: string, input: AddProcessInstitutionInput): Promise<ProcessInstitution> => {
          const list = institutions.get(processId) ?? [];
          const inst: ProcessInstitution = {
            id: `inst-${Date.now()}`,
            processId,
            institutionName: input.institutionName,
            role: input.role,
            notes: input.notes,
            assignedAt: new Date(),
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          list.push(inst);
          institutions.set(processId, list);
          return Promise.resolve(inst);
        },
      ),

      removeInstitution: jest.fn().mockImplementation((processId: string, institutionId: string) => {
        const list = (institutions.get(processId) ?? []).filter((i) => i.id !== institutionId);
        institutions.set(processId, list);
        return Promise.resolve();
      }),

      addParticipant: jest.fn().mockImplementation(
        (processId: string, input: AddProcessParticipantInput): Promise<ProcessParticipant> => {
          const list = participants.get(processId) ?? [];
          const part: ProcessParticipant = {
            id: `part-${Date.now()}`,
            processId,
            fullName: input.fullName,
            role: input.role,
            documentType: input.documentType,
            documentNumber: input.documentNumber,
            professionalId: input.professionalId,
            institution: input.institution,
            relationshipToDonor: input.relationshipToDonor,
            phone: input.phone,
            email: input.email,
            notes: input.notes,
            systemUserId: input.systemUserId,
            createdAt: new Date(),
            updatedAt: new Date(),
          };
          list.push(part);
          participants.set(processId, list);
          return Promise.resolve(part);
        },
      ),

      removeParticipant: jest.fn().mockImplementation((processId: string, participantId: string) => {
        const list = (participants.get(processId) ?? []).filter((p) => p.id !== participantId);
        participants.set(processId, list);
        return Promise.resolve();
      }),

      countByYear: jest.fn().mockImplementation(() => Promise.resolve(processes.size)),
    };
  });

  describe("Apertura de proceso (CreateDonationProcessUseCase)", () => {
    it("debe abrir un proceso con datos mínimos sin requerir historia clínica ni participantes", async () => {
      const useCase = new CreateDonationProcessUseCase(
        mockRepository,
        mockDonorRepository as DonorRecordRepository,
        mockAuditPort,
      );

      const process = await useCase.execute(
        {
          donorId: mockDonor.id,
          primaryIpsName: "Hospital Universitario del Valle",
        },
        coordinatorUser,
      );

      expect(process.id).toBeDefined();
      expect(process.processCode).toMatch(/^PROC-\d{4}-\d{4}$/);
      expect(process.status).toBe("EN_VALORACION");
      expect(process.donorId).toBe(mockDonor.id);
      expect(process.primaryIpsName).toBe("Hospital Universitario del Valle");
      expect(auditLogs).toHaveLength(1);
      expect(auditLogs[0]).toMatchObject({
        action: "PROCESS_OPENED",
        entityType: "DONATION_PROCESS",
        entityId: process.id,
      });
    });

    it("debe rechazar la apertura si el donante no existe", async () => {
      const useCase = new CreateDonationProcessUseCase(
        mockRepository,
        mockDonorRepository as DonorRecordRepository,
        mockAuditPort,
      );

      await expect(
        useCase.execute(
          {
            donorId: "non-existent-donor",
            primaryIpsName: "Hospital Universitario del Valle",
          },
          coordinatorUser,
        ),
      ).rejects.toThrow("El donante especificado no existe");
    });

    it("debe denegar el acceso si el usuario no tiene la IPS en su alcance", async () => {
      const useCase = new CreateDonationProcessUseCase(
        mockRepository,
        mockDonorRepository as DonorRecordRepository,
        mockAuditPort,
      );

      await expect(
        useCase.execute(
          {
            donorId: mockDonor.id,
            primaryIpsName: "Hospital Universitario del Valle",
          },
          otherHospitalUser,
        ),
      ).rejects.toThrow(DonationProcessAccessDeniedError);
    });

    it("debe permitir a un ADMIN abrir un proceso en cualquier IPS", async () => {
      const useCase = new CreateDonationProcessUseCase(
        mockRepository,
        mockDonorRepository as DonorRecordRepository,
        mockAuditPort,
      );

      const process = await useCase.execute(
        {
          donorId: mockDonor.id,
          primaryIpsName: "Hospital Universitario del Valle",
          processCode: "PROC-2026-CUSTOM",
        },
        adminUser,
      );

      expect(process.processCode).toBe("PROC-2026-CUSTOM");
    });

    it("debe rechazar la creación si el código ya existe", async () => {
      const useCase = new CreateDonationProcessUseCase(
        mockRepository,
        mockDonorRepository as DonorRecordRepository,
        mockAuditPort,
      );

      await useCase.execute(
        {
          donorId: mockDonor.id,
          primaryIpsName: "Hospital Universitario del Valle",
          processCode: "PROC-DUPLICATE",
        },
        adminUser,
      );

      await expect(
        useCase.execute(
          {
            donorId: mockDonor.id,
            primaryIpsName: "Hospital Universitario del Valle",
            processCode: "PROC-DUPLICATE",
          },
          adminUser,
        ),
      ).rejects.toThrow(DonationProcessConflictError);
    });
  });

  describe("Consulta y filtrado (GetDonationProcessUseCase & ListDonationProcessesUseCase)", () => {
    it("debe consultar un proceso existente y validar permisos", async () => {
      const createUseCase = new CreateDonationProcessUseCase(
        mockRepository,
        mockDonorRepository as DonorRecordRepository,
        mockAuditPort,
      );
      const getUseCase = new GetDonationProcessUseCase(mockRepository);

      const created = await createUseCase.execute(
        {
          donorId: mockDonor.id,
          primaryIpsName: "Hospital Universitario del Valle",
        },
        coordinatorUser,
      );

      const fetched = await getUseCase.execute(created.id, coordinatorUser);
      expect(fetched.id).toBe(created.id);
      expect(fetched.primaryIpsName).toBe("Hospital Universitario del Valle");

      // Usuario de otra institución recibe error de acceso
      await expect(getUseCase.execute(created.id, otherHospitalUser)).rejects.toThrow(
        DonationProcessAccessDeniedError,
      );
    });

    it("debe listar procesos filtrando por alcance institucional del usuario", async () => {
      const createUseCase = new CreateDonationProcessUseCase(
        mockRepository,
        mockDonorRepository as DonorRecordRepository,
        mockAuditPort,
      );
      const listUseCase = new ListDonationProcessesUseCase(mockRepository);

      await createUseCase.execute(
        {
          donorId: mockDonor.id,
          primaryIpsName: "Hospital Universitario del Valle",
        },
        adminUser,
      );

      const coordList = await listUseCase.execute({}, coordinatorUser);
      expect(coordList.total).toBe(1);

      const otherList = await listUseCase.execute({}, otherHospitalUser);
      expect(otherList.total).toBe(0);

      const adminList = await listUseCase.execute({}, adminUser);
      expect(adminList.total).toBe(1);
    });
  });

  describe("Actualización de proceso (UpdateDonationProcessUseCase)", () => {
    it("debe actualizar el estado a COMPLETADO registrando fecha y usuario de cierre", async () => {
      const createUseCase = new CreateDonationProcessUseCase(
        mockRepository,
        mockDonorRepository as DonorRecordRepository,
        mockAuditPort,
      );
      const updateUseCase = new UpdateDonationProcessUseCase(mockRepository, mockAuditPort);

      const created = await createUseCase.execute(
        {
          donorId: mockDonor.id,
          primaryIpsName: "Hospital Universitario del Valle",
        },
        coordinatorUser,
      );

      const updated = await updateUseCase.execute(
        created.id,
        {
          status: "COMPLETADO",
          notes: "Operativo finalizado satisfactoriamente",
        },
        coordinatorUser,
      );

      expect(updated.status).toBe("COMPLETADO");
      expect(updated.closedAt).toBeDefined();
      expect(updated.closedById).toBe(coordinatorUser.userId);
      expect(updated.notes).toBe("Operativo finalizado satisfactoriamente");
    });
  });

  describe("Gestión de Instituciones y Participantes (AddInstitution & AddParticipant)", () => {
    it("debe agregar instituciones con roles operativos específicos al proceso", async () => {
      const createUseCase = new CreateDonationProcessUseCase(
        mockRepository,
        mockDonorRepository as DonorRecordRepository,
        mockAuditPort,
      );
      const addInstUseCase = new AddProcessInstitutionUseCase(mockRepository, mockAuditPort);
      const getUseCase = new GetDonationProcessUseCase(mockRepository);

      const created = await createUseCase.execute(
        {
          donorId: mockDonor.id,
          primaryIpsName: "Hospital Universitario del Valle",
        },
        coordinatorUser,
      );

      const institution = await addInstUseCase.execute(
        created.id,
        {
          institutionName: "Banco de Tejidos Regional 3",
          role: "BANCO_TEJIDOS",
          notes: "Receptor de tejidos oculares y osteomusculares",
        },
        coordinatorUser,
      );

      expect(institution.id).toBeDefined();
      expect(institution.role).toBe("BANCO_TEJIDOS");

      const fetched = await getUseCase.execute(created.id, coordinatorUser);
      expect(fetched.institutions).toHaveLength(1);
      expect(fetched.institutions![0].institutionName).toBe("Banco de Tejidos Regional 3");
    });

    it("debe agregar participantes diferenciando identidad y rol en el operativo", async () => {
      const createUseCase = new CreateDonationProcessUseCase(
        mockRepository,
        mockDonorRepository as DonorRecordRepository,
        mockAuditPort,
      );
      const addPartUseCase = new AddProcessParticipantUseCase(mockRepository, mockAuditPort);
      const getUseCase = new GetDonationProcessUseCase(mockRepository);

      const created = await createUseCase.execute(
        {
          donorId: mockDonor.id,
          primaryIpsName: "Hospital Universitario del Valle",
        },
        coordinatorUser,
      );

      const participant = await addPartUseCase.execute(
        created.id,
        {
          fullName: "Dra. Carmen Mendoza",
          role: "CIRUJANO_RESCATE",
          documentType: "CC",
          documentNumber: "52148963",
          professionalId: "MP-987654",
          institution: "Clínica Imbanaco",
          phone: "3101234567",
        },
        coordinatorUser,
      );

      expect(participant.id).toBeDefined();
      expect(participant.role).toBe("CIRUJANO_RESCATE");
      expect(participant.professionalId).toBe("MP-987654");

      const fetched = await getUseCase.execute(created.id, coordinatorUser);
      expect(fetched.participants).toHaveLength(1);
      expect(fetched.participants![0].fullName).toBe("Dra. Carmen Mendoza");
    });
  });
});
