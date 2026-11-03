import { DocumentDefinitionValidator } from "../src/application/document-engine/document-definition.validator";

describe("DocumentDefinitionValidator", () => {
  const validSchema = {
    type: "object",
    properties: { code: { type: "string" } },
    required: ["code"],
  };
  const validUi = { sections: [{ id: "identity", fields: [] }] };

  it("accepts a safe dynamic definition", () => {
    expect(() =>
      new DocumentDefinitionValidator().validate(
        validSchema,
        validUi,
        [
          {
            targetKey: "rndCode",
            sourcePath: "donorRecord.rndCode",
            sourceKind: "DONOR_RECORD",
            dataType: "string",
            writable: false,
          },
        ],
        {
          fields: {
            "$.code": {
              visibleWhen: { field: "$.code", equals: "TISSUE_RECOVERY" },
            },
          },
        },
      ),
    ).not.toThrow();
  });

  it("accepts nullable JSON Schema type arrays", () => {
    expect(() =>
      new DocumentDefinitionValidator().validate(
        {
          type: "object",
          properties: {
            finishedAt: {
              type: ["string", "null"],
              format: "date-time",
            },
          },
        },
        validUi,
        [],
      ),
    ).not.toThrow();
  });

  it("rejects duplicated or unsupported JSON Schema types", () => {
    const validator = new DocumentDefinitionValidator();
    expect(() =>
      validator.validate(
        { type: "object", properties: { value: { type: ["string", "string"] } } },
        validUi,
        [],
      ),
    ).toThrow();
    expect(() =>
      validator.validate(
        { type: "object", properties: { value: { type: ["string", "null", "object"] } } },
        validUi,
        [],
      ),
    ).not.toThrow();
    expect(() =>
      validator.validate(
        { type: "object", properties: { value: { type: ["string", "script"] } } },
        validUi,
        [],
      ),
    ).toThrow();
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

  it("rejects UI references that are not present in the schema", () => {
    const validator = new DocumentDefinitionValidator();
    expect(() =>
      validator.validate(
        validSchema,
        { sections: [{ id: "identity", fields: ["missing"] }] },
        [],
      ),
    ).toThrow("references an unknown field");
    expect(() =>
      validator.validate(
        validSchema,
        {
          sections: [{ id: "identity", fields: ["code"] }],
          fieldConfigs: { "$.missing": { label: "Missing" } },
        },
        [],
      ),
    ).toThrow("field configuration");
  });

  it("accepts generic nested UI paths and rejects duplicate sections", () => {
    const validator = new DocumentDefinitionValidator();
    expect(() =>
      validator.validate(
        {
          type: "object",
          properties: {
            entries: {
              type: "array",
              items: {
                type: "object",
                properties: { label: { type: "string" } },
              },
            },
          },
        },
        {
          sections: [{ id: "entries", fields: ["entries"] }],
          fieldConfigs: { "$.entries[].label": { readonly: true } },
        },
        [],
      ),
    ).not.toThrow();
    expect(() =>
      validator.validate(
        validSchema,
        {
          sections: [
            { id: "identity", fields: ["code"] },
            { id: "identity", fields: ["code"] },
          ],
        },
        [],
      ),
    ).toThrow("duplicated");
  });

  it("accepts declarative dependencies and rejects executable or unknown references", () => {
    const validator = new DocumentDefinitionValidator();
    expect(() =>
      validator.validate(
        validSchema,
        validUi,
        [],
        {
          fields: {
            "$.code": {
              enabledWhen: {
                any: [
                  { field: "$.code", equals: "A" },
                  { field: "$.code", in: ["B", "C"] },
                ],
              },
            },
          },
        },
      ),
    ).not.toThrow();
    expect(() =>
      validator.validate(validSchema, validUi, [], {
        fields: {
          "$.code": { visibleWhen: { field: "$.missing", equals: true } },
        },
      }),
    ).toThrow("field reference");
    expect(() =>
      validator.validate(validSchema, validUi, [], {
        fields: { "$.code": { visibleWhen: { execute: "javascript" } } },
      }),
    ).toThrow("not allowed");
  });
});
