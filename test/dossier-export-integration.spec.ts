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
import { BullmqDossierQueueService } from "../src/infrastructure/dossier/bullmq-dossier-queue.service";
import {
  computeCanonicalManifestDigest,
  DossierAccessDeniedError,
  DossierNotFoundError,
  DossierQueueUnavailableError,
} from "../src/domain/dossier/dossier.types";
import { PDFDocument } from "pdf-lib";
import { createHash } from "crypto";
import AdmZip from "adm-zip";

describe("Dossier Export Integration & Hardening Tests (Fase E & E.1)", () => {
  jest.setTimeout(90000);
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
  let realQueueService: BullmqDossierQueueService;

  const testSuffix = `fase-e1-${Date.now()}`;
  let authorizedUser: any;
  let unauthorizedUser: any;
  let testDonor: any;
  let testPackage: any;
  let testPackageVersion: any;
  let testProcess: any;
  let testSourceDoc: any;

  let releasedAnexo1PdfBytes: Buffer;
  let releasedAnexo1Hash: string;
  let releasedAnexo8PdfBytes: Buffer;
  let releasedAnexo8Hash: string;

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

  // Mock queue sincronico para pruebas unitarias de casos de uso
  const mockSyncQueue = {
    enqueueExport: jest.fn(async (exportId: string, user: AuthenticatedUser) => {
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
      mockSyncQueue as any,
    );
    getUseCase = new GetDossierExportUseCase(prisma, mockAuditPort);
    listUseCase = new ListDossierExportsUseCase(prisma);
    verifyUseCase = new VerifyDossierIntegrityUseCase(prisma, storage, mockAuditPort);

    realQueueService = new BullmqDossierQueueService(config, processExportService, prisma);

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
        fullName: "Donante Expediente Piloto E.1",
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
        name: "Paquete Donación con Ficha de Órganos y Homologación Fase E.1",
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

      const pDoc = await prisma.processDocument.create({
        data: {
          processId: testProcess.id,
          positionNumber: pos.positionNumber,
          documentCode: pos.documentCode,
          title: pos.title,
          category: pos.category,
          orderIndex: pos.orderIndex,
          applicabilityStatus:
            pos.positionNumber === 17 ? "NO_APLICA" : "APLICA",
          nonApplicabilityReason:
            pos.positionNumber === 17 ? "Donante sin antecedentes judiciales ni muerte violenta." : null,
          status: pos.positionNumber === 1 || pos.positionNumber === 18 ? "LIBERADO" : "PENDIENTE",
          isMandatory: pos.isMandatory,
        },
      });

      // Para Anexo 1 (Pos 1) y Anexo 8 (Pos 18), crear instancias completas, PDFs y firmas
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

        // Crear PDF con pdf-lib y guardarlo
        const samplePdfDoc = await PDFDocument.create();
        const page = samplePdfDoc.addPage([612, 792]);
        page.drawText(`DOCUMENTO OFICIAL: ${pos.title}`, { x: 50, y: 700 });
        page.drawText(`PROCESO: ${testProcess.processCode}`, { x: 50, y: 680 });
        const samplePdfBytes = await samplePdfDoc.save();
        const pdfBuffer = Buffer.from(samplePdfBytes);
        const pdfHash = createHash("sha256").update(pdfBuffer).digest("hex");

        if (pos.positionNumber === 1) {
          releasedAnexo1PdfBytes = pdfBuffer;
          releasedAnexo1Hash = pdfHash;
        } else {
          releasedAnexo8PdfBytes = pdfBuffer;
          releasedAnexo8Hash = pdfHash;
        }

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

        // Crear participante y firma válida
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
      await prisma.systemUser.deleteMany({
        where: { id: { in: [authorizedUser?.id, unauthorizedUser?.id].filter(Boolean) } },
      });
      await prisma.$disconnect();
    }
  });

  let standardExportId: string;
  let standardZipBuffer: Buffer;

  describe("1. Solicitud y Control de Acceso (Escenarios 1, 2, 4, 20)", () => {
    it("Escenario 20: debe rechazar la exportación si el usuario no tiene acceso a la IPS del proceso", async () => {
      await expect(
        requestUseCase.execute({
          processId: testProcess.id,
          user: authExternal,
          includeSourceDocuments: false,
        }),
      ).rejects.toThrow(DossierAccessDeniedError);
    });

    it("Escenario 4: debe rechazar la exportación si un usuario no coordinador/admin intenta incluir documentos fuente", async () => {
      const unauthorizedClinician: AuthenticatedUser = {
        userId: authorizedUser.id,
        role: "TECHNICIAN",
        institutionalIps: ["Hospital Universitario del Valle"],
      };

      await expect(
        requestUseCase.execute({
          processId: testProcess.id,
          user: unauthorizedClinician,
          includeSourceDocuments: true,
        }),
      ).rejects.toThrow(DossierAccessDeniedError);
    });

    it("Escenarios 1 & 2: debe crear y procesar exitosamente la exportación en modo estándar (sin documentos fuente por defecto)", async () => {
      const result = await requestUseCase.execute({
        processId: testProcess.id,
        user: authCoordinator,
        includeSourceDocuments: false,
      });

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      standardExportId = result.id;

      // Esperar estado COMPLETED
      const record = await prisma.processDossierExport.findUnique({
        where: { id: standardExportId },
      });
      expect(record?.status).toBe("COMPLETED");
      expect(record?.packageChecksumSha256).toBeDefined();
      expect(record?.manifestDigest).toBeDefined();
    });
  });

  describe("2. Inspección Criptográfica y Estructural del ZIP (Escenarios 5, 6, 7, 8, 9)", () => {
    it("Escenario 6: debe generar un paquete ZIP con la taxonomía de 6 carpetas y magic bytes PK", async () => {
      const record = await prisma.processDossierExport.findUnique({
        where: { id: standardExportId },
      });
      standardZipBuffer = await storage.get(record!.zipStorageKey!);

      // Magic bytes ZIP: 50 4b 03 04
      expect(standardZipBuffer.slice(0, 4).toString("hex")).toBe("504b0304");

      const zip = new AdmZip(standardZipBuffer);
      const entries = zip.getEntries().map((e) => e.entryName);

      expect(entries.some((e) => e.includes("/00_INDICE/indice_expediente.pdf"))).toBe(true);
      expect(entries.some((e) => e.includes("/00_INDICE/resumen_expediente.json"))).toBe(true);
      expect(entries.some((e) => e.includes("/01_DOCUMENTOS_LIBERADOS/"))).toBe(true);
      expect(entries.some((e) => e.includes("/02_DOCUMENTO_CONSOLIDADO/expediente_consolidado.pdf"))).toBe(true);
      expect(entries.some((e) => e.includes("/03_EVIDENCIAS/manifiesto_integridad.json"))).toBe(true);
      expect(entries.some((e) => e.includes("/03_EVIDENCIAS/evidencias_atestaciones.json"))).toBe(true);
      expect(entries.some((e) => e.includes("/04_CADENA_CUSTODIA/eventos_custodia_inmutables.json"))).toBe(true);
      expect(entries.some((e) => e.includes("/04_CADENA_CUSTODIA/referencia_anexo_8.json"))).toBe(true);
      expect(entries.some((e) => e.includes("/README.txt"))).toBe(true);
      // Por defecto no debe incluir 05_FUENTES_COMPLEMENTARIAS
      expect(entries.some((e) => e.includes("/05_FUENTES_COMPLEMENTARIAS/"))).toBe(false);
    });

    it("Escenario 7: los archivos en 01_DOCUMENTOS_LIBERADOS deben conservar su binario y hash SHA-256 original sin modificaciones", async () => {
      const zip = new AdmZip(standardZipBuffer);
      const entries = zip.getEntries();

      // Nomenclatura oficial: POS_01_ANEXO_1_VALORACION_ALERTA.pdf
      const anexo1Entry = entries.find((e) =>
        e.entryName.includes("01_DOCUMENTOS_LIBERADOS/POS_01_ANEXO_1_VALORACION_ALERTA"),
      );
      expect(anexo1Entry).toBeDefined();
      const extractedBytes1 = anexo1Entry!.getData();
      const actualHash1 = createHash("sha256").update(extractedBytes1).digest("hex");
      expect(actualHash1).toBe(releasedAnexo1Hash);

      // Anexo 8 en 01_DOCUMENTOS_LIBERADOS: POS_18_ANEXO_8_ACTA_CADENA_CUSTODIA.pdf
      const anexo8Entry = entries.find((e) =>
        e.entryName.includes("01_DOCUMENTOS_LIBERADOS/POS_18_ANEXO_8_ACTA_CADENA_CUSTODIA"),
      );
      expect(anexo8Entry).toBeDefined();
      const extractedBytes8 = anexo8Entry!.getData();
      const actualHash8 = createHash("sha256").update(extractedBytes8).digest("hex");
      expect(actualHash8).toBe(releasedAnexo8Hash);
    });

    it("Escenario 5: el PDF consolidado debe compilar portada, índice y páginas ordenadas", async () => {
      const zip = new AdmZip(standardZipBuffer);
      const consolidadoEntry = zip.getEntries().find((e) =>
        e.entryName.includes("02_DOCUMENTO_CONSOLIDADO/expediente_consolidado.pdf"),
      );
      expect(consolidadoEntry).toBeDefined();

      const consolidadoDoc = await PDFDocument.load(consolidadoEntry!.getData());
      // Portada + Índice (2 págs aprox) + Anexo 1 (1 pág) + Anexo 8 (1 pág) >= 3 páginas
      expect(consolidadoDoc.getPageCount()).toBeGreaterThanOrEqual(3);
    });

    it("Escenario 8: el manifiesto_integridad.json debe implementar digest canónico determinista y no contener autorreferencia circular", async () => {
      const zip = new AdmZip(standardZipBuffer);
      const manifestEntry = zip.getEntries().find((e) =>
        e.entryName.includes("03_EVIDENCIAS/manifiesto_integridad.json"),
      );
      expect(manifestEntry).toBeDefined();

      const manifestObj = JSON.parse(manifestEntry!.getData().toString("utf-8"));
      // No debe contener el hash del ZIP completo internamente
      expect(manifestObj.zipPackage).toBeUndefined();
      expect(manifestObj.files).toBeDefined();
      expect(manifestObj.files.length).toBeGreaterThan(0);

      // El digest del manifiesto debe ser calculable de forma determinista
      const calculatedDigest = computeCanonicalManifestDigest(manifestObj);
      expect(manifestObj.manifestDigest).toBe(calculatedDigest);
    });

    it("Escenario 9: el hash binario del ZIP debe almacenarse en packageChecksumSha256 en PostgreSQL", async () => {
      const record = await prisma.processDossierExport.findUnique({
        where: { id: standardExportId },
      });
      const realZipHash = createHash("sha256").update(standardZipBuffer).digest("hex");

      expect(record?.packageChecksumSha256).toBe(realZipHash);
      expect(record?.zipSha256).toBe(realZipHash);
    });
  });

  describe("3. Exportación con Fuentes Sensibles Autorizadas (Escenario 3)", () => {
    it("Escenario 3: debe incluir 05_FUENTES_COMPLEMENTARIAS únicamente cuando se solicita con autorización expresa", async () => {
      const result = await requestUseCase.execute({
        processId: testProcess.id,
        user: authCoordinator,
        includeSourceDocuments: true,
      });

      const record = await prisma.processDossierExport.findUnique({
        where: { id: result.id },
      });
      expect(record?.status).toBe("COMPLETED");

      const zipBuf = await storage.get(record!.zipStorageKey!);
      const zip = new AdmZip(zipBuf);
      const entries = zip.getEntries().map((e) => e.entryName);

      expect(entries.some((e) => e.includes("/05_FUENTES_COMPLEMENTARIAS/"))).toBe(true);
      expect(
        entries.some((e) =>
          e.includes("HISTORIA_CLINICA_COMPLETA/historia_clinica_completa.pdf"),
        ),
      ).toBe(true);
    });
  });

  describe("4. Endpoints de Verificación Criptográfica y Detección de Alteraciones (Escenarios 10, 11, 12, 13, 14)", () => {
    it("debe validar exitosamente la integridad (INTEGRITY_VERIFIED) si ningún archivo ha sido alterado", async () => {
      const report = await verifyUseCase.execute(standardExportId, authCoordinator);

      expect(report.overallStatus).toBe("INTEGRITY_VERIFIED");
      expect(report.packageHashMatches).toBe(true);
      expect(report.manifestDigestMatches).toBe(true);
      expect(report.alteredFilesCount).toBe(0);
      expect(report.missingFilesCount).toBe(0);
      expect(report.unexpectedFilesCount).toBe(0);
      expect(report.correctFilesCount).toBeGreaterThan(0);
    });

    it("Escenario 10: debe detectar discrepancia (INTEGRITY_COMPROMISED) si un archivo en el ZIP es alterado", async () => {
      // Modificar deliberadamente un archivo dentro del ZIP y guardarlo en un export temporal
      const zip = new AdmZip(standardZipBuffer);
      zip.deleteFile(
        zip.getEntries().find((e) =>
          e.entryName.includes("01_DOCUMENTOS_LIBERADOS/POS_01_ANEXO_1_VALORACION_ALERTA"),
        )!,
      );
      zip.addFile(
        `GODT_EXPEDIENTE_${testProcess.processCode}/01_DOCUMENTOS_LIBERADOS/POS_01_ANEXO_1_VALORACION_ALERTA.pdf`,
        Buffer.from("CONTENIDO MODIFICADO FRAUDULENTAMENTE"),
      );
      const tamperedZip = zip.toBuffer();

      const storedTampered = await storage.put({
        buffer: tamperedZip,
        originalFilename: "tampered_export.zip",
        mimeType: "application/zip",
      });

      const tamperedExport = await prisma.processDossierExport.create({
        data: {
          processId: testProcess.id,
          requestedById: authorizedUser.id,
          status: "COMPLETED",
          zipStorageKey: storedTampered.storageKey,
          zipSha256: "originalhashfake000000000000000000000000000000000000000000000000",
          packageChecksumSha256: "originalhashfake000000000000000000000000000000000000000000000000",
          manifestData: (
            await prisma.processDossierExport.findUnique({ where: { id: standardExportId } })
          )?.manifestData as any,
          manifestDigest: (
            await prisma.processDossierExport.findUnique({ where: { id: standardExportId } })
          )?.manifestDigest,
        },
      });

      const report = await verifyUseCase.execute(tamperedExport.id, authCoordinator);

      expect(report.overallStatus).toBe("INTEGRITY_COMPROMISED");
      expect(report.packageHashMatches).toBe(false);
      expect(report.alteredFilesCount).toBeGreaterThan(0);
    });

    it("Escenario 11: debe detectar discrepancia (INTEGRITY_COMPROMISED) si falta un archivo declarado en el manifiesto", async () => {
      const zip = new AdmZip(standardZipBuffer);
      const targetEntry = zip.getEntries().find((e) =>
        e.entryName.includes("01_DOCUMENTOS_LIBERADOS/POS_01_ANEXO_1_VALORACION_ALERTA"),
      );
      if (targetEntry) {
        zip.deleteFile(targetEntry);
      }
      const missingZip = zip.toBuffer();

      const storedMissing = await storage.put({
        buffer: missingZip,
        originalFilename: "missing_file_export.zip",
        mimeType: "application/zip",
      });

      const missingExport = await prisma.processDossierExport.create({
        data: {
          processId: testProcess.id,
          requestedById: authorizedUser.id,
          status: "COMPLETED",
          zipStorageKey: storedMissing.storageKey,
          zipSha256: "0".repeat(64),
          packageChecksumSha256: "0".repeat(64),
          manifestData: (
            await prisma.processDossierExport.findUnique({ where: { id: standardExportId } })
          )?.manifestData as any,
          manifestDigest: (
            await prisma.processDossierExport.findUnique({ where: { id: standardExportId } })
          )?.manifestDigest,
        },
      });

      const report = await verifyUseCase.execute(missingExport.id, authCoordinator);
      expect(report.overallStatus).toBe("INTEGRITY_COMPROMISED");
      expect(report.missingFilesCount).toBeGreaterThan(0);
    });

    it("Escenario 12: debe detectar discrepancia (INTEGRITY_COMPROMISED) si se inyecta un archivo inesperado no inventariado", async () => {
      const zip = new AdmZip(standardZipBuffer);
      zip.addFile(
        `GODT_EXPEDIENTE_${testProcess.processCode}/01_DOCUMENTOS_LIBERADOS/INYECCION_NO_AUTORIZADA.pdf`,
        Buffer.from("MALWARE O ARCHIVO INESPERADO"),
      );
      const unexpectedZip = zip.toBuffer();

      const storedUnexpected = await storage.put({
        buffer: unexpectedZip,
        originalFilename: "unexpected_file_export.zip",
        mimeType: "application/zip",
      });

      const unexpectedExport = await prisma.processDossierExport.create({
        data: {
          processId: testProcess.id,
          requestedById: authorizedUser.id,
          status: "COMPLETED",
          zipStorageKey: storedUnexpected.storageKey,
          zipSha256: createHash("sha256").update(unexpectedZip).digest("hex"),
          packageChecksumSha256: createHash("sha256").update(unexpectedZip).digest("hex"),
          manifestData: (
            await prisma.processDossierExport.findUnique({ where: { id: standardExportId } })
          )?.manifestData as any,
          manifestDigest: (
            await prisma.processDossierExport.findUnique({ where: { id: standardExportId } })
          )?.manifestDigest,
        },
      });

      const report = await verifyUseCase.execute(unexpectedExport.id, authCoordinator);
      expect(report.overallStatus).toBe("INTEGRITY_COMPROMISED");
      expect(report.unexpectedFilesCount).toBeGreaterThan(0);
    });

    it("Escenario 13: debe detectar discrepancia (INTEGRITY_COMPROMISED) si el manifiesto fue alterado internamente", async () => {
      const zip = new AdmZip(standardZipBuffer);
      const manifestEntry = zip.getEntries().find((e) =>
        e.entryName.includes("03_EVIDENCIAS/manifiesto_integridad.json"),
      );
      const manifestObj = JSON.parse(manifestEntry!.getData().toString("utf-8"));
      manifestObj.systemVersion = "HACKED_SYSTEM_VERSION";

      zip.deleteFile(manifestEntry!);
      zip.addFile(
        `GODT_EXPEDIENTE_${testProcess.processCode}/03_EVIDENCIAS/manifiesto_integridad.json`,
        Buffer.from(JSON.stringify(manifestObj, null, 2), "utf-8"),
      );
      const tamperedManifestZip = zip.toBuffer();

      const stored = await storage.put({
        buffer: tamperedManifestZip,
        originalFilename: "tampered_manifest.zip",
        mimeType: "application/zip",
      });

      const exportRec = await prisma.processDossierExport.create({
        data: {
          processId: testProcess.id,
          requestedById: authorizedUser.id,
          status: "COMPLETED",
          zipStorageKey: stored.storageKey,
          zipSha256: "0".repeat(64),
          packageChecksumSha256: "0".repeat(64),
          manifestData: (
            await prisma.processDossierExport.findUnique({ where: { id: standardExportId } })
          )?.manifestData as any,
          manifestDigest: (
            await prisma.processDossierExport.findUnique({ where: { id: standardExportId } })
          )?.manifestDigest,
        },
      });

      const report = await verifyUseCase.execute(exportRec.id, authCoordinator);
      expect(report.overallStatus).toBe("INTEGRITY_COMPROMISED");
      expect(report.manifestDigestMatches).toBe(false);
    });

    it("Escenario 14: debe detectar discrepancia (INTEGRITY_COMPROMISED) si el ZIP completo es reemplazado por otro archivo", async () => {
      const fakeZipBytes = Buffer.from("ZIP FALSO TOTALMENTE DISTINTO");
      const stored = await storage.put({
        buffer: fakeZipBytes,
        originalFilename: "fake_complete.zip",
        mimeType: "application/zip",
      });

      const exportRec = await prisma.processDossierExport.create({
        data: {
          processId: testProcess.id,
          requestedById: authorizedUser.id,
          status: "COMPLETED",
          zipStorageKey: stored.storageKey,
          zipSha256: "0".repeat(64),
          packageChecksumSha256: "0".repeat(64),
          manifestData: (
            await prisma.processDossierExport.findUnique({ where: { id: standardExportId } })
          )?.manifestData as any,
          manifestDigest: (
            await prisma.processDossierExport.findUnique({ where: { id: standardExportId } })
          )?.manifestDigest,
        },
      });

      const report = await verifyUseCase.execute(exportRec.id, authCoordinator);
      expect(report.overallStatus).toBe("INTEGRITY_COMPROMISED");
      expect(report.packageHashMatches).toBe(false);
    });
  });

  describe("5. Idempotencia y Concurrencia (Escenarios 15, 19)", () => {
    it("Escenario 15: debe ser idempotente y evitar duplicación si existe una exportación PENDING o PROCESSING", async () => {
      // Crear exportación simulada en estado PROCESSING
      const activeExp = await prisma.processDossierExport.create({
        data: {
          processId: testProcess.id,
          requestedById: authorizedUser.id,
          status: "PROCESSING",
          progressPercent: 50,
          currentStep: "GENERANDO_INDICE_Y_CONSOLIDANDO_PDF",
        },
      });

      const duplicateRequest = await requestUseCase.execute({
        processId: testProcess.id,
        user: authCoordinator,
      });

      expect(duplicateRequest.id).toBe(activeExp.id);
      expect((duplicateRequest as any).message).toContain("Ya existe una solicitud de exportación en curso");

      // Limpiar registro
      await prisma.processDossierExport.delete({ where: { id: activeExp.id } });
    });

    it("Escenario 19: debe manejar concurrencia segura mediante transacciones atómicas", async () => {
      const requests = await Promise.all([
        requestUseCase.execute({ processId: testProcess.id, user: authCoordinator }),
        requestUseCase.execute({ processId: testProcess.id, user: authCoordinator }),
      ]);

      // Ambos requests retornan la misma exportación activa sin duplicar registros
      expect(requests[0].id).toBe(requests[1].id);
    });
  });

  describe("6. Durabilidad BullMQ, Fallback y Recuperación (Escenarios 16, 17, 18 y Durabilidad)", () => {
    it("Escenario 16: debe permitir fallback en desarrollo cuando Redis no está disponible y ENABLE_IN_MEMORY_QUEUE_FALLBACK=true", async () => {
      const devConfig = new ConfigService({
        NODE_ENV: "development",
        REDIS_URL: "redis://invalid-host:9999",
        ENABLE_IN_MEMORY_QUEUE_FALLBACK: "true",
      });
      const devQueue = new BullmqDossierQueueService(devConfig, processExportService, prisma);
      await devQueue.onModuleInit();

      const testExp = await prisma.processDossierExport.create({
        data: {
          processId: testProcess.id,
          requestedById: authorizedUser.id,
          status: "PENDING",
        },
      });

      // No debe lanzar excepción, sino ejecutar fallback asíncrono
      await expect(devQueue.enqueueExport(testExp.id, authCoordinator)).resolves.not.toThrow();

      await devQueue.onModuleDestroy();
      await prisma.processDossierExport.delete({ where: { id: testExp.id } });
    });

    it("Escenario 17: debe rechazar estrictamente el fallback con DossierQueueUnavailableError en producción si Redis no está disponible", async () => {
      const prodConfig = new ConfigService({ NODE_ENV: "production", REDIS_URL: "redis://invalid-host:9999" });
      const prodQueue = new BullmqDossierQueueService(prodConfig, processExportService, prisma);
      await prodQueue.onModuleInit();

      const testExp = await prisma.processDossierExport.create({
        data: {
          processId: testProcess.id,
          requestedById: authorizedUser.id,
          status: "PENDING",
        },
      });

      await expect(prodQueue.enqueueExport(testExp.id, authCoordinator)).rejects.toThrow(
        DossierQueueUnavailableError,
      );

      await prodQueue.onModuleDestroy();
      await prisma.processDossierExport.delete({ where: { id: testExp.id } });
    });

    it("Escenario 18 & Prueba Especial de Durabilidad: debe recuperar trabajos en PROCESSING interrumpidos por reinicio", async () => {
      // 1. Crear exportación abandonada simulando interrupción de worker
      const abandonedExp = await prisma.processDossierExport.create({
        data: {
          processId: testProcess.id,
          requestedById: authorizedUser.id,
          status: "PROCESSING",
          progressPercent: 30,
          currentStep: "EMPAQUETANDO_ARCHIVO_ZIP",
        },
      });

      // 2. Ejecutar servicio de recuperación al inicializar módulo
      await realQueueService.recoverOrphanExports();

      // 3. Comprobar que transiciona a FAILED con mensaje descriptivo para permitir reintento seguro
      const recovered = await prisma.processDossierExport.findUnique({
        where: { id: abandonedExp.id },
      });
      expect(recovered?.status).toBe("FAILED");
      expect(recovered?.errorMessage).toContain("interrumpido");

      await prisma.processDossierExport.delete({ where: { id: abandonedExp.id } });
    });

    it("Escenario 19 & Multi-Worker: una instancia reiniciada NO debe marcar como FAILED trabajos activos de otra instancia", async () => {
      // 1. Simular Worker A procesando activamente un expediente con heartbeat reciente
      const workerAExp = await prisma.processDossierExport.create({
        data: {
          processId: testProcess.id,
          requestedById: authorizedUser.id,
          status: "PROCESSING",
          progressPercent: 45,
          currentStep: "GENERANDO_INDICE",
          processingWorkerId: "worker-pod-A-12345",
          lastHeartbeatAt: new Date(), // Heartbeat fresco
        },
      });

      // 2. Simular Worker B (instancia independiente) que arranca y ejecuta recoverOrphanExports()
      const workerBConfig = new ConfigService({
        NODE_ENV: "development",
        REDIS_URL: "redis://localhost:6379",
        INSTANCE_ID: "worker-pod-B-67890",
      });
      const workerBQueue = new BullmqDossierQueueService(
        workerBConfig,
        processExportService,
        prisma,
      );

      // Worker B ejecuta recuperación de huérfanos
      await workerBQueue.recoverOrphanExports();

      // 3. Comprobar que el trabajo de Worker A se mantiene intacto en PROCESSING
      const checkWorkerA = await prisma.processDossierExport.findUnique({
        where: { id: workerAExp.id },
      });
      expect(checkWorkerA?.status).toBe("PROCESSING");
      expect(checkWorkerA?.processingWorkerId).toBe("worker-pod-A-12345");

      // 4. Worker A completa su trabajo con éxito
      await processExportService.processExport(
        workerAExp.id,
        authCoordinator,
        "worker-pod-A-12345",
      );

      const completedExp = await prisma.processDossierExport.findUnique({
        where: { id: workerAExp.id },
      });
      expect(completedExp?.status).toBe("COMPLETED");
      expect(completedExp?.progressPercent).toBe(100);

      await prisma.processDossierExport.delete({ where: { id: workerAExp.id } });
    });

    it("Escenario 20 & Stale Timeout: debe recuperar exportaciones inactivas que superen el umbral de 15 minutos", async () => {
      const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);
      const staleExp = await prisma.processDossierExport.create({
        data: {
          processId: testProcess.id,
          requestedById: authorizedUser.id,
          status: "PROCESSING",
          progressPercent: 50,
          currentStep: "CONSOLIDANDO_PDF",
          processingWorkerId: "dead-worker-pod-99999",
          lastHeartbeatAt: twentyMinutesAgo,
        },
      });

      await realQueueService.recoverOrphanExports();

      const recoveredStale = await prisma.processDossierExport.findUnique({
        where: { id: staleExp.id },
      });
      expect(recoveredStale?.status).toBe("FAILED");
      expect(recoveredStale?.errorMessage).toContain("umbral de inactividad");

      await prisma.processDossierExport.delete({ where: { id: staleExp.id } });
    });

    it("Escenario 21: Prohibición estricta de fallback en memoria en entorno STAGING", async () => {
      const stagingConfig = new ConfigService({
        NODE_ENV: "staging",
        REDIS_URL: "redis://invalid-host:6379",
        ENABLE_IN_MEMORY_QUEUE_FALLBACK: "true", // Intento de activar fallback que debe ser ignorado
      });

      const stagingQueue = new BullmqDossierQueueService(
        stagingConfig,
        processExportService,
        prisma,
      );

      const testExp = await prisma.processDossierExport.create({
        data: {
          processId: testProcess.id,
          requestedById: authorizedUser.id,
          status: "PENDING",
        },
      });

      await expect(stagingQueue.enqueueExport(testExp.id, authCoordinator)).rejects.toThrow(
        DossierQueueUnavailableError,
      );

      await stagingQueue.onModuleDestroy();
      await prisma.processDossierExport.delete({ where: { id: testExp.id } });
    });
  });

  describe("7. Prueba de Repetición y Reproducibilidad Lógica", () => {
    it("debe verificar determinismo de documentos originales y manifest digest en dos exportaciones sucesivas", async () => {
      // Exportación 1
      const exp1Record = await prisma.processDossierExport.create({
        data: {
          processId: testProcess.id,
          requestedById: authorizedUser.id,
          status: "PENDING",
        },
      });
      await processExportService.processExport(exp1Record.id, authCoordinator);

      // Simular cambio de tiempo para Exportación 2
      const exp2Record = await prisma.processDossierExport.create({
        data: {
          processId: testProcess.id,
          requestedById: authorizedUser.id,
          status: "PENDING",
        },
      });
      await processExportService.processExport(exp2Record.id, authCoordinator);

      const r1 = await prisma.processDossierExport.findUnique({ where: { id: exp1Record.id } });
      const r2 = await prisma.processDossierExport.findUnique({ where: { id: exp2Record.id } });

      const m1 = r1?.manifestData as any;
      const m2 = r2?.manifestData as any;

      // 1. Los PDFs individuales conservan el mismo hash SHA-256
      const pdfs1 = m1.documents.filter((d: any) => d.originalFile).map((d: any) => d.originalFile.sha256);
      const pdfs2 = m2.documents.filter((d: any) => d.originalFile).map((d: any) => d.originalFile.sha256);
      expect(pdfs1).toEqual(pdfs2);

      // 2. El contenido clínico congelado coincide exactamente
      expect(m1.summary).toEqual(m2.summary);

      // 3. El contenido clínico congelado de las 23 posiciones genera un digest determinista idéntico
      const clinicalCore1 = {
        processCode: m1.processCode,
        donorId: m1.donorId,
        packageVersion: m1.packageVersion,
        summary: m1.summary,
        documents: m1.documents.map((d: any) => ({
          pos: d.positionNumber,
          code: d.documentCode,
          status: d.status,
          app: d.applicabilityStatus,
          sha: d.originalFile?.sha256,
        })),
      };
      const clinicalCore2 = {
        processCode: m2.processCode,
        donorId: m2.donorId,
        packageVersion: m2.packageVersion,
        summary: m2.summary,
        documents: m2.documents.map((d: any) => ({
          pos: d.positionNumber,
          code: d.documentCode,
          status: d.status,
          app: d.applicabilityStatus,
          sha: d.originalFile?.sha256,
        })),
      };
      expect(computeCanonicalManifestDigest(clinicalCore1)).toBe(
        computeCanonicalManifestDigest(clinicalCore2),
      );

      // 4. Cada exportación genera un ZIP con hash y sesión independientes para trazabilidad de auditoría
      expect(r1?.packageChecksumSha256).toBeDefined();
      expect(r2?.packageChecksumSha256).toBeDefined();

      // 5. Verificación de minimización de privacidad (datos del donante enmascarados en cabecera)
      expect(m1.donorDocumentMasked).toBeDefined();
      expect(m1.donorDocumentMasked?.startsWith("***")).toBe(true);
      expect(m1.donorFullNameMasked).toBeDefined();

      await prisma.processDossierExport.delete({ where: { id: exp1Record.id } });
      await prisma.processDossierExport.delete({ where: { id: exp2Record.id } });
    });

    it("evidencias_atestaciones.json debe reflejar 3 campos disyuntos, vincularse al PDF liberado y rechazar certificados PKI sin soporte", async () => {
      const zip = new AdmZip(standardZipBuffer);
      const evidEntry = zip.getEntries().find((e) =>
        e.entryName.includes("03_EVIDENCIAS/evidencias_atestaciones.json"),
      );
      expect(evidEntry).toBeDefined();

      const evidObj = JSON.parse(evidEntry!.getData().toString("utf-8"));
      expect(evidObj.digitalSignatureDisclaimer).toBeDefined();
      expect(evidObj.attestationNotice).toBeDefined();

      const emptyHash = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
      const allSigs = evidObj.signaturesAuditTrail.flatMap((trail: any) => trail.signatures);

      for (const sig of allSigs) {
        // Campo 1: Hash exacto del PDF liberado
        expect(sig.documentPdfSha256).toBeDefined();
        expect(sig.documentPdfSha256).toHaveLength(64);

        // Campo 2: Evidencia de firma separable (nullable, nunca hash de string vacío)
        expect(sig.signatureEvidenceSha256).not.toBe(emptyHash);

        // Campo 3: Digest determinista de la declaración de atestación
        expect(sig.attestationDigest).toBeDefined();
        expect(sig.attestationDigest).toHaveLength(64);

        // Nivel de atestación y advertencia técnica
        expect(sig.attestationLevel).toBeDefined();
        expect(sig.technicalDisclaimer).toContain("No constituye firma digital certificada PKI");
      }
    });
  });
});
