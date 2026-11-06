import { createHash } from "crypto";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { ValidateDocumentInstanceUseCase } from "../src/application/document-lifecycle/validate-document-instance.use-case";
import { CompleteDocumentInstanceUseCase } from "../src/application/document-lifecycle/complete-document-instance.use-case";
import { GenerateDocumentSnapshotUseCase } from "../src/application/document-lifecycle/generate-document-snapshot.use-case";
import { ManageDocumentParticipantsUseCase } from "../src/application/document-lifecycle/manage-document-participants.use-case";
import { SignDocumentSnapshotUseCase } from "../src/application/document-lifecycle/sign-document-snapshot.use-case";
import { ReleaseDocumentInstanceUseCase } from "../src/application/document-lifecycle/release-document-instance.use-case";
import { ManageCustodyEventsUseCase } from "../src/application/document-lifecycle/manage-custody-events.use-case";
import { GetDocumentSnapshotUseCase } from "../src/application/document-lifecycle/get-document-snapshot.use-case";
import { ReopenDocumentInstanceUseCase } from "../src/application/document-lifecycle/reopen-document-instance.use-case";
import { PdfRenderEngineService } from "../src/application/pdf/pdf-render-engine.service";
import { DocumentResponseValidator } from "../src/application/document-engine/document-response.validator";
import { LocalPrivateStorageAdapter } from "../src/infrastructure/documents/local-private-storage.adapter";
import { AuditEventPort } from "../src/application/audit/audit-event.port";
import { AuthenticatedUser } from "../src/presentation/auth/auth.types";
import { ConfigService } from "@nestjs/config";
import { OFFICIAL_REGIONAL_3_POSITIONS } from "../src/domain/packages/process-package";
import {
  DocumentLockedError,
  InvalidLifecycleTransitionError,
  MissingRequiredSignaturesError,
  SnapshotIntegrityError,
  CustodySequenceError,
} from "../src/domain/document-lifecycle/document-lifecycle";
import { DonationProcessAccessDeniedError } from "../src/domain/processes/donation-process";

describe("Document Lifecycle, Snapshots, Signatures & PDF Rendering — Fase D Integration", () => {
  let prisma: PrismaService;
  let validateUseCase: ValidateDocumentInstanceUseCase;
  let completeUseCase: CompleteDocumentInstanceUseCase;
  let snapshotUseCase: GenerateDocumentSnapshotUseCase;
  let participantsUseCase: ManageDocumentParticipantsUseCase;
  let signUseCase: SignDocumentSnapshotUseCase;
  let releaseUseCase: ReleaseDocumentInstanceUseCase;
  let custodyUseCase: ManageCustodyEventsUseCase;
  let getSnapshotUseCase: GetDocumentSnapshotUseCase;
  let reopenUseCase: ReopenDocumentInstanceUseCase;
  let pdfRenderer: PdfRenderEngineService;
  let storage: LocalPrivateStorageAdapter;

  const runId = `test-d-${Date.now()}`;
  let testUser: any;
  let testDonor: any;
  let testPackage: any;
  let testPackageVersion: any;
  let testProcess: any;
  let testProcessDoc: any;
  let testTemplate: any;
  let testTemplateVersion: any;
  let testInstance: any;

  const authUser: AuthenticatedUser = {
    userId: "",
    role: "COORDINATOR",
    institutionalIps: ["Hospital Universitario del Valle"],
  };

  const auditEventsRecorded: any[] = [];
  const mockAuditPort: AuditEventPort = {
    record: async (event) => {
      auditEventsRecorded.push(event);
    },
  };

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    const config = new ConfigService();
    storage = new LocalPrivateStorageAdapter(config);
    pdfRenderer = new PdfRenderEngineService();
    const responseValidator = new DocumentResponseValidator();

    validateUseCase = new ValidateDocumentInstanceUseCase(prisma, mockAuditPort, responseValidator);
    completeUseCase = new CompleteDocumentInstanceUseCase(prisma, mockAuditPort, validateUseCase);
    snapshotUseCase = new GenerateDocumentSnapshotUseCase(
      prisma,
      mockAuditPort,
      storage,
      pdfRenderer,
      completeUseCase,
    );
    participantsUseCase = new ManageDocumentParticipantsUseCase(prisma, mockAuditPort);
    signUseCase = new SignDocumentSnapshotUseCase(prisma, mockAuditPort);
    releaseUseCase = new ReleaseDocumentInstanceUseCase(prisma, mockAuditPort);
    custodyUseCase = new ManageCustodyEventsUseCase(prisma, mockAuditPort);
    getSnapshotUseCase = new GetDocumentSnapshotUseCase(prisma, storage);
    reopenUseCase = new ReopenDocumentInstanceUseCase(prisma, mockAuditPort);

    // 1. Crear Usuario de Prueba
    testUser = await prisma.systemUser.create({
      data: {
        email: `${runId}@godt.gov.co`,
        fullName: "Coordinador Ciclo Documental",
        role: "COORDINATOR",
        isActive: true,
      },
    });
    authUser.userId = testUser.id;

    // 2. Crear Donante de Prueba
    testDonor = await prisma.donorRecord.create({
      data: {
        rndCode: `RND-${runId}`,
        documentNumber: `100223${Date.now().toString().slice(-4)}`,
        fullName: "Donante Pruebas Fase D",
        originatingIpsName: "Hospital Universitario del Valle",
        clinicalService: "UCI Adultos",
        bloodGroup: "O",
        rhFactor: "POSITIVO",
        status: "EN_VALORACION",
        createdById: testUser.id,
      },
    });

    // 3. Crear Paquete y Versión
    testPackage = await prisma.processPackage.create({
      data: {
        code: `PKG-${runId}`,
        name: "Paquete Donación Fase D",
        createdById: testUser.id,
      },
    });

    testPackageVersion = await prisma.processPackageVersion.create({
      data: {
        packageId: testPackage.id,
        versionNumber: "1.0.0",
        status: "PUBLISHED",
        positionsConfig: OFFICIAL_REGIONAL_3_POSITIONS as any,
        createdById: testUser.id,
      },
    });

    // 4. Crear Proceso de Donación
    testProcess = await prisma.donationProcess.create({
      data: {
        processCode: `PROC-${runId}`,
        donorId: testDonor.id,
        packageVersionId: testPackageVersion.id,
        primaryIpsName: "Hospital Universitario del Valle",
        status: "EN_CURSO",
        openedById: testUser.id,
      },
    });

    // 5. Crear Plantilla y Versión Piloto Anexo 1
    testTemplate = await prisma.documentTemplate.create({
      data: {
        templateCode: `ANEXO_1_${runId}`,
        name: "Anexo 1: Formato de Valoración y Alerta",
        category: "CLINICAL",
        status: "ACTIVE",
      },
    });

    testTemplateVersion = await prisma.templateVersion.create({
      data: {
        templateId: testTemplate.id,
        versionNumber: "1.0.0",
        effectiveFrom: new Date(),
        status: "PUBLISHED",
        jsonSchema: {
          type: "object",
          required: ["paciente", "clinicos"],
          properties: {
            paciente: {
              type: "object",
              required: ["nombresApellidos", "numeroDocumento"],
              properties: {
                nombresApellidos: { type: "string" },
                numeroDocumento: { type: "string" },
                edad: { type: "number" },
                sexo: { type: "string" },
              },
            },
            clinicos: {
              type: "object",
              required: ["causaMuerte"],
              properties: {
                causaMuerte: { type: "string" },
                grupoSanguineo: { type: "string" },
                factorRh: { type: "string" },
              },
            },
            paraclinicos: {
              type: "object",
              properties: {
                gasometriaBasal: {
                  type: "object",
                  properties: { ph: { type: "number" } },
                },
                quimica: {
                  type: "object",
                  properties: { creatinina: { type: "number" } },
                },
              },
            },
          },
        },
        uiSchema: {
          sections: [
            { id: "paciente", title: "Datos del Donante", fields: ["paciente"] },
            { id: "clinicos", title: "Datos Clínicos", fields: ["clinicos"] },
            { id: "paraclinicos", title: "Paraclínicos", fields: ["paraclinicos"] },
          ],
        },
        mappingConfig: [
          {
            canonicalFieldKey: "donor.identity.full_name",
            schemaPath: "paciente.nombresApellidos",
            scope: "DONOR",
            bindingPolicy: "SHARED",
            dataType: "string",
          },
          {
            canonicalFieldKey: "donor.clinical.arterial_ph",
            schemaPath: "paraclinicos.gasometriaBasal.ph",
            scope: "PROCESS",
            bindingPolicy: "SHARED",
            dataType: "number",
            cardinality: "REPEATABLE",
          },
        ] as any,
        createdById: testUser.id,
        authorizedById: testUser.id,
      },
    });

    // 6. Crear Posición Documental Anexo 1
    testProcessDoc = await prisma.processDocument.create({
      data: {
        processId: testProcess.id,
        positionNumber: 1,
        documentCode: "ANEXO_1",
        title: "Anexo 1: Valoración y Alerta de Posible Donante",
        category: "CLINICAL",
        status: "PENDIENTE",
        applicabilityStatus: "APLICABLE",
        isMandatory: true,
        orderIndex: 1,
        templateId: testTemplate.id,
        templateVersionId: testTemplateVersion.id,
      },
    });

    // 7. Crear Instancia en Borrador con Revisión 1
    testInstance = await prisma.documentInstance.create({
      data: {
        donorId: testDonor.id,
        processId: testProcess.id,
        processDocumentId: testProcessDoc.id,
        templateId: testTemplate.id,
        templateVersionId: testTemplateVersion.id,
        documentCode: "ANEXO_1",
        status: "BORRADOR",
        createdById: testUser.id,
        updatedById: testUser.id,
      },
    });

    const rev1 = await prisma.documentResponseRevision.create({
      data: {
        documentInstanceId: testInstance.id,
        revisionNumber: 1,
        responseData: {
          paciente: {
            nombresApellidos: "Donante Pruebas Fase D",
            numeroDocumento: testDonor.documentNumber,
            edad: 34,
            sexo: "MASCULINO",
          },
          clinicos: {
            causaMuerte: "Trauma Craneoencefálico Severo",
            grupoSanguineo: "O",
            factorRh: "POSITIVO",
          },
          paraclinicos: {
            gasometriaBasal: { ph: 7.39 },
            quimica: { creatinina: 1.05 },
          },
        },
        createdById: testUser.id,
      },
    });

    await prisma.documentInstance.update({
      where: { id: testInstance.id },
      data: { currentRevisionId: rev1.id },
    });

    await prisma.processDocument.update({
      where: { id: testProcessDoc.id },
      data: { currentInstanceId: testInstance.id, status: "BORRADOR" },
    });
  });

  afterAll(async () => {
    try {
      if (testProcess?.id) {
        await prisma.custodyEvent.deleteMany({ where: { documentInstance: { processId: testProcess.id } } });
        await prisma.documentSignature.deleteMany({ where: { documentInstance: { processId: testProcess.id } } });
        await prisma.documentParticipant.deleteMany({ where: { documentInstance: { processId: testProcess.id } } });
        await prisma.generatedPdfDocument.deleteMany({ where: { processId: testProcess.id } });
        await prisma.documentInstance.updateMany({ where: { processId: testProcess.id }, data: { currentRevisionId: null } });
        await prisma.documentFieldProvenance.deleteMany({ where: { responseRevision: { documentInstance: { processId: testProcess.id } } } });
        await prisma.documentResponseRevision.deleteMany({ where: { documentInstance: { processId: testProcess.id } } });
        await prisma.processDocument.updateMany({ where: { processId: testProcess.id }, data: { currentInstanceId: null } });
        await prisma.documentInstance.deleteMany({ where: { processId: testProcess.id } });
        await prisma.processDocument.deleteMany({ where: { processId: testProcess.id } });
      }
      if (testTemplateVersion?.id) {
        await prisma.templateVersion.delete({ where: { id: testTemplateVersion.id } });
        await prisma.documentTemplate.delete({ where: { id: testTemplate.id } });
      }
      if (testProcess?.id) {
        await prisma.donationProcess.delete({ where: { id: testProcess.id } });
      }
      if (testPackageVersion?.id) {
        await prisma.processPackageVersion.delete({ where: { id: testPackageVersion.id } });
        await prisma.processPackage.delete({ where: { id: testPackage.id } });
      }
      if (testDonor?.id) {
        await prisma.donorRecord.delete({ where: { id: testDonor.id } });
      }
      if (testUser?.id) {
        await prisma.systemUser.delete({ where: { id: testUser.id } });
      }
    } finally {
      await prisma.$disconnect();
    }
  });

  // 1. Transición de Validación
  it("Escenario 1: Validación estructural exitosa avanzando de BORRADOR a VALIDADO", async () => {
    const res = await validateUseCase.execute({
      instanceId: testInstance.id,
      user: authUser,
    });

    expect(res.valid).toBe(true);
    expect(res.status).toBe("VALIDADO");

    const inDb = await prisma.documentInstance.findUnique({ where: { id: testInstance.id } });
    expect(inDb?.status).toBe("VALIDADO");

    const audit = auditEventsRecorded.find((e) => e.action === "DOCUMENT_INSTANCE_VALIDATED");
    expect(audit).toBeDefined();
  });

  // 2. Asignación de Participantes Documentales
  it("Escenario 2: Asignación de participantes documentales con roles y requerimientos de firma", async () => {
    // Coordinador (firmante obligatorio)
    const part1 = await participantsUseCase.assign({
      instanceId: testInstance.id,
      fullName: "Dra. Coordinadora Operativa",
      documentType: "CC",
      documentNumber: "52889900",
      signerRole: "COORDINADOR_OPERATIVO",
      isSigner: true,
      signatureRequired: true,
      signatureOrder: 1,
      user: authUser,
    });

    expect(part1.id).toBeDefined();
    expect(part1.signatureRequired).toBe(true);

    // Médico Tratante (firmante obligatorio)
    const part2 = await participantsUseCase.assign({
      instanceId: testInstance.id,
      fullName: "Dr. Médico Intensivista",
      documentType: "CC",
      documentNumber: "19882233",
      signerRole: "MEDICO_TRATANTE",
      isSigner: true,
      signatureRequired: true,
      signatureOrder: 2,
      user: authUser,
    });

    expect(part2.id).toBeDefined();

    const parts = await participantsUseCase.list(testInstance.id);
    expect(parts).toHaveLength(2);
    expect(parts[0].signerRole).toBe("COORDINADOR_OPERATIVO");
    expect(parts[1].signerRole).toBe("MEDICO_TRATANTE");
  });

  // 3. Completitud Formal
  it("Escenario 3: Completitud formal del diligenciamiento avanzando a COMPLETADO", async () => {
    const completed = await completeUseCase.execute({
      instanceId: testInstance.id,
      user: authUser,
    });

    expect(completed.status).toBe("COMPLETADO");
    expect(completed.completedAt).not.toBeNull();

    const procDoc = await prisma.processDocument.findUnique({ where: { id: testProcessDoc.id } });
    expect(procDoc?.status).toBe("COMPLETADO");
  });

  // 4. Generación de Snapshot Inmutable y Renderizado PDF
  let generatedPdf: any;
  let originalPdfHash: string;
  it("Escenario 4: Generación de snapshot inmutable y renderizado PDF oficial con pdf-lib", async () => {
    const result = await snapshotUseCase.execute({
      instanceId: testInstance.id,
      user: authUser,
    });

    expect(result.generatedPdf).toBeDefined();
    expect(result.sha256Hash).toHaveLength(64);
    // Como tiene participantes que requieren firma, pasa a PENDIENTE_FIRMAS
    expect(result.resultingStatus).toBe("PENDIENTE_FIRMAS");

    generatedPdf = result.generatedPdf;
    originalPdfHash = result.sha256Hash;

    // Verificar que el buffer es un PDF real válido (%PDF-)
    expect(result.pdfBuffer.subarray(0, 5).toString()).toBe("%PDF-");

    // Verificar snapshot en base de datos
    const snapshotInDb = await prisma.generatedPdfDocument.findUnique({
      where: { id: generatedPdf.id },
    });
    expect(snapshotInDb).not.toBeNull();
    expect(snapshotInDb?.sha256Hash).toBe(originalPdfHash);

    const meta = snapshotInDb?.dataSnapshot as any;
    expect(meta.documentCode).toBe("ANEXO_1");
    expect(meta.responseData.paciente.nombresApellidos).toBe("Donante Pruebas Fase D");
    expect(meta.responseData.paraclinicos.gasometriaBasal.ph).toBe(7.39);
    expect(meta.renderEngine).toContain("pdf-lib");

    // Desacoplamiento de hash: Snapshot Digest (Manifiesto canónico) vs Hash Binario del PDF
    expect(meta.snapshotDigest).toBeDefined();
    expect(meta.snapshotDigest).toHaveLength(64);
    expect(meta.snapshotDigest).not.toBe(originalPdfHash);
    expect(meta.participants).toBeDefined();
    expect(meta.participants.length).toBe(2);
  });

  // 5. Inmutabilidad del Snapshot ante Modificaciones Posteriores
  it("Escenario 5: Garantía de inmutabilidad: modificaciones del donante no alteran el snapshot previo", async () => {
    // Intentar alterar el nombre del donante en DonorRecord
    await prisma.donorRecord.update({
      where: { id: testDonor.id },
      data: { fullName: "Nombre Modificado Posteriormente" },
    });

    // Consultar nuevamente el snapshot previo
    const snapshotCheck = await prisma.generatedPdfDocument.findUnique({
      where: { id: generatedPdf.id },
    });

    const meta = snapshotCheck?.dataSnapshot as any;
    // El snapshot inmutable conserva el valor original
    expect(meta.responseData.paciente.nombresApellidos).toBe("Donante Pruebas Fase D");
    expect(snapshotCheck?.sha256Hash).toBe(originalPdfHash);
  });

  // 6. Registro de Firmas y Atestaciones
  it("Escenario 6: Registro de firmas con verificación criptográfica y transición automática", async () => {
    const participants = await participantsUseCase.list(testInstance.id);
    const coord = participants.find((p) => p.signerRole === "COORDINADOR_OPERATIVO")!;
    const med = participants.find((p) => p.signerRole === "MEDICO_TRATANTE")!;

    // 1. Intento de firmar un snapshot con ID incorrecto
    await expect(
      signUseCase.execute({
        instanceId: testInstance.id,
        snapshotId: "00000000-0000-0000-0000-000000000001",
        participantId: coord.id,
        signatureType: "ATESTACION_USUARIO",
        user: authUser,
      }),
    ).rejects.toThrow(SnapshotIntegrityError);

    // 1b. Bloqueo operativo de DIGITAL_CERTIFICADA (Ley 527/1999 / ONAC requerido)
    await expect(
      signUseCase.execute({
        instanceId: testInstance.id,
        snapshotId: generatedPdf.id,
        participantId: coord.id,
        signatureType: "DIGITAL_CERTIFICADA",
        user: authUser,
      }),
    ).rejects.toThrow(InvalidLifecycleTransitionError);

    // 2. Firma válida de la Coordinadora
    const sig1Res = await signUseCase.execute({
      instanceId: testInstance.id,
      snapshotId: generatedPdf.id,
      participantId: coord.id,
      signatureType: "ATESTACION_USUARIO",
      attestationText: "He verificado la alerta y confirmo la idoneidad clínica del donante.",
      evidenceData: { ip: "127.0.0.1", userAgent: "GODT-Regional-3/Test" },
      user: authUser,
    });

    expect(sig1Res.signature.id).toBeDefined();
    expect(sig1Res.signature.snapshotHash).toBe(originalPdfHash);
    expect((sig1Res.signature.evidenceData as any).legalNotice).toContain("Ley 527/1999");
    expect((sig1Res.signature.evidenceData as any).attestationDigest).toHaveLength(64);
    // Aún falta el médico, por ende no está completamente firmado
    expect(sig1Res.allRequiredSignaturesMet).toBe(false);
    expect(sig1Res.resultingStatus).toBe("PENDIENTE_FIRMAS");

    // 3. Firma válida del Médico Intensivista
    const sig2Res = await signUseCase.execute({
      instanceId: testInstance.id,
      snapshotId: generatedPdf.id,
      participantId: med.id,
      signatureType: "MANUSCRITA_PRESENCIAL",
      evidenceData: { witness: "Enfermera Jefe UCI", observation: "Sello verificado" },
      user: authUser,
    });

    // Ahora todos los obligatorios firmaron: pasa a FIRMADO
    expect(sig2Res.allRequiredSignaturesMet).toBe(true);
    expect(sig2Res.resultingStatus).toBe("FIRMADO");

    const instInDb = await prisma.documentInstance.findUnique({ where: { id: testInstance.id } });
    expect(instInDb?.status).toBe("FIRMADO");
  });

  // 7. Protección de Inmutabilidad contra modificación de documentos firmados
  it("Escenario 7: Protección contra mutaciones de documentos en estado FIRMADO", async () => {
    // No permite agregar participantes
    await expect(
      participantsUseCase.assign({
        instanceId: testInstance.id,
        fullName: "Participante Extemporáneo",
        signerRole: "OTRO",
        user: authUser,
      }),
    ).rejects.toThrow(DocumentLockedError);
  });

  // 8. Liberación y Cierre Documental
  it("Escenario 8: Liberación final del documento en el expediente del proceso", async () => {
    const released = await releaseUseCase.execute({
      instanceId: testInstance.id,
      user: authUser,
    });

    expect(released.status).toBe("LIBERADO");
    expect(released.approvedAt).not.toBeNull();

    const procDoc = await prisma.processDocument.findUnique({ where: { id: testProcessDoc.id } });
    expect(procDoc?.status).toBe("LIBERADO");

    const pdfInDb = await prisma.generatedPdfDocument.findUnique({ where: { id: generatedPdf.id } });
    expect(pdfInDb?.status).toBe("RELEASED");

    // Intento de reabrir documento en estado LIBERADO -> estrictamente prohibido
    await expect(
      reopenUseCase.execute({
        instanceId: testInstance.id,
        justification: "Reapertura no autorizada sobre documento sellado y liberado",
        user: authUser,
      }),
    ).rejects.toThrow(DocumentLockedError);
  });

  // 8b. Reapertura Técnica Controlada con Invalidez de Snapshots Previos
  it("Escenario 8b: Reapertura técnica controlada con justificación obligatoria e invalidación de snapshots previos", async () => {
    // Crear instancia auxiliar para prueba de reapertura
    const auxDoc = await prisma.processDocument.create({
      data: {
        processId: testProcess.id,
        positionNumber: 2,
        documentCode: "ANEXO_2",
        title: "Anexo 2: Notificación a Deudos",
        category: "LEGAL",
        status: "BORRADOR",
        applicabilityStatus: "APLICABLE",
        orderIndex: 2,
      },
    });

    const auxInstance = await prisma.documentInstance.create({
      data: {
        donorId: testDonor.id,
        processId: testProcess.id,
        processDocumentId: auxDoc.id,
        templateId: testTemplate.id,
        templateVersionId: testTemplateVersion.id,
        documentCode: "ANEXO_2",
        status: "BORRADOR",
        createdById: testUser.id,
        updatedById: testUser.id,
      },
    });

    const auxRev = await prisma.documentResponseRevision.create({
      data: {
        documentInstanceId: auxInstance.id,
        revisionNumber: 1,
        responseData: {
          paciente: {
            nombresApellidos: "Donante Reapertura",
            numeroDocumento: testDonor.documentNumber,
            edad: 34,
            sexo: "MASCULINO",
          },
          clinicos: {
            causaMuerte: "Encefalopatía Anóxica",
            grupoSanguineo: "O",
            factorRh: "POSITIVO",
          },
          paraclinicos: {
            gasometriaBasal: { ph: 7.4 },
          },
        },
        createdById: testUser.id,
      },
    });

    await prisma.documentInstance.update({
      where: { id: auxInstance.id },
      data: { currentRevisionId: auxRev.id },
    });

    // Asignar participante y completar
    await participantsUseCase.assign({
      instanceId: auxInstance.id,
      fullName: "Dra. Test Reapertura",
      signerRole: "MEDICO_TRATANTE",
      signatureRequired: true,
      user: authUser,
    });

    const snapResult = await snapshotUseCase.execute({
      instanceId: auxInstance.id,
      user: authUser,
    });
    expect(snapResult.resultingStatus).toBe("PENDIENTE_FIRMAS");

    // 1. Intento sin justificación o justificación muy corta (< 10 caracteres)
    await expect(
      reopenUseCase.execute({
        instanceId: auxInstance.id,
        justification: "Error",
        user: authUser,
      }),
    ).rejects.toThrow(InvalidLifecycleTransitionError);

    // 2. Intento con usuario sin rol administrativo/coordinador
    const unauthorizedUser: AuthenticatedUser = {
      userId: testUser.id,
      role: "TECHNICIAN",
      institutionalIps: ["Hospital Universitario del Valle"],
    };
    await expect(
      reopenUseCase.execute({
        instanceId: auxInstance.id,
        justification: "Se requiere corregir la fecha de notificación",
        user: unauthorizedUser,
      }),
    ).rejects.toThrow(DonationProcessAccessDeniedError);

    // 3. Reapertura válida por Coordinador
    const reopenRes = await reopenUseCase.execute({
      instanceId: auxInstance.id,
      justification: "Corrección técnica justificada de datos de notificación clínica",
      user: authUser,
    });

    expect(reopenRes.previousStatus).toBe("PENDIENTE_FIRMAS");
    expect(reopenRes.status).toBe("BORRADOR");

    // Comprobar que el snapshot anterior quedó marcado como SUPERSEDED
    const supersedSnap = await prisma.generatedPdfDocument.findUnique({
      where: { id: snapResult.generatedPdf.id },
    });
    expect(supersedSnap?.status).toBe("SUPERSEDED");

    // Comprobar registro de auditoría
    const reopenAudit = auditEventsRecorded.find((e) => e.action === "DOCUMENT_INSTANCE_REOPENED");
    expect(reopenAudit).toBeDefined();
    expect(reopenAudit.metadata.justification).toContain("Corrección técnica");

    // Limpieza de instancia auxiliar
    await prisma.documentInstance.update({ where: { id: auxInstance.id }, data: { currentRevisionId: null } });
    await prisma.documentFieldProvenance.deleteMany({ where: { responseRevision: { documentInstanceId: auxInstance.id } } });
    await prisma.documentResponseRevision.deleteMany({ where: { documentInstanceId: auxInstance.id } });
    await prisma.documentParticipant.deleteMany({ where: { documentInstanceId: auxInstance.id } });
    await prisma.generatedPdfDocument.deleteMany({ where: { documentInstanceId: auxInstance.id } });
    await prisma.documentInstance.delete({ where: { id: auxInstance.id } });
    await prisma.processDocument.delete({ where: { id: auxDoc.id } });
  });

  // 9. Descarga Protegida del PDF Oficial y Detección de Adulteración
  it("Escenario 9: Descarga y verificación de integridad criptográfica del PDF emitido", async () => {
    const downloaded = await getSnapshotUseCase.downloadPdf(generatedPdf.id, authUser);

    expect(downloaded.mimeType).toBe("application/pdf");
    expect(downloaded.sha256Hash).toBe(originalPdfHash);
    expect(downloaded.buffer.subarray(0, 5).toString()).toBe("%PDF-");

    // Verificación de adulteración criptográfica: alteración de un byte invalida el hash
    const tampered = Buffer.from(downloaded.buffer);
    tampered[150] = tampered[150] ^ 0xff;
    const tamperedHash = createHash("sha256").update(tampered).digest("hex");
    expect(tamperedHash).not.toBe(downloaded.sha256Hash);
  });

  // 10. Cadena de Custodia Append-Only y Verificación de Integridad (Anexo 8)
  it("Escenario 10: Secuencia inmutable de eventos de custodia y verificación térmica (Anexo 8)", async () => {
    // Instancia específica de Anexo 8
    const anexo8Doc = await prisma.processDocument.create({
      data: {
        processId: testProcess.id,
        positionNumber: 18,
        documentCode: "ANEXO_8",
        title: "Anexo 8: Cadena de Custodia",
        category: "CUSTODY",
        status: "BORRADOR",
        applicabilityStatus: "APLICABLE",
        orderIndex: 18,
      },
    });

    const anexo8Inst = await prisma.documentInstance.create({
      data: {
        donorId: testDonor.id,
        processId: testProcess.id,
        processDocumentId: anexo8Doc.id,
        templateId: testTemplate.id,
        templateVersionId: testTemplateVersion.id,
        documentCode: "ANEXO_8",
        status: "BORRADOR",
        createdById: testUser.id,
        updatedById: testUser.id,
      },
    });

    const t1 = new Date("2026-11-06T14:00:00Z");
    const t2 = new Date("2026-11-06T15:30:00Z");
    const tRetro = new Date("2026-11-06T13:00:00Z");

    // Evento 1: Recolección (integrityVerified por defecto en false si no se valida explícitamente)
    const ev1 = await custodyUseCase.append({
      instanceId: anexo8Inst.id,
      eventType: "RECOLECCION",
      itemDescription: "Córneas donante cadavérico (Par)",
      containerCode: "CONT-OCULAR-01",
      sealNumber: "SELLO-9912",
      temperatureCelsius: 4.2,
      transferorName: "Dr. Cirujano Rescate",
      receiverName: "Tec. Custodio Transporte",
      occurredAt: t1,
      location: "Quirófano 3 — HUV",
      user: authUser,
    });

    expect(ev1.sequenceNumber).toBe(1);
    expect(ev1.integrityVerified).toBe(false);

    // Intento con temperatura fuera de límites admisibles (> 45°C)
    await expect(
      custodyUseCase.append({
        instanceId: anexo8Inst.id,
        eventType: "TRANSPORTE",
        itemDescription: "Córneas donante cadavérico (Par)",
        temperatureCelsius: 60,
        transferorName: "Tec. Custodio Transporte",
        receiverName: "Transportador",
        occurredAt: t2,
        location: "Vehículo",
        user: authUser,
      }),
    ).rejects.toThrow(CustodySequenceError);

    // Evento 2: Transporte con verificación de integridad auditada
    const ev2 = await custodyUseCase.append({
      instanceId: anexo8Inst.id,
      eventType: "TRANSPORTE",
      itemDescription: "Córneas donante cadavérico (Par)",
      containerCode: "CONT-OCULAR-01",
      sealNumber: "SELLO-9912",
      temperatureCelsius: 3.9,
      transferorName: "Tec. Custodio Transporte",
      receiverName: "Banco de Tejidos Regional",
      occurredAt: t2,
      location: "Banco de Tejidos — Cali",
      integrityVerified: true,
      verifierNotes: "Nevera sellada e inspeccionada con precinto intacto",
      user: authUser,
    });

    expect(ev2.sequenceNumber).toBe(2);
    expect(ev2.integrityVerified).toBe(true);
    expect(ev2.verifiedById).toBe(authUser.userId);
    expect(ev2.verifiedAt).not.toBeNull();
    expect(ev2.verifierNotes).toContain("precinto intacto");

    // Intento de evento extemporáneo hacia el pasado -> error de secuencia
    await expect(
      custodyUseCase.append({
        instanceId: anexo8Inst.id,
        eventType: "ENTREGA",
        itemDescription: "Córneas",
        transferorName: "Persona",
        receiverName: "Persona 2",
        occurredAt: tRetro,
        location: "Lugar",
        user: authUser,
      }),
    ).rejects.toThrow(CustodySequenceError);

    const list = await custodyUseCase.list(anexo8Inst.id);
    expect(list).toHaveLength(2);
    expect(list[0].sequenceNumber).toBe(1);
    expect(list[1].sequenceNumber).toBe(2);

    // Limpieza de anexo 8
    await prisma.custodyEvent.deleteMany({ where: { documentInstanceId: anexo8Inst.id } });
    await prisma.documentInstance.delete({ where: { id: anexo8Inst.id } });
    await prisma.processDocument.delete({ where: { id: anexo8Doc.id } });
  });

  // 11. Renderizado de Pilotos Anexo 6 y Anexo 7
  it("Escenario 11: Renderizado fiel de pilotos Anexo 6 (Extracción) y Anexo 7 (Ficha Quirúrgica)", async () => {
    // Anexo 6
    const pdfAnexo6 = await pdfRenderer.render({
      documentCode: "ANEXO_6",
      title: "ANEXO 6: REGISTRO GENERAL DE EXTRACCIÓN DE COMPONENTES ANATÓMICOS",
      data: {
        scheduledStartAt: "2026-11-06T14:00:00Z",
        clampAt: "2026-11-06T15:45:00Z",
        organRecoveries: [
          { component: "CORAZÓN", responsibleInstitution: "Clínica Imbanaco", nonExtractionReason: null },
          { component: "HÍGADO", responsibleInstitution: "HUV", nonExtractionReason: null },
        ],
        preservationSolutions: [
          { route: "AORTA", type: "Custodiol", quantityCc: 2000 },
        ],
      },
      metadata: {
        processCode: `PROC-${runId}`,
        primaryIpsName: "Hospital Universitario del Valle",
        revisionNumber: 1,
        templateVersion: "1.0.0",
        generatedAt: new Date(),
        generatedByName: "Coordinador",
      },
    });

    expect(pdfAnexo6.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdfAnexo6.length).toBeGreaterThan(1000);

    // Anexo 7 Variante Corazón
    const pdfAnexo7 = await pdfRenderer.render({
      documentCode: "ANEXO_7_CORAZON",
      title: "ANEXO 7: FICHA DE EXTRACCIÓN QUIRÚRGICA — CORAZÓN",
      data: {
        clampeoAortico: "2026-11-06T15:45:00Z",
        cirujano: "Dr. Cirujano Cardiovascular",
        calidad: "Excelente función ventricular previa",
        hallazgos: "Corazón sin hipertrofia ni coronariopatía evidente",
      },
      metadata: {
        processCode: `PROC-${runId}`,
        primaryIpsName: "Hospital Universitario del Valle",
        revisionNumber: 1,
        templateVersion: "1.0.0",
        generatedAt: new Date(),
        generatedByName: "Coordinador",
      },
    });

    expect(pdfAnexo7.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdfAnexo7.length).toBeGreaterThan(1000);
  });
});
