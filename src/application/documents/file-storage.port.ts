export interface StoredFile {
  storageKey: string;
  sha256Hash: string;
}

export interface FileStoragePort {
  put(input: {
    buffer: Buffer;
    originalFilename: string;
    mimeType: string;
  }): Promise<StoredFile>;
  get(storageKey: string): Promise<Buffer>;
  remove(storageKey: string): Promise<void>;
}

export const FILE_STORAGE_PORT = Symbol("FILE_STORAGE_PORT");
