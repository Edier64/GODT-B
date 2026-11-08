import { Inject, Injectable } from "@nestjs/common";
import {
  CanonicalFieldDefinition,
  CanonicalFieldMapping,
  CanonicalFieldNotFoundError,
  CanonicalScope,
  CanonicalSharingPolicy,
  CanonicalSourceKind,
  CanonicalValidationError,
  ConflictResolutionStrategy,
  HOMOLOGATED_CANONICAL_FIELDS,
  ProcessCanonicalValue,
  PropagationResult,
} from "../../domain/canonical/canonical-dictionary";
import {
  CANONICAL_DICTIONARY_REPOSITORY,
  CanonicalDictionaryRepository,
} from "./canonical-dictionary.repository";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AUDIT_EVENT_PORT, AuditEventPort } from "../audit/audit-event.port";
import { Prisma } from "@prisma/client";

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const cleanPath = path.startsWith("$.") ? path.slice(2) : path;
  const segments = cleanPath.split(".");
  let current: any = obj;
  for (const seg of segments) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = current[seg];
  }
  return current;
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const cleanPath = path.startsWith("$.") ? path.slice(2) : path;
  const segments = cleanPath.split(".");
  let current: any = obj;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (!current[seg] || typeof current[seg] !== "object") {
      current[seg] = {};
    }
    current = current[seg];
  }
  current[segments[segments.length - 1]] = value;
}

@Injectable()
export class CanonicalPropagationEngine {
  constructor(
    @Inject(CANONICAL_DICTIONARY_REPOSITORY)
    private readonly repository: CanonicalDictionaryRepository,
    private readonly prisma: PrismaService,
    @Inject(AUDIT_EVENT_PORT)
    private readonly audit: AuditEventPort,
  ) {}

  async applyAndPropagate(input: {
    processId: string;
    canonicalFieldKey: string;
    value: unknown;
    unit?: string | null;
    sampleContext?: string | null;
    effectiveAt?: Date;
    sourceKind: CanonicalSourceKind;
    sourceInstanceId?: string | null;
    sourceRevisionId?: string | null;
    actorUserId: string;
    conflictResolution?: {
      strategy: ConflictResolutionStrategy;
      justification?: string;
    };
  }): Promise<PropagationResult> {
    // 1. Resolver y validar definición del catálogo
    let fieldDef = await this.repository.findFieldByKey(input.canonicalFieldKey);
    if (!fieldDef) {
      // Buscar en catálogo homologado estático
      const staticDef = HOMOLOGATED_CANONICAL_FIELDS.find(
        (f) => f.canonicalFieldKey === input.canonicalFieldKey,
      );
      if (staticDef) {
        await this.repository.seedDefaultCatalog(input.actorUserId);
        fieldDef = await this.repository.findFieldByKey(input.canonicalFieldKey);
      }
    }

    if (!fieldDef) {
      throw new CanonicalFieldNotFoundError(
        `Marcador canónico '${input.canonicalFieldKey}' no existe en el catálogo`,
      );
    }

    // 2. Validar tipo y políticas
    this.validateValueType(fieldDef, input.value);

    if (
      fieldDef.sharingPolicy === "READONLY_DERIVED" &&
      (input.sourceKind === "MANUAL" ||
        input.sourceKind === "OCR_CONFIRMED" ||
        input.sourceKind === "OCR_MODIFIED")
    ) {
      throw new CanonicalValidationError(
        `El marcador '${fieldDef.displayName}' es de solo lectura derivada institucional y no puede modificarse mediante ingesta OCR ni edición manual`,
      );
    }

    // 3. Si el scope es DONOR, sincronizar la verdad con DonorRecord
    const process = await this.prisma.donationProcess.findUnique({
      where: { id: input.processId },
      include: { donor: true },
    });

    if (process && fieldDef.scope === "DONOR") {
      await this.syncDonorRecord(process.donorId, fieldDef.canonicalFieldKey, input.value);
    }

    // 4. Capturar valor canónico previo antes de persistir (para detección de divergencias)
    const previousCanonical = await this.repository.findProcessValueByKey(
      input.processId,
      input.canonicalFieldKey,
    );
    const previousCanonicalValue = previousCanonical?.currentValue;

    // Persistir valor canónico vigente y revisión append-only
    const effectiveAt = input.effectiveAt || new Date();
    const currentVal = await this.repository.upsertProcessValue({
      processId: input.processId,
      canonicalFieldKey: input.canonicalFieldKey,
      value: input.value,
      unit: input.unit || fieldDef.unit,
      sampleContext: input.sampleContext,
      effectiveAt,
      sourceKind: input.sourceKind,
      sourceInstanceId: input.sourceInstanceId,
      sourceRevisionId: input.sourceRevisionId,
      actorUserId: input.actorUserId,
    });

    await this.repository.addHistoryEntry({
      processId: input.processId,
      canonicalFieldKey: input.canonicalFieldKey,
      value: input.value,
      unit: input.unit || fieldDef.unit,
      sampleContext: input.sampleContext,
      effectiveAt,
      sourceKind: input.sourceKind,
      sourceInstanceId: input.sourceInstanceId,
      sourceRevisionId: input.sourceRevisionId,
      versionNumber: currentVal.versionNumber,
      actorUserId: input.actorUserId,
    });

    const result: PropagationResult = {
      canonicalFieldKey: input.canonicalFieldKey,
      currentValue: input.value,
      scope: fieldDef.scope,
      sharingPolicy: fieldDef.sharingPolicy,
      versionNumber: currentVal.versionNumber,
      propagatedCount: 0,
      propagatedInstances: [],
      conflicts: [],
    };

    // Si la política es LOCAL o COPY_ONCE, no propaga a instancias abiertas existentes
    if (fieldDef.sharingPolicy === "LOCAL" || fieldDef.sharingPolicy === "COPY_ONCE") {
      return result;
    }

    // 5. Identificar instancias destino en el mismo proceso
    const instances = await this.prisma.documentInstance.findMany({
      where: {
        processId: input.processId,
      },
      include: {
        templateVersion: true,
        currentRevision: true,
      },
    });

    // Detectar el valor previo en la instancia fuente (si el cambio provino de una instancia)
    let sourcePriorValue: unknown = undefined;
    if (input.sourceInstanceId) {
      const sourceInst = instances.find((i) => i.id === input.sourceInstanceId);
      if (sourceInst) {
        const sourceMappings = this.extractMappings(sourceInst.templateVersion?.mappingConfig);
        const sourceMapping = sourceMappings.find(
          (m) =>
            m.canonicalFieldKey === input.canonicalFieldKey ||
            (m as any).targetKey === input.canonicalFieldKey,
        );
        if (sourceMapping) {
          const sFieldPath = sourceMapping.schemaPath || (sourceMapping as any).targetKey;
          sourcePriorValue = getNestedValue(
            (sourceInst.currentRevision?.responseData as Record<string, unknown>) || {},
            sFieldPath,
          );
        }
      }
    }

    for (const inst of instances) {
      // Regla de Protección: no sobreescribir instancias cerradas/firmadas
      if (inst.status === "COMPLETADO" || inst.status === "FIRMADO") {
        result.propagatedInstances.push({
          instanceId: inst.id,
          documentCode: inst.documentCode,
          fieldPath: "",
          status: "SKIPPED_LOCKED",
        });
        continue;
      }

      // No propagar a la instancia origen si fue la que disparó el cambio
      if (input.sourceInstanceId && inst.id === input.sourceInstanceId) {
        continue;
      }

      // Buscar si la plantilla de esta instancia mapea este canonicalFieldKey
      const mappings = this.extractMappings(inst.templateVersion?.mappingConfig);
      const targetMapping = mappings.find(
        (m) =>
          m.canonicalFieldKey === input.canonicalFieldKey ||
          (m as any).targetKey === input.canonicalFieldKey,
      );

      if (!targetMapping) continue;

      const fieldPath = targetMapping.schemaPath || (targetMapping as any).targetKey;
      const currentResponseData =
        (inst.currentRevision?.responseData as Record<string, unknown>) || {};
      const existingVal = getNestedValue(currentResponseData, fieldPath);

      // Si el campo es REPEATABLE (mediciones clínicas seriadas), no sobreescribir silenciosamente
      // a menos que el mapeo destino coincida explícitamente con el contexto de la muestra
      if (fieldDef.cardinality === "REPEATABLE") {
        const isContextMatch =
          targetMapping.repeatableSelectionStrategy === "SAMPLE_CONTEXT_MATCH" &&
          targetMapping.sampleContextFilter &&
          input.sampleContext &&
          targetMapping.sampleContextFilter === input.sampleContext;

        if (!isContextMatch) {
          result.propagatedInstances.push({
            instanceId: inst.id,
            documentCode: inst.documentCode,
            fieldPath,
            status: "SKIPPED_LOCKED",
          });
          continue;
        }
      }

      // Si el valor ya es idéntico al nuevo valor propuesto, no hay nada que propagar
      if (JSON.stringify(existingVal) === JSON.stringify(input.value)) {
        continue;
      }

      // Si el valor de destino coincide con el valor previo de sincronización
      // (coincide con el valor previo de la instancia origen o con el valor canónico previo),
      // significa que no hay divergencia local; simplemente estaba sincronizado con el valor anterior.
      const matchesPriorSync =
        (sourcePriorValue !== undefined &&
          JSON.stringify(existingVal) === JSON.stringify(sourcePriorValue)) ||
        (previousCanonicalValue !== undefined &&
          JSON.stringify(existingVal) === JSON.stringify(previousCanonicalValue));

      const hasDivergence =
        existingVal !== undefined &&
        existingVal !== null &&
        existingVal !== "" &&
        !matchesPriorSync;

      if (hasDivergence) {
        if (input.conflictResolution?.strategy === "ACCEPT_CANDIDATE") {
          // Acepta y sobreescribe con auditoría
          await this.updateInstanceField(
            inst,
            fieldPath,
            input.value,
            input.canonicalFieldKey,
            input.sourceKind,
            input.actorUserId,
            "RESOLVED",
            "ACCEPT_CANDIDATE",
            input.conflictResolution.justification,
          );
          result.propagatedCount++;
          result.propagatedInstances.push({
            instanceId: inst.id,
            documentCode: inst.documentCode,
            fieldPath,
            status: "UPDATED",
          });
        } else if (input.conflictResolution?.strategy === "KEEP_CURRENT") {
          // Conserva valor previo
          result.propagatedInstances.push({
            instanceId: inst.id,
            documentCode: inst.documentCode,
            fieldPath,
            status: "SKIPPED_LOCKED",
          });
        } else {
          // No sobreescribe silenciosamente: genera conflicto
          const existingProvenance = ((inst.currentRevision as any)?.provenance as any[])?.find(
            (p: any) => p.fieldPath === fieldPath,
          );
          result.conflicts.push({
            instanceId: inst.id,
            documentCode: inst.documentCode,
            fieldPath,
            canonicalFieldKey: input.canonicalFieldKey,
            existingValue: existingVal,
            proposedValue: input.value,
            existingSourceKind: (existingProvenance?.sourceKind as string) || "UNKNOWN",
            existingEffectiveAt: existingProvenance?.validatedAt || new Date(),
            sourceInstanceId: input.sourceInstanceId || undefined,
          });
          result.propagatedInstances.push({
            instanceId: inst.id,
            documentCode: inst.documentCode,
            fieldPath,
            status: "CONFLICT",
          });

          await this.repository.updateConflictStatus(
            input.processId,
            input.canonicalFieldKey,
            "CONFLICT_DETECTED",
            {
              instanceId: inst.id,
              documentCode: inst.documentCode,
              fieldPath,
              existingVal,
              proposedVal: input.value,
            },
            input.actorUserId,
          );

          await this.audit.record({
            actorUserId: input.actorUserId,
            action: "CANONICAL_CONFLICT_DETECTED",
            entityType: "PROCESS_CANONICAL_VALUE",
            entityId: currentVal.id,
            correlationId: input.processId,
            metadata: {
              canonicalFieldKey: input.canonicalFieldKey,
              sourceInstanceId: input.sourceInstanceId,
              targetInstanceId: inst.id,
              targetDocumentCode: inst.documentCode,
              fieldPath,
              existingValue: existingVal,
              proposedValue: input.value,
              detectedAt: new Date().toISOString(),
            },
          });
        }
      } else {
        // No hay conflicto: actualiza limpiamente la instancia
        await this.updateInstanceField(
          inst,
          fieldPath,
          input.value,
          input.canonicalFieldKey,
          "PROCESS_CANONICAL",
          input.actorUserId,
          "NONE",
        );
        result.propagatedCount++;
        result.propagatedInstances.push({
          instanceId: inst.id,
          documentCode: inst.documentCode,
          fieldPath,
          status: "UPDATED",
        });
      }
    }

    await this.audit.record({
      actorUserId: input.actorUserId,
      action: "CANONICAL_VALUE_PROPAGATED",
      entityType: "PROCESS_CANONICAL_VALUE",
      entityId: currentVal.id,
      correlationId: input.processId,
      metadata: {
        canonicalFieldKey: input.canonicalFieldKey,
        propagatedCount: result.propagatedCount,
        conflictsCount: result.conflicts.length,
      },
    });

    return result;
  }

  async preloadCanonicalValues(
    processId: string,
    templateVersionId: string,
  ): Promise<{
    responseData: Record<string, unknown>;
    provenance: Array<{
      fieldPath: string;
      canonicalFieldKey: string;
      sourceKind: CanonicalSourceKind;
      sourceValue: unknown;
    }>;
  }> {
    const templateVer = await this.prisma.templateVersion.findUnique({
      where: { id: templateVersionId },
    });
    if (!templateVer) {
      return { responseData: {}, provenance: [] };
    }

    const mappings = this.extractMappings(templateVer.mappingConfig);
    const canonicalValues = await this.repository.findProcessValues(processId);
    const valueMap = new Map(canonicalValues.map((v) => [v.canonicalFieldKey, v]));

    const process = await this.prisma.donationProcess.findUnique({
      where: { id: processId },
      include: { donor: true },
    });

    const responseData: Record<string, unknown> = {};
    const provenance: Array<{
      fieldPath: string;
      canonicalFieldKey: string;
      sourceKind: CanonicalSourceKind;
      sourceValue: unknown;
    }> = [];

    for (const m of mappings) {
      if (m.bindingPolicy === "LOCAL") continue;

      const key = m.canonicalFieldKey || (m as any).targetKey;
      let val: unknown = undefined;
      let sourceKind: CanonicalSourceKind = "PROCESS_CANONICAL";

      const fieldDef = await this.repository.findFieldByKey(key);
      const isRepeatable = m.cardinality === "REPEATABLE" || fieldDef?.cardinality === "REPEATABLE";

      if (isRepeatable) {
        // En campos REPEATABLE (mediciones seriadas clínicas como pH, creatinina):
        // Se aplica la estrategia explícita de vinculación documental
        const observations = await this.repository.listObservations(processId, key);

        if (m.repeatableSelectionStrategy === "SAMPLE_CONTEXT_MATCH" && m.sampleContextFilter) {
          const match = observations.find((o) => o.sampleContext === m.sampleContextFilter);
          if (match) {
            val = match.value;
            sourceKind = match.sourceKind;
          }
        } else if (m.repeatableSelectionStrategy === "DETERMINISTIC_RULE" && m.deterministicRule === "BASELINE") {
          // Línea base: la medición más temprana registrada
          if (observations.length > 0) {
            const baseline = observations[observations.length - 1];
            val = baseline.value;
            sourceKind = baseline.sourceKind;
          }
        } else if (m.repeatableSelectionStrategy === "MANUAL_SELECTION" || m.requiresHumanSelection) {
          // Exige selección humana explícita. No precarga silenciosamente.
          val = undefined;
          continue;
        } else {
          // Sin regla segura explícita: no precargar automáticamente
          val = undefined;
          continue;
        }
      } else {
        if (valueMap.has(key)) {
          val = valueMap.get(key)!.currentValue;
          sourceKind = valueMap.get(key)!.sourceKind;
        } else if (process?.donor && m.scope === "DONOR") {
          val = this.readFromDonor(process.donor, key);
          sourceKind = "DONOR_RECORD";
        }
      }

      if (val !== undefined && val !== null) {
        const fieldPath = m.schemaPath || (m as any).targetKey;
        setNestedValue(responseData, fieldPath, val);
        provenance.push({
          fieldPath,
          canonicalFieldKey: key,
          sourceKind,
          sourceValue: val,
        });
      }
    }

    return { responseData, provenance };
  }

  private validateValueType(def: CanonicalFieldDefinition, value: unknown): void {
    if (value === null || value === undefined) return;

    switch (def.dataType) {
      case "string":
        if (typeof value !== "string") {
          throw new CanonicalValidationError(`El valor para '${def.displayName}' debe ser de tipo texto`);
        }
        break;
      case "number":
        if (typeof value !== "number" || isNaN(value)) {
          throw new CanonicalValidationError(`El valor para '${def.displayName}' debe ser numérico`);
        }
        break;
      case "boolean":
        if (typeof value !== "boolean") {
          throw new CanonicalValidationError(`El valor para '${def.displayName}' debe ser booleano (true/false)`);
        }
        break;
      case "date-time":
        if (typeof value !== "string" && !(value instanceof Date)) {
          throw new CanonicalValidationError(`El valor para '${def.displayName}' debe ser una fecha/hora válida`);
        }
        break;
    }
  }

  private async syncDonorRecord(donorId: string, canonicalKey: string, value: unknown): Promise<void> {
    if (typeof value !== "string" && typeof value !== "number") return;

    const data: Prisma.DonorRecordUpdateInput = {};
    if (canonicalKey === "donor.identity.full_name" && typeof value === "string") {
      data.fullName = value;
    } else if (canonicalKey === "donor.identity.document_number" && typeof value === "string") {
      data.documentNumber = value;
    } else if (canonicalKey === "donor.clinical.blood_group" && typeof value === "string") {
      data.bloodGroup = value;
    } else if (canonicalKey === "donor.clinical.rh_factor" && typeof value === "string") {
      data.rhFactor = value;
    }

    if (Object.keys(data).length > 0) {
      await this.prisma.donorRecord.update({
        where: { id: donorId },
        data,
      });
    }
  }

  private readFromDonor(donor: any, canonicalKey: string): unknown {
    switch (canonicalKey) {
      case "donor.identity.full_name":
        return donor.fullName;
      case "donor.identity.document_number":
        return donor.documentNumber;
      case "donor.clinical.blood_group":
        return donor.bloodGroup;
      case "donor.clinical.rh_factor":
        return donor.rhFactor;
      case "donor.registration.rnd_code":
        return donor.rndCode;
      case "donor.institution.originating_ips":
        return donor.originatingIpsName;
      case "donor.clinical.clinical_service":
        return donor.clinicalService;
      default:
        return undefined;
    }
  }

  private extractMappings(mappingConfig: unknown): CanonicalFieldMapping[] {
    if (!Array.isArray(mappingConfig)) return [];
    return mappingConfig
      .filter((item): item is Record<string, any> => typeof item === "object" && item !== null)
      .map((item) => {
        const anyItem = item as any;
        return {
          schemaPath: anyItem.schemaPath || anyItem.targetKey || "",
          canonicalFieldKey: anyItem.canonicalFieldKey || anyItem.targetKey || "",
          scope: anyItem.scope || "DONOR",
          bindingPolicy: anyItem.bindingPolicy || "SHARED",
          dataType: anyItem.dataType || "string",
          unit: anyItem.unit,
          readOnly: anyItem.readOnly,
          allowedSources: anyItem.allowedSources,
          cardinality: anyItem.cardinality,
          repeatableSelectionStrategy: anyItem.repeatableSelectionStrategy,
          sampleContextFilter: anyItem.sampleContextFilter,
          deterministicRule: anyItem.deterministicRule,
          requiresHumanSelection: anyItem.requiresHumanSelection,
        };
      });
  }

  private async updateInstanceField(
    instance: any,
    fieldPath: string,
    value: unknown,
    canonicalFieldKey: string,
    sourceKind: string,
    actorUserId: string,
    conflictStatus: string,
    conflictDecision?: string,
    conflictJustification?: string,
  ): Promise<void> {
    const currentData = (instance.currentRevision?.responseData as Record<string, unknown>) || {};
    const updatedData = JSON.parse(JSON.stringify(currentData));
    setNestedValue(updatedData, fieldPath, value);

    const nextRevNumber = (instance.currentRevision?.revisionNumber || 0) + 1;

    // Crear nueva revisión append-only
    const newRev = await this.prisma.documentResponseRevision.create({
      data: {
        documentInstanceId: instance.id,
        revisionNumber: nextRevNumber,
        responseData: updatedData as Prisma.InputJsonValue,
        changeSummary: {
          fieldPropagated: fieldPath,
          canonicalFieldKey,
          sourceKind,
        } as Prisma.InputJsonValue,
        createdById: actorUserId,
      },
    });

    // Actualizar currentRevisionId en DocumentInstance
    await this.prisma.documentInstance.update({
      where: { id: instance.id },
      data: {
        currentRevisionId: newRev.id,
        updatedById: actorUserId,
      },
    });

    // Registrar procedencia de campo
    await this.prisma.documentFieldProvenance.create({
      data: {
        responseRevisionId: newRev.id,
        fieldPath,
        canonicalFieldKey,
        sourceKind,
        sourceValue: value as Prisma.InputJsonValue,
        conflictStatus,
        conflictDecision,
        conflictJustification,
      },
    });
  }
}
