export interface StoredFile {
  storageKey: string;
  sha256Hash: string;
}

export interface FileStoragePort {
  put(input: {
    buffer: Buffer;
    originalFilename: string;
    mimeType: string;
    processId?: string;
    sourceDocumentId?: string;
    subDirectory?: "original" | "extracted" | "pages" | string;
  }): Promise<StoredFile>;
  get(storageKey: string): Promise<Buffer>;
  remove(storageKey: string): Promise<void>;
  exists?(storageKey: string): Promise<boolean>;
}

export const FILE_STORAGE_PORT = Symbol("FILE_STORAGE_PORT");
