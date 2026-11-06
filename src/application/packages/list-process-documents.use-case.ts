import { Inject, Injectable } from "@nestjs/common";
import {
  ProcessDocument,
  ProcessPackageNotFoundError,
} from "../../domain/packages/process-package";
import {
  PROCESS_PACKAGE_REPOSITORY,
  ProcessPackageRepository,
} from "./process-package.repository";
import {
  DONATION_PROCESS_REPOSITORY,
  DonationProcessRepository,
} from "../processes/donation-process.repository";
import {
  DonationProcessAccessDeniedError,
  DonationProcessNotFoundError,
} from "../../domain/processes/donation-process";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";

export interface ProcessDocumentsSummary {
  processId: string;
  totalPositions: number;
  applicableCount: number;
  completedCount: number;
  signedCount: number;
  inProgressCount: number;
  pendingCount: number;
  nonApplicableCount: number;
  progressPercentage: number;
  documents: ProcessDocument[];
}

@Injectable()
export class ListProcessDocumentsUseCase {
  constructor(
    @Inject(PROCESS_PACKAGE_REPOSITORY)
    private readonly packageRepository: ProcessPackageRepository,
    @Inject(DONATION_PROCESS_REPOSITORY)
    private readonly processRepository: DonationProcessRepository,
  ) {}

  async execute(
    processId: string,
    user: AuthenticatedUser,
  ): Promise<ProcessDocumentsSummary> {
    const process = await this.processRepository.findById(processId);
    if (!process) {
      throw new DonationProcessNotFoundError(`Proceso '${processId}' no encontrado`);
    }

    if (
      user.role !== "ADMIN" &&
      !user.institutionalIps?.includes(process.primaryIpsName)
    ) {
      throw new DonationProcessAccessDeniedError(
        "No tiene autorización para consultar los documentos de este proceso",
      );
    }

    const documents = await this.packageRepository.listProcessDocuments(processId);

    const applicable = documents.filter((d) => d.applicabilityStatus !== "NO_APLICA");
    const applicableCount = applicable.length;
    // Distinción clara entre COMPLETADO (formulario completo y validado) y FIRMADO (sellado con firmas)
    const completedCount = applicable.filter((d) => d.status === "COMPLETADO").length;
    const signedCount = applicable.filter((d) => d.status === "FIRMADO").length;
    const inProgressCount = applicable.filter(
      (d) => d.status === "EN_DILIGENCIAMIENTO" || d.status === "EN_REVISION" || d.status === "BLOQUEADO",
    ).length;
    const pendingCount = applicable.filter((d) => d.status === "PENDIENTE").length;
    const nonApplicableCount = documents.filter(
      (d) => d.applicabilityStatus === "NO_APLICA",
    ).length;

    // Avance porcentual: documentos finalizados (completados + firmados) sobre el total de aplicables
    const finalizedCount = completedCount + signedCount;
    const progressPercentage =
      applicableCount > 0 ? Math.round((finalizedCount / applicableCount) * 100) : 0;

    return {
      processId,
      totalPositions: documents.length,
      applicableCount,
      completedCount,
      signedCount,
      inProgressCount,
      pendingCount,
      nonApplicableCount,
      progressPercentage,
      documents,
    };
  }
}

