export type CanonicalDataType = "string" | "number" | "boolean" | "date-time";

export interface CanonicalMappingDefinition {
  targetKey: string;
  sourcePath: string;
  sourceKind:
    | "DONOR_RECORD"
    | "SOURCE_DOCUMENT"
    | "OCR_CONFIRMED"
    | "OCR_MODIFIED"
    | "MANUAL"
    | "CALCULATED";
  dataType: CanonicalDataType;
  writable: boolean;
}

export const CANONICAL_MAPPING_CATALOG: Readonly<
  Record<string, CanonicalMappingDefinition>
> = {
  rndCode: {
    targetKey: "rndCode",
    sourcePath: "donorRecord.rndCode",
    sourceKind: "DONOR_RECORD",
    dataType: "string",
    writable: false,
  },
  originatingIpsName: {
    targetKey: "originatingIpsName",
    sourcePath: "donorRecord.originatingIpsName",
    sourceKind: "DONOR_RECORD",
    dataType: "string",
    writable: false,
  },
  clinicalService: {
    targetKey: "clinicalService",
    sourcePath: "donorRecord.clinicalService",
    sourceKind: "DONOR_RECORD",
    dataType: "string",
    writable: false,
  },
  fullName: {
    targetKey: "fullName",
    sourcePath: "donorRecord.fullName",
    sourceKind: "DONOR_RECORD",
    dataType: "string",
    writable: false,
  },
  documentNumber: {
    targetKey: "documentNumber",
    sourcePath: "donorRecord.documentNumber",
    sourceKind: "DONOR_RECORD",
    dataType: "string",
    writable: false,
  },
  bloodGroup: {
    targetKey: "bloodGroup",
    sourcePath: "donorRecord.bloodGroup",
    sourceKind: "DONOR_RECORD",
    dataType: "string",
    writable: false,
  },
  rhFactor: {
    targetKey: "rhFactor",
    sourcePath: "donorRecord.rhFactor",
    sourceKind: "DONOR_RECORD",
    dataType: "string",
    writable: false,
  },
};
