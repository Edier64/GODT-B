import Ajv2020, { AnySchema, ErrorObject } from "ajv/dist/2020";
import addFormats from "ajv-formats";

export interface DocumentResponseValidationError {
  path: string;
  keyword: string;
  message: string;
  params: Record<string, unknown>;
}

export interface DocumentResponseValidationResult {
  valid: boolean;
  errors: DocumentResponseValidationError[];
}

export class DocumentResponseValidator {
  private readonly ajv: Ajv2020;

  constructor() {
    this.ajv = new Ajv2020({
      allErrors: true,
      strict: false,
      allowUnionTypes: true,
    });
    addFormats(this.ajv);
  }

  validate(
    schema: unknown,
    response: unknown,
  ): DocumentResponseValidationResult {
    const validator = this.ajv.compile(schema as AnySchema);
    const valid = validator(response);
    return {
      valid: Boolean(valid),
      errors: valid ? [] : this.mapErrors(validator.errors),
    };
  }

  private mapErrors(
    errors: ErrorObject[] | null | undefined,
  ): DocumentResponseValidationError[] {
    return (errors ?? []).map((error) => ({
      path: this.errorPath(error),
      keyword: error.keyword,
      message: error.message ?? "Value is invalid",
      params: error.params as Record<string, unknown>,
    }));
  }

  private errorPath(error: ErrorObject): string {
    const basePath = this.jsonPointerToPath(error.instancePath);
    if (
      error.keyword === "required" &&
      typeof error.params.missingProperty === "string"
    ) {
      return `${basePath}.${error.params.missingProperty}`;
    }
    if (
      (error.keyword === "additionalProperties" ||
        error.keyword === "propertyNames") &&
      typeof error.params.additionalProperty === "string"
    ) {
      return `${basePath}.${error.params.additionalProperty}`;
    }
    return basePath;
  }

  private jsonPointerToPath(pointer: string): string {
    if (!pointer) return "$";
    return pointer
      .split("/")
      .slice(1)
      .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"))
      .reduce(
        (path, segment) =>
          /^\d+$/.test(segment) ? `${path}[${segment}]` : `${path}.${segment}`,
        "$",
      );
  }
}
