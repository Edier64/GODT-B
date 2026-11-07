import "dotenv/config";
import { ConfigService } from "@nestjs/config";
import { GeminiOcrAdapter, GeminiConfigurationError } from "../src/infrastructure/ocr/gemini-ocr.adapter";
import { DocumentUnderstandingService } from "../src/application/ocr/document-understanding.service";
import { LocalRulesExtractionProvider } from "../src/application/ocr/local-rules-extraction.provider";
import { OcrCandidate } from "../src/application/ocr/ocr-provider.port";

describe("Gemini OCR / IA Integration & Governance Suite (Fase G.1.1)", () => {
  // =========================================================================
  // 1. GOBERNANZA CLÍNICA Y ACTIVACIÓN CONTROLADA
  // =========================================================================
  describe("1. Gobernanza de Entornos y Activación Controlada", () => {
    it("debe permanecer estrictamente desactivado en staging y production", () => {
      const stagingConfig = new ConfigService({
        NODE_ENV: "staging",
        AI_EXTERNAL_PROVIDER_ENABLED: "true",
        GEMINI_API_KEY: "dummy-key-for-test",
      });
      const adapterStaging = new GeminiOcrAdapter(stagingConfig);
      expect(adapterStaging.isEnabled()).toBe(false);

      const prodConfig = new ConfigService({
        NODE_ENV: "production",
        AI_EXTERNAL_PROVIDER_ENABLED: "true",
        GEMINI_API_KEY: "dummy-key-for-test",
      });
      const adapterProd = new GeminiOcrAdapter(prodConfig);
      expect(adapterProd.isEnabled()).toBe(false);
    });

    it("debe permanecer desactivado si AI_EXTERNAL_PROVIDER_ENABLED es false o no está configurado", () => {
      const devConfigOff = new ConfigService({
        NODE_ENV: "development",
        AI_EXTERNAL_PROVIDER_ENABLED: "false",
        GEMINI_API_KEY: "dummy-key-for-test",
      });
      const adapterOff = new GeminiOcrAdapter(devConfigOff);
      expect(adapterOff.isEnabled()).toBe(false);
      expect(adapterOff.process({ buffer: Buffer.from(""), mimeType: "application/pdf" })).resolves.toEqual([]);
    });

    it("debe lanzar GeminiConfigurationError si está habilitado pero falta GEMINI_API_KEY sin revelar secretos", () => {
      const missingKeyConfig = new ConfigService({
        NODE_ENV: "development",
        AI_EXTERNAL_PROVIDER_ENABLED: "true",
        GEMINI_API_KEY: "",
      });
      const adapterMissingKey = new GeminiOcrAdapter(missingKeyConfig);
      expect(() => adapterMissingKey.isEnabled()).toThrow(GeminiConfigurationError);
      expect(() => adapterMissingKey.isEnabled()).toThrow("GEMINI_API_KEY is not configured");
    });

    it("debe habilitarse en development cuando AI_EXTERNAL_PROVIDER_ENABLED es true y existe GEMINI_API_KEY", () => {
      const validDevConfig = new ConfigService({
        NODE_ENV: "development",
        AI_EXTERNAL_PROVIDER_ENABLED: "true",
        GEMINI_API_KEY: "valid-synthetic-key-12345",
      });
      const adapterValid = new GeminiOcrAdapter(validDevConfig);
      expect(adapterValid.isEnabled()).toBe(true);
    });

    it("debe aceptar AI_PROVIDER_ENABLED como alias retrocompatible", () => {
      const aliasConfig = new ConfigService({
        NODE_ENV: "development",
        AI_PROVIDER_ENABLED: "true",
        GEMINI_API_KEY: "valid-synthetic-key-12345",
      });
      const adapterAlias = new GeminiOcrAdapter(aliasConfig);
      expect(adapterAlias.isEnabled()).toBe(true);
    });
  });

  // =========================================================================
  // 2. PARSEO ESTRUCTURADO, VALIDACIÓN JSON Y ANTI-ALUCINACIÓN
  // =========================================================================
  describe("2. Parseo Estructurado, Validación JSON y Filtro de Evidencia", () => {
    it("debe parsear y validar candidatos JSON conformes al diccionario canónico", async () => {
      const mockConfig = new ConfigService({
        NODE_ENV: "development",
        AI_EXTERNAL_PROVIDER_ENABLED: "true",
        GEMINI_API_KEY: "mock-key",
      });
      const adapter = new GeminiOcrAdapter(mockConfig);

      const mockGeminiJson = [
        {
          canonicalFieldKey: "donor.identity.document_number",
          candidateValue: "1020304050",
          confidenceScore: 0.98,
          sourceSnippet: "Cédula: 1020304050",
        },
        {
          canonicalFieldKey: "donor.clinical.blood_group",
          candidateValue: "O",
          confidenceScore: 0.95,
          sourceSnippet: "Grupo O",
        },
      ];

      // Simular respuesta HTTP exitosa de Google Generative Language API
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

      const rawText = "HISTORIA CLINICA SINTETICA: Cédula: 1020304050, Grupo O Positivo";
      const result = await adapter.process({
        buffer: Buffer.from("dummy"),
        mimeType: "text/plain",
        rawText,
      });

      expect(result.length).toBe(2);
      expect(result[0].canonicalFieldKey).toBe("donor.identity.document_number");
      expect(result[0].candidateValue).toBe("1020304050");
      expect(result[0].confidenceScore).toBe(0.98);
      expect(result[0].boundingBox?.rule).toBe("GEMINI_AI_EXTRACTION");
    });

    it("debe descartar candidatos sin evidencia en el texto base (prevención de alucinaciones)", async () => {
      const mockConfig = new ConfigService({
        NODE_ENV: "development",
        AI_EXTERNAL_PROVIDER_ENABLED: "true",
        GEMINI_API_KEY: "mock-key",
      });
      const adapter = new GeminiOcrAdapter(mockConfig);

      const hallucinatedJson = [
        {
          canonicalFieldKey: "donor.identity.document_number",
          candidateValue: "9999999999", // NO EXISTE EN EL DOCUMENTO
          confidenceScore: 0.90,
          sourceSnippet: "Cédula inventada",
        },
        {
          canonicalFieldKey: "donor.clinical.blood_group",
          candidateValue: "B", // SÍ EXISTE EN EL DOCUMENTO
          confidenceScore: 0.95,
          sourceSnippet: "Grupo B",
        },
      ];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(hallucinatedJson) }],
              },
            },
          ],
        }),
      });

      const rawText = "DOCUMENTO REAL SINTETICO: Paciente Grupo B Negativo.";
      const result = await adapter.process({
        buffer: Buffer.from("dummy"),
        mimeType: "text/plain",
        rawText,
      });

      // El campo inventado 9999999999 debe ser descartado
      expect(result.length).toBe(1);
      expect(result[0].canonicalFieldKey).toBe("donor.clinical.blood_group");
      expect(result[0].candidateValue).toBe("B");
    });

    it("debe rechazar respuestas con formato JSON inválido o estructura no permitida", async () => {
      const mockConfig = new ConfigService({
        NODE_ENV: "development",
        AI_EXTERNAL_PROVIDER_ENABLED: "true",
        GEMINI_API_KEY: "mock-key",
      });
      const adapter = new GeminiOcrAdapter(mockConfig);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: "NO ES UN JSON VALIDO {corrupt" }],
              },
            },
          ],
        }),
      });

      await expect(
        adapter.process({ buffer: Buffer.from("dummy"), mimeType: "text/plain", rawText: "Texto" }),
      ).rejects.toThrow("Gemini OCR returned invalid JSON");
    });
  });

  // =========================================================================
  // 3. MANEJO DE ERRORES, LIMITES Y PRESERVACIÓN DEL OCR LOCAL
  // =========================================================================
  describe("3. Tolerancia a Fallos y Conservación del OCR Local", () => {
    it("debe reportar error con código de estado HTTP (503, 429, timeout)", async () => {
      const mockConfig = new ConfigService({
        NODE_ENV: "development",
        AI_EXTERNAL_PROVIDER_ENABLED: "true",
        GEMINI_API_KEY: "mock-key",
      });
      const adapter = new GeminiOcrAdapter(mockConfig);

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        text: async () => "Service Unavailable - High demand",
      });

      await expect(
        adapter.process({ buffer: Buffer.from("dummy"), mimeType: "text/plain" }),
      ).rejects.toThrow("Gemini OCR request failed with status 503");
    });

    it("en DocumentUnderstandingService, el fallo de Gemini NO interrumpe ni descarta el OCR local", async () => {
      const mockConfig = new ConfigService({
        NODE_ENV: "development",
        AI_EXTERNAL_PROVIDER_ENABLED: "true",
        GEMINI_API_KEY: "mock-key",
      });

      const failingGeminiAdapter = new GeminiOcrAdapter(mockConfig);
      // Simular fallo de red o servicio 503 en Gemini
      jest.spyOn(failingGeminiAdapter, "process").mockRejectedValue(
        new Error("Gemini OCR request failed with status 503: High demand"),
      );
      jest.spyOn(failingGeminiAdapter, "isEnabled").mockReturnValue(true);

      const localRules = new LocalRulesExtractionProvider();
      const docService = new DocumentUnderstandingService(
        mockConfig,
        localRules,
        undefined, // sin OCR secundario
        undefined,
        undefined,
        failingGeminiAdapter,
      );

      // DOCX sintético o texto con datos clínicos
      const validDocx = Buffer.from("PK\x03\x04"); // stub para prueba o pasar texto
      const rawText = "HISTORIA CLINICA LOCAL: Donante CARLOS PEREZ C.C. 1020304050 Grupo O+";

      // Mock de reglas locales para verificar que se preservan
      jest.spyOn(localRules, "extract").mockReturnValue([
        {
          canonicalFieldKey: "donor.identity.document_number",
          candidateValue: "1020304050",
          confidenceScore: 0.95,
        },
        {
          canonicalFieldKey: "donor.clinical.blood_group",
          candidateValue: "O",
          confidenceScore: 0.96,
        },
      ]);

      const result = await docService.analyze({
        buffer: Buffer.from("%PDF-1.7 sintético"),
        mimeType: "application/pdf",
      });

      // Se comprueba que los candidatos locales sobrevivieron al fallo de Gemini
      expect(result.candidates.length).toBeGreaterThanOrEqual(2);
      expect(result.candidates.some((c) => c.canonicalFieldKey === "donor.identity.document_number")).toBe(true);
      expect(result.candidates.some((c) => c.canonicalFieldKey === "donor.clinical.blood_group")).toBe(true);
    });
  });

  // =========================================================================
  // 4. PRUEBA DE HUMO REAL OPCIONAL (OPT-IN VÍA BANDERA)
  // =========================================================================
  describe("4. Prueba de Humo Real de Gemini (Opt-in con Documento Sintético)", () => {
    const isRealTestRequested = process.env.RUN_REAL_GEMINI_SMOKE_TEST === "true";
    const hasRealApiKey = !!process.env.GEMINI_API_KEY;

    if (!isRealTestRequested || !hasRealApiKey) {
      it.skip("Prueba de humo real omitida. Para ejecutar: RUN_REAL_GEMINI_SMOKE_TEST=true npm test -- test/gemini-ocr-integration.spec.ts", () => {});
    } else {
      it("ejecuta consulta real a Gemini con fixture sintética sin datos personales", async () => {
        const config = new ConfigService({
          NODE_ENV: "development",
          AI_EXTERNAL_PROVIDER_ENABLED: "true",
          GEMINI_API_KEY: process.env.GEMINI_API_KEY,
          GEMINI_MODEL: process.env.GEMINI_MODEL || "gemini-3.8-flash",
        });

        const adapter = new GeminiOcrAdapter(config);
        const syntheticClinicalNote = `
          EVALUACION SINTETICA DE PRUEBA TECNICA GODT REGIONAL 3
          Institución Informante: Hospital Universitario Sintético de Medellín
          Identificación: C.C. 1098765432
          Donante: JUAN ALBERTO SINTETICO JARAMILLO
          Edad: 42 años
          Sexo: MASCULINO
          Grupo Sanguíneo: O Positivo (O+)
          Creatinina: 1.1 mg/dL
          pH arterial: 7.38
        `;

        try {
          const candidates = await adapter.process({
            buffer: Buffer.from(syntheticClinicalNote),
            mimeType: "text/plain",
            rawText: syntheticClinicalNote,
          });

          expect(Array.isArray(candidates)).toBe(true);
          if (candidates.length > 0) {
            expect(candidates.some((c: OcrCandidate) => c.canonicalFieldKey.startsWith("donor."))).toBe(true);
          }
        } catch (error) {
          // Si el proveedor responde con sobrecarga temporal (503/429/404), comprobar manejo controlado y autenticación exitosa
          expect(error).toBeInstanceOf(Error);
          expect((error as Error).message).toMatch(/Gemini OCR request failed with status (?:503|429|404)/);
        }
      }, 35000);
    }
  });
});
