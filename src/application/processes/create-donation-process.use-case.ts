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
    if (!input.primaryIpsName || typeof input.primaryIpsName !== "string" || !input.primaryIpsName.trim()) {
      throw new DonationProcessValidationError("primaryIpsName es requerida");
    }
    const primaryIpsName = input.primaryIpsName.trim();

    // Verificar alcance institucional
    if (
      user.role !== "ADMIN" &&
      !user.institutionalIps?.includes(primaryIpsName)
    ) {
      throw new DonationProcessAccessDeniedError(
        "No tiene autorización para abrir un proceso en la IPS indicada",
      );
    }

    // Resolver el donante: existente o nuevo registro preliminar/provisional
    let resolvedDonorId = input.donorId?.trim();
    let createdProvisionalDonorId: string | null = null;
    if (resolvedDonorId) {
      const donor = await this.donorRepository.findById(resolvedDonorId);
      if (!donor) {
        throw new DonationProcessValidationError(
          "El donante especificado no existe",
        );
      }
    } else {
      // Crear un nuevo DonorRecord preliminar de forma limpia y consistente
      // NOTA AUDITORÍA G.1.2: El RND oficial es emitido por el Instituto Nacional de Salud (INS).
      // Los códigos provisionales generados internamente se prefijan con 'PROV-RND-' para evitar
      // colisiones y marcar explícitamente la dependencia institucional pendiente.
      const currentYear = new Date().getFullYear();
      const randomSuffix = randomBytes(3).toString("hex").toUpperCase();
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
          institutionalDependency: "HOMOLOGACION_INS_PENDIENTE",
        },
      });

      resolvedDonorId = newDonor.id;
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

    try {
      const process = await this.repository.create(
        {
          ...input,
          donorId: resolvedDonorId,
          primaryIpsName,
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
    } catch (error) {
      if (createdProvisionalDonorId && this.donorRepository.delete) {
        await this.donorRepository.delete(createdProvisionalDonorId).catch(() => {});
      }
      throw error;
    }
  }
}
