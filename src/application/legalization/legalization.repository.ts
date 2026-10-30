import { LegalizationAssessment } from "../../domain/legalization/legalization";
import { AuditEventInput } from "../audit/audit-event.port";

export interface LegalizationRepository {
  createWithRepresentatives(
    donorId: string,
    officerInChargeId: string,
    input: LegalizationAssessment,
    audit: AuditEventInput,
  ): Promise<{ id: string; donorId: string }>;
}

export const LEGALIZATION_REPOSITORY = Symbol("LEGALIZATION_REPOSITORY");
