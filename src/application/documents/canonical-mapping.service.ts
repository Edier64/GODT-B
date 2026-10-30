import { Injectable } from "@nestjs/common";

export interface CanonicalMapping {
  targetKey: string;
  sourcePath: string;
  required?: boolean;
}

export interface MappedCanonicalValue {
  targetKey: string;
  value: unknown;
  sourcePath: string;
}

@Injectable()
export class CanonicalMappingService {
  map(
    source: Record<string, unknown>,
    mappings: CanonicalMapping[],
  ): { values: MappedCanonicalValue[]; missingRequired: string[] } {
    const values: MappedCanonicalValue[] = [];
    const missingRequired: string[] = [];
    for (const mapping of mappings) {
      const value = mapping.sourcePath
        .split(".")
        .reduce<unknown>((current, key) => {
          if (typeof current !== "object" || current === null) {
            return undefined;
          }
          return (current as Record<string, unknown>)[key];
        }, source);
      if (value === undefined || value === null || value === "") {
        if (mapping.required) {
          missingRequired.push(mapping.targetKey);
        }
        continue;
      }
      values.push({
        targetKey: mapping.targetKey,
        value,
        sourcePath: mapping.sourcePath,
      });
    }
    return { values, missingRequired };
  }
}
