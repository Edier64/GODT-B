import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { ConfigService } from "@nestjs/config";
import { LocalPrivateStorageAdapter } from "../src/infrastructure/documents/local-private-storage.adapter";
import { PdfRenderEngineService } from "../src/application/pdf/pdf-render-engine.service";
import { DocumentResponseValidator } from "../src/application/document-engine/document-response.validator";
import { AuditEventPort } from "../src/application/audit/audit-event.port";
import { AuthenticatedUser } from "../src/presentation/auth/auth.types";
import { ValidateDocumentInstanceUseCase } from "../src/application/document-lifecycle/validate-document-instance.use-case";
import { CompleteDocumentInstanceUseCase } from "../src/application/document-lifecycle/complete-document-instance.use-case";
import { GenerateDocumentSnapshotUseCase } from "../src/application/document-lifecycle/generate-document-snapshot.use-case";
import { ManageDocumentParticipantsUseCase } from "../src/application/document-lifecycle/manage-document-participants.use-case";
import { SignDocumentSnapshotUseCase } from "../src/application/document-lifecycle/sign-document-snapshot.use-case";
import { ReleaseDocumentInstanceUseCase } from "../src/application/document-lifecycle/release-document-instance.use-case";
import { ReopenDocumentInstanceUseCase } from "../src/application/document-lifecycle/reopen-document-instance.use-case";
import { ManageCustodyEventsUseCase } from "../src/application/document-lifecycle/manage-custody-events.use-case";
import { GetDocumentSnapshotUseCase } from "../src/application/document-lifecycle/get-document-snapshot.use-case";
import { CanonicalPropagationEngine } from "../src/application/canonical/canonical-propagation.engine";
import { PrismaCanonicalDictionaryRepository } from "../src/infrastructure/canonical/prisma-canonical-dictionary.repository";
import { PrismaDonationProcessRepository } from "../src/infrastructure/processes/prisma-donation-process.repository";
import { OFFICIAL_REGIONAL_3_POSITIONS } from "../src/domain/packages/process-package";
import {
  InvalidLifecycleTransitionError,
  DocumentLockedError,
  CustodySequenceError,
} from "../src/domain/document-lifecycle/document-lifecycle";
import { DonationProcessAccessDeniedError } from "../src/domain/processes/donation-process";

describe("E2E Real Integration Scenarios (A through G) — Fase D.2 Cierre Funcional", () => {
  let prisma: PrismaService;
  let storage: LocalPrivateStorageAdapter;
  let pdfRenderer: PdfRenderEngineService;
  let validateUseCase: ValidateDocumentInstanceUseCase;
  let completeUseCase: CompleteDocumentInstanceUseCase;
  let snapshotUseCase: GenerateDocumentSnapshotUseCase;
  let participantsUseCase: ManageDocumentParticipantsUseCase;
  let signUseCase: SignDocumentSnapshotUseCase;
  let releaseUseCase: ReleaseDocumentInstanceUseCase;
  let reopenUseCase: ReopenDocumentInstanceUseCase;
  let custodyUseCase: ManageCustodyEventsUseCase;
  let getSnapshotUseCase: GetDocumentSnapshotUseCase;
  let propagationEngine: CanonicalPropagationEngine;

  const testSuffix = `d2-${Date.now()}`;
  let testUser: any;
  let unauthorizedUser: any;
  let testDonor: any;
  let testPackage: any;
  let testPackageVersion: any;
  let testProcess: any;
  let testTemplate: any;
  let testTemplateVersion: any;
  let testInstance: any;
  let testProcessDoc: any;
  let testAnexo8Doc: any;
  let testAnexo8Template: any;
  let testAnexo8TemplateVersion: any;
  let testAnexo8Instance: any;
  let participant: any;
  let activeSnapshotId: string;

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
    reopenUseCase = new ReopenDocumentInstanceUseCase(prisma, mockAuditPort);
    custodyUseCase = new ManageCustodyEventsUseCase(prisma, mockAuditPort);
    getSnapshotUseCase = new GetDocumentSnapshotUseCase(prisma, storage);

    const canonicalRepo = new PrismaCanonicalDictionaryRepository(prisma);
    const processRepo = new PrismaDonationProcessRepository(prisma);
    propagationEngine = new CanonicalPropagationEngine(canonicalRepo, prisma, mockAuditPort);

    // Sembrar catálogo maestro
    await canonicalRepo.seedDefaultCatalog();

    // 1. Crear usuario autorizado
    testUser = await prisma.systemUser.create({
      data: {
        email: `coord-${testSuffix}@godt.salud.gov.co`,
        fullName: "Dra. Elena Ramos - Coordinadora Regional",
        role: "COORDINATOR",
        isActive: true,
      },
    });
    authUser.userId = testUser.id;

    // 2. Crear usuario de otra IPS no autorizada
    unauthorizedUser = await prisma.systemUser.create({
      data: {
        email: `externo-${testSuffix}@otra-ips.gov.co`,
        fullName: "Dr. Externo No Autorizado",
        role: "COORDINATOR",
        isActive: true,
      },
    });

    // 3. Crear Donante de prueba
    testDonor = await prisma.donorRecord.create({
      data: {
        rndCode: `RND-D2-${testSuffix.slice(-6)}`,
        documentNumber: `CC-${testSuffix.slice(-8)}`,
        fullName: "Gabriel Mendoza",
        originatingIpsName: "Hospital Universitario del Valle",
        clinicalService: "UCI Adultos",
        bloodGroup: "O",
        rhFactor: "POSITIVO",
        status: "EN_VALORACION",
        createdById: testUser.id,
      },
    });

    // 4. Paquete oficial y versión
    testPackage = await prisma.processPackage.create({
      data: {
        code: `PKG-R3-${testSuffix}`,
        name: "Paquete Oficial Regional 3",
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

    // 5. Plantilla base para Anexo 6
    testTemplate = await prisma.documentTemplate.create({
      data: {
        templateCode: `anexo-6-${testSuffix}`,
        name: "Anexo 6 — Registro General de Extracción",
        category: "SURGERY",
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
          required: ["horaInicioCirugia", "cirujanoPrincipal", "organosExtraidos"],
          properties: {
            horaInicioCirugia: { type: "string" },
            cirujanoPrincipal: { type: "string" },
            organosExtraidos: { type: "string" },
            grupoSanguineo: { type: "string" },
          },
        },
        uiSchema: {
          sections: [
            { id: "cirugia", title: "Datos Quirúrgicos", fields: ["horaInicioCirugia", "cirujanoPrincipal", "organosExtraidos", "grupoSanguineo"] },
          ],
        },
        mappingConfig: [
          {
            canonicalFieldKey: "donor.clinical.blood_group",
            schemaPath: "grupoSanguineo",
            scope: "DONOR",
            bindingPolicy: "SHARED",
            dataType: "string",
          },
        ] as any,
        createdById: testUser.id,
        authorizedById: testUser.id,
      },
    });

    // Plantilla para Anexo 8
    testAnexo8Template = await prisma.documentTemplate.create({
      data: {
        templateCode: `anexo-8-${testSuffix}`,
        name: "Anexo 8 — Cadena de Custodia",
        category: "CUSTODY",
        status: "ACTIVE",
      },
    });

    testAnexo8TemplateVersion = await prisma.templateVersion.create({
      data: {
        templateId: testAnexo8Template.id,
        versionNumber: "1.0.0",
        effectiveFrom: new Date(),
        status: "PUBLISHED",
        jsonSchema: {
          type: "object",
          properties: {
            codigoElemento: { type: "string" },
          },
        },
        uiSchema: {},
        mappingConfig: [] as any,
        createdById: testUser.id,
        authorizedById: testUser.id,
      },
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
        await prisma.processParticipant.deleteMany({ where: { processId: testProcess.id } });
        await prisma.processInstitution.deleteMany({ where: { processId: testProcess.id } });
        await prisma.processCanonicalHistory.deleteMany({ where: { processId: testProcess.id } });
        await prisma.processCanonicalValue.deleteMany({ where: { processId: testProcess.id } });
        await prisma.donationProcess.delete({ where: { id: testProcess.id } });
      }
      if (testTemplateVersion?.id) {
        await prisma.templateVersion.delete({ where: { id: testTemplateVersion.id } });
        await prisma.documentTemplate.delete({ where: { id: testTemplate.id } });
      }
      if (testAnexo8TemplateVersion?.id) {
        await prisma.templateVersion.delete({ where: { id: testAnexo8TemplateVersion.id } });
        await prisma.documentTemplate.delete({ where: { id: testAnexo8Template.id } });
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
      if (unauthorizedUser?.id) {
        await prisma.systemUser.delete({ where: { id: unauthorizedUser.id } });
      }
      await prisma.$disconnect();
    } catch (err) {
      console.warn("Cleanup warning:", err);
    }
  });

  // =========================================================================
  // ESCENARIO A: Apertura de proceso y paquete documental de 23 posiciones
  // =========================================================================
  it("Escenario A: Apertura de DonationProcess y generación del paquete de 23 posiciones", async () => {
    testProcess = await prisma.donationProcess.create({
      data: {
        processCode: `PROC-D2-${testSuffix.slice(-6)}`,
        donorId: testDonor.id,
        status: "EN_CURSO",
        primaryIpsName: "Hospital Universitario del Valle",
        packageVersionId: testPackageVersion.id,
        openedById: testUser.id,
        institutions: {
          create: [
            {
              institutionName: "Hospital Universitario del Valle",
              role: "IPS_EXTRACTORA",
            },
          ],
        },
        participants: {
          create: [
            {
              fullName: "Dra. Elena Ramos",
              role: "COORDINADOR_OPERATIVO",
              documentType: "CC",
              documentNumber: "52147896",
              institution: "Hospital Universitario del Valle",
            },
          ],
        },
      },
      include: {
        institutions: true,
        participants: true,
      },
    });

    expect(testProcess).toBeDefined();
    expect(testProcess.institutions.length).toBe(1);
    expect(testProcess.participants.length).toBe(1);

    // Crear las 23 posiciones documentales vinculadas al paquete oficial
    const positionsData = OFFICIAL_REGIONAL_3_POSITIONS.map((pos) => ({
      processId: testProcess.id,
      positionNumber: pos.positionNumber,
      documentCode: pos.documentCode,
      title: pos.title,
      category: pos.category,
      status: "PENDIENTE" as const,
      applicabilityStatus: pos.defaultApplicability,
      isMandatory: pos.isMandatory,
      orderIndex: pos.orderIndex,
      rules: pos.rules as any,
    }));

    await prisma.processDocument.createMany({
      data: positionsData,
    });

    const createdDocs = await prisma.processDocument.findMany({
      where: { processId: testProcess.id },
      orderBy: { positionNumber: "asc" },
    });

    expect(createdDocs.length).toBe(23);
    expect(createdDocs[0].documentCode).toBe("ANEXO_1");
    expect(createdDocs[5].documentCode).toBe("ANEXO_6");
    expect(createdDocs[12].documentCode).toBe("ANEXO_7_OTROS_ORGANOS");
    expect(createdDocs[17].documentCode).toBe("ANEXO_8");
    expect(createdDocs[18].documentCode).toBe("ANEXO_9");
    expect(createdDocs[19].category).toBe("PENDING_HOMOLOGATION");
    expect(createdDocs[22].category).toBe("PENDING_HOMOLOGATION");

    testProcessDoc = createdDocs.find((d) => d.documentCode === "ANEXO_6");
    testAnexo8Doc = createdDocs.find((d) => d.documentCode === "ANEXO_8");
  });

  // =========================================================================
  // ESCENARIO B: Ciclo de vida documental y reapertura técnica justificada
  // =========================================================================
  it("Escenario B: Ciclo de vida (BORRADOR -> VALIDADO -> COMPLETADO) y reapertura técnica justificada", async () => {
    // 1. Crear instancia para Anexo 6
    testInstance = await prisma.documentInstance.create({
      data: {
        processId: testProcess.id,
        donorId: testDonor.id,
        processDocumentId: testProcessDoc.id,
        templateId: testTemplate.id,
        templateVersionId: testTemplateVersion.id,
        status: "BORRADOR",
        documentCode: "ANEXO_6",
        createdById: testUser.id,
        updatedById: testUser.id,
      },
    });

    const rev1 = await prisma.documentResponseRevision.create({
      data: {
        documentInstanceId: testInstance.id,
        revisionNumber: 1,
        responseData: {
          horaInicioCirugia: "08:30",
          cirujanoPrincipal: "Dr. Roberto Martínez",
          organosExtraidos: "Hígado, Riñón Derecho",
          grupoSanguineo: "O",
        },
        createdById: testUser.id,
      },
    });

    await prisma.documentInstance.update({
      where: { id: testInstance.id },
      data: { currentRevisionId: rev1.id },
    });

    // 2. Transición a VALIDADO
    const validResult = await validateUseCase.execute({
      instanceId: testInstance.id,
      user: authUser,
    });
    expect(validResult.status).toBe("VALIDADO");

    // 3. Transición a COMPLETADO
    const compResult = await completeUseCase.execute({
      instanceId: testInstance.id,
      user: authUser,
    });
    expect(compResult.status).toBe("COMPLETADO");

    // 4. Reapertura técnica justificada (vuelve a BORRADOR con justificación registrada)
    const reopenResult = await reopenUseCase.execute({
      instanceId: testInstance.id,
      justification: "Corrección justificada: Rectificación de hora de clampeo y verificación quirúrgica",
      user: authUser,
    });
    expect(reopenResult.status).toBe("BORRADOR");

    const instAfterReopen = await prisma.documentInstance.findUnique({
      where: { id: testInstance.id },
    });
    expect(instAfterReopen?.status).toBe("BORRADOR");
  });

  // =========================================================================
  // ESCENARIO C: Diccionario Canónico, Propagación y Resolución de Conflictos
  // =========================================================================
  it("Escenario C: Diccionario Canónico, propagación y resolución formal de discrepancias", async () => {
    // 1. Aplicar valor canónico vigente
    const propRes = await propagationEngine.applyAndPropagate({
      processId: testProcess.id,
      canonicalFieldKey: "donor.clinical.blood_group",
      value: "O",
      sourceKind: "MANUAL",
      actorUserId: authUser.userId,
    });

    expect(propRes.canonicalFieldKey).toBe("donor.clinical.blood_group");
    expect(propRes.currentValue).toBe("O");

    // Verificar persistencia en base de datos
    const savedVal = await prisma.processCanonicalValue.findUnique({
      where: {
        processId_canonicalFieldKey: {
          processId: testProcess.id,
          canonicalFieldKey: "donor.clinical.blood_group",
        },
      },
    });
    expect(savedVal?.currentValue).toBe("O");

    // 2. Historial de trazabilidad inmutable
    const history = await prisma.processCanonicalHistory.findMany({
      where: {
        processId: testProcess.id,
        canonicalFieldKey: "donor.clinical.blood_group",
      },
    });
    expect(history.length).toBeGreaterThanOrEqual(1);

    // 3. Simulación de resolución de conflicto con justificación auditada
    const resolveRes = await propagationEngine.applyAndPropagate({
      processId: testProcess.id,
      canonicalFieldKey: "donor.clinical.blood_group",
      value: "O",
      sourceKind: "DONOR_RECORD",
      actorUserId: authUser.userId,
      conflictResolution: {
        strategy: "ACCEPT_CANDIDATE",
        justification: "Confirmado con prueba serológica de laboratorio central IPS",
      },
    });
    expect(resolveRes.currentValue).toBe("O");
  });

  // =========================================================================
  // ESCENARIO D: Snapshot Inmutable, Hash SHA-256 y Protección contra Mutación
  // =========================================================================
  it("Escenario D: Generación de Snapshot oficial PDF, hash SHA-256 y garantía de inmutabilidad", async () => {
    // Asignar participante con firma obligatoria ANTES de generar el snapshot para requerir firmas
    participant = await participantsUseCase.assign({
      instanceId: testInstance.id,
      fullName: "Dr. Carlos Gómez",
      documentType: "CC",
      documentNumber: "79456123",
      signerRole: "CIRUJANO_RESCATE",
      isSigner: true,
      signatureRequired: true,
      signatureOrder: 1,
      user: authUser,
    });
    expect(participant.id).toBeDefined();

    // Validar y completar nuevamente el documento reabierto
    await validateUseCase.execute({ instanceId: testInstance.id, user: authUser });
    await completeUseCase.execute({ instanceId: testInstance.id, user: authUser });

    // Generar Snapshot oficial
    const snapResult = await snapshotUseCase.execute({
      instanceId: testInstance.id,
      user: authUser,
    });

    expect(snapResult.sha256Hash).toBeDefined();
    expect(snapResult.sha256Hash.length).toBe(64);
    expect(snapResult.generatedPdf.id).toBeDefined();
    expect(snapResult.resultingStatus).toBe("PENDIENTE_FIRMAS");
    activeSnapshotId = snapResult.generatedPdf.id;

    const originalHash = snapResult.sha256Hash;

    // Mutar datos del donante posterior a la emisión del snapshot
    await prisma.donorRecord.update({
      where: { id: testDonor.id },
      data: { fullName: "Gabriel Mendoza Modificado Post-Snapshot" },
    });

    // Descargar snapshot y verificar integridad criptográfica inalterada
    const downloadedPdf = await getSnapshotUseCase.downloadPdf(snapResult.generatedPdf.id, authUser);
    expect(downloadedPdf.sha256Hash).toBe(originalHash);
    expect(downloadedPdf.buffer.length).toBeGreaterThan(0);
  });

  // =========================================================================
  // ESCENARIO E: Asignación de participantes, firmas y transición a FIRMADO
  // =========================================================================
  it("Escenario E: Participantes documentales, registro de firmas y transición a FIRMADO", async () => {
    // Registrar firma / atestación sobre el snapshot
    const signResult = await signUseCase.execute({
      instanceId: testInstance.id,
      snapshotId: activeSnapshotId,
      participantId: participant.id,
      signatureType: "ATESTACION_USUARIO",
      attestationText: "Certifico la veracidad del procedimiento quirúrgico y la integridad de los órganos extraídos.",
      user: authUser,
    });

    expect(signResult.signature.id).toBeDefined();
    expect(signResult.resultingStatus).toBe("FIRMADO");

    const instAfterSign = await prisma.documentInstance.findUnique({
      where: { id: testInstance.id },
    });
    expect(instAfterSign?.status).toBe("FIRMADO");
  });

  // =========================================================================
  // ESCENARIO F: Cadena de custodia (Anexo 8), secuencia y validación térmica
  // =========================================================================
  it("Escenario F: Anexo 8 Cadena de Custodia: secuencia estricta e inmutabilidad térmica", async () => {
    // Instanciar Anexo 8
    testAnexo8Instance = await prisma.documentInstance.create({
      data: {
        processId: testProcess.id,
        donorId: testDonor.id,
        processDocumentId: testAnexo8Doc.id,
        templateId: testAnexo8Template.id,
        templateVersionId: testAnexo8TemplateVersion.id,
        status: "BORRADOR",
        documentCode: "ANEXO_8",
        createdById: testUser.id,
        updatedById: testUser.id,
      },
    });

    const now = new Date();

    // 1. Registrar Evento 1
    const event1 = await custodyUseCase.append({
      instanceId: testAnexo8Instance.id,
      eventType: "RECOLECCION",
      itemDescription: "Hígado donante cadavérico en contenedor isotérmico",
      containerCode: "CONT-HEP-01",
      sealNumber: "SEAL-EMP-001",
      temperatureCelsius: 4.0,
      transferorName: "Dr. Cirujano Rescate",
      receiverName: "Enf. Custodio",
      occurredAt: now,
      location: "Quirófano 3 — HUV",
      integrityVerified: true,
      user: authUser,
    });
    expect(event1.sequenceNumber).toBe(1);
    expect(Number(event1.temperatureCelsius)).toBe(4.0);

    // 2. Registrar Evento 2
    const event2 = await custodyUseCase.append({
      instanceId: testAnexo8Instance.id,
      eventType: "TRANSPORTE",
      itemDescription: "Hígado donante cadavérico en contenedor isotérmico",
      containerCode: "CONT-HEP-01",
      sealNumber: "SEAL-EMP-001",
      temperatureCelsius: 3.8,
      transferorName: "Enf. Custodio",
      receiverName: "Transportador Especializado",
      occurredAt: new Date(now.getTime() + 1000 * 60 * 30),
      location: "Ambulancia de Transporte Medicalizado",
      integrityVerified: true,
      verifierNotes: "Nevera sellada e inspeccionada con precinto intacto",
      user: authUser,
    });
    expect(event2.sequenceNumber).toBe(2);
    expect(Number(event2.temperatureCelsius)).toBe(3.8);

    // 3. Validar rechazo de temperatura no finita (NaN)
    await expect(
      custodyUseCase.append({
        instanceId: testAnexo8Instance.id,
        eventType: "ENTREGA",
        itemDescription: "Hígado donante cadavérico",
        temperatureCelsius: NaN,
        transferorName: "Transportador",
        receiverName: "Transportador",
        occurredAt: new Date(now.getTime() + 1000 * 60 * 60),
        location: "En tránsito",
        user: authUser,
      }),
    ).rejects.toThrow(CustodySequenceError);
  });

  // =========================================================================
  // ESCENARIO G: Bloqueo de mutaciones y control de acceso por IPS
  // =========================================================================
  it("Escenario G: Protección contra mutaciones de documentos cerrados y control de acceso institucional", async () => {
    // 1. Intentar validar el documento que ya está en FIRMADO -> Rechaza transición
    await expect(
      validateUseCase.execute({ instanceId: testInstance.id, user: authUser }),
    ).rejects.toThrow(InvalidLifecycleTransitionError);

    // 2. Intentar operar con usuario de otra IPS no autorizada sobre instancia abierta
    await expect(
      validateUseCase.execute({
        instanceId: testAnexo8Instance.id,
        user: {
          userId: unauthorizedUser.id,
          role: "COORDINATOR",
          institutionalIps: ["Clínica Imbanaco"],
        },
      }),
    ).rejects.toThrow(DonationProcessAccessDeniedError);
  });
});
