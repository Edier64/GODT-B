import { Inject, Injectable } from "@nestjs/common";
import { createHash } from "crypto";
import { PrismaService } from "../../infrastructure/prisma/prisma.service";
import { AUDIT_EVENT_PORT, AuditEventPort } from "../audit/audit-event.port";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";
import {
  DocumentParticipantNotFoundError,
  InvalidLifecycleTransitionError,
  SignatureType,
  SnapshotIntegrityError,
} from "../../domain/document-lifecycle/document-lifecycle";
import {
  DonationProcessAccessDeniedError,
  DonationProcessNotFoundError,
} from "../../domain/processes/donation-process";

@Injectable()
export class SignDocumentSnapshotUseCase {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(AUDIT_EVENT_PORT)
    private readonly audit: AuditEventPort,
  ) {}

  async execute(input: {
    instanceId: string;
    snapshotId: string;
    participantId: string;
    signatureType: SignatureType;
    attestationText?: string;
    evidenceData?: Record<string, unknown>;
    user: AuthenticatedUser;
  }) {
    if (input.signatureType === "DIGITAL_CERTIFICADA") {
      throw new InvalidLifecycleTransitionError(
        "La modalidad DIGITAL_CERTIFICADA no está habilitada operativamente. Requiere integración PKI con entidad de certificación acreditada por la ONAC según Ley 527 de 1999. Utilice ATESTACION_USUARIO, MANUSCRITA_PRESENCIAL o DIBUJADA_UI.",
      );
    }

    const instance = await this.prisma.documentInstance.findUnique({
      where: { id: input.instanceId },
      include: {
        process: true,
        documentParticipants: true,
      },
    });

    if (!instance) {
      throw new DonationProcessNotFoundError(`Instancia '${input.instanceId}' no encontrada`);
    }

    if (
      input.user.role !== "ADMIN" &&
      input.user.role !== "COORDINATOR" &&
      instance.process &&
      !input.user.institutionalIps?.includes(instance.process.primaryIpsName)
    ) {
      throw new DonationProcessAccessDeniedError("No tiene autorización sobre este proceso");
    }

    const snapshot = await this.prisma.generatedPdfDocument.findUnique({
      where: { id: input.snapshotId },
    });

    if (!snapshot || snapshot.documentInstanceId !== instance.id) {
      throw new SnapshotIntegrityError(
        "El snapshot especificado no corresponde a la instancia documental indicada",
      );
    }

    const participant = instance.documentParticipants.find((p) => p.id === input.participantId);
    if (!participant) {
      throw new DocumentParticipantNotFoundError(
        `Participante '${input.participantId}' no asignado a este documento`,
      );
    }

    if (!participant.isSigner) {
      throw new SnapshotIntegrityError(
        `El participante '${participant.fullName}' no está configurado como firmante en este documento`,
      );
    }

    const now = new Date();

    // Cálculo del hash de atestación probatoria
    const attestationDigest = createHash("sha256")
      .update(
        `${snapshot.sha256Hash}:${participant.documentNumber || participant.fullName}:${now.toISOString()}:${input.signatureType}`,
      )
      .digest("hex");

    const evidenceData = {
      ...(input.evidenceData || {}),
      attestationText:
        (input.evidenceData?.attestationText as string) ||
        input.attestationText ||
        "Atestiguo bajo juramento y responsabilidad profesional que he revisado el contenido de este documento y confirmo la veracidad de la información clínica registrada en el proceso de donación.",
      attestationDigest,
      authenticatedUserId: input.user.userId,
      signerFullName: participant.fullName,
      signerDocumentType: participant.documentType || "CC",
      signerDocumentNumber: participant.documentNumber || "N/A",
      signerRole: participant.signerRole,
      snapshotId: snapshot.id,
      snapshotBinaryHash: snapshot.sha256Hash,
      legalNotice:
        "Atestación electrónica y evidencia documental interna conforme a la política GODT Regional 3. No constituye firma digital PKI (Ley 527/1999).",
    };

    // Registrar firma vinculada indivisiblemente al hash del snapshot
    const signature = await this.prisma.documentSignature.create({
      data: {
        documentInstanceId: instance.id,
        generatedPdfId: snapshot.id,
        participantId: participant.id,
        signatureType: input.signatureType,
        snapshotHash: snapshot.sha256Hash,
        signedAt: now,
        evidenceData: evidenceData as any,
        authenticatedUserId: input.user.userId,
        status: "VALIDA",
      },
    });

    // Actualizar estado del participante
    await this.prisma.documentParticipant.update({
      where: { id: participant.id },
      data: { status: "FIRMADO" },
    });

    // Verificar si todos los firmantes obligatorios completaron la firma
    const allParticipants = await this.prisma.documentParticipant.findMany({
      where: { documentInstanceId: instance.id },
    });

    const pendingRequired = allParticipants.filter(
      (p) => p.signatureRequired && p.status !== "FIRMADO",
    );

    let resultingStatus = instance.status;
    if (pendingRequired.length === 0) {
      resultingStatus = "FIRMADO";
      await this.prisma.documentInstance.update({
        where: { id: instance.id },
        data: { status: "FIRMADO" },
      });

      if (instance.processDocumentId) {
        await this.prisma.processDocument.update({
          where: { id: instance.processDocumentId },
          data: { status: "FIRMADO" },
        });
      }
    }

    await this.audit.record({
      actorUserId: input.user.userId,
      action: "DOCUMENT_SIGNATURE_REGISTERED",
      entityType: "DOCUMENT_SIGNATURE",
      entityId: signature.id,
      correlationId: instance.processId || instance.id,
      metadata: {
        documentCode: instance.documentCode,
        snapshotId: snapshot.id,
        snapshotHash: snapshot.sha256Hash,
        participantFullName: participant.fullName,
        signerRole: participant.signerRole,
        signatureType: input.signatureType,
        resultingStatus,
      },
    });

    return {
      signature,
      resultingStatus,
      allRequiredSignaturesMet: pendingRequired.length === 0,
    };
  }
}
