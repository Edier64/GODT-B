import genericDefinition from "./fixtures/generic-document-definition.json";
import { DocumentDefinitionValidator } from "../src/application/document-engine/document-definition.validator";
import { DocumentResponseValidator } from "../src/application/document-engine/document-response.validator";

describe("generic document engine fixtures", () => {
  it("accepts a definition without institutional or Anexo 6 identifiers", () => {
    expect(() =>
      new DocumentDefinitionValidator().validate(
        genericDefinition.jsonSchema,
        genericDefinition.uiSchema,
        genericDefinition.mappingConfig,
      ),
    ).not.toThrow();
  });

  it("validates scalar, nullable, nested and table values", () => {
    const result = new DocumentResponseValidator().validate(
      genericDefinition.jsonSchema,
      {
        title: "Synthetic document",
        amount: 12.5,
        active: true,
        reviewAt: null,
        contact: { email: "synthetic@example.test" },
        lines: [{ code: "A", quantity: 2 }],
      },
    );
    expect(result).toEqual({ valid: true, errors: [] });
  });

  it("reports generic table and nested validation paths", () => {
    const result = new DocumentResponseValidator().validate(
      genericDefinition.jsonSchema,
      {
        title: "",
        amount: -1,
        contact: { email: "invalid" },
        lines: [{ code: "UNKNOWN", quantity: 0 }],
      },
    );
    expect(result.valid).toBe(false);
    expect(result.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: "$.amount", keyword: "minimum" }),
        expect.objectContaining({
          path: "$.contact.email",
          keyword: "format",
        }),
        expect.objectContaining({
          path: "$.lines[0].code",
          keyword: "enum",
        }),
        expect.objectContaining({
          path: "$.lines[0].quantity",
          keyword: "minimum",
        }),
      ]),
    );
  });
});
