import * as fs from "node:fs";
import * as path from "node:path";
import { createHash } from "node:crypto";
import * as zlib from "node:zlib";
import AdmZip from "adm-zip";
import { InstitutionalDocumentService } from "../src/application/pdf/institutional-document.service";
import { PdfRenderEngineService } from "../src/application/pdf/pdf-render-engine.service";

function extractAllTextFromPdfBuffer(buf: Buffer): string {
  const str = buf.toString("latin1");
  let allText = str;
  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  let match;
  while ((match = streamRegex.exec(str)) !== null) {
    try {
      const decompressed = zlib.inflateSync(Buffer.from(match[1], "latin1")).toString("latin1");
      const decodedHex = decompressed.replace(/<([0-9A-Fa-f]+)>/g, (_, h) =>
        Buffer.from(h, "hex").toString("latin1"),
      );
      allText += " " + decompressed + " " + decodedHex;
    } catch {}
  }
  return allText;
}

describe("All 19 Formats Fidelity, Inventory & Legal Audit (Fase G.1.3.1)", () => {
  let docService: InstitutionalDocumentService;
  let pdfEngine: PdfRenderEngineService;
  const docsDir = path.resolve(process.cwd(), "docs", "documentos-reales");

  beforeAll(() => {
    docService = new InstitutionalDocumentService();
    pdfEngine = new PdfRenderEngineService(docService);
  });

  const EXPECTED_OFFICIAL_19 = [
    "anexo_1",
    "anexo_2",
    "anexo_3",
    "anexo_4",
    "anexo_5",
    "anexo_6",
    "anexo_7_ocular",
    "anexo_7_cardiovascular",
    "anexo_7_osteomuscular",
    "anexo_7_piel",
    "anexo_7_corazon",
    "anexo_7_higado",
    "anexo_7_otros_organos",
    "anexo_7_pancreas",
    "anexo_7_pulmon",
    "anexo_7_rinon_derecho",
    "anexo_7_rinon_izquierdo",
    "anexo_8",
    "anexo_9",
  ];

  const EXPECTED_COMPLEMENTARY_4 = [
    "calculo_hemodilucion",
    "evaluacion_covid_tissue_bank",
    "hc_donante_2024",
    "historia_clinica_tissue_bank",
  ];

  // -------------------------------------------------------------
  // 1. INVENTARIO FÍSICO Y HASHES SHA-256
  // -------------------------------------------------------------
  it("1. Todos los 23 archivos físicos existen en docs/documentos-reales con hashes válidos", () => {
    const allExpectedKeys = [...EXPECTED_OFFICIAL_19, ...EXPECTED_COMPLEMENTARY_4];
    expect(allExpectedKeys).toHaveLength(23);

    for (const key of allExpectedKeys) {
      const meta = docService.getOriginalMetadata(key);
      expect(meta).toBeDefined();
      expect(meta.sha256Hash).toHaveLength(64);

      const filePath = docService.getOriginalFilePath(key);
      expect(fs.existsSync(filePath)).toBe(true);
      const fileBytes = fs.readFileSync(filePath);
      expect(fileBytes.length).toBe(meta.sizeBytes);

      const computedHash = createHash("sha256").update(fileBytes).digest("hex");
      expect(computedHash).toBe(meta.sha256Hash);
    }
  });

  // -------------------------------------------------------------
  // 2. RECONCILIACIÓN ESTRICTA DEL ANEXO 7 (11 VARIANTES)
  // -------------------------------------------------------------
  it("2. El inventario canónico del Anexo 7 tiene exactamente 11 variantes (4 tejidos + 7 órganos)", () => {
    const tissueVariants = [
      "anexo_7_ocular",
      "anexo_7_cardiovascular",
      "anexo_7_osteomuscular",
      "anexo_7_piel",
    ];
    const organVariants = [
      "anexo_7_corazon",
      "anexo_7_higado",
      "anexo_7_otros_organos",
      "anexo_7_pancreas",
      "anexo_7_pulmon",
      "anexo_7_rinon_derecho",
      "anexo_7_rinon_izquierdo",
    ];

    expect(tissueVariants).toHaveLength(4);
    expect(organVariants).toHaveLength(7);

    for (const t of tissueVariants) {
      const meta = docService.getOriginalMetadata(t);
      expect(meta.mimeType).toBe("application/pdf");
      expect(meta.fidelityStatus).toBe("RENDER_READY");
      expect(meta.pageCount).toBeGreaterThanOrEqual(2);
    }

    for (const o of organVariants) {
      const meta = docService.getOriginalMetadata(o);
      expect(meta.mimeType).toBe("application/pdf");
      expect(meta.fidelityStatus).toBe("RENDER_READY");
      expect(meta.pageCount).toBe(1);
    }

    // Verificar que otros órganos corresponde exactamente a 'anexo-7-registro-extraccion-otros-organos.pdf'
    const otrosMeta = docService.getOriginalMetadata("anexo_7_otros_organos");
    expect(otrosMeta.filename).toBe("anexo-7-registro-extraccion-otros-organos.pdf");

    // Verificar que NO existan códigos obsoletos o incorrectos
    const inventory = docService.listInstitutionalInventory();
    const allCodes = inventory.map((i) => i.templateCode);
    expect(allCodes).not.toContain("anexo_7_intestino");
    expect(allCodes).not.toContain("anexo_7_corneas");
    expect(allCodes).not.toContain("anexo_7_otros");
  });

  // -------------------------------------------------------------
  // 3. ANEXO 5 DOCX GENERATION VIA XML INJECTION & REVIEW_REQUIRED
  // -------------------------------------------------------------
  it("3. Anexo 5 es nativamente DOCX, reporta REVIEW_REQUIRED para PDF y genera DOCX diligenciado íntegro", () => {
    const meta5 = docService.getOriginalMetadata("anexo_5");
    expect(meta5.mimeType).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(meta5.fidelityStatus).toBe("REVIEW_REQUIRED");
    expect(meta5.derivativeMetadata).toBeDefined();
    expect(meta5.derivativeMetadata?.originalFormat).toBe("DOCX");
    expect(meta5.derivativeMetadata?.relationship).toBe("DILIGENCED_INSTANCE");

    // Generar DOCX diligenciado
    const diligencedDocxBuffer = docService.generateDiligencedAnexo5Docx(
      {
        causaMuerte: "TEC Severo / Traumatismo Craneoencefálico",
        grupoSanguineo: "O",
        rh: "+",
        observaciones: "Remisión urgente para pruebas cruzadas HLA.",
      },
      {
        processCode: "PROC-2026-VALLE-001",
        primaryIpsName: "Clínica Imbanaco",
        donorName: "Fallecido Donante Acreditado",
        donorDocument: "1144000111",
      },
    );

    expect(diligencedDocxBuffer).toBeInstanceOf(Buffer);
    expect(diligencedDocxBuffer.length).toBeGreaterThan(50000);

    // Validar estructura OpenXML (ZIP con todas las partes intactas)
    const zip = new AdmZip(diligencedDocxBuffer);
    const entries = zip.getEntries().map((e) => e.entryName);
    expect(entries).toContain("word/document.xml");
    expect(entries).toContain("word/media/image1.png");
    expect(entries).toContain("word/styles.xml");

    const docXml = zip.readAsText("word/document.xml");
    expect(docXml).toContain("Clínica Imbanaco");
    expect(docXml).toContain("Fallecido Donante Acreditado");
    expect(docXml).toContain("1144000111");
    expect(docXml).toContain("COORDINACIÓN REGIONAL No. 3");
  });

  // -------------------------------------------------------------
  // 4. METADATOS DERIVADOS DE LOS 4 DOCUMENTOS COMPLEMENTARIOS
  // -------------------------------------------------------------
  it("4. Los 4 documentos fuente complementarios son DOCX y se registran como SOURCE_REGISTERED", () => {
    for (const key of EXPECTED_COMPLEMENTARY_4) {
      const meta = docService.getOriginalMetadata(key);
      expect(meta.status).toBe("COMPLEMENTARY_SOURCE");
      expect(meta.fidelityStatus).toBe("SOURCE_REGISTERED");
      expect(meta.renderMode).toBe("SOURCE_ATTACHMENT");
      expect(meta.mimeType).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      expect(meta.derivativeMetadata?.originalFormat).toBe("DOCX");
      expect(meta.derivativeMetadata?.relationship).toBe("ORIGINAL_SOURCE");
    }
  });

  // -------------------------------------------------------------
  // 5. RENDERIZADO CON OVERLAY DE LOS 18 FORMATOS PDF OFICIALES
  // -------------------------------------------------------------
  it("5. Los 18 formatos PDF oficiales se renderizan con overlay sobre el fondo institucional sin errores", async () => {
    const pdfOfficialKeys = EXPECTED_OFFICIAL_19.filter((k) => k !== "anexo_5");
    expect(pdfOfficialKeys).toHaveLength(18);

    const testMetadata = {
      processCode: "PROC-2026-VALLE-001",
      rndCode: "RND-2026-00445",
      donorName: "MARÍA ALEJANDRA OSORIO CÓRDOBA",
      donorDocument: "31888999",
      primaryIpsName: "Hospital Universitario del Valle Evaristo García",
      revisionNumber: 1,
      templateVersion: "1.0.0",
      generatedAt: new Date("2026-11-08T00:00:00Z"),
      generatedByName: "Dra. Sofía Mendoza (COT Regional 3)",
      snapshotDigest: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      signatures: [
        {
          signerRole: "COORDINADOR_OPERATIVO",
          fullName: "Dra. Sofía Mendoza",
          signatureType: "ATESTACION_ELECTRONICA",
          status: "FIRMADO",
          signedAt: new Date("2026-11-08T00:30:00Z"),
        },
      ],
    };

    for (const key of pdfOfficialKeys) {
      const renderedPdfBuffer = await pdfEngine.render({
        documentCode: key.toUpperCase(),
        title: `Prueba de Fidelidad ${key}`,
        data: {
          fallecidoNombre: "MARÍA ALEJANDRA OSORIO CÓRDOBA",
          fallecidoDocumento: "31888999",
          causaMuerte: "Hemorragia Subaracnoidea / Aneurisma roto",
          tecnicaQuirurgica: "Técnica quirúrgica estándar con canulación y perfusión fría de preservación.",
          hallazgosIntraoperatorios: "Órgano y tejidos íntegros, perfusión adecuada sin lesiones traumáticas.",
          observaciones: "Transporte en contenedor térmico regulado con precinto de seguridad.",
        },
        metadata: testMetadata,
      });

      expect(renderedPdfBuffer).toBeInstanceOf(Buffer);
      expect(renderedPdfBuffer.length).toBeGreaterThan(10000);

      // Cabecera PDF válida
      const header = renderedPdfBuffer.subarray(0, 5).toString("ascii");
      expect(header).toBe("%PDF-");
    }
  });

  // -------------------------------------------------------------
  // 6. DELIMITACIÓN LEGAL DE FIRMAS Y ADVERTENCIAS (LEY 527/1999)
  // -------------------------------------------------------------
  it("6. Modalidad DIGITAL_CERTIFICADA es advertida y pie de página contiene aviso de Ley 527 de 1999", async () => {
    const renderedPdf = await pdfEngine.render({
      documentCode: "ANEXO_1",
      title: "Anexo 1: Formato de Valoración y Alerta del Posible Donante",
      data: { fallecidoNombre: "Donante Test" },
      metadata: {
        processCode: "PROC-2026-001",
        primaryIpsName: "Clínica Imbanaco",
        revisionNumber: 1,
        templateVersion: "1.0.0",
        generatedAt: new Date(),
        generatedByName: "Dr. Test",
        signatures: [
          {
            signerRole: "MEDICO_TRATANTE",
            fullName: "Dr. Médico No Certificado ONAC",
            signatureType: "DIGITAL_CERTIFICADA", // Modalidad no permitida
            status: "FIRMADO",
            signedAt: new Date(),
          },
        ],
      },
    });

    const pdfString = extractAllTextFromPdfBuffer(renderedPdf);
    // Debe incluir el aviso legal explícito
    expect(pdfString).toContain("Ley 527 de 1999");
    expect(pdfString).toContain("No constituye firma digital certificada PKI");
    // No debe afirmar falsamente que es una firma digital certificada válida
    expect(pdfString).not.toContain("✓ FIRMA DIGITAL CERTIFICADA");
  });
});
