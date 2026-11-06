import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  DocumentApplicability,
  OFFICIAL_REGIONAL_3_POSITIONS,
  PackagePositionDefinition,
  ProcessDocument,
  ProcessDocumentStatus,
  ProcessPackage,
  ProcessPackageVersion,
} from "../../domain/packages/process-package";
import { ProcessPackageRepository } from "../../application/packages/process-package.repository";
import { Prisma } from "@prisma/client";

@Injectable()
export class PrismaProcessPackageRepository implements ProcessPackageRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findActivePackage(): Promise<ProcessPackage | null> {
    const pkg = await this.prisma.processPackage.findFirst({
      where: { isActive: true },
      include: {
        versions: {
          where: { status: "PUBLISHED" },
          orderBy: { createdAt: "desc" },
          take: 1,
        },
      },
    });

    return (pkg as unknown as ProcessPackage) ?? null;
  }

  async findPackageByCode(code: string): Promise<ProcessPackage | null> {
    const pkg = await this.prisma.processPackage.findUnique({
      where: { code },
      include: {
        versions: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return (pkg as unknown as ProcessPackage) ?? null;
  }

  async findLatestPublishedVersion(
    packageId: string,
  ): Promise<ProcessPackageVersion | null> {
    const version = await this.prisma.processPackageVersion.findFirst({
      where: {
        packageId,
        status: "PUBLISHED",
      },
      orderBy: { createdAt: "desc" },
    });

    return (version as unknown as ProcessPackageVersion) ?? null;
  }

  async findVersionById(id: string): Promise<ProcessPackageVersion | null> {
    const version = await this.prisma.processPackageVersion.findUnique({
      where: { id },
    });

    return (version as unknown as ProcessPackageVersion) ?? null;
  }

  async createDefaultPackage(actorUserId: string): Promise<ProcessPackageVersion> {
    const code = "PAQUETE_REGIONAL_3";
    let pkg = await this.prisma.processPackage.findUnique({ where: { code } });

    if (!pkg) {
      pkg = await this.prisma.processPackage.create({
        data: {
          code,
          name: "Paquete Operativo de Donación Regional 3",
          description:
            "Paquete normativo oficial estructurado con 23 posiciones documentales para la Regional 3",
          isActive: true,
          createdById: actorUserId,
        },
      });
    }

    const versionNumber = "1.0.0";
    let version = await this.prisma.processPackageVersion.findUnique({
      where: {
        packageId_versionNumber: {
          packageId: pkg.id,
          versionNumber,
        },
      },
    });

    if (!version) {
      version = await this.prisma.processPackageVersion.create({
        data: {
          packageId: pkg.id,
          versionNumber,
          status: "PUBLISHED",
          description: "Versión base oficial del paquete documental de 23 posiciones",
          positionsConfig: OFFICIAL_REGIONAL_3_POSITIONS as unknown as Prisma.InputJsonValue,
          createdById: actorUserId,
          authorizedById: actorUserId,
          publishedAt: new Date(),
        },
      });
    }

    return version as unknown as ProcessPackageVersion;
  }

  async createProcessDocuments(
    processId: string,
    positions: PackagePositionDefinition[],
  ): Promise<ProcessDocument[]> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.processDocument.findMany({
        where: { processId },
      });

      if (existing.length >= positions.length) {
        return existing as unknown as ProcessDocument[];
      }

      const existingCodes = new Set(existing.map((d) => d.documentCode));

      for (const pos of positions) {
        if (!existingCodes.has(pos.documentCode)) {
          // Si tiene templateCode, intentar enlazarlo con DocumentTemplate
          let templateId: string | undefined;
          let templateVersionId: string | undefined;

          if (pos.templateCode) {
            const t = await tx.documentTemplate.findUnique({
              where: { templateCode: pos.templateCode },
              include: {
                versions: {
                  where: { status: { in: ["PUBLISHED", "DRAFT"] } },
                  orderBy: { createdAt: "desc" },
                  take: 1,
                },
              },
            });
            if (t && t.versions.length) {
              templateId = t.id;
              templateVersionId = t.versions[0].id;
            }
          }

          await tx.processDocument.create({
            data: {
              processId,
              positionNumber: pos.positionNumber,
              documentCode: pos.documentCode,
              title: pos.title,
              category: pos.category,
              status: "PENDIENTE",
              applicabilityStatus: pos.defaultApplicability,
              isMandatory: pos.isMandatory,
              orderIndex: pos.orderIndex,
              rules: pos.rules as Prisma.InputJsonValue | undefined,
              templateId,
              templateVersionId,
            },
          });
        }
      }

      const all = await tx.processDocument.findMany({
        where: { processId },
        orderBy: { orderIndex: "asc" },
        include: {
          template: {
            select: { id: true, templateCode: true, name: true, category: true },
          },
          templateVersion: {
            select: { id: true, versionNumber: true, status: true },
          },
          currentInstance: {
            select: { id: true, status: true, currentRevisionId: true, createdAt: true, updatedAt: true },
          },
        },
      });

      return all as unknown as ProcessDocument[];
    });
  }

  async listProcessDocuments(processId: string): Promise<ProcessDocument[]> {
    const docs = await this.prisma.processDocument.findMany({
      where: { processId },
      orderBy: { orderIndex: "asc" },
      include: {
        template: {
          select: { id: true, templateCode: true, name: true, category: true },
        },
        templateVersion: {
          select: { id: true, versionNumber: true, status: true },
        },
        currentInstance: {
          select: { id: true, status: true, currentRevisionId: true, createdAt: true, updatedAt: true },
        },
        instances: {
          select: { id: true, status: true, createdAt: true, updatedAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return docs as unknown as ProcessDocument[];
  }

  async findProcessDocumentById(id: string): Promise<ProcessDocument | null> {
    const doc = await this.prisma.processDocument.findUnique({
      where: { id },
      include: {
        template: {
          select: { id: true, templateCode: true, name: true, category: true },
        },
        templateVersion: {
          select: { id: true, versionNumber: true, status: true },
        },
        currentInstance: {
          select: { id: true, status: true, currentRevisionId: true, createdAt: true, updatedAt: true },
        },
        instances: {
          select: { id: true, status: true, createdAt: true, updatedAt: true },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return (doc as unknown as ProcessDocument) ?? null;
  }

  async findProcessDocumentByCode(
    processId: string,
    documentCode: string,
  ): Promise<ProcessDocument | null> {
    const doc = await this.prisma.processDocument.findUnique({
      where: {
        processId_documentCode: {
          processId,
          documentCode,
        },
      },
      include: {
        template: {
          select: { id: true, templateCode: true, name: true, category: true },
        },
        templateVersion: {
          select: { id: true, versionNumber: true, status: true },
        },
        currentInstance: {
          select: { id: true, status: true, currentRevisionId: true, createdAt: true, updatedAt: true },
        },
      },
    });

    return (doc as unknown as ProcessDocument) ?? null;
  }

  async updateProcessDocumentApplicability(
    id: string,
    applicabilityStatus: DocumentApplicability,
    nonApplicabilityReason?: string,
  ): Promise<ProcessDocument> {
    const updated = await this.prisma.processDocument.update({
      where: { id },
      data: {
        applicabilityStatus,
        nonApplicabilityReason,
      },
      include: {
        template: true,
        templateVersion: true,
        currentInstance: true,
      },
    });

    return updated as unknown as ProcessDocument;
  }

  async updateProcessDocumentStatus(
    id: string,
    status: ProcessDocumentStatus,
  ): Promise<ProcessDocument> {
    const updated = await this.prisma.processDocument.update({
      where: { id },
      data: { status },
      include: {
        template: true,
        templateVersion: true,
        currentInstance: true,
      },
    });

    return updated as unknown as ProcessDocument;
  }

  async setProcessDocumentInstance(
    documentId: string,
    instanceId: string,
  ): Promise<ProcessDocument> {
    const updated = await this.prisma.processDocument.update({
      where: { id: documentId },
      data: {
        currentInstanceId: instanceId,
      },
      include: {
        template: true,
        templateVersion: true,
        currentInstance: true,
      },
    });

    return updated as unknown as ProcessDocument;
  }

  async linkTemplateToDocument(
    documentId: string,
    templateId: string,
    templateVersionId: string,
  ): Promise<ProcessDocument> {
    const updated = await this.prisma.processDocument.update({
      where: { id: documentId },
      data: {
        templateId,
        templateVersionId,
      },
      include: {
        template: true,
        templateVersion: true,
        currentInstance: true,
      },
    });

    return updated as unknown as ProcessDocument;
  }
}

