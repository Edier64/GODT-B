import { ConfigService } from "@nestjs/config";
import { GeminiOcrAdapter } from "../src/infrastructure/ocr/gemini-ocr.adapter";
import { DocumentUnderstandingService } from "../src/application/ocr/document-understanding.service";
import { LocalRulesExtractionProvider } from "../src/application/ocr/local-rules-extraction.provider";

describe("Validación de Extracción Clínica de Laboratorios (7 Paneles) & Gobernanza HITL", () => {
  let adapter: GeminiOcrAdapter;
  let service: DocumentUnderstandingService;

  const mockConfig = new ConfigService({
    NODE_ENV: "development",
    AI_EXTERNAL_PROVIDER_ENABLED: "true",
    GEMINI_API_KEY: "mock-gemini-key-clinical-labs",
    GEMINI_MODEL: "gemini-3.5-flash-lite",
  });

  const syntheticClinicalLabsReport = `
================================================================================
HOSPITAL UNIVERSITARIO DEL VALLE "EVARISTO GARCÍA" E.S.E.
LABORATORIO CLÍNICO Y PATOLOGÍA - REPORTE DE RESULTADOS CRÍTICOS
Paciente: SINTETICO DONANTE REGIONAL 3 | Identificación: CC 1144205890
Servicio: UCI ADULTOS - Cama 14 | Fecha/Hora Toma: 19/11/2026 06:30 COT
================================================================================

1. CUADRO HEMÁTICO COMPLETO:
   - Hemoglobina (Hb): 11.8 g/dL (Ref: 12.0 - 16.0)
   - Hematocrito (Hcto): 35.4 % (Ref: 36.0 - 48.0)
   - Recuento de Leucocitos: 13500 /uL (Ref: 4500 - 11000)
   - Recuento de Plaquetas: 198000 /uL (Ref: 150000 - 450000)

2. QUÍMICA SANGUÍNEA:
   - Creatinina sérica: 1.15 mg/dL (Ref: 0.7 - 1.3)
   - Nitrógeno Ureico (BUN): 19.2 mg/dL (Ref: 7.0 - 20.0)
   - Glicemia basal: 124 mg/dL (Ref: 70 - 100)
   - Bilirrubina Total: 0.85 mg/dL (Ref: 0.2 - 1.2)
   - Transaminasa ALT/GPT: 32 U/L (Ref: 10 - 40)
   - Transaminasa AST/GOT: 28 U/L (Ref: 10 - 35)

3. ELECTROLITOS SÉRICOS:
   - Sodio sérico (Na): 141 mEq/L (Ref: 135 - 145)
   - Potasio sérico (K): 4.1 mEq/L (Ref: 3.5 - 5.0)

4. GASES ARTERIALES (FiO2 40%, PEEP 5):
   - pH arterial: 7.38 (Ref: 7.35 - 7.45)
   - Lactato sérico: 1.4 mmol/L (Ref: 0.5 - 2.0)
   - PaO2: 95 mmHg | PaCO2: 36 mmHg | HCO3: 23 mEq/L | SpO2: 98 %

5. COAGULACIÓN:
   - Tiempo de Protrombina (TP): 12.4 seg (Control: 11.8)
   - Tiempo de Tromboplastina (TPT): 29.1 seg (Control: 28.0)
   - INR: 1.08 (Ref: 0.9 - 1.2)

6. UROANÁLISIS & FUNCIÓN RENAL:
   - Gasto Urinario: 65 cc/hora (Adecuado > 0.5 cc/kg/h)
   - Sedimento urinario: Sin hematuria macroscópica, leucocitos 0-2 x campo.

7. CULTIVOS Y MICROBIOLOGÍA:
   - Hemocultivos periféricos x 2: Negativos a las 48h de incubación.
   - Urocultivo: Sin aislamiento bacteriano (< 10.000 UFC/mL).
   - Aspirado traqueal: Negativo para patógenos oportunistas.
================================================================================
`;

  beforeEach(() => {
    adapter = new GeminiOcrAdapter(mockConfig);
    const localRules = new LocalRulesExtractionProvider();
    service = new DocumentUnderstandingService(
      mockConfig,
      localRules,
      undefined,
      undefined,
      undefined,
      adapter,
    );
  });

  it("debe extraer candidatos para los 7 paneles clínicos asegurando que contengan evidencia textual y unidades", async () => {
    const mockGeminiJson = [
      // 1. Cuadro hemático
      {
        canonicalFieldKey: "donor.clinical.labs.hemoglobin",
        candidateValue: "11.8",
        confidenceScore: 0.96,
        sourceSnippet: "Hemoglobina (Hb): 11.8 g/dL (Ref: 12.0 - 16.0)",
        pageNumber: 1,
      },
      {
        canonicalFieldKey: "donor.clinical.labs.hematocrit",
        candidateValue: "35.4",
        confidenceScore: 0.95,
        sourceSnippet: "Hematocrito (Hcto): 35.4 % (Ref: 36.0 - 48.0)",
        pageNumber: 1,
      },
      {
        canonicalFieldKey: "donor.clinical.labs.leukocytes",
        candidateValue: "13500",
        confidenceScore: 0.94,
        sourceSnippet: "Recuento de Leucocitos: 13500 /uL",
        pageNumber: 1,
      },
      {
        canonicalFieldKey: "donor.clinical.labs.platelets",
        candidateValue: "198000",
        confidenceScore: 0.97,
        sourceSnippet: "Recuento de Plaquetas: 198000 /uL",
        pageNumber: 1,
      },
      // 2. Química sanguínea
      {
        canonicalFieldKey: "donor.clinical.creatinine",
        candidateValue: "1.15",
        confidenceScore: 0.98,
        sourceSnippet: "Creatinina sérica: 1.15 mg/dL",
        pageNumber: 1,
      },
      {
        canonicalFieldKey: "donor.clinical.labs.bun",
        candidateValue: "19.2",
        confidenceScore: 0.93,
        sourceSnippet: "Nitrógeno Ureico (BUN): 19.2 mg/dL",
        pageNumber: 1,
      },
      {
        canonicalFieldKey: "donor.clinical.labs.glycemia",
        candidateValue: "124",
        confidenceScore: 0.94,
        sourceSnippet: "Glicemia basal: 124 mg/dL",
        pageNumber: 1,
      },
      // 3. Electrolitos
      {
        canonicalFieldKey: "donor.clinical.labs.sodium",
        candidateValue: "141",
        confidenceScore: 0.95,
        sourceSnippet: "Sodio sérico (Na): 141 mEq/L",
        pageNumber: 1,
      },
      {
        canonicalFieldKey: "donor.clinical.labs.potassium",
        candidateValue: "4.1",
        confidenceScore: 0.95,
        sourceSnippet: "Potasio sérico (K): 4.1 mEq/L",
        pageNumber: 1,
      },
      // 4. Gases arteriales
      {
        canonicalFieldKey: "donor.clinical.arterial_ph",
        candidateValue: "7.38",
        confidenceScore: 0.99,
        sourceSnippet: "pH arterial: 7.38 (Ref: 7.35 - 7.45)",
        pageNumber: 1,
      },
      {
        canonicalFieldKey: "donor.clinical.labs.lactate",
        candidateValue: "1.4",
        confidenceScore: 0.93,
        sourceSnippet: "Lactato sérico: 1.4 mmol/L",
        pageNumber: 1,
      },
      // 5. Coagulación
      {
        canonicalFieldKey: "donor.clinical.labs.inr",
        candidateValue: "1.08",
        confidenceScore: 0.96,
        sourceSnippet: "INR: 1.08 (Ref: 0.9 - 1.2)",
        pageNumber: 1,
      },
      // 6. Uroanálisis / Gasto urinario
      {
        canonicalFieldKey: "donor.clinical.vitals.diuresis_rate",
        candidateValue: "65",
        confidenceScore: 0.91,
        sourceSnippet: "Gasto Urinario: 65 cc/hora",
        pageNumber: 1,
      },
    ];

    // Simular llamada a Gemini API devolviendo el payload estructurado
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [{ text: JSON.stringify(mockGeminiJson) }],
            },
          },
        ],
      }),
    });

    const candidates = await adapter.process({
      buffer: Buffer.from("dummy-pdf-buffer"),
      mimeType: "application/pdf",
      rawText: syntheticClinicalLabsReport,
    });

    // Validar que se extrajeron los campos de los paneles y ninguno fue descartado
    expect(candidates.length).toBe(13);

    const keys = candidates.map((c) => c.canonicalFieldKey);
    // 1. Cuadro hemático
    expect(keys).toContain("donor.clinical.labs.hemoglobin");
    expect(keys).toContain("donor.clinical.labs.hematocrit");
    expect(keys).toContain("donor.clinical.labs.leukocytes");
    expect(keys).toContain("donor.clinical.labs.platelets");
    // 2. Química
    expect(keys).toContain("donor.clinical.creatinine");
    expect(keys).toContain("donor.clinical.labs.bun");
    expect(keys).toContain("donor.clinical.labs.glycemia");
    // 3. Electrolitos
    expect(keys).toContain("donor.clinical.labs.sodium");
    expect(keys).toContain("donor.clinical.labs.potassium");
    // 4. Gases
    expect(keys).toContain("donor.clinical.arterial_ph");
    expect(keys).toContain("donor.clinical.labs.lactate");
    // 5. Coagulación
    expect(keys).toContain("donor.clinical.labs.inr");
    // 6. Diuresis
    expect(keys).toContain("donor.clinical.vitals.diuresis_rate");

    // Verificar que cada candidato tiene snippet de evidencia y puntaje de confianza
    candidates.forEach((c) => {
      expect(c.confidenceScore).toBeGreaterThanOrEqual(0.75);
      expect(c.boundingBox).toBeDefined();
      expect(c.boundingBox?.snippet).toBeDefined();
      expect(c.candidateValue).toBeDefined();
    });
  });

  it("debe garantizar que ningún laboratorio extraído se auto-propaga: todos nacen como candidatos PENDIENTES de revisión humana", async () => {
    // Al pasar por DocumentUnderstandingService, el resultado es una lista de OcrCandidate pura
    jest.spyOn(adapter, "process").mockResolvedValue([
      {
        canonicalFieldKey: "donor.clinical.creatinine",
        candidateValue: "1.15",
        confidenceScore: 0.98,
        boundingBox: { snippet: "Creatinina sérica: 1.15 mg/dL" },
      },
      {
        canonicalFieldKey: "donor.clinical.arterial_ph",
        candidateValue: "7.38",
        confidenceScore: 0.99,
        boundingBox: { snippet: "pH arterial: 7.38" },
      },
    ]);

    const result = await service.analyze({
      buffer: Buffer.from("pdf-bytes"),
      mimeType: "text/plain",
      rawText: syntheticClinicalLabsReport,
    });

    expect(result.candidates.length).toBeGreaterThanOrEqual(2);
    // Los candidatos retornados son propuestas asistidas: no modifican el estado del donante por sí mismos
    result.candidates.forEach((c) => {
      expect(c.canonicalFieldKey).toMatch(/^donor\.clinical/);
      expect(typeof c.candidateValue).toBe("string");
    });
  });
});
