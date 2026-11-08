import * as fs from "node:fs";
import * as path from "node:path";
import { PDFDocument } from "pdf-lib";
import { InstitutionalDocumentService } from "../src/application/pdf/institutional-document.service";
import { PdfRenderEngineService } from "../src/application/pdf/pdf-render-engine.service";
import { INSTITUTIONAL_OVERLAYS } from "../src/application/pdf/institutional-coordinates";

describe("Validación Visual y de Alineación de los 18 Formatos PDF Oficiales (Fase G.1.3.2)", () => {
  let docService: InstitutionalDocumentService;
  let pdfEngine: PdfRenderEngineService;
  const auditOutputDir = path.resolve(process.cwd(), "test-output", "visual-audit");

  beforeAll(() => {
    docService = new InstitutionalDocumentService();
    pdfEngine = new PdfRenderEngineService(docService);
    if (!fs.existsSync(auditOutputDir)) {
      fs.mkdirSync(auditOutputDir, { recursive: true });
    }
  });

  const PDF_18_CONFIGS = [
    { key: "anexo_1", title: "Anexo 1: Valoración y Alerta", pages: 2, width: 612, height: 1008, orientation: "PORTRAIT" },
    { key: "anexo_2", title: "Anexo 2: Notificación Deudos", pages: 2, width: 612, height: 792, orientation: "PORTRAIT" },
    { key: "anexo_3", title: "Anexo 3: Consentimiento Familiar", pages: 2, width: 612, height: 792, orientation: "PORTRAIT" },
    { key: "anexo_4", title: "Anexo 4: Registro Donante y Oferta", pages: 4, width: 612, height: 1008, orientation: "PORTRAIT" },
    { key: "anexo_6", title: "Anexo 6: Extracción Quirúrgica", pages: 2, width: 612, height: 792, orientation: "PORTRAIT" },
    { key: "anexo_7_ocular", title: "Anexo 7: Rescate Ocular", pages: 2, width: 595.5, height: 842.25, orientation: "PORTRAIT" },
    { key: "anexo_7_cardiovascular", title: "Anexo 7: Rescate Cardiovascular", pages: 3, width: 595.5, height: 842.25, orientation: "PORTRAIT" },
    { key: "anexo_7_osteomuscular", title: "Anexo 7: Rescate Osteomuscular", pages: 3, width: 595.5, height: 842.25, orientation: "PORTRAIT" },
    { key: "anexo_7_piel", title: "Anexo 7: Rescate Piel", pages: 3, width: 595.5, height: 842.25, orientation: "PORTRAIT" },
    { key: "anexo_7_corazon", title: "Anexo 7: Extracción Corazón", pages: 1, width: 612, height: 792, orientation: "PORTRAIT" },
    { key: "anexo_7_higado", title: "Anexo 7: Extracción Hígado", pages: 1, width: 612, height: 792, orientation: "PORTRAIT" },
    { key: "anexo_7_otros_organos", title: "Anexo 7: Extracción Otros Órganos", pages: 1, width: 612, height: 792, orientation: "PORTRAIT" },
    { key: "anexo_7_pancreas", title: "Anexo 7: Extracción Páncreas", pages: 1, width: 612, height: 792, orientation: "PORTRAIT" },
    { key: "anexo_7_pulmon", title: "Anexo 7: Extracción Pulmón", pages: 1, width: 612, height: 792, orientation: "PORTRAIT" },
    { key: "anexo_7_rinon_derecho", title: "Anexo 7: Extracción Riñón Derecho", pages: 1, width: 612, height: 792, orientation: "PORTRAIT" },
    { key: "anexo_7_rinon_izquierdo", title: "Anexo 7: Extracción Riñón Izquierdo", pages: 1, width: 612, height: 792, orientation: "PORTRAIT" },
    { key: "anexo_8", title: "Anexo 8: Cadena de Custodia", pages: 2, width: 930.96, height: 606.96, orientation: "LANDSCAPE" },
    { key: "anexo_9", title: "Anexo 9: Carta INMLCF", pages: 1, width: 612, height: 792, orientation: "PORTRAIT" },
  ];

  const syntheticClinicalData = {
    // Identificación y Donante
    nombreDonante: "DANIEL ALEJANDRO MONTOYA VALENCIA",
    fallecidoNombre: "DANIEL ALEJANDRO MONTOYA VALENCIA",
    nombresApellidos: "DANIEL ALEJANDRO MONTOYA VALENCIA",
    tipoIdentificacion: "CC",
    numeroIdentificacion: "1144098765",
    fallecidoDocumento: "1144098765",
    edad: "29",
    donanteEdad: "29",
    sexo: "MASCULINO",
    donanteSexo: "MASCULINO",
    nacionalidad: "Colombiana",
    etnia: "Mestizo",
    grupoSanguineo: "O",
    abo: "O",
    factorRh: "POSITIVO (+)",
    rh: "+",
    // Muerte Encefálica y Diagnóstico
    causaMuerte: "Trauma Craneoencefálico Severo por impacto en vía pública",
    causaMuerteEncefalica: "Trauma Craneoencefálico Severo / Hemorragia Subaracnoidea traumática",
    diagnosticoMuerte: "Muerte Encefálica certificada bajo protocolo clínico y prueba de apnea positiva",
    glasgowIngreso: "3",
    glasgowAlerta: "3",
    testApnea: "Prueba de apnea positiva sin esfuerzo ventilatorio (pH 7.24, PaCO2 65 mmHg)",
    reflejosTronco: "Reflejos pupilares, oculocefálicos, oculovestibulares y corneal totalmente ausentes",
    eeg: "Silencio electroencefalográfico cerebral sostenido",
    pruebaFlujo: "Doppler transcraneal con espigas sistólicas mínimas y ausencia de flujo diastólico",
    // Monitoreo Hemodinámico y Soporte
    tensionArterial: "116/74",
    tensionArterialSistolica: "116",
    tensionArterialDiastolica: "74",
    presionArterialMedia: "78",
    frecuenciaCardiaca: "80",
    frecuenciaRespiratoria: "14",
    temperatura: "36.7",
    temperaturaCorporal: "36.7",
    saturacionOxigeno: "99",
    diuresisHoraria: "1.3",
    peso: "74",
    talla: "175",
    perimetroAbdominal: "82",
    perimetroToracico: "94",
    imc: "24.2",
    // Laboratorios y Serología
    hemoglobina: "13.6",
    hematocrito: "41.2",
    leucocitos: "11400",
    plaquetas: "242000",
    creatinina: "0.88",
    bun: "14",
    alt: "26",
    ast: "22",
    bilirrubinaTotal: "0.6",
    glicemia: "118",
    ph: "7.39",
    pco2: "37",
    po2: "112",
    sodio: "141",
    potasio: "4.0",
    cloro: "103",
    serologiaVih: "NO REACTIVO",
    serologiaHbsag: "NO REACTIVO",
    serologiaVhc: "NO REACTIVO",
    serologiaChagas: "NO REACTIVO",
    serologiaSifilis: "NO REACTIVO",
    // Extracción Quirúrgica y Oferta
    horaInicioCirugia: "02:15",
    horaClampeoAortico: "03:45",
    solucionPreservacion: "Custodiol (HTK) - 4000 cc perfundidos en frío a 4°C",
    tiempoIsquemiaCaliente: "0 minutos",
    tiempoIsquemiaFria: "180 minutos estimados hasta implante",
    cirujanoExtirpador: "Dr. Roberto Mendoza - Cirujano de Trasplantes",
    registroMedicoCirujano: "RM-76-98765-COL",
    anestesiologo: "Dra. Claudia Riascos - Anestesióloga Cardiovascular",
    instrumentador: "Lic. Andrea Torres",
    // Observaciones y Atestación
    observaciones: "Perfusión uniforme, lavado homogéneo y conservación óptima en triple empaque estéril.",
  };

  const syntheticMetadata = {
    processCode: "PROC-2026-VALLE-001",
    rndCode: "RND-2026-00982",
    donorName: "DANIEL ALEJANDRO MONTOYA VALENCIA",
    donorDocument: "1144098765",
    primaryIpsName: "Hospital Universitario del Valle Evaristo García",
    revisionNumber: 2,
    templateVersion: "1.0.0",
    generatedAt: new Date("2026-11-08T03:00:00Z"),
    generatedByName: "Dr. Carlos Santamaría (Coordinador Operativo Red Regional 3)",
    snapshotDigest: "4a2b6e12d83b9c71f054e819acde25f918bc32057391da40763f912e84c16a8b",
    signatures: [
      {
        signerRole: "COORDINADOR_OPERATIVO",
        fullName: "Dr. Carlos Santamaría",
        signatureType: "ATESTACION_ELECTRONICA",
        status: "FIRMADO",
        signedAt: new Date("2026-11-08T03:30:00Z"),
      },
    ],
  };

  it("1. Los 18 formatos PDF oficiales se renderizan, conservan dimensiones exactas y se guardan para auditoría", async () => {
    for (const conf of PDF_18_CONFIGS) {
      const meta = docService.getOriginalMetadata(conf.key);
      const renderedBytes = await pdfEngine.render({
        documentCode: conf.key.toUpperCase(),
        title: conf.title,
        data: syntheticClinicalData,
        metadata: syntheticMetadata,
      });

      expect(Buffer.isBuffer(renderedBytes)).toBe(true);
      expect(renderedBytes.length).toBeGreaterThan(15000);

      // Cargar con pdf-lib y verificar páginas y dimensiones
      const doc = await PDFDocument.load(renderedBytes);
      expect(doc.getPageCount()).toBe(conf.pages);

      for (let i = 0; i < doc.getPageCount(); i++) {
        const page = doc.getPage(i);
        const w = Math.round(page.getWidth() * 100) / 100;
        const h = Math.round(page.getHeight() * 100) / 100;

        const expectedDim = meta.dimensions[i] || { width: conf.width, height: conf.height };
        // Tolerancia de 0.5 puntos tipográficos para escala de renderizado
        expect(Math.abs(w - expectedDim.width)).toBeLessThanOrEqual(0.5);
        expect(Math.abs(h - expectedDim.height)).toBeLessThanOrEqual(0.5);
      }

      // Guardar PDF de auditoría visual en carpeta de salida
      const outputPath = path.join(auditOutputDir, `${conf.key}-rendered-audit.pdf`);
      fs.writeFileSync(outputPath, renderedBytes);
      expect(fs.existsSync(outputPath)).toBe(true);
    }
  });

  it("2. Verificación de límites de coordenadas en overlays (no exceden ancho de página ni pie de página)", () => {
    for (const conf of PDF_18_CONFIGS) {
      const overlayKey = conf.key;
      const coordinates = INSTITUTIONAL_OVERLAYS[overlayKey] || [];

      for (const field of coordinates) {
        // La coordenada X debe ser >= 30 y menor que el ancho de la página
        expect(field.x).toBeGreaterThanOrEqual(30);
        expect(field.x).toBeLessThan(conf.width);

        // Si tiene maxWidth, x + maxWidth no debe sobrepasar el margen derecho
        if (field.maxWidth) {
          expect(field.x + field.maxWidth).toBeLessThanOrEqual(conf.width - 15);
        }

        // La coordenada Y debe ser >= 25 (para no tapar los avisos de atestación del pie de página) y <= altura
        expect(field.y).toBeGreaterThanOrEqual(25);
        expect(field.y).toBeLessThan(conf.height);

        // El pageIndex debe ser un índice válido dentro del rango de páginas
        expect(field.pageIndex).toBeGreaterThanOrEqual(0);
        expect(field.pageIndex).toBeLessThan(conf.pages);
      }
    }
  });

  it("3. Verificación especial de Anexo 4 (Oficio 4 páginas): Coordenadas cubren todas las páginas y status RENDER_READY", () => {
    const anexo4Meta = docService.getOriginalMetadata("anexo_4");
    expect(anexo4Meta.fidelityStatus).toBe("RENDER_READY");
    expect(anexo4Meta.pageCount).toBe(4);
    expect(anexo4Meta.dimensions[0].width).toBe(612);
    expect(anexo4Meta.dimensions[0].height).toBe(1008);

    const anexo4Fields = INSTITUTIONAL_OVERLAYS["anexo_4"];
    expect(anexo4Fields).toBeDefined();

    // Comprobar que hay campos en cada una de las 4 páginas
    const pagesWithFields = new Set(anexo4Fields.map((f) => f.pageIndex));
    expect(pagesWithFields.has(0)).toBe(true);
    expect(pagesWithFields.has(1)).toBe(true);
    expect(pagesWithFields.has(2)).toBe(true);
    expect(pagesWithFields.has(3)).toBe(true);
    expect(anexo4Fields.length).toBeGreaterThanOrEqual(40);
  });

  it("4. Verificación especial de Anexo 8 (Formato Horizontal / Landscape 930.96 x 606.96)", () => {
    const anexo8Meta = docService.getOriginalMetadata("anexo_8");
    expect(anexo8Meta.dimensions[0].orientation).toBe("LANDSCAPE");
    expect(Math.abs(anexo8Meta.dimensions[0].width - 930.96)).toBeLessThan(1);
    expect(Math.abs(anexo8Meta.dimensions[0].height - 606.96)).toBeLessThan(1);
  });
});
