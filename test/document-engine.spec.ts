import { DocumentDefinitionValidator } from "../src/application/document-engine/document-definition.validator";

describe("DocumentDefinitionValidator", () => {
  const validSchema = {
    type: "object",
    properties: { code: { type: "string" } },
    required: ["code"],
  };
  const validUi = { sections: [{ id: "identity", fields: ["code"] }] };

  it("accepts a safe dynamic definition", () => {
    expect(() =>
      new DocumentDefinitionValidator().validate(
        validSchema,
        validUi,
        [
          {
            targetKey: "code",
            sourcePath: "rndCode",
            sourceKind: "DONOR_RECORD",
          },
        ],
        { all: [{ field: "procedure.kind", equals: "TISSUE_RECOVERY" }] },
      ),
    ).not.toThrow();
  });

  it("rejects malformed schemas and UI definitions", () => {
    const validator = new DocumentDefinitionValidator();
    expect(() => validator.validate({ type: "script" }, validUi, [])).toThrow();
    expect(() => validator.validate(validSchema, {}, [])).toThrow();
    expect(() =>
      validator.validate(validSchema, validUi, [{ targetKey: "code" }]),
    ).toThrow();
    expect(() =>
      validator.validate(validSchema, validUi, [], { execute: "javascript" }),
    ).toThrow();
  });
});
