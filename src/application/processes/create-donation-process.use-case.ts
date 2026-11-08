import { Inject, Injectable, Optional } from "@nestjs/common";
import { randomBytes } from "node:crypto";
import {
  CreateDonationProcessInput,
  DonationProcess,
  DonationProcessAccessDeniedError,
  DonationProcessConflictError,
  DonationProcessValidationError,
} from "../../domain/processes/donation-process";
import {
  DONATION_PROCESS_REPOSITORY,
  DonationProcessRepository,
} from "./donation-process.repository";
import {
  DONOR_RECORD_REPOSITORY,
  DonorRecordRepository,
} from "../donors/donor-record.repository";
import { AUDIT_EVENT_PORT, AuditEventPort } from "../audit/audit-event.port";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";
import {
  PROCESS_PACKAGE_REPOSITORY,
  ProcessPackageRepository,
} from "../packages/process-package.repository";
import { InstitutionService } from "../institutions/institution.service";
import {
  OFFICIAL_REGIONAL_3_POSITIONS,
  PackagePositionDefinition,
} from "../../domain/packages/process-package";

@Injectable()
export class CreateDonationProcessUseCase {
  constructor(
    @Inject(DONATION_PROCESS_REPOSITORY)
    private readonly repository: DonationProcessRepository,
    @Inject(DONOR_RECORD_REPOSITORY)
    private readonly donorRepository: DonorRecordRepository,
    @Inject(AUDIT_EVENT_PORT)
    private readonly audit: AuditEventPort,
    @Optional()
    @Inject(PROCESS_PACKAGE_REPOSITORY)
    private readonly packageRepository?: ProcessPackageRepository,
    @Optional()
    private readonly institutionService?: InstitutionService,
  ) {}

  async execute(
    input: CreateDonationProcessInput,
    user: AuthenticatedUser,
  ): Promise<DonationProcess> {
    if (!input.primaryIpsName || typeof input.primaryIpsName !== "string" || !input.primaryIpsName.trim()) {
      throw new DonationProcessValidationError("primaryIpsName es requerida");
    }

    let primaryIpsName = input.primaryIpsName.trim();

    // Resolver y validar alcance institucional mediante el servicio de entidades maestras
    if (this.institutionService) {
      const resolved = await this.institutionService.resolveIpsForProcess(
        primaryIpsName,
        user,
      );
      primaryIpsName = resolved.canonicalName;
    } else {
      // Verificación directa de respaldo para pruebas unitarias sin servicio de entidades
      if (
        user.role !== "ADMIN" &&
        !user.institutionalIps?.includes(primaryIpsName)
      ) {
        throw new DonationProcessAccessDeniedError(
          "No tiene autorización para abrir un proceso en la IPS indicada",
        );
      }
    }

    // Resolver el donante: existente o nuevo registro preliminar/provisional
    let resolvedDonorId = input.donorId?.trim();
    if (resolvedDonorId) {
      const donor = await this.donorRepository.findById(resolvedDonorId);
      if (!donor) {
        throw new DonationProcessValidationError(
          "El donante especificado no existe",
        );
      }
    }

    // Generar o validar código legible
    const currentYear = new Date().getFullYear();
    let processCode = input.processCode?.trim();
    if (processCode) {
      const existing = await this.repository.findByCode(processCode);
      if (existing) {
        throw new DonationProcessConflictError(
          `El código de proceso '${processCode}' ya se encuentra registrado`,
        );
      }
    } else {
      const count = await this.repository.countByYear(currentYear);
      processCode = `PROC-${currentYear}-${(count + 1).toString().padStart(4, "0")}`;
    }

    // Resolver versión de paquete documental
    let packageVersionId = input.packageVersionId;
    let positionsToCreate: PackagePositionDefinition[] = [...OFFICIAL_REGIONAL_3_POSITIONS];

    if (this.packageRepository) {
      if (packageVersionId) {
        const version = await this.packageRepository.findVersionById(packageVersionId);
        if (version && Array.isArray(version.positionsConfig)) {
          positionsToCreate = version.positionsConfig;
        }
      } else {
        const defaultVersion = await this.packageRepository.createDefaultPackage(user.userId);
        packageVersionId = defaultVersion.id;
        if (Array.isArray(defaultVersion.positionsConfig)) {
          positionsToCreate = defaultVersion.positionsConfig;
        }
      }
    }

    // Bucle con reintentos controlados ante colisiones de unicidad en identificadores provisionales
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      // 128 bits de entropía criptográfica (16 bytes = 32 caracteres hexadecimales)
      const randomSuffix = randomBytes(16).toString("hex").toUpperCase();
      const provisionalRnd =
        input.donor?.rndCode?.trim() ||
        `PROV-RND-${currentYear}-${randomSuffix}`;
      const originatingIps =
        input.donor?.originatingIpsName?.trim() || primaryIpsName;
      const clinicalService =
        input.donor?.clinicalService?.trim() ||
        "UCI / Urgencias (Valoración preliminar)";
      const fullName =
        input.donor?.fullName?.trim() || "Donante en valoración preliminar";
      const documentNumber =
        input.donor?.documentNumber?.trim() ||
        `PROV-DOC-${currentYear}-${randomSuffix}`;

      // 1. Ruta transaccional atómica de base de datos (Prisma $transaction)
      if (this.repository.createTransactional) {
        try {
          const auditEvents = [];
          if (!resolvedDonorId) {
            auditEvents.push({
              actorUserId: user.userId,
              action: "DONOR_CREATED",
              entityType: "DONOR_RECORD",
              correlationId: `corr-donor-${randomSuffix}`,
              metadata: {
                source: "donation-process-bootstrap",
                originatingIpsName: originatingIps,
                isProvisionalRnd: !input.donor?.rndCode?.trim(),
                isProvisionalDocument: !input.donor?.documentNumber?.trim(),
                entropyBits: 128,
                institutionalDependency: "HOMOLOGACION_INS_PENDIENTE",
              },
            });
          }
          auditEvents.push({
            actorUserId: user.userId,
            action: "PROCESS_OPENED",
            entityType: "DONATION_PROCESS",
            correlationId: `corr-proc-${randomSuffix}`,
            metadata: {
              processCode,
              primaryIpsName,
              packageVersionId,
              totalPositions: positionsToCreate.length,
            },
          });

          return await this.repository.createTransactional({
            processInput: input,
            provisionalDonorInput: !resolvedDonorId
              ? {
                  rndCode: provisionalRnd,
                  originatingIpsName: originatingIps,
                  clinicalService,
                  fullName,
                  documentNumber,
                  status: "EN_VALORACION",
                  bloodGroup: input.donor?.bloodGroup?.trim(),
                  rhFactor: input.donor?.rhFactor?.trim(),
                }
              : undefined,
            donorId: resolvedDonorId,
            openedById: user.userId,
            processCode,
            packageVersionId,
            positions: positionsToCreate,
            auditEvents,
          });
        } catch (error: any) {
          const isUniqueConflict =
            error?.code === "P2002" ||
            error?.message?.includes("Unique constraint") ||
            error?.message?.includes("ya se encuentra registrado");
          if (isUniqueConflict && attempt < 3 && !input.donor?.rndCode) {
            continue; // Reintentar generando un nuevo identificador de 128 bits
          }
          throw error;
        }
      }

      // 2. Ruta desacoplada para repositorios mock en pruebas unitarias
      let createdProvisionalDonorId: string | null = null;
      try {
        let finalDonorId = resolvedDonorId;
        if (!finalDonorId) {
          const newDonor = await this.donorRepository.create(
            {
              rndCode: provisionalRnd,
              originatingIpsName: originatingIps,
              clinicalService,
              fullName,
              documentNumber,
              status: "EN_VALORACION",
              bloodGroup: input.donor?.bloodGroup?.trim(),
              rhFactor: input.donor?.rhFactor?.trim(),
            },
            user.userId,
          );
          createdProvisionalDonorId = newDonor.id;
          finalDonorId = newDonor.id;

          await this.audit.record({
            actorUserId: user.userId,
            action: "DONOR_CREATED",
            entityType: "DONOR_RECORD",
            entityId: newDonor.id,
            correlationId: newDonor.id,
            metadata: {
              source: "donation-process-bootstrap",
              originatingIpsName: originatingIps,
              isProvisionalRnd: !input.donor?.rndCode?.trim(),
              isProvisionalDocument: !input.donor?.documentNumber?.trim(),
              entropyBits: 128,
              institutionalDependency: "HOMOLOGACION_INS_PENDIENTE",
            },
          });
        }

        const process = await this.repository.create(
          {
            ...input,
            donorId: finalDonorId,
            primaryIpsName,
            processCode,
            packageVersionId,
          },
          user.userId,
          processCode,
        );

        if (this.packageRepository) {
          await this.packageRepository.createProcessDocuments(
            process.id,
            positionsToCreate,
          );
        }

        await this.audit.record({
          actorUserId: user.userId,
          action: "PROCESS_OPENED",
          entityType: "DONATION_PROCESS",
          entityId: process.id,
          correlationId: process.id,
          metadata: {
            processCode: process.processCode,
            donorId: process.donorId,
            primaryIpsName: process.primaryIpsName,
            packageVersionId,
            totalPositions: positionsToCreate.length,
          },
        });

        return process;
      } catch (error: any) {
        if (createdProvisionalDonorId && this.donorRepository.delete) {
          await this.donorRepository.delete(createdProvisionalDonorId).catch(() => {});
        }
        const isUniqueConflict =
          error?.code === "P2002" ||
          error?.message?.includes("Unique constraint");
        if (isUniqueConflict && attempt < 3 && !input.donor?.rndCode) {
          continue;
        }
        throw error;
      }
    }

    throw new DonationProcessConflictError(
      "No fue posible generar un identificador provisional único tras múltiples reintentos.",
    );
  }
}
