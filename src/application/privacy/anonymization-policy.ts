export interface AnonymizableDonor {
  rndCode: string;
  status: string;
  clinicalService: string;
  bloodGroup: string | null;
  rhFactor: string | null;
  anthropometry: Record<string, unknown> | null;
  clinicalData: Record<string, unknown> | null;
}

export interface AnonymizedDonor {
  rndCode: string;
  status: string;
  clinicalService: string;
  bloodGroup: string | null;
  rhFactor: string | null;
  anthropometry: Record<string, unknown> | null;
  clinicalData: Record<string, unknown> | null;
}

const forbiddenKeys = new Set([
  "fullName",
  "full_name",
  "documentNumber",
  "document_number",
  "phone",
  "email",
  "address",
  "contact",
]);

function stripCivilKeys(
  value: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !forbiddenKeys.has(key))
      .map(([key, child]) => [
        key,
        child && typeof child === "object" && !Array.isArray(child)
          ? stripCivilKeys(child as Record<string, unknown>)
          : child,
      ]),
  );
}

export class AnonymizationPolicy {
  apply(donor: AnonymizableDonor): AnonymizedDonor {
    return {
      rndCode: donor.rndCode,
      status: donor.status,
      clinicalService: donor.clinicalService,
      bloodGroup: donor.bloodGroup,
      rhFactor: donor.rhFactor,
      anthropometry: donor.anthropometry
        ? stripCivilKeys(donor.anthropometry)
        : null,
      clinicalData: donor.clinicalData
        ? stripCivilKeys(donor.clinicalData)
        : null,
    };
  }
}
