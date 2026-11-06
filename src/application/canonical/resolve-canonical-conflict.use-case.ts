import { Inject, Injectable } from "@nestjs/common";
import {
  CanonicalConflictError,
  CanonicalFieldNotFoundError,
  CanonicalValidationError,
  ConflictResolutionStrategy,
  ProcessCanonicalValue,
} from "../../domain/canonical/canonical-dictionary";
import {
  CANONICAL_DICTIONARY_REPOSITORY,
  CanonicalDictionaryRepository,
} from "./canonical-dictionary.repository";
import {
  DONATION_PROCESS_REPOSITORY,
  DonationProcessRepository,
} from "../processes/donation-process.repository";
import { AUDIT_EVENT_PORT, AuditEventPort } from "../audit/audit-event.port";
import { CanonicalPropagationEngine } from "./canonical-propagation.engine";
import {
  DonationProcessAccessDeniedError,
  DonationProcessNotFoundError,
} from "../../domain/processes/donation-process";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";

@Injectable()
export class ResolveCanonicalConflictUseCase {
  constructor(
    @Inject(CANONICAL_DICTIONARY_REPOSITORY)
    private readonly repository: CanonicalDictionaryRepository,
    @Inject(DONATION_PROCESS_REPOSITORY)
    private readonly processRepository: DonationProcessRepository,
    private readonly propagationEngine: CanonicalPropagationEngine,
    @Inject(AUDIT_EVENT_PORT)
    private readonly audit: AuditEventPort,
  ) {}

  async execute(input: {
    processId: string;
    canonicalFieldKey: string;
    strategy: ConflictResolutionStrategy;
    resolvedValue?: unknown;
    justification: string;
    user: AuthenticatedUser;
  }): Promise<ProcessCanonicalValue> {
    const process = await this.processRepository.findById(input.processId);
    if (!process) {
      throw new DonationProcessNotFoundError(
        `Proceso '${input.processId}' no encontrado`,
      );
    }

    if (
      input.user.role !== "ADMIN" &&
      !input.user.institutionalIps?.includes(process.primaryIpsName)
    ) {
      throw new DonationProcessAccessDeniedError(
        "No tiene autorización para resolver conflictos canónicos en este proceso",
      );
    }

    if (!input.justification || !input.justification.trim()) {
      throw new CanonicalValidationError(
        "Se requiere una justificación clínica o administrativa obligatoria para resolver el conflicto",
      );
    }

    const currentVal = await this.repository.findProcessValueByKey(
      input.processId,
      input.canonicalFieldKey,
    );
    if (!currentVal) {
      throw new CanonicalFieldNotFoundError(
        `No existe valor canónico registrado para '${input.canonicalFieldKey}'`,
      );
    }

    let finalValue = currentVal.currentValue;

    if (input.strategy === "ACCEPT_CANDIDATE") {
      // Si el conflicto guardó proposedVal, aplicarlo
      const details = currentVal.conflictDetails as Record<string, unknown> | null;
      if (details?.proposedVal !== undefined) {
        finalValue = details.proposedVal;
      }
      await this.propagationEngine.applyAndPropagate({
        processId: input.processId,
        canonicalFieldKey: input.canonicalFieldKey,
        value: finalValue,
        sourceKind: "PROCESS_CANONICAL",
        actorUserId: input.user.userId,
        conflictResolution: {
          strategy: "ACCEPT_CANDIDATE",
          justification: input.justification.trim(),
        },
      });
    } else if (input.strategy === "MANUAL_OVERRIDE") {
      if (input.resolvedValue === undefined) {
        throw new CanonicalValidationError(
          "La estrategia MANUAL_OVERRIDE requiere proporcionar resolvedValue",
        );
      }
      finalValue = input.resolvedValue;
      await this.propagationEngine.applyAndPropagate({
        processId: input.processId,
        canonicalFieldKey: input.canonicalFieldKey,
        value: finalValue,
        sourceKind: "MANUAL",
        actorUserId: input.user.userId,
        conflictResolution: {
          strategy: "ACCEPT_CANDIDATE", // Propaga el valor manual rectificado
          justification: input.justification.trim(),
        },
      });
    }

    const resolved = await this.repository.updateConflictStatus(
      input.processId,
      input.canonicalFieldKey,
      "RESOLVED",
      {
        resolvedBy: input.user.userId,
        resolvedAt: new Date().toISOString(),
        strategy: input.strategy,
        justification: input.justification.trim(),
        finalValue,
      },
      input.user.userId,
    );

    await this.audit.record({
      actorUserId: input.user.userId,
      action: "CANONICAL_CONFLICT_RESOLVED",
      entityType: "PROCESS_CANONICAL_VALUE",
      entityId: resolved.id,
      correlationId: input.processId,
      metadata: {
        canonicalFieldKey: input.canonicalFieldKey,
        strategy: input.strategy,
        justification: input.justification.trim(),
      },
    });

    return resolved;
  }
}

