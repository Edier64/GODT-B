import { Injectable } from "@nestjs/common";
import { DocumentEngineValidationError } from "./document-engine.errors";

const SOURCE_KINDS = new Set([
  "MANUAL",
  "DONOR_RECORD",
  "SOURCE_DOCUMENT",
  "OCR_CONFIRMED",
  "OCR_MODIFIED",
  "CALCULATED",
]);
const ALLOWED_RULE_KEYS = new Set([
  "all",
  "any",
  "not",
  "field",
  "equals",
  "in",
]);

@Injectable()
export class DocumentDefinitionValidator {
  validate(
    jsonSchema: unknown,
    uiSchema: unknown,
    mappingConfig: unknown,
    dependencyConfig?: unknown,
  ): void {
    this.validateSchema(jsonSchema);
    this.validateUiSchema(uiSchema);
    this.validateMappings(mappingConfig);
    if (dependencyConfig !== undefined) this.validateRules(dependencyConfig);
  }

  private validateSchema(value: unknown): void {
    if (!this.isRecord(value) || value.type !== "object") {
      throw new DocumentEngineValidationError(
        "jsonSchema must be an object schema",
      );
    }
    if (value.properties !== undefined && !this.isRecord(value.properties)) {
      throw new DocumentEngineValidationError(
        "jsonSchema.properties must be an object",
      );
    }
    this.validateSchemaNode(value, "$");
  }

  private validateSchemaNode(
    value: Record<string, unknown>,
    path: string,
  ): void {
    const allowedTypes = new Set([
      "object",
      "array",
      "string",
      "number",
      "integer",
      "boolean",
    ]);
    if (value.type !== undefined && typeof value.type !== "string") {
      throw new DocumentEngineValidationError(`${path}.type is invalid`);
    }
    if (typeof value.type === "string" && !allowedTypes.has(value.type)) {
      throw new DocumentEngineValidationError(`${path}.type is unsupported`);
    }
    if (value.properties !== undefined) {
      if (!this.isRecord(value.properties)) {
        throw new DocumentEngineValidationError(
          `${path}.properties is invalid`,
        );
      }
      for (const [key, child] of Object.entries(value.properties)) {
        if (!/^[A-Za-z][A-Za-z0-9_.-]*$/.test(key) || !this.isRecord(child)) {
          throw new DocumentEngineValidationError(
            `${path}.properties contains an invalid field`,
          );
        }
        this.validateSchemaNode(child, `${path}.properties.${key}`);
      }
    }
    if (value.items !== undefined) {
      if (!this.isRecord(value.items)) {
        throw new DocumentEngineValidationError(`${path}.items is invalid`);
      }
      this.validateSchemaNode(value.items, `${path}.items`);
    }
    if (value.required !== undefined) {
      if (
        !Array.isArray(value.required) ||
        !value.required.every((item) => typeof item === "string")
      ) {
        throw new DocumentEngineValidationError(`${path}.required is invalid`);
      }
    }
  }

  private validateUiSchema(value: unknown): void {
    if (!this.isRecord(value) || !Array.isArray(value.sections)) {
      throw new DocumentEngineValidationError(
        "uiSchema.sections must be an array",
      );
    }
    for (const section of value.sections) {
      if (!this.isRecord(section) || typeof section.id !== "string") {
        throw new DocumentEngineValidationError(
          "Each UI section requires an id",
        );
      }
      if (section.fields !== undefined && !Array.isArray(section.fields)) {
        throw new DocumentEngineValidationError(
          "UI section fields must be an array",
        );
      }
    }
  }

  private validateMappings(value: unknown): void {
    if (!Array.isArray(value)) {
      throw new DocumentEngineValidationError("mappingConfig must be an array");
    }
    for (const mapping of value) {
      if (
        !this.isRecord(mapping) ||
        typeof mapping.targetKey !== "string" ||
        typeof mapping.sourcePath !== "string"
      ) {
        throw new DocumentEngineValidationError(
          "Each mapping requires targetKey and sourcePath",
        );
      }
      if (
        mapping.sourceKind !== undefined &&
        (typeof mapping.sourceKind !== "string" ||
          !SOURCE_KINDS.has(mapping.sourceKind))
      ) {
        throw new DocumentEngineValidationError(
          "Mapping sourceKind is not supported",
        );
      }
    }
  }

  private validateRules(value: unknown): void {
    if (!this.isRecord(value) && !Array.isArray(value)) {
      throw new DocumentEngineValidationError("dependencyConfig is invalid");
    }
    this.walkRules(value);
  }

  private walkRules(value: unknown, depth = 0): void {
    if (depth > 8) {
      throw new DocumentEngineValidationError("Declarative rule is too deep");
    }
    if (Array.isArray(value)) {
      value.forEach((item) => this.walkRules(item, depth + 1));
      return;
    }
    if (!this.isRecord(value)) return;
    for (const [key, child] of Object.entries(value)) {
      if (!ALLOWED_RULE_KEYS.has(key)) {
        throw new DocumentEngineValidationError(
          `Declarative rule key '${key}' is not allowed`,
        );
      }
      this.walkRules(child, depth + 1);
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
