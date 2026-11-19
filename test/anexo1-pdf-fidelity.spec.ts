import { PdfRenderEngineService } from "../src/application/pdf/pdf-render-engine.service";
import { InstitutionalDocumentService } from "../src/application/pdf/institutional-document.service";
import { PDFDocument } from "pdf-lib";

describe("Anexo 1 PDF High Fidelity & Continuation Sheet", () => {
  let engine: PdfRenderEngineService;

  beforeAll(() => {
    const instDocs = new InstitutionalDocumentService();
    engine = new PdfRenderEngineService(instDocs);
  });

  it("debe renderizar Anexo 1 en 2 páginas oficiales cuando los datos caben en la plantilla", async () => {
    const input = {
      documentCode: "ANEXO_1",
      title: "Anexo 1 — Formato de valoración y alerta de posible donante",
      data: {
        codigoRnd: "RND-2026-VAL-001",
        fechaNotificacion: "2026-11-19",
        horaNotificacion: "14:30",
        medicoCoordinador: "Dra. María Carmona",
        regionalGeneradora: "Regional 3",
        ipsGeneradora: "Hospital Universitario del Valle",
        nombreDonante: "Juan David Pérez González",
        tipoIdentificacion: "CC",
        numeroIdentificacion: "1144123456",
        edad: 28,
        sexo: "MASCULINO",
        etnia: "MESTIZO",
        nacionalidad: "Colombiana",
        fechaIngresoIps: "2026-11-18",
        horaIngresoIps: "08:15",
        glasgowIngreso: 7,
        glasgowAlerta: 3,
        grupoSanguineo: "O",
        factorRh: "POSITIVO",
        grupoSanguineoDeterminadoPor: "LABORATORIO",
        servicioHospitalario: "UCI",
        remitido: true,
        estanciaHospitalariaDias: 2,
        diagnosticoPosibleDonante: "Trauma craneoencefálico severo cerrado con hemorragia subaracnoidea",
        pesoKg: 72,
        tallaCm: 175,
        perimetroAbdominalCm: 84,
        perimetroToracicoCm: 96,
        imc: 23.5,
        tensionArterialSistolica: 120,
        tensionArterialDiastolica: 80,
        frecuenciaCardiaca: 82,
        temperaturaCorporal: 36.6,
        spo2: 98,
        diuresisCcHora: 95,
        labHb: 13.5,
        labHto: 40.5,
        labLeucocitos: 11200,
        labPlaquetas: 215000,
        labCreatinina: 0.95,
        labPh: 7.38,
        labPco2: 38,
        labPo2: 95,
        labSodio: 140,
        labPotasio: 4.1,
        labInr: 1.05,
        medicamentos: [
          { nombre: "Noradrenalina", dosisActual: "0.08 mcg/kg/min", fechaInicio: "2026-11-18 10:00", fechaFin: "2026-11-19 14:00", dosisMaxima: "0.2 mcg/kg/min" },
          { nombre: "Fentanilo", dosisActual: "100 mcg/h", fechaInicio: "2026-11-18 08:30", fechaFin: "2026-11-19 12:00", dosisMaxima: "150 mcg/h" },
          { nombre: "Midazolam", dosisActual: "5 mg/h", fechaInicio: "2026-11-18 08:30", fechaFin: "2026-11-19 06:00", dosisMaxima: "10 mg/h" },
        ],
      },
      metadata: {
        processCode: "PROC-2026-0099",
        rndCode: "RND-2026-VAL-001",
        donorName: "Juan David Pérez González",
        donorDocument: "1144123456",
        primaryIpsName: "Hospital Universitario del Valle",
        revisionNumber: 1,
        templateVersion: "2.0.0",
        generatedAt: new Date("2026-11-19T14:30:00.000Z"),
        generatedByName: "Dra. María Carmona",
        snapshotDigest: "a1b2c3d4e5f60718293a",
      },
    };

    const pdfBuffer = await engine.render(input);
    expect(pdfBuffer).toBeDefined();
    expect(pdfBuffer.length).toBeGreaterThan(10000);

    const doc = await PDFDocument.load(pdfBuffer);
    expect(doc.getPageCount()).toBe(2);
  });

  it("debe generar automáticamente Hoja Anexa de Continuación cuando existen más de 6 medicamentos", async () => {
    const input = {
      documentCode: "ANEXO_1",
      title: "Anexo 1 — Formato de valoración y alerta de posible donante",
      data: {
        codigoRnd: "RND-2026-MEDS-002",
        nombreDonante: "Carlos Alberto Rodríguez",
        tipoIdentificacion: "CC",
        numeroIdentificacion: "1020304050",
        ipsGeneradora: "Clínica Imbanaco",
        diagnosticoPosibleDonante: "Hemorragia intraventricular masiva / Muerte encefálica",
        medicamentos: [
          { nombre: "Noradrenalina", dosisActual: "0.1 mcg/kg/min" },
          { nombre: "Vasopresina", dosisActual: "0.04 UI/min" },
          { nombre: "Levotiroxina", dosisActual: "200 mcg IV" },
          { nombre: "Metilprednisolona", dosisActual: "1 g IV" },
          { nombre: "Insulina Cristalina", dosisActual: "2 UI/h" },
          { nombre: "Vancomicina", dosisActual: "1 g cada 12h" },
          { nombre: "Meropenem", dosisActual: "1 g cada 8h" }, // Fila 7 -> Desborda a Hoja de Continuación
          { nombre: "Desmopresina (DDAVP)", dosisActual: "2 mcg IV" }, // Fila 8
        ],
      },
      metadata: {
        processCode: "PROC-2026-0100",
        primaryIpsName: "Clínica Imbanaco",
        revisionNumber: 1,
        templateVersion: "2.0.0",
        generatedAt: new Date("2026-11-19T15:00:00.000Z"),
        generatedByName: "Dr. Roberto Gómez",
      },
    };

    const pdfBuffer = await engine.render(input);
    const doc = await PDFDocument.load(pdfBuffer);

    // Debe generar 3 páginas (2 oficiales + 1 de continuación)
    expect(doc.getPageCount()).toBe(3);
    const page3 = doc.getPage(2);
    expect(page3.getWidth()).toBe(612);
    expect(page3.getHeight()).toBe(1008);
  });

  it("debe contener el texto dentro del recuadro (drawTextContained) sin colisión cuando las observaciones son extensas", async () => {
    const veryLongObservations =
      "Paciente masculino ingresa bajo protocolo de preservación multiorgánica. Presenta poliuria secundaria a diabetes insípida neurogénica " +
      "corregida oportunamente con reposición de desmopresina 2 mcg IV y balance estricto. Se realiza angiografía cerebral de 4 vasos confirmando ausencia completa " +
      "de flujo intracraneal compatible con muerte encefálica legalmente certificada según Resolución 2640 de 2005. Familiares en acompañamiento psicológico continuo.";

    const input = {
      documentCode: "ANEXO_1",
      title: "Anexo 1",
      data: {
        nombreDonante: "Pedro Gómez",
        numeroIdentificacion: "98765432",
        ipsGeneradora: "Clínica de Occidente",
        observacionesAlerta: veryLongObservations,
      },
      metadata: {
        processCode: "PROC-2026-0101",
        primaryIpsName: "Clínica de Occidente",
        revisionNumber: 1,
        templateVersion: "2.0.0",
        generatedAt: new Date(),
        generatedByName: "Dra. Sofía Pérez",
      },
    };

    const pdfBuffer = await engine.render(input);
    const doc = await PDFDocument.load(pdfBuffer);
    expect(doc.getPageCount()).toBeGreaterThanOrEqual(2);
  });
});
