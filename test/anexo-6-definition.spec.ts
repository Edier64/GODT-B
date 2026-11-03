import definition from "../scripts/anexo-6-definition.json";
import { DocumentDefinitionValidator } from "../src/application/document-engine/document-definition.validator";
import { DocumentResponseValidator } from "../src/application/document-engine/document-response.validator";

describe("Anexo 6 pilot definition", () => {
  it("is accepted by the definition validator", () => {
    expect(() =>
      new DocumentDefinitionValidator().validate(
        definition.jsonSchema,
        definition.uiSchema,
        definition.mappingConfig,
      ),
    ).not.toThrow();
  });

  it("accepts synthetic table responses and preserves nullable fields", () => {
    const result = new DocumentResponseValidator().validate(
      definition.jsonSchema,
      {
        rndCode: "RND-SYNTHETIC-06",
        city: "Ciudad sintética",
        originatingIpsName: "IPS sintética",
        actualStartAt: null,
        organRecoveries: [
          {
            component: "HEART",
            responsibleInstitution: "IPS sintética",
            nonExtractionReason: null,
          },
        ],
        personnel: [
          {
            procedure: "CARDIECTOMY",
            surgeon: "Profesional sintético",
            assistant: null,
            instrumentation: null,
          },
        ],
        preservationSolutions: [
          { route: "AORTA", type: "Solución sintética", quantityCc: 0 },
        ],
        tissueRecoveries: [
          {
            component: "SKIN",
            responsibleBank: null,
            extractionProfessional: "Técnico sintético",
            nonExtractionReason: null,
          },
        ],
      },
    );

    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("reports precise paths for invalid table values", () => {
    const result = new DocumentResponseValidator().validate(
      definition.jsonSchema,
      { organRecoveries: [{ component: "INVALID" }] },
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "$.organRecoveries[0].component",
          keyword: "enum",
        }),
      ]),
    );
  });
});
