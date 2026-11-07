import { PrismaService } from "../src/infrastructure/prisma/prisma.service";
import { ConfigService } from "@nestjs/config";
import { LocalPrivateStorageAdapter } from "../src/infrastructure/documents/local-private-storage.adapter";
import { PdfRenderEngineService } from "../src/application/pdf/pdf-render-engine.service";
import { AuditEventPort } from "../src/application/audit/audit-event.port";
import { AuthenticatedUser } from "../src/presentation/auth/auth.types";
import { OFFICIAL_REGIONAL_3_POSITIONS } from "../src/domain/packages/process-package";
import { BuildIntegrityManifestService } from "../src/application/dossier/build-integrity-manifest.service";
import { GenerateDossierIndexService } from "../src/application/dossier/generate-dossier-index.service";
import { ConsolidatePdfService } from "../src/application/dossier/consolidate-pdf.service";
import { PackageZipService } from "../src/application/dossier/package-zip.service";
import { ProcessDossierExportService } from "../src/application/dossier/process-dossier-export.service";
import { RequestDossierExportUseCase } from "../src/application/dossier/request-dossier-export.use-case";
import { GetDossierExportUseCase } from "../src/application/dossier/get-dossier-export.use-case";
import { ListDossierExportsUseCase } from "../src/application/dossier/list-dossier-exports.use-case";
import { VerifyDossierIntegrityUseCase } from "../src/application/dossier/verify-dossier-integrity.use-case";
import { DossierAccessDeniedError, DossierNotFoundError } from "../src/domain/dossier/dossier.types";
import { PDFDocument } from "pdf-lib";
import { createHash } from "crypto";
import AdmZip from "adm-zip";

describe("Dossier Export Integration Tests (Fase E)", () => {
  jest.setTimeout(60000);
  let prisma: PrismaService;
  let storage: LocalPrivateStorageAdapter;
  let pdfRenderer: PdfRenderEngineService;
  let manifestService: BuildIntegrityManifestService;
  let indexService: GenerateDossierIndexService;
  let consolidateService: ConsolidatePdfService;
  let zipService: PackageZipService;
  let processExportService: ProcessDossierExportService;
  let requestUseCase: RequestDossierExportUseCase;
  let getUseCase: GetDossierExportUseCase;
  let listUseCase: ListDossierExportsUseCase;
  let verifyUseCase: VerifyDossierIntegrityUseCase;

  const testSuffix = `fase-e-${Date.now()}`;
  let authorizedUser: any;
  let unauthorizedUser: any;
  let testDonor: any;
  let testPackage: any;
  let testPackageVersion: any;
  let testProcess: any;
  let testSourceDoc: any;

  const authCoordinator: AuthenticatedUser = {
    userId: "",
    role: "COORDINATOR",
    institutionalIps: ["Hospital Universitario del Valle"],
  };

  const authExternal: AuthenticatedUser = {
    userId: "",
    role: "COORDINATOR",
    institutionalIps: ["Clínica Los Remedios"],
  };

  const recordedAuditEvents: any[] = [];
  const mockAuditPort: AuditEventPort = {
    record: async (event) => {
      recordedAuditEvents.push(event);
    },
  };

  // Mock queue for tests
  const mockQueueService = {
    enqueueExport: jest.fn(async (exportId: string, user: AuthenticatedUser) => {
      // Direct synchronous execution in test environment
      await processExportService.processExport(exportId, user);
    }),
  };

  beforeAll(async () => {
    prisma = new PrismaService();
    await prisma.$connect();

    const config = new ConfigService();
    storage = new LocalPrivateStorageAdapter(config);
    pdfRenderer = new PdfRenderEngineService();

    manifestService = new BuildIntegrityManifestService(prisma);
    indexService = new GenerateDossierIndexService();
    consolidateService = new ConsolidatePdfService(storage, indexService);
    zipService = new PackageZipService(storage);

    processExportService = new ProcessDossierExportService(
      prisma,
      storage,
      mockAuditPort,
      manifestService,
      indexService,
      consolidateService,
      zipService,
    );

    requestUseCase = new RequestDossierExportUseCase(
      prisma,
      mockAuditPort,
      mockQueueService as any,
    );
    getUseCase = new GetDossierExportUseCase(prisma, mockAuditPort);
    listUseCase = new ListDossierExportsUseCase(prisma);
    verifyUseCase = new VerifyDossierIntegrityUseCase(prisma, storage, mockAuditPort);

    // 1. Crear usuario coordinador autorizado
    authorizedUser = await prisma.systemUser.create({
      data: {
        email: `coord-${testSuffix}@godt.salud.gov.co`,
        fullName: "Dr. Carlos Valderrama - Coordinador Regional",
        role: "COORDINATOR",
        isActive: true,
      },
    });
    authCoordinator.userId = authorizedUser.id;

    // 2. Crear usuario de otra IPS
    unauthorizedUser = await prisma.systemUser.create({
      data: {
        email: `externo-${testSuffix}@otra-ips.com`,
        fullName: "Dra. María Externa",
        role: "COORDINATOR",
        isActive: true,
      },
    });
    authExternal.userId = unauthorizedUser.id;

    // 3. Crear Donante
    testDonor = await prisma.donorRecord.create({
      data: {
        rndCode: `RND-EXP-${testSuffix.slice(-6)}`,
        documentNumber: `CC-EXP-${testSuffix.slice(-8)}`,
        fullName: "Donante Expediente Piloto E",
        originatingIpsName: "Hospital Universitario del Valle",
        clinicalService: "UCI Neurocríticos",
        bloodGroup: "O",
        rhFactor: "POSITIVO",
        status: "EN_VALORACION",
        createdById: authorizedUser.id,
      },
    });

    // 4. Crear Paquete Documental con 23 posiciones
    testPackage = await prisma.processPackage.create({
      data: {
        code: `PKG-EXP-${testSuffix.slice(-6)}`,
        name: "Paquete Donación con Ficha de Órganos y Homologación Fase E",
        createdById: authorizedUser.id,
      },
    });

    testPackageVersion = await prisma.processPackageVersion.create({
      data: {
        packageId: testPackage.id,
        versionNumber: "1.0.0",
        status: "PUBLISHED",
        positionsConfig: OFFICIAL_REGIONAL_3_POSITIONS as any,
        createdById: authorizedUser.id,
      },
    });

    // 5. Crear Proceso de Donación
    testProcess = await prisma.donationProcess.create({
      data: {
        processCode: `PROC-EXP-${testSuffix.slice(-6)}`,
        donorId: testDonor.id,
        packageVersionId: testPackageVersion.id,
        primaryIpsName: "Hospital Universitario del Valle",
        status: "EN_CURSO",
        openedById: authorizedUser.id,
      },
    });

    // 6. Crear plantillas y documentos en las 23 posiciones
    for (const pos of OFFICIAL_REGIONAL_3_POSITIONS) {
      const template = await prisma.documentTemplate.create({
        data: {
          templateCode: `TPL-${pos.documentCode}-${testSuffix.slice(-4)}`,
          name: pos.title,
          category: "OFFICIAL",
          status: "ACTIVE",
        },
      });

      const templateVersion = await prisma.templateVersion.create({
        data: {
          templateId: template.id,
          versionNumber: "1.0.0",
          effectiveFrom: new Date(),
          status: "PUBLISHED",
          jsonSchema: { type: "object", properties: {} },
          uiSchema: {},
          mappingConfig: [],
          createdById: authorizedUser.id,
          authorizedById: authorizedUser.id,
        },
      });

      // Crear ProcessDocument
      const pDoc = await prisma.processDocument.create({
        data: {
          processId: testProcess.id,
          positionNumber: pos.positionNumber,
          documentCode: pos.documentCode,
          title: pos.title,
          category: pos.category,
          orderIndex: pos.orderIndex,
          applicabilityStatus:
            pos.positionNumber === 17 // Anexo 12 no aplica por ejemplo
              ? "NO_APLICA"
              : "APLICA",
          nonApplicabilityReason:
            pos.positionNumber === 17 ? "Donante sin antecedentes judiciales ni muerte violenta." : null,
          status: pos.positionNumber === 1 || pos.positionNumber === 18 ? "LIBERADO" : "PENDIENTE",
          isMandatory: pos.isMandatory,
        },
      });

      // Para Anexo 1 y Anexo 8, crear instancias completas, PDFs y firmas para simular estado LIBERADO
      if (pos.positionNumber === 1 || pos.positionNumber === 18) {
        const instance = await prisma.documentInstance.create({
          data: {
            donorId: testDonor.id,
            templateId: template.id,
            templateVersionId: templateVersion.id,
            documentCode: pos.documentCode,
            status: "LIBERADO",
            createdById: authorizedUser.id,
            updatedById: authorizedUser.id,
            processId: testProcess.id,
            processDocumentId: pDoc.id,
          },
        });

        await prisma.processDocument.update({
          where: { id: pDoc.id },
          data: { currentInstanceId: instance.id },
        });

        // Crear PDF sintético con pdf-lib y guardarlo en storage
        const samplePdfDoc = await PDFDocument.create();
        const page = samplePdfDoc.addPage([612, 792]);
        page.drawText(`DOCUMENTO OFICIAL: ${pos.title}`, { x: 50, y: 700 });
        page.drawText(`PROCESO: ${testProcess.processCode}`, { x: 50, y: 680 });
        const samplePdfBytes = await samplePdfDoc.save();
        const pdfBuffer = Buffer.from(samplePdfBytes);
        const pdfHash = createHash("sha256").update(pdfBuffer).digest("hex");

        const stored = await storage.put({
          buffer: pdfBuffer,
          originalFilename: `${pos.documentCode}_v1.pdf`,
          mimeType: "application/pdf",
        });

        const genPdf = await prisma.generatedPdfDocument.create({
          data: {
            donorId: testDonor.id,
            processId: testProcess.id,
            templateVersionId: templateVersion.id,
            documentInstanceId: instance.id,
            documentCode: pos.documentCode,
            versionNumber: 1,
            sha256Hash: pdfHash,
            objectStorageKey: stored.storageKey,
            dataSnapshot: {
              pdfSizeBytes: pdfBuffer.length,
              generatedAt: new Date().toISOString(),
            },
            status: "RELEASED",
            generatedById: authorizedUser.id,
          },
        });

        // Crear participante y firma
        const part = await prisma.documentParticipant.create({
          data: {
            documentInstanceId: instance.id,
            fullName: "Dr. Carlos Valderrama",
            documentNumber: "CC-12345678",
            signerRole: "COORDINADOR_DONACION",
            isSigner: true,
            signatureRequired: true,
          },
        });

        await prisma.documentSignature.create({
          data: {
            documentInstanceId: instance.id,
            participantId: part.id,
            generatedPdfId: genPdf.id,
            snapshotHash: pdfHash,
            signatureType: "OTP_SMS",
            signedAt: new Date(),
            status: "VALIDA",
          },
        });

        // Si es Anexo 8, crear evento de custodia
        if (pos.positionNumber === 18) {
          await prisma.custodyEvent.create({
            data: {
              processId: testProcess.id,
              documentInstanceId: instance.id,
              sequenceNumber: 1,
              eventType: "MUESTRA_BIOLOGICA_RECOLECTADA",
              itemDescription: "Toma inicial de muestras sanguíneas",
              transferorName: "Dra. Patricia Gómez",
              receiverName: "Dr. Carlos Valderrama",
              occurredAt: new Date(),
              location: "UCI Adultos HUV",
              recordedById: authorizedUser.id,
            },
          });
        }
      }
    }

    // 7. Crear un SourceDocument complementario (Historia Clínica)
    const hcContent = Buffer.from("HISTORIA CLINICA ORIGINAL - CONFIDENCIAL - DONANTE GODT");
    const hcHash = createHash("sha256").update(hcContent).digest("hex");
    const storedHc = await storage.put({
      buffer: hcContent,
      originalFilename: "historia_clinica_completa.pdf",
      mimeType: "application/pdf",
    });

    testSourceDoc = await prisma.sourceDocument.create({
      data: {
        donorId: testDonor.id,
        processId: testProcess.id,
        uploadedById: authorizedUser.id,
        originalFilename: "historia_clinica_completa.pdf",
        mimeType: "application/pdf",
        documentCategory: "HISTORIA_CLINICA_COMPLETA",
        objectStorageKey: storedHc.storageKey,
        sha256Hash: hcHash,
        status: "ACTIVE",
      },
    });
  });

  afterAll(async () => {
    // Cleanup de prueba
    if (prisma) {
      await prisma.processDossierExport.deleteMany({ where: { processId: testProcess?.id } });
      await prisma.custodyEvent.deleteMany({ where: { processId: testProcess?.id } });
      await prisma.documentSignature.deleteMany({
        where: { documentInstance: { processDocument: { processId: testProcess?.id } } },
      });
      await prisma.documentParticipant.deleteMany({
        where: { documentInstance: { processDocument: { processId: testProcess?.id } } },
      });
      await prisma.generatedPdfDocument.deleteMany({ where: { processId: testProcess?.id } });
      await prisma.processDocument.updateMany({
        where: { processId: testProcess?.id },
        data: { currentInstanceId: null },
      });
      await prisma.documentInstance.deleteMany({
        where: { processId: testProcess?.id },
      });
      await prisma.sourceDocument.deleteMany({ where: { processId: testProcess?.id } });
      await prisma.processDocument.deleteMany({ where: { processId: testProcess?.id } });
      await prisma.donationProcess.deleteMany({ where: { id: testProcess?.id } });
      await prisma.donorRecord.deleteMany({ where: { id: testDonor?.id } });
      await prisma.templateVersion.deleteMany({ where: { createdById: authorizedUser?.id } });
      await prisma.documentTemplate.deleteMany({ where: { templateCode: { contains: testSuffix } } });
      await prisma.processPackageVersion.deleteMany({ where: { packageId: testPackage?.id } });
      await prisma.processPackage.deleteMany({ where: { id: testPackage?.id } });
      await prisma.systemUser.deleteMany({ where: { id: { in: [authorizedUser?.id, unauthorizedUser?.id].filter(Boolean) } } });
      await prisma.$disconnect();
    }
  });

  describe("1. Solicitud y Encolamiento de Exportación de Expediente (Fase E)", () => {
    it("debe rechazar la exportación si el usuario no tiene acceso a la IPS del proceso", async () => {
      await expect(
        requestUseCase.execute({
          processId: testProcess.id,
          user: authExternal,
          includeSourceDocuments: false,
        }),
      ).rejects.toThrow(DossierAccessDeniedError);
    });

    it("debe rechazar la exportación si un usuario no coordinador/admin intenta incluir documentos fuente", async () => {
      const authTechnician: AuthenticatedUser = {
        userId: authorizedUser.id,
        role: "TECHNICIAN",
        institutionalIps: ["Hospital Universitario del Valle"],
      };

      await expect(
        requestUseCase.execute({
          processId: testProcess.id,
          user: authTechnician,
          includeSourceDocuments: true,
        }),
      ).rejects.toThrow(DossierAccessDeniedError);
    });

    it("debe crear y procesar exitosamente la exportación en modo estándar (sin documentos fuente por defecto)", async () => {
      const exportRecord = await requestUseCase.execute({
        processId: testProcess.id,
        user: authCoordinator,
        includeSourceDocuments: false,
      });

      expect(exportRecord).toBeDefined();
      expect(exportRecord.id).toBeDefined();
      expect(exportRecord.processId).toBe(testProcess.id);

      // El mock queue ejecuta síncronamente processExportService.processExport(exportId, user)
      const finished = await prisma.processDossierExport.findUnique({
        where: { id: exportRecord.id },
      });

      expect(finished).toBeDefined();
      expect(finished!.status).toBe("COMPLETED");
      expect(finished!.progressPercent).toBe(100);
      expect(finished!.zipStorageKey).toBeDefined();
      expect(finished!.zipSha256).toMatch(/^[a-f0-9]{64}$/i);
      expect(finished!.consolidatedPdfSha256).toMatch(/^[a-f0-9]{64}$/i);
    });
  });

  describe("2. Inspección Criptográfica y Estructural del Paquete ZIP (Fase E)", () => {
    it("debe generar un paquete ZIP con la taxonomía de 6 carpetas reglamentaria", async () => {
      const exports = await listUseCase.execute(testProcess.id, authCoordinator);
      expect(exports.length).toBeGreaterThan(0);
      const latestExport = exports[0];

      // Recuperar el buffer del ZIP desde el almacenamiento privado
      const zipBuffer = await storage.get(latestExport.zipStorageKey!);
      expect(zipBuffer).toBeDefined();

      // Verificar SHA-256 del binario ZIP
      const actualZipHash = createHash("sha256").update(zipBuffer).digest("hex");
      expect(actualZipHash.toLowerCase()).toBe(latestExport.zipSha256?.toLowerCase());

      // Descomprimir y auditar estructura usando adm-zip
      const zip = new AdmZip(zipBuffer);
      const entries = zip.getEntries();
      const entryNames = entries.map((e) => e.entryName.replace(/\\/g, "/"));

      const rootPrefix = `GODT_EXPEDIENTE_${testProcess.processCode}/`;

      // A. Verificar README
      expect(entryNames).toContain(`${rootPrefix}README.txt`);

      // B. Verificar 00_INDICE
      expect(entryNames).toContain(`${rootPrefix}00_INDICE/indice_expediente.pdf`);
      expect(entryNames).toContain(`${rootPrefix}00_INDICE/resumen_expediente.json`);

      // C. Verificar 01_DOCUMENTOS_LIBERADOS
      const releasedFiles = entryNames.filter((name) =>
        name.startsWith(`${rootPrefix}01_DOCUMENTOS_LIBERADOS/`),
      );
      // Hay 2 documentos liberados (Anexo 1 y Anexo 8)
      expect(releasedFiles.length).toBe(2);
      expect(releasedFiles.some((f) => f.includes("ANEXO_1"))).toBe(true);
      expect(releasedFiles.some((f) => f.includes("ANEXO_8"))).toBe(true);

      // D. Verificar 02_DOCUMENTO_CONSOLIDADO
      expect(entryNames).toContain(
        `${rootPrefix}02_DOCUMENTO_CONSOLIDADO/expediente_consolidado.pdf`,
      );

      // E. Verificar 03_EVIDENCIAS
      expect(entryNames).toContain(`${rootPrefix}03_EVIDENCIAS/manifiesto_integridad.json`);
      expect(entryNames).toContain(`${rootPrefix}03_EVIDENCIAS/evidencias_atestaciones.json`);

      // F. Verificar 04_CADENA_CUSTODIA
      expect(entryNames).toContain(
        `${rootPrefix}04_CADENA_CUSTODIA/eventos_custodia_inmutables.json`,
      );

      // G. Verificar que 05_FUENTES_COMPLEMENTARIAS no incluya nada porque no fue solicitado
      const sourceFiles = entryNames.filter((name) =>
        name.startsWith(`${rootPrefix}05_FUENTES_COMPLEMENTARIAS/`),
      );
      expect(sourceFiles.length).toBe(0);
    });

    it("los archivos en 01_DOCUMENTOS_LIBERADOS deben conservar su binario y hash SHA-256 original sin modificaciones", async () => {
      const exports = await listUseCase.execute(testProcess.id, authCoordinator);
      const latestExport = exports[0];
      const zipBuffer = await storage.get(latestExport.zipStorageKey!);
      const zip = new AdmZip(zipBuffer);

      // Obtener el registro de GeneratedPdf de Anexo 1
      const anexo1Pdf = await prisma.generatedPdfDocument.findFirst({
        where: { processId: testProcess.id, documentCode: "ANEXO_1" },
      });
      expect(anexo1Pdf).toBeDefined();

      const rootPrefix = `GODT_EXPEDIENTE_${testProcess.processCode}/`;
      const targetName = `${rootPrefix}01_DOCUMENTOS_LIBERADOS/ANEXO_1_v1.pdf`;
      const entry = zip.getEntries().find((e) => e.entryName.replace(/\\/g, "/") === targetName);
      expect(entry).toBeDefined();

      const extractedBytes = entry!.getData();
      const extractedHash = createHash("sha256").update(extractedBytes).digest("hex");

      // Verificación estricta: el hash del archivo dentro del ZIP coincide bit a bit con el original
      expect(extractedHash.toLowerCase()).toBe(anexo1Pdf!.sha256Hash.toLowerCase());
    });

    it("el PDF consolidado debe compilar portada, índice y páginas de documentos ordenadas", async () => {
      const exports = await listUseCase.execute(testProcess.id, authCoordinator);
      const latestExport = exports[0];
      const zipBuffer = await storage.get(latestExport.zipStorageKey!);
      const zip = new AdmZip(zipBuffer);

      const rootPrefix = `GODT_EXPEDIENTE_${testProcess.processCode}/`;
      const targetName = `${rootPrefix}02_DOCUMENTO_CONSOLIDADO/expediente_consolidado.pdf`;
      const consolidatedEntry = zip
        .getEntries()
        .find((e) => e.entryName.replace(/\\/g, "/") === targetName);
      expect(consolidatedEntry).toBeDefined();

      // Cargar con pdf-lib y verificar número de páginas
      const loadedDoc = await PDFDocument.load(consolidatedEntry!.getData());
      const pageCount = loadedDoc.getPageCount();
      // Portada (1) + Índice (mín 1) + 2 documentos liberados (1 página cada uno) = al menos 3 páginas
      expect(pageCount).toBeGreaterThanOrEqual(3);
    });

    it("el manifiesto_integridad.json debe reflejar la matriz de 23 posiciones, estados y hashes deterministas", async () => {
      const exports = await listUseCase.execute(testProcess.id, authCoordinator);
      const latestExport = exports[0];
      const zipBuffer = await storage.get(latestExport.zipStorageKey!);
      const zip = new AdmZip(zipBuffer);

      const rootPrefix = `GODT_EXPEDIENTE_${testProcess.processCode}/`;
      const targetName = `${rootPrefix}03_EVIDENCIAS/manifiesto_integridad.json`;
      const manifestEntry = zip
        .getEntries()
        .find((e) => e.entryName.replace(/\\/g, "/") === targetName);
      expect(manifestEntry).toBeDefined();

      const manifestContent = JSON.parse(manifestEntry!.getData().toString("utf-8"));
      expect(manifestContent.manifestVersion).toBe("1.0.0");
      expect(manifestContent.processCode).toBe(testProcess.processCode);
      expect(manifestContent.summary.totalPositions).toBe(23);
      expect(manifestContent.summary.releasedCount).toBe(2);
      expect(manifestContent.summary.nonApplicableCount).toBe(1); // Posición 17
      expect(manifestContent.summary.pendingHomologationCount).toBe(4); // Posiciones 20 a 23

      // Verificar que el Anexo 12 (posición 17) esté registrado con su motivo
      const anexo12 = manifestContent.documents.find((d: any) => d.positionNumber === 17);
      expect(anexo12).toBeDefined();
      expect(anexo12.applicabilityStatus).toBe("NO_APLICA");
      expect(anexo12.nonApplicabilityReason).toContain("sin antecedentes judiciales");
      expect(anexo12.includedInConsolidatedPdf).toBe(false);
    });
  });

  describe("3. Exportación con Documentos Fuente Autorizados (Fase E)", () => {
    it("debe incluir 05_FUENTES_COMPLEMENTARIAS únicamente cuando se solicita con autorización expresa", async () => {
      const exportReq = await requestUseCase.execute({
        processId: testProcess.id,
        user: authCoordinator,
        includeSourceDocuments: true,
        selectedSourceDocumentIds: [testSourceDoc.id],
      });

      const exportWithSources = await prisma.processDossierExport.findUnique({
        where: { id: exportReq.id },
      });

      expect(exportWithSources).toBeDefined();
      expect(exportWithSources!.status).toBe("COMPLETED");

      const zipBuffer = await storage.get(exportWithSources!.zipStorageKey!);
      const zip = new AdmZip(zipBuffer);
      const rootPrefix = `GODT_EXPEDIENTE_${testProcess.processCode}/`;

      const sourceFiles = zip
        .getEntries()
        .map((e) => e.entryName.replace(/\\/g, "/"))
        .filter((name) => name.startsWith(`${rootPrefix}05_FUENTES_COMPLEMENTARIAS/`));

      expect(sourceFiles.length).toBe(1);
      expect(sourceFiles[0]).toContain("historia_clinica_completa.pdf");

      // Verificar integridad del documento fuente
      const targetName = sourceFiles[0];
      const entry = zip.getEntries().find((e) => e.entryName.replace(/\\/g, "/") === targetName);
      const extractedHash = createHash("sha256").update(entry!.getData()).digest("hex");
      expect(extractedHash.toLowerCase()).toBe(testSourceDoc.sha256Hash.toLowerCase());
    });
  });

  describe("4. Endpoint y Caso de Uso de Verificación Criptográfica de Integridad (Fase E)", () => {
    it("debe validar exitosamente la integridad (INTEGRITY_VERIFIED) si ningún archivo ha sido alterado", async () => {
      const exports = await listUseCase.execute(testProcess.id, authCoordinator);
      const targetExport = exports[0];

      const report = await verifyUseCase.execute(targetExport.id, authCoordinator);

      expect(report.overallStatus).toBe("INTEGRITY_VERIFIED");
      expect(report.failedCount).toBe(0);
      expect(report.passedCount).toBeGreaterThan(0);
      expect(report.items.every((i) => i.matches)).toBe(true);

      // Verificar evento de auditoría
      const auditEvt = recordedAuditEvents.find(
        (e) => e.action === "DOSSIER_INTEGRITY_VERIFIED" && e.entityId === targetExport.id,
      );
      expect(auditEvt).toBeDefined();
    });

    it("debe detectar discrepancia (INTEGRITY_COMPROMISED) si un archivo en almacenamiento es modificado", async () => {
      // Crear exportación dedicada para prueba de alteración
      const tamperReq = await requestUseCase.execute({
        processId: testProcess.id,
        user: authCoordinator,
        includeSourceDocuments: false,
      });

      const tamperExport = await prisma.processDossierExport.findUnique({
        where: { id: tamperReq.id },
      });

      expect(tamperExport).toBeDefined();

      // Sobrescribir la clave de almacenamiento del registro para apuntar a un buffer manipulado
      const hackedStorage = await storage.put({
        buffer: Buffer.from("HACKED_DATA_TAMPERED"),
        originalFilename: "tampered.zip",
        mimeType: "application/zip",
      });

      await prisma.processDossierExport.update({
        where: { id: tamperExport!.id },
        data: { zipStorageKey: hackedStorage.storageKey },
      });

      const report = await verifyUseCase.execute(tamperExport!.id, authCoordinator);

      expect(report.overallStatus).toBe("INTEGRITY_COMPROMISED");
      expect(report.failedCount).toBeGreaterThan(0);
      const zipItem = report.items.find((i) => i.itemType === "ZIP_ARCHIVE");
      expect(zipItem).toBeDefined();
      expect(zipItem!.matches).toBe(false);
      expect(zipItem!.status).toBe("MISMATCH");
    });
  });

  describe("5. Endpoints de Consulta y Descarga Segura", () => {
    it("debe permitir obtener el detalle de una exportación existente", async () => {
      const exports = await listUseCase.execute(testProcess.id, authCoordinator);
      const exp = exports[0];

      const fetched = await getUseCase.execute(exp.id, authCoordinator);
      expect(fetched.id).toBe(exp.id);
      expect(fetched.processId).toBe(testProcess.id);
    });

    it("debe lanzar DossierNotFoundError para un ID inexistente", async () => {
      await expect(
        getUseCase.execute("00000000-0000-0000-0000-000000000000", authCoordinator),
      ).rejects.toThrow(DossierNotFoundError);
    });

    it("debe rechazar a un usuario no autorizado para obtener la exportación", async () => {
      const exports = await listUseCase.execute(testProcess.id, authCoordinator);
      const exp = exports[0];

      await expect(getUseCase.execute(exp.id, authExternal)).rejects.toThrow(
        DossierAccessDeniedError,
      );
    });
  });
});
