import { DocumentResponseValidator } from "../src/application/document-engine/document-response.validator";

describe("DocumentResponseValidator", () => {
  const validator = new DocumentResponseValidator();
  const schema = {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: ["name", "status", "items", "nested"],
    properties: {
      name: { type: "string", minLength: 3, maxLength: 10 },
      status: { type: "string", enum: ["ACTIVE", "INACTIVE"] },
      email: { type: "string", format: "email", pattern: "^[^@]+@[^@]+$" },
      amount: { type: "number", minimum: 1, maximum: 10 },
      items: {
        type: "array",
        minItems: 1,
        items: { type: "integer", minimum: 1 },
      },
      nested: {
        type: "object",
        required: ["code"],
        properties: { code: { type: "string" } },
      },
    },
  };

  it("accepts a valid response", () => {
    expect(
      validator.validate(schema, {
        name: "Alice",
        status: "ACTIVE",
        email: "alice@example.com",
        amount: 5,
        items: [1, 2],
        nested: { code: "A" },
      }),
    ).toEqual({ valid: true, errors: [] });
  });

  it.each([
    [
      "required field",
      { status: "ACTIVE", items: [1], nested: { code: "A" } },
      "required",
    ],
    [
      "primitive type",
      { name: 7, status: "ACTIVE", items: [1], nested: { code: "A" } },
      "type",
    ],
    [
      "length",
      { name: "A", status: "ACTIVE", items: [1], nested: { code: "A" } },
      "minLength",
    ],
    [
      "format",
      {
        name: "Alice",
        status: "ACTIVE",
        email: "invalid",
        items: [1],
        nested: { code: "A" },
      },
      "format",
    ],
    [
      "range",
      {
        name: "Alice",
        status: "ACTIVE",
        amount: 11,
        items: [1],
        nested: { code: "A" },
      },
      "maximum",
    ],
    [
      "enum",
      { name: "Alice", status: "OTHER", items: [1], nested: { code: "A" } },
      "enum",
    ],
    [
      "array",
      { name: "Alice", status: "ACTIVE", items: ["1"], nested: { code: "A" } },
      "type",
    ],
    [
      "nested object",
      { name: "Alice", status: "ACTIVE", items: [1], nested: {} },
      "required",
    ],
    [
      "additional property",
      {
        name: "Alice",
        status: "ACTIVE",
        items: [1],
        nested: { code: "A" },
        extra: true,
      },
      "additionalProperties",
    ],
  ])("rejects %s with a structured path", (_name, response, keyword) => {
    const result = validator.validate(schema, response);
    expect(result.valid).toBe(false);
    expect(result.errors.some((error) => error.keyword === keyword)).toBe(true);
    expect(result.errors.every((error) => error.path.length > 0)).toBe(true);
  });
});
