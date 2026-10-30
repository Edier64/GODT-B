import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import {
  CreateDonorRecordInput,
  DonorRecord,
  DonorRecordStatus,
  UpdateDonorRecordInput,
} from "../../domain/donors/donor-record";
import { PrismaService } from "../prisma/prisma.service";
import { DonorRecordRepository } from "../../application/donors/donor-record.repository";

@Injectable()
export class PrismaDonorRecordRepository implements DonorRecordRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: CreateDonorRecordInput,
    createdById: string,
  ): Promise<DonorRecord> {
    return this.prisma.donorRecord.create({
      data: {
        rndCode: input.rndCode,
        originatingIpsName: input.originatingIpsName,
        clinicalService: input.clinicalService,
        fullName: input.fullName,
        documentNumber: input.documentNumber,
        status: input.status ?? "EN_VALORACION",
        anthropometry: input.anthropometry as Prisma.InputJsonValue | undefined,
        bloodGroup: input.bloodGroup,
        rhFactor: input.rhFactor,
        createdById,
      },
    }) as Promise<DonorRecord>;
  }

  async findById(id: string): Promise<DonorRecord | null> {
    return this.prisma.donorRecord.findUnique({
      where: { id },
    }) as Promise<DonorRecord | null>;
  }

  async findMany(input: {
    status?: DonorRecordStatus;
    rndCode?: string;
    createdById?: string;
    page: number;
    pageSize: number;
  }): Promise<{ items: DonorRecord[]; total: number }> {
    const where: Prisma.DonorRecordWhereInput = {
      status: input.status,
      rndCode: input.rndCode
        ? { contains: input.rndCode, mode: "insensitive" }
        : undefined,
      createdById: input.createdById,
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.donorRecord.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (input.page - 1) * input.pageSize,
        take: input.pageSize,
      }),
      this.prisma.donorRecord.count({ where }),
    ]);
    return { items: items as DonorRecord[], total };
  }

  async update(
    id: string,
    input: UpdateDonorRecordInput,
  ): Promise<DonorRecord> {
    return this.prisma.donorRecord.update({
      where: { id },
      data: input as Prisma.DonorRecordUpdateInput,
    }) as Promise<DonorRecord>;
  }
}
