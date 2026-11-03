import { Injectable } from "@nestjs/common";
import { DocumentEngineValidationError } from "./document-engine.errors";
import { CANONICAL_MAPPING_CATALOG } from "./canonical-mapping-catalog";

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
    this.validateUiSchema(uiSchema, jsonSchema);
    this.validateMappings(mappingConfig);
    if (dependencyConfig !== undefined && dependencyConfig !== null) {
      this.validateDependencyConfig(dependencyConfig, jsonSchema);
    }
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
      "null",
    ]);
    const types =
      typeof value.type === "string"
        ? [value.type]
        : Array.isArray(value.type)
          ? value.type
          : [];
    if (
      value.type !== undefined &&
      (!types.length ||
        types.some(
          (type) => typeof type !== "string" || !allowedTypes.has(type),
        ) ||
        new Set(types).size !== types.length)
    ) {
      throw new DocumentEngineValidationError(`${path}.type is invalid`);
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
        !value.required.every(
          (item) =>
            typeof item === "string" &&
            this.isRecord(value.properties) &&
            Object.prototype.hasOwnProperty.call(value.properties, item),
        )
      ) {
        throw new DocumentEngineValidationError(`${path}.required is invalid`);
      }
    }
    for (const key of ["oneOf", "anyOf"] as const) {
      if (value[key] !== undefined) {
        if (
          !Array.isArray(value[key]) ||
          !value[key].every((item) => this.isRecord(item))
        ) {
          throw new DocumentEngineValidationError(`${path}.${key} is invalid`);
        }
        for (const [index, alternative] of value[key].entries()) {
          this.validateSchemaNode(
            alternative as Record<string, unknown>,
            `${path}.${key}[${index}]`,
          );
        }
      }
    }
  }

  private validateUiSchema(
    value: unknown,
    jsonSchema: unknown,
  ): void {
    if (!this.isRecord(value) || !Array.isArray(value.sections)) {
      throw new DocumentEngineValidationError(
        "uiSchema.sections must be an array",
      );
    }
    const rootProperties = this.rootProperties(jsonSchema);
    const sectionIds = new Set<string>();
    for (const section of value.sections) {
      if (!this.isRecord(section) || typeof section.id !== "string") {
        throw new DocumentEngineValidationError(
          "Each UI section requires an id",
        );
      }
      if (sectionIds.has(section.id)) {
        throw new DocumentEngineValidationError(
          `UI section '${section.id}' is duplicated`,
        );
      }
      sectionIds.add(section.id);
      if (section.fields !== undefined && !Array.isArray(section.fields)) {
        throw new DocumentEngineValidationError(
          "UI section fields must be an array",
        );
      }
      if (
        Array.isArray(section.fields) &&
        section.fields.some(
          (field) =>
            typeof field !== "string" || !rootProperties.has(field),
        )
      ) {
        throw new DocumentEngineValidationError(
          `UI section '${section.id}' references an unknown field`,
        );
      }
    }
    if (value.fieldConfigs !== undefined) {
      if (!this.isRecord(value.fieldConfigs)) {
        throw new DocumentEngineValidationError(
          "uiSchema.fieldConfigs must be an object",
        );
      }
      for (const [path, config] of Object.entries(value.fieldConfigs)) {
        if (
          !this.isRecord(config) ||
          !this.isRootOrNestedProperty(path, jsonSchema)
        ) {
          throw new DocumentEngineValidationError(
            `UI field configuration '${path}' is invalid`,
          );
        }
      }
    }
  }

  private rootProperties(value: unknown): Set<string> {
    if (!this.isRecord(value) || !this.isRecord(value.properties)) {
      return new Set();
    }
    return new Set(Object.keys(value.properties));
  }

  private isRootOrNestedProperty(path: string, schema: unknown): boolean {
    if (!this.isRecord(schema) || !path.startsWith("$.")) return false;
    const segments = path
      .slice(2)
      .split(".")
      .filter((segment) => segment.length > 0);
    if (!segments.length) {
      return false;
    }
    let current: Record<string, unknown> | undefined = schema;
    for (const rawSegment of segments) {
      const isArray = rawSegment.endsWith("[]");
      const segment = isArray ? rawSegment.slice(0, -2) : rawSegment;
      if (!/^[A-Za-z][A-Za-z0-9_.-]*$/.test(segment)) return false;
      if (!this.isRecord(current?.properties) || !this.isRecord(current.properties[segment])) {
        return false;
      }
      current = current.properties[segment];
      if (isArray) {
        if (!this.isRecord(current?.items)) return false;
        current = current.items;
      }
    }
    return true;
  }

  private validateMappings(value: unknown): void {
    if (!Array.isArray(value)) {
      throw new DocumentEngineValidationError("mappingConfig must be an array");
    }
    for (const mapping of value) {
      if (
        !this.isRecord(mapping) ||
        typeof mapping.targetKey !== "string" ||
        typeof mapping.sourcePath !== "string" ||
        typeof mapping.sourceKind !== "string" ||
        typeof mapping.dataType !== "string"
      ) {
        throw new DocumentEngineValidationError(
          "Each mapping requires targetKey and sourcePath",
        );
      }
      const definition = CANONICAL_MAPPING_CATALOG[mapping.targetKey];
      if (!definition) {
        throw new DocumentEngineValidationError(
          "Mapping targetKey is not in the canonical catalog",
        );
      }
      if (
        !SOURCE_KINDS.has(mapping.sourceKind) ||
        mapping.sourcePath !== definition.sourcePath ||
        mapping.sourceKind !== definition.sourceKind ||
        mapping.dataType !== definition.dataType ||
        mapping.writable !== false
      ) {
        throw new DocumentEngineValidationError(
          "Mapping is incompatible with the canonical catalog",
        );
      }
    }
  }

  private validateDependencyConfig(value: unknown, jsonSchema: unknown): void {
    if (!this.isRecord(value) || !this.isRecord(value.fields)) {
      throw new DocumentEngineValidationError(
        "dependencyConfig.fields must be an object",
      );
    }
    for (const [path, config] of Object.entries(value.fields)) {
      if (!this.isRootOrNestedProperty(path, jsonSchema) || !this.isRecord(config)) {
        throw new DocumentEngineValidationError(
          `Dependency target '${path}' is invalid`,
        );
      }
      for (const [key, rule] of Object.entries(config)) {
        if (key !== "visibleWhen" && key !== "enabledWhen") {
          throw new DocumentEngineValidationError(
            `Dependency action '${key}' is not allowed`,
          );
        }
        this.validateRule(rule, jsonSchema);
      }
    }
  }

  private validateRule(value: unknown, jsonSchema: unknown, depth = 0): void {
    if (depth > 8) {
      throw new DocumentEngineValidationError("Declarative rule is too deep");
    }
    if (!this.isRecord(value)) {
      throw new DocumentEngineValidationError("Declarative rule is invalid");
    }
    const keys = Object.keys(value);
    if (keys.length !== 1 && !(keys.length === 2 && keys.includes("field"))) {
      throw new DocumentEngineValidationError(
        "Declarative rule must contain one operator",
      );
    }
    for (const [key, child] of Object.entries(value)) {
      if (!ALLOWED_RULE_KEYS.has(key)) {
        throw new DocumentEngineValidationError(
          `Declarative rule key '${key}' is not allowed`,
        );
      }
      if (key === "field") {
        if (
          typeof child !== "string" ||
          !this.isRootOrNestedProperty(child, jsonSchema)
        ) {
          throw new DocumentEngineValidationError(
            "Declarative field reference is invalid",
          );
        }
      } else if (key === "equals") {
        continue;
      } else if (key === "in") {
        if (!Array.isArray(child)) {
          throw new DocumentEngineValidationError(
            "Declarative 'in' operator requires an array",
          );
        }
      } else if (key === "all" || key === "any") {
        if (
          !Array.isArray(child) ||
          !child.length ||
          child.some((item) => !this.isRecord(item))
        ) {
          throw new DocumentEngineValidationError(
            `Declarative '${key}' operator requires rules`,
          );
        }
        child.forEach((item) => this.validateRule(item, jsonSchema, depth + 1));
      } else if (key === "not") {
        this.validateRule(child, jsonSchema, depth + 1);
      }
    }
  }

  private isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
  }
}
