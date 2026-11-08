import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import {
  AddProcessInstitutionInput,
  AddProcessParticipantInput,
  CreateDonationProcessInput,
  DonationProcess,
  DonationProcessStatus,
  ProcessInstitution,
  ProcessParticipant,
  UpdateDonationProcessInput,
} from "../../domain/processes/donation-process";
import {
  CreateProcessTransactionalInput,
  DonationProcessRepository,
} from "../../application/processes/donation-process.repository";

@Injectable()
export class PrismaDonationProcessRepository
  implements DonationProcessRepository
{
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: CreateDonationProcessInput & { donorId: string },
    openedById: string,
    processCode: string,
  ): Promise<DonationProcess> {
    const process = await this.prisma.donationProcess.create({
      data: {
        processCode,
        donorId: input.donorId,
        primaryIpsName: input.primaryIpsName,
        packageVersionId: input.packageVersionId,
        openedById,
        notes: input.notes,
        institutions: input.institutions?.length
          ? {
              create: input.institutions.map((inst) => ({
                institutionName: inst.institutionName,
                role: inst.role,
                notes: inst.notes,
              })),
            }
          : undefined,
        participants: input.participants?.length
          ? {
              create: input.participants.map((p) => ({
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
              })),
            }
          : undefined,
      },
      include: {
        donor: {
          select: {
            id: true,
            rndCode: true,
            fullName: true,
            documentNumber: true,
            originatingIpsName: true,
            status: true,
          },
        },
        institutions: true,
        participants: true,
      },
    });

    return process as unknown as DonationProcess;
  }

  async createTransactional(
    input: CreateProcessTransactionalInput,
  ): Promise<DonationProcess> {
    return this.prisma.$transaction(async (tx) => {
      let donorId = input.donorId;

      // 1. Crear DonorRecord provisional dentro de la transacción si aplica
      if (!donorId && input.provisionalDonorInput) {
        const newDonor = await tx.donorRecord.create({
          data: {
            rndCode: input.provisionalDonorInput.rndCode,
            originatingIpsName: input.provisionalDonorInput.originatingIpsName,
            clinicalService: input.provisionalDonorInput.clinicalService,
            fullName: input.provisionalDonorInput.fullName,
            documentNumber: input.provisionalDonorInput.documentNumber,
            status: input.provisionalDonorInput.status ?? "EN_VALORACION",
            bloodGroup: input.provisionalDonorInput.bloodGroup,
            rhFactor: input.provisionalDonorInput.rhFactor,
            createdById: input.openedById,
          },
        });
        donorId = newDonor.id;
      }

      if (!donorId) {
        throw new Error("donorId es requerido para abrir el proceso");
      }

      // 2. Crear DonationProcess dentro de la misma transacción
      const process = await tx.donationProcess.create({
        data: {
          processCode: input.processCode,
          donorId,
          primaryIpsName: input.processInput.primaryIpsName,
          packageVersionId: input.packageVersionId,
          openedById: input.openedById,
          notes: input.processInput.notes,
          institutions: input.processInput.institutions?.length
            ? {
                create: input.processInput.institutions.map((inst) => ({
                  institutionName: inst.institutionName,
                  role: inst.role,
                  notes: inst.notes,
                })),
              }
            : undefined,
          participants: input.processInput.participants?.length
            ? {
                create: input.processInput.participants.map((p) => ({
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
                })),
              }
            : undefined,
        },
        include: {
          donor: {
            select: {
              id: true,
              rndCode: true,
              fullName: true,
              documentNumber: true,
              originatingIpsName: true,
              status: true,
            },
          },
          institutions: true,
          participants: true,
        },
      });

      // 3. Crear las 23 posiciones documentales dentro de la misma transacción
      if (input.positions && input.positions.length > 0) {
        await tx.processDocument.createMany({
          data: input.positions.map((pos) => ({
            processId: process.id,
            positionNumber: pos.positionNumber,
            documentCode: pos.documentCode,
            title: pos.title,
            category: pos.category,
            orderIndex: pos.orderIndex,
            isMandatory: pos.isMandatory ?? true,
            rules: (pos.rules as any) ?? Prisma.DbNull,
            status: "PENDIENTE",
            applicabilityStatus: pos.defaultApplicability ?? "APLICABLE",
          })),
        });
      }

      // 4. Registrar los eventos de auditoría dentro de la transacción
      for (const event of input.auditEvents) {
        await tx.auditEvent.create({
          data: {
            actorUserId: event.actorUserId,
            action: event.action,
            entityType: event.entityType,
            entityId: event.entityType === "DONOR_RECORD" ? donorId : process.id,
            correlationId: event.correlationId,
            metadata: (event.metadata as Prisma.InputJsonValue) ?? Prisma.DbNull,
          },
        });
      }

      return process as unknown as DonationProcess;
    });
  }

  async findById(id: string): Promise<DonationProcess | null> {
    const process = await this.prisma.donationProcess.findUnique({
      where: { id },
      include: {
        donor: {
          select: {
            id: true,
            rndCode: true,
            fullName: true,
            documentNumber: true,
            originatingIpsName: true,
            status: true,
          },
        },
        institutions: {
          orderBy: { assignedAt: "asc" },
        },
        participants: {
          orderBy: { createdAt: "asc" },
        },
      },
    });

    return (process as unknown as DonationProcess) ?? null;
  }

  async findByCode(processCode: string): Promise<DonationProcess | null> {
    const process = await this.prisma.donationProcess.findUnique({
      where: { processCode },
      include: {
        donor: {
          select: {
            id: true,
            rndCode: true,
            fullName: true,
            documentNumber: true,
            originatingIpsName: true,
            status: true,
          },
        },
        institutions: true,
        participants: true,
      },
    });

    return (process as unknown as DonationProcess) ?? null;
  }

  async findMany(query: {
    status?: DonationProcessStatus;
    donorId?: string;
    primaryIpsName?: string;
    institutionalIps?: string[];
    page: number;
    pageSize: number;
  }): Promise<{ items: DonationProcess[]; total: number }> {
    const where: {
      status?: DonationProcessStatus;
      donorId?: string;
      primaryIpsName?: string | { in: string[] };
    } = {};

    if (query.status) where.status = query.status;
    if (query.donorId) where.donorId = query.donorId;
    if (query.primaryIpsName) {
      where.primaryIpsName = query.primaryIpsName;
    } else if (query.institutionalIps && query.institutionalIps.length > 0) {
      where.primaryIpsName = { in: query.institutionalIps };
    }

    const [items, total] = await Promise.all([
      this.prisma.donationProcess.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { openedAt: "desc" },
        include: {
          donor: {
            select: {
              id: true,
              rndCode: true,
              fullName: true,
              documentNumber: true,
              originatingIpsName: true,
              status: true,
            },
          },
          institutions: true,
          participants: true,
        },
      }),
      this.prisma.donationProcess.count({ where }),
    ]);

    return {
      items: items as unknown as DonationProcess[],
      total,
    };
  }

  async update(
    id: string,
    input: UpdateDonationProcessInput,
  ): Promise<DonationProcess> {
    const updated = await this.prisma.donationProcess.update({
      where: { id },
      data: {
        status: input.status,
        primaryIpsName: input.primaryIpsName,
        notes: input.notes,
        closedAt: input.closedAt,
        closedById: input.closedById,
      },
      include: {
        donor: {
          select: {
            id: true,
            rndCode: true,
            fullName: true,
            documentNumber: true,
            originatingIpsName: true,
            status: true,
          },
        },
        institutions: true,
        participants: true,
      },
    });

    return updated as unknown as DonationProcess;
  }

  async addInstitution(
    processId: string,
    input: AddProcessInstitutionInput,
  ): Promise<ProcessInstitution> {
    const institution = await this.prisma.processInstitution.create({
      data: {
        processId,
        institutionName: input.institutionName,
        role: input.role,
        notes: input.notes,
      },
    });

    return institution as unknown as ProcessInstitution;
  }

  async removeInstitution(
    processId: string,
    institutionId: string,
  ): Promise<void> {
    await this.prisma.processInstitution.delete({
      where: {
        id: institutionId,
        processId,
      },
    });
  }

  async addParticipant(
    processId: string,
    input: AddProcessParticipantInput,
  ): Promise<ProcessParticipant> {
    const participant = await this.prisma.processParticipant.create({
      data: {
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
      },
    });

    return participant as unknown as ProcessParticipant;
  }

  async removeParticipant(
    processId: string,
    participantId: string,
  ): Promise<void> {
    await this.prisma.processParticipant.delete({
      where: {
        id: participantId,
        processId,
      },
    });
  }

  async countByYear(year: number): Promise<number> {
    const start = new Date(`${year}-01-01T00:00:00.000Z`);
    const end = new Date(`${year + 1}-01-01T00:00:00.000Z`);
    return this.prisma.donationProcess.count({
      where: {
        openedAt: {
          gte: start,
          lt: end,
        },
      },
    });
  }
}

