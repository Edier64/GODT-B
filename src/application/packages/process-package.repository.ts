import {
  DocumentApplicability,
  PackagePositionDefinition,
  ProcessDocument,
  ProcessDocumentStatus,
  ProcessPackage,
  ProcessPackageVersion,
} from "../../domain/packages/process-package";

export interface ProcessPackageRepository {
  findActivePackage(): Promise<ProcessPackage | null>;

  findPackageByCode(code: string): Promise<ProcessPackage | null>;

  findLatestPublishedVersion(packageId: string): Promise<ProcessPackageVersion | null>;

  findVersionById(id: string): Promise<ProcessPackageVersion | null>;

  createDefaultPackage(actorUserId: string): Promise<ProcessPackageVersion>;

  createProcessDocuments(
    processId: string,
    positions: PackagePositionDefinition[],
  ): Promise<ProcessDocument[]>;

  listProcessDocuments(processId: string): Promise<ProcessDocument[]>;

  findProcessDocumentById(id: string): Promise<ProcessDocument | null>;

  findProcessDocumentByCode(
    processId: string,
    documentCode: string,
  ): Promise<ProcessDocument | null>;

  updateProcessDocumentApplicability(
    id: string,
    applicabilityStatus: DocumentApplicability,
    nonApplicabilityReason?: string,
  ): Promise<ProcessDocument>;

  updateProcessDocumentStatus(
    id: string,
    status: ProcessDocumentStatus,
  ): Promise<ProcessDocument>;

  setProcessDocumentInstance(
    documentId: string,
    instanceId: string,
  ): Promise<ProcessDocument>;

  linkTemplateToDocument(
    documentId: string,
    templateId: string,
    templateVersionId: string,
  ): Promise<ProcessDocument>;
}

export const PROCESS_PACKAGE_REPOSITORY = Symbol("PROCESS_PACKAGE_REPOSITORY");

