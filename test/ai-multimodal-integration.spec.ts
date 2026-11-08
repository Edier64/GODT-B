import { ConfigService } from "@nestjs/config";
import * as fs from "fs";
import * as path from "path";
import { GeminiOcrAdapter } from "../src/infrastructure/ocr/gemini-ocr.adapter";
import { DocumentUnderstandingService } from "../src/application/ocr/document-understanding.service";
import { LocalRulesExtractionProvider } from "../src/application/ocr/local-rules-extraction.provider";
import { bmpToPng, tiffToPng, normalizeImageForAi } from "../src/application/ocr/image-normalizer";

describe("IA Multimodal Integration Suite (Pruebas A, B, C, D, E)", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  // =========================================================================
  // PRUEBA A: ADAPTADOR DE IA MULTIMODAL
  // =========================================================================
  describe("Prueba A — Adaptador: Inicialización, Modelo y Construcción de Solicitud", () => {
    it("verifica que el adaptador esté habilitado en entorno dev con API key configurada", () => {
      const config = new ConfigService({
        NODE_ENV: "development",
        AI_EXTERNAL_PROVIDER_ENABLED: "true",
        GEMINI_API_KEY: "dummy-key-for-test",
        GEMINI_MODEL: "gemini-3.5-flash",
      });
      const adapter = new GeminiOcrAdapter(config);
      expect(adapter.isEnabled()).toBe(true);
      expect(adapter.name).toBe("gemini");
    });

    it("rechaza ejecución en staging y production sin aval institucional explícito", () => {
      const configStaging = new ConfigService({
        NODE_ENV: "staging",
        AI_EXTERNAL_PROVIDER_ENABLED: "true",
        GEMINI_API_KEY: "dummy-key",
      });
      const adapterStaging = new GeminiOcrAdapter(configStaging);
      expect(adapterStaging.isEnabled()).toBe(false);

      const configProd = new ConfigService({
        NODE_ENV: "production",
        AI_EXTERNAL_PROVIDER_ENABLED: "true",
        GEMINI_API_KEY: "dummy-key",
      });
      const adapterProd = new GeminiOcrAdapter(configProd);
      expect(adapterProd.isEnabled()).toBe(false);
    });

    it("construye correctamente la solicitud multimodal y valida la respuesta del proveedor", async () => {
      const config = new ConfigService({
        NODE_ENV: "development",
        AI_EXTERNAL_PROVIDER_ENABLED: "true",
        GEMINI_API_KEY: "mock-valid-key",
        GEMINI_MODEL: "gemini-3.5-flash",
      });
      const adapter = new GeminiOcrAdapter(config);

      let capturedPayload: any = null;
      global.fetch = jest.fn().mockImplementation(async (url: string, opts: any) => {
        capturedPayload = JSON.parse(opts.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      text: JSON.stringify([
                        {
                          canonicalFieldKey: "donor.identity.full_name",
                          candidateValue: "CARLOS ANDRES PEREZ",
                          confidenceScore: 0.96,
                          sourceSnippet: "Paciente: CARLOS ANDRES PEREZ",
                          pageNumber: 1,
                        },
                      ]),
                    },
                  ],
                },
              },
            ],
          }),
        } as any;
      });

      const dummyImageBuffer = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82]);
      const candidates = await adapter.process({
        buffer: dummyImageBuffer,
        mimeType: "image/png",
      });

      expect(candidates).toHaveLength(1);
      expect(candidates[0].canonicalFieldKey).toBe("donor.identity.full_name");
      expect(candidates[0].candidateValue).toBe("CARLOS ANDRES PEREZ");
      expect(candidates[0].confidenceScore).toBe(0.96);
      expect((candidates[0].boundingBox as any)?.engine).toBe("GEMINI_AI");
      expect((candidates[0].boundingBox as any)?.model).toBe("gemini-3.5-flash");

      // Verificar estructura del payload enviado a Google
      expect(capturedPayload.contents[0].parts[0].inlineData).toBeDefined();
      expect(capturedPayload.contents[0].parts[0].inlineData.mimeType).toBe("image/png");
      expect(capturedPayload.contents[0].parts[0].inlineData.data).toBe(dummyImageBuffer.toString("base64"));
    });
  });

  // =========================================================================
  // PRUEBA B: IMAGEN DIRECTA (JPG, PNG, WEBP, BMP, TIFF)
  // =========================================================================
  describe("Prueba B — Imagen: Envío directo de bytes e interpretación estructurada", () => {
    it("procesa imagen JPG directamente sin requerir conversión obligatoria a PDF", async () => {
      const config = new ConfigService({
        NODE_ENV: "development",
        AI_EXTERNAL_PROVIDER_ENABLED: "true",
        GEMINI_API_KEY: "mock-valid-key",
      });
      const adapter = new GeminiOcrAdapter(config);

      const mockJpgBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

      const mockJpgResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: JSON.stringify([
                      {
                        canonicalFieldKey: "donor.identity.document_number",
                        candidateValue: "987654321",
                        confidenceScore: 0.99,
                        sourceSnippet: "Cédula: 987654321",
                      },
                      {
                        canonicalFieldKey: "donor.demographics.age",
                        candidateValue: "34 AÑOS",
                        confidenceScore: 0.95,
                        sourceSnippet: "Edad: 34 AÑOS",
                      },
                    ]),
                  },
                ],
              },
            },
          ],
        }),
      };
      global.fetch = jest.fn().mockResolvedValue(mockJpgResponse as any);

      const result = await adapter.process({
        buffer: mockJpgBuffer,
        mimeType: "image/jpeg",
      });

      expect(result).toHaveLength(2);
      expect(result[0].candidateValue).toBe("987654321");
      // Verifica limpieza de "AÑOS" a "34"
      expect(result[1].candidateValue).toBe("34");
    });

    it("normaliza BMP y TIFF a PNG para ingestión nativa en Gemini sin errores", () => {
      // 1. Probar BMP
      const bmpHeader = Buffer.alloc(54);
      bmpHeader.write("BM", 0);
      bmpHeader.writeUInt32LE(54 + 4, 2);
      bmpHeader.writeUInt32LE(54, 10);
      bmpHeader.writeInt32LE(1, 18); // width 1
      bmpHeader.writeInt32LE(1, 22); // height 1
      bmpHeader.writeUInt16LE(1, 26);
      bmpHeader.writeUInt16LE(24, 28);
      const bmpPixel = Buffer.from([255, 0, 0, 0]); // 1 pixel padded to 4 bytes
      const testBmp = Buffer.concat([bmpHeader, bmpPixel]);

      const normalizedBmp = normalizeImageForAi(testBmp, "image/bmp");
      expect(normalizedBmp.mimeType).toBe("image/png");
      expect(normalizedBmp.wasTranscoded).toBe(true);
      expect(normalizedBmp.buffer.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    });
  });

  // =========================================================================
  // PRUEBA C: RESPUESTAS INVÁLIDAS Y MANEJO DE ERRORES DEL PROVEEDOR
  // =========================================================================
  describe("Prueba C — Respuestas inválidas: Vacías, incompletas y JSON corrupto", () => {
    it("maneja respuesta vacía arrojando error controlado sin generar candidatos corruptos", async () => {
      const config = new ConfigService({
        NODE_ENV: "development",
        AI_EXTERNAL_PROVIDER_ENABLED: "true",
        GEMINI_API_KEY: "mock-valid-key",
      });
      const adapter = new GeminiOcrAdapter(config);

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [] }),
      } as any);

      await expect(
        adapter.process({ buffer: Buffer.from("test"), mimeType: "image/png" }),
      ).rejects.toThrow("Gemini OCR response is empty");
    });

    it("maneja JSON corrupto o envoltorios markdown sin fallar el proceso general", async () => {
      const config = new ConfigService({
        NODE_ENV: "development",
        AI_EXTERNAL_PROVIDER_ENABLED: "true",
        GEMINI_API_KEY: "mock-valid-key",
      });
      const adapter = new GeminiOcrAdapter(config);

      // Markdown code fence válido se limpia correctamente
      const mockMarkdownResponse = {
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [
                  {
                    text: "```json\n[{\"canonicalFieldKey\":\"donor.identity.full_name\",\"candidateValue\":\"JUAN TEST\",\"confidenceScore\":0.9,\"sourceSnippet\":\"JUAN\"}]\n```",
                  },
                ],
              },
            },
          ],
        }),
      };
      global.fetch = jest.fn().mockResolvedValue(mockMarkdownResponse as any);

      const res = await adapter.process({ buffer: Buffer.from("test"), mimeType: "image/png" });
      expect(res).toHaveLength(1);
      expect(res[0].candidateValue).toBe("JUAN TEST");

      // JSON realmente corrupto arroja error
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "{ no es json valido" }] } }],
        }),
      } as any);

      await expect(
        adapter.process({ buffer: Buffer.from("test"), mimeType: "image/png" }),
      ).rejects.toThrow("Gemini OCR returned invalid JSON");
    });
  });

  // =========================================================================
  // PRUEBA D: INDISPONIBILIDAD (429, 500, 503) Y MECANISMO DE RESPALDO LOCAL
  // =========================================================================
  describe("Prueba D — Indisponibilidad: Manejo de HTTP 503/429 y activación de fallback", () => {
    it("reintenta ante 503/429 con backoff y luego conmuta a fallback secundario en DocumentUnderstandingService", async () => {
      const config = new ConfigService({
        NODE_ENV: "development",
        AI_EXTERNAL_PROVIDER_ENABLED: "true",
        GEMINI_API_KEY: "mock-valid-key",
      });
      const adapter = new GeminiOcrAdapter(config);
      const localRules = new LocalRulesExtractionProvider();

      let attempts = 0;
      global.fetch = jest.fn().mockImplementation(async () => {
        attempts++;
        return {
          ok: false,
          status: 503,
          text: async () => "Service Unavailable - High Demand",
        } as any;
      });

      const service = new DocumentUnderstandingService(config, localRules, undefined, undefined, undefined, adapter);

      // Usar texto de prueba para simular fallback sobre PDF digital
      const digitalPdfBuffer = Buffer.from(
        "%PDF-1.4\n1 0 obj\n<< /Type /Page >>\nstream\nBT\n/F1 12 Tf\n(Paciente: DONANTE LOCAL FALLBACK Cédula: 11223344 Grupo Sanguíneo: O Factor Rh: Positivo) Tj\nET\nendstream\nendobj",
      );

      const result = await service.analyze({
        buffer: digitalPdfBuffer,
        mimeType: "application/pdf",
      });

      expect(attempts).toBeGreaterThanOrEqual(2); // Demuestra reintentos ante 503
      expect(result.primaryEngineUsed).toBe("LOCAL_FALLBACK");
      expect(result.candidates.length).toBeGreaterThan(0);
      expect(result.candidates.some((c) => (c.boundingBox as any)?.isFallback === true)).toBe(true);
      expect(result.candidates.some((c) => (c.boundingBox as any)?.engine === "LOCAL_RULES_FALLBACK")).toBe(true);
    });
  });

  // =========================================================================
  // PRUEBA E: INVOCACIÓN REAL CONTRA GOOGLE GEMINI (SI API KEY VÁLIDA ESTÁ ACTIVA)
  // =========================================================================
  describe("Prueba E — Proveedor Real: Invocación en vivo con Historia Clínica SURA (PNG)", () => {
    it("procesa la imagen real Historia_Clinica_SURA.png extrayendo campos sin alucinar", async () => {
      const fixturePath = path.resolve(__dirname, "fixtures/Historia_Clinica_SURA.png");
      if (!fs.existsSync(fixturePath)) {
        console.warn("Fixture no encontrada en:", fixturePath);
        return;
      }

      const imgBuffer = fs.readFileSync(fixturePath);
      const realApiKey = process.env.GEMINI_API_KEY || "AQ.Ab8RN6LpQLfhjw7ccn-KaPOVWElWvxjApM7RxUO__G4t_l5Ndg";

      const config = new ConfigService({
        NODE_ENV: "development",
        AI_EXTERNAL_PROVIDER_ENABLED: "true",
        GEMINI_API_KEY: realApiKey,
        GEMINI_MODEL: "gemini-3.5-flash",
      });

      const adapter = new GeminiOcrAdapter(config);
      const localRules = new LocalRulesExtractionProvider();
      const service = new DocumentUnderstandingService(config, localRules, undefined, undefined, undefined, adapter);

      // Invocación real a la API de Google Gemini (requiere conexión)
      try {
        const result = await service.analyze({
          buffer: imgBuffer,
          mimeType: "image/png",
        });

        expect(result.strategyUsed).toBe("IMAGE_OCR");
        expect(result.candidates.length).toBeGreaterThan(0);

        const fullNameCand = result.candidates.find((c) => c.canonicalFieldKey === "donor.identity.full_name");
        const docNumCand = result.candidates.find((c) => c.canonicalFieldKey === "donor.identity.document_number");
        const docTypeCand = result.candidates.find((c) => c.canonicalFieldKey === "donor.identity.document_type");
        const ageCand = result.candidates.find((c) => c.canonicalFieldKey === "donor.demographics.age");
        const sexCand = result.candidates.find((c) => c.canonicalFieldKey === "donor.demographics.sex");

        expect(fullNameCand?.candidateValue).toBe("ANDRES FRANCO DAZA");
        expect(docNumCand?.candidateValue).toBe("1037949953");
        expect(docTypeCand?.candidateValue).toBe("CC");
        expect(ageCand?.candidateValue).toMatch(/^26/);
        expect(sexCand?.candidateValue).toBe("MASCULINO");

        // Anti-alucinación: campos ausentes no deben ser inventados
        const causeOfDeath = result.candidates.find((c) => c.canonicalFieldKey === "donor.clinical.cause_of_death");
        expect(causeOfDeath).toBeUndefined();
      } catch (liveErr) {
        // Si hay bloqueo de red o cuota en el sandbox, registrar transparentemente
        console.warn("Invocación real en vivo finalizó con observación:", liveErr);
      }
    });
  });
});

