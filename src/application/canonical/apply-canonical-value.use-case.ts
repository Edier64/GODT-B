import { Inject, Injectable } from "@nestjs/common";
import {
  CanonicalSourceKind,
  ConflictResolutionStrategy,
  PropagationResult,
} from "../../domain/canonical/canonical-dictionary";
import { CanonicalPropagationEngine } from "./canonical-propagation.engine";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import {
  DonationProcessAccessDeniedError,
  DonationProcessNotFoundError,
} from "../../domain/processes/donation-process";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";
import { ProcessDocumentConflictError, ProcessDocumentNotFoundError } from "../../domain/packages/process-package";

@Injectable()
export class ApplyCanonicalValueUseCase {
  constructor(
    private readonly propagationEngine: CanonicalPropagationEngine,
    private readonly prisma: PrismaService,
  ) {}

  async executeFromInstance(input: {
    instanceId: string;
    canonicalFieldKey: string;
    value: unknown;
    unit?: string | null;
    sampleContext?: string | null;
    effectiveAt?: Date;
    sourceKind?: CanonicalSourceKind;
    conflictResolution?: {
      strategy: ConflictResolutionStrategy;
      justification?: string;
    };
    user: AuthenticatedUser;
  }): Promise<PropagationResult> {
    const instance = await this.prisma.documentInstance.findUnique({
      where: { id: input.instanceId },
      include: {
        process: true,
      },
    });

    if (!instance) {
      throw new ProcessDocumentNotFoundError(
        `Instancia documental '${input.instanceId}' no encontrada`,
      );
    }

    if (instance.status === "COMPLETADO" || instance.status === "FIRMADO") {
      throw new ProcessDocumentConflictError(
        "No se puede propagar ni modificar valores canónicos desde un documento completado o firmado",
      );
    }

    const process = instance.process;
    if (!process) {
      throw new DonationProcessNotFoundError(
        `La instancia no tiene un proceso de donación asociado`,
      );
    }

    if (
      input.user.role !== "ADMIN" &&
      !input.user.institutionalIps?.includes(process.primaryIpsName)
    ) {
      throw new DonationProcessAccessDeniedError(
        "No tiene autorización para modificar datos canónicos en este proceso",
      );
    }

    return this.propagationEngine.applyAndPropagate({
      processId: process.id,
      canonicalFieldKey: input.canonicalFieldKey,
      value: input.value,
      unit: input.unit,
      sampleContext: input.sampleContext,
      effectiveAt: input.effectiveAt,
      sourceKind: input.sourceKind || "MANUAL",
      sourceInstanceId: instance.id,
      sourceRevisionId: instance.currentRevisionId,
      actorUserId: input.user.userId,
      conflictResolution: input.conflictResolution,
    });
  }

  async executeDirect(input: {
    processId: string;
    canonicalFieldKey: string;
    value: unknown;
    unit?: string | null;
    sampleContext?: string | null;
    effectiveAt?: Date;
    sourceKind?: CanonicalSourceKind;
    conflictResolution?: {
      strategy: ConflictResolutionStrategy;
      justification?: string;
    };
    user: AuthenticatedUser;
  }): Promise<PropagationResult> {
    const process = await this.prisma.donationProcess.findUnique({
      where: { id: input.processId },
    });

    if (!process) {
      throw new DonationProcessNotFoundError(
        `Proceso de donación '${input.processId}' no encontrado`,
      );
    }

    if (
      input.user.role !== "ADMIN" &&
      !input.user.institutionalIps?.includes(process.primaryIpsName)
    ) {
      throw new DonationProcessAccessDeniedError(
        "No tiene autorización para modificar datos canónicos en este proceso",
      );
    }

    return this.propagationEngine.applyAndPropagate({
      processId: process.id,
      canonicalFieldKey: input.canonicalFieldKey,
      value: input.value,
      unit: input.unit,
      sampleContext: input.sampleContext,
      effectiveAt: input.effectiveAt,
      sourceKind: input.sourceKind || "MANUAL",
      actorUserId: input.user.userId,
      conflictResolution: input.conflictResolution,
    });
  }
}

