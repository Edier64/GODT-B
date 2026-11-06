import { Inject, Injectable } from "@nestjs/common";
import {
  ProcessDocument,
  ProcessDocumentNotFoundError,
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

export interface DependencyEvaluationResult {
  documentId: string;
  documentCode: string;
  isSatisfied: boolean;
  canInitiateDraft: boolean;
  canApproveOrSign: boolean;
  blockingReasons: string[];
  applicabilityStatus: string;
  rules: unknown;
}

@Injectable()
export class EvaluateDocumentDependenciesUseCase {
  constructor(
    @Inject(PROCESS_PACKAGE_REPOSITORY)
    private readonly packageRepository: ProcessPackageRepository,
    @Inject(DONATION_PROCESS_REPOSITORY)
    private readonly processRepository: DonationProcessRepository,
  ) {}

  async execute(
    documentId: string,
    user: AuthenticatedUser,
  ): Promise<DependencyEvaluationResult> {
    const document = await this.packageRepository.findProcessDocumentById(documentId);
    if (!document) {
      throw new ProcessDocumentNotFoundError(
        `Posición documental '${documentId}' no encontrada`,
      );
    }

    const process = await this.processRepository.findById(document.processId);
    if (!process) {
      throw new DonationProcessNotFoundError(
        `Proceso '${document.processId}' no encontrado`,
      );
    }

    if (
      user.role !== "ADMIN" &&
      !user.institutionalIps?.includes(process.primaryIpsName)
    ) {
      throw new DonationProcessAccessDeniedError(
        "No tiene autorización para evaluar dependencias de este proceso",
      );
    }

    const allDocuments = await this.packageRepository.listProcessDocuments(document.processId);
    const blockingReasons: string[] = [];
    const rules = document.rules as Record<string, unknown> | null;

    if (rules) {
      const relationType = rules.relationType as string;

      if (relationType === "REQUIRED" && typeof rules.dependsOn === "string") {
        const prereq = allDocuments.find((d) => d.documentCode === rules.dependsOn);
        if (prereq) {
          const isComplete =
            prereq.status === "COMPLETADO" || prereq.status === "FIRMADO";
          if (!isComplete) {
            blockingReasons.push(
              `Dependencia previa insatisfecha para aprobación final/firma: requiere que '${prereq.title}' (${prereq.documentCode}) esté completado o firmado (estado actual: ${prereq.status}). No impide iniciar ni guardar borradores en construcción.`,
            );
          }
        }
      }

      if (relationType === "CONDITIONAL" && rules.description) {
        // Regla informativa condicional
      }
    }

    const canInitiateDraft = document.applicabilityStatus !== "NO_APLICA";
    const isSatisfied = blockingReasons.length === 0;

    return {
      documentId: document.id,
      documentCode: document.documentCode,
      isSatisfied,
      canInitiateDraft,
      canApproveOrSign: isSatisfied,
      blockingReasons,
      applicabilityStatus: document.applicabilityStatus,
      rules: document.rules,
    };
  }
}

