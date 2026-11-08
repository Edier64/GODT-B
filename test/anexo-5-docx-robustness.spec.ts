import AdmZip from "adm-zip";
import { InstitutionalDocumentService } from "../src/application/pdf/institutional-document.service";

describe("Anexo 5: Robustez y Validación OpenXML (Fase G.1.3.2)", () => {
  let service: InstitutionalDocumentService;

  beforeEach(() => {
    service = new InstitutionalDocumentService();
  });

  it("1. Validación con datos cortos (códigos, iniciales, números breves)", () => {
    const docxBuffer = service.generateDiligencedAnexo5Docx(
      {
        causaMuerte: "TEC",
        grupoSanguineo: "O",
        rh: "+",
        observaciones: "Tubo #1",
      },
      {
        primaryIpsName: "HUV",
        donorName: "J. D.",
        donorDocument: "123",
      },
    );

    expect(Buffer.isBuffer(docxBuffer)).toBe(true);
    expect(docxBuffer.length).toBeGreaterThan(50000);

    const zip = new AdmZip(docxBuffer);
    const docXml = zip.readAsText("word/document.xml");

    expect(docXml).toContain("HUV");
    expect(docXml).toContain("J. D.");
    expect(docXml).toContain("123");
    expect(docXml).toContain("TEC");
    expect(docXml).toContain("Rh: O+");
    expect(docXml).toContain("Tubo #1");

    // Verificar que el XML no se corrompe y contiene tags válidos
    expect(docXml.startsWith('<?xml version="1.0"')).toBe(true);
    expect(docXml.endsWith("</w:document>")).toBe(true);
  });

  it("2. Validación con datos estándar clínicos (longitud media)", () => {
    const docxBuffer = service.generateDiligencedAnexo5Docx(
      {
        institucionRemitente: "Clínica Imbanaco S.A. - Torre Principal",
        causaMuerte: "Hemorragia Subaracnoidea espontánea Fisher IV",
        grupoSanguineo: "A",
        rh: "+",
        observaciones:
          "3 tubos tapa roja, 2 tubos tapa lila para tipificación HLA y serología de donante cadavérico.",
      },
      {
        primaryIpsName: "Clínica Imbanaco S.A.",
        donorName: "Carlos Eduardo Gómez Restrepo",
        donorDocument: "94.321.876",
      },
    );

    const zip = new AdmZip(docxBuffer);
    const docXml = zip.readAsText("word/document.xml");

    expect(docXml).toContain("Clínica Imbanaco S.A.");
    expect(docXml).toContain("Carlos Eduardo Gómez Restrepo");
    expect(docXml).toContain("94.321.876");
    expect(docXml).toContain("Hemorragia Subaracnoidea");
    expect(docXml).toContain("Rh: A+");
    expect(docXml).toContain("tipificación HLA");
  });

  it("3. Validación con textos extensos (longitud larga > 500 chars) y caracteres especiales XML (&, <, >, quotes, tildes)", () => {
    const longObservation =
      "Observación clínica extensa: Muestras biológicas transportadas en contenedor isotérmico con control de temperatura entre 2°C y 8°C. " +
      "Se realiza entrega formal al mensajero de la Red Regional 3 con cadena de custodia intacta. " +
      "Valores críticos analizados: Creatinina < 1.0 mg/dL, Leucocitos > 5000 /mm³ & Plaquetas normales. " +
      "Contiene 'tubos primarios' con código de barras legible y sin hemólisis visible. ".repeat(3);

    const docxBuffer = service.generateDiligencedAnexo5Docx(
      {
        causaMuerte: "Trauma Cráneo-Encefálico Severo por colisión en vía rápida <Glasgow 3/15>",
        grupoSanguineo: "AB",
        rh: "-",
        observaciones: longObservation,
      },
      {
        primaryIpsName: "Hospital Universitario & Centro de Trauma 'San Rafael' <Valle>",
        donorName: "María & Fernando Peña-Gómez",
        donorDocument: "1.144.555.888",
      },
    );

    const zip = new AdmZip(docxBuffer);
    const docXml = zip.readAsText("word/document.xml");

    // Verificar que los caracteres especiales se escaparon adecuadamente en el XML
    expect(docXml).toContain("&amp;");
    expect(docXml).toContain("&lt;");
    expect(docXml).toContain("&gt;");

    // Comprobar que no hay etiquetas XML abiertas inválidas causadas por los textos
    expect(docXml).not.toContain("<Glasgow 3/15>");
    expect(docXml).not.toContain("<Valle>");

    // Estructura XML intacta
    expect(docXml.startsWith('<?xml version="1.0"')).toBe(true);
    expect(docXml.endsWith("</w:document>")).toBe(true);
  });

  it("4. Integridad estructural OpenXML: Headers, Footers, Styles y Media conservados", () => {
    const docxBuffer = service.generateDiligencedAnexo5Docx({}, {
      primaryIpsName: "Clínica Versalles",
      donorName: "Donante Test",
    });

    const zip = new AdmZip(docxBuffer);

    // Archivos estructurales clave
    const stylesXml = zip.readAsText("word/styles.xml");
    expect(stylesXml.length).toBeGreaterThan(10000);
    expect(stylesXml).toContain("<w:styles");

    const header1 = zip.readAsText("word/header1.xml");
    expect(header1).toContain("<w:hdr");

    const header2 = zip.readAsText("word/header2.xml");
    expect(header2).toContain("<w:hdr");

    const footer1 = zip.readAsText("word/footer1.xml");
    expect(footer1).toContain("<w:ftr");

    const footer2 = zip.readAsText("word/footer2.xml");
    expect(footer2).toContain("<w:ftr");

    // Media (logos/imágenes intactas con tamaño original)
    const img1 = zip.getEntry("word/media/image1.png");
    expect(img1).toBeDefined();
    expect(img1?.header.size).toBe(21050);

    const img2 = zip.getEntry("word/media/image2.png");
    expect(img2).toBeDefined();
    expect(img2?.header.size).toBe(5512);

    // Relaciones
    const rels = zip.readAsText("word/_rels/document.xml.rels");
    expect(rels).toContain("<Relationships");
    expect(rels).toContain("Target=\"header2.xml\"");
  });

  it("5. Verificación de estado técnico de Anexo 5: DOCX activo, vista PDF en REVIEW_REQUIRED", () => {
    const meta = service.getOriginalMetadata("anexo_5");
    expect(meta.mimeType).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(meta.renderMode).toBe("VECTOR_GENERATED");
    expect(meta.fidelityStatus).toBe("REVIEW_REQUIRED");
    expect(meta.status).toBe("INSTITUTIONAL_REGISTERED_TEMPLATE");
  });
});
