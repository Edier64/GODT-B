import { Inject, Injectable, Optional } from "@nestjs/common";
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
  ) {}

  async execute(
    input: CreateDonationProcessInput,
    user: AuthenticatedUser,
  ): Promise<DonationProcess> {
    if (!input.donorId || typeof input.donorId !== "string") {
      throw new DonationProcessValidationError("donorId es requerido");
    }
    if (!input.primaryIpsName || typeof input.primaryIpsName !== "string") {
      throw new DonationProcessValidationError("primaryIpsName es requerida");
    }

    // Verificar que el donante existe
    const donor = await this.donorRepository.findById(input.donorId);
    if (!donor) {
      throw new DonationProcessValidationError("El donante especificado no existe");
    }

    // Verificar alcance institucional
    if (
      user.role !== "ADMIN" &&
      !user.institutionalIps?.includes(input.primaryIpsName)
    ) {
      throw new DonationProcessAccessDeniedError(
        "No tiene autorización para abrir un proceso en la IPS indicada",
      );
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

    const process = await this.repository.create(
      {
        ...input,
        primaryIpsName: input.primaryIpsName.trim(),
        processCode,
        packageVersionId,
      },
      user.userId,
      processCode,
    );

    // Crear las 23 posiciones de forma idempotente
    if (this.packageRepository) {
      await this.packageRepository.createProcessDocuments(process.id, positionsToCreate);
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
  }
}
