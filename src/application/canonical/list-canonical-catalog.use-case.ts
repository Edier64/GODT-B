import { Inject, Injectable } from "@nestjs/common";
import {
  CanonicalFieldDefinition,
  HOMOLOGATED_CANONICAL_FIELDS,
} from "../../domain/canonical/canonical-dictionary";
import {
  CANONICAL_DICTIONARY_REPOSITORY,
  CanonicalDictionaryRepository,
} from "./canonical-dictionary.repository";

@Injectable()
export class ListCanonicalCatalogUseCase {
  constructor(
    @Inject(CANONICAL_DICTIONARY_REPOSITORY)
    private readonly repository: CanonicalDictionaryRepository,
  ) {}

  async execute(): Promise<CanonicalFieldDefinition[]> {
    const list = await this.repository.listCatalog();
    if (!list.length) {
      // Si la base de datos no ha sido sembrada, sembrar el catálogo homologado
      await this.repository.seedDefaultCatalog();
      return this.repository.listCatalog();
    }
    return list;
  }
}

