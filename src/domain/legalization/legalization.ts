export type LegalizationMechanism =
  "PRESUNCION_LEGAL" | "CONSENTIMIENTO_FAMILIAR";

export interface LegalRepresentativeInput {
  fullName: string;
  documentType: string;
  documentNumber: string;
  relationshipToDonor: string;
  signatureStorageKey?: string;
  signedAt?: Date;
}

export interface LegalizationAssessment {
  mechanism: LegalizationMechanism;
  isAdult: boolean | null;
  isColombian: boolean | null;
  isResident: boolean | null;
  oppositionRegistered: boolean | null;
  representatives: LegalRepresentativeInput[];
}

export class LegalizationRequirementsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LegalizationRequirementsError";
  }
}

export class LegalizationPolicy {
  evaluate(input: LegalizationAssessment): void {
    if (
      input.isAdult === null ||
      input.isColombian === null ||
      input.isResident === null ||
      input.oppositionRegistered === null
    ) {
      throw new LegalizationRequirementsError(
        "Institutional legal assessment facts are incomplete",
      );
    }

    if (input.mechanism === "PRESUNCION_LEGAL") {
      if (!input.isAdult || !input.isColombian || input.oppositionRegistered) {
        throw new LegalizationRequirementsError(
          "Anexo 2 requires an adult Colombian without registered opposition",
        );
      }
      return;
    }

    const anexo3Eligible =
      !input.isAdult || (!input.isColombian && !input.isResident);
    if (!anexo3Eligible) {
      throw new LegalizationRequirementsError(
        "The supplied facts do not qualify for Anexo 3",
      );
    }
    if (input.representatives.length < 2) {
      throw new LegalizationRequirementsError(
        "Anexo 3 requires at least two representatives",
      );
    }
  }
}
