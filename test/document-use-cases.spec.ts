import { UploadSourceDocumentUseCase } from "../src/application/documents/upload-source-document.use-case";
import { DocumentAccessDeniedError } from "../src/application/documents/document-errors";
import { Logger } from "@nestjs/common";

describe("UploadSourceDocumentUseCase", () => {
  const actor = {
    userId: "user-1",
    role: "COORDINATOR" as const,
    institutionalIps: ["IPS-1"],
  };

  function createUseCase() {
    const repository = {
      create: jest.fn().mockResolvedValue({ id: "document-1" }),
      findByHash: jest.fn().mockResolvedValue(null),
    };
    const storage = {
      put: jest.fn().mockResolvedValue({
        storageKey: "document-1.pdf",
        sha256Hash: "a".repeat(64),
      }),
      remove: jest.fn(),
    };
    const prisma = {
      donorRecord: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ originatingIpsName: "IPS-1" }),
      },
    };
    return {
      useCase: new UploadSourceDocumentUseCase(
        repository as never,
        storage as never,
        prisma as never,
      ),
      repository,
      storage,
    };
  }

  it("accepts a signed PDF and persists only its storage reference", async () => {
    const { useCase, repository, storage } = createUseCase();
    const result = await useCase.execute({
      donorId: "donor-1",
      uploadedById: actor.userId,
      originalFilename: "synthetic.pdf",
      declaredMimeType: "application/pdf",
      buffer: Buffer.from("%PDF-1.7 synthetic"),
      documentCategory: "SYNTHETIC",
      actor,
    });

    expect(result).toEqual({ id: "document-1" });
    expect(storage.put).toHaveBeenCalled();
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        donorId: "donor-1",
        objectStorageKey: "document-1.pdf",
        sha256Hash: "a".repeat(64),
      }),
    );
  });

  it("rejects a MIME/signature mismatch before storage", async () => {
    const { useCase, storage } = createUseCase();

    await expect(
      useCase.execute({
        donorId: "donor-1",
        uploadedById: actor.userId,
        originalFilename: "synthetic.pdf",
        declaredMimeType: "application/pdf",
        buffer: Buffer.from("not a PDF"),
        documentCategory: "SYNTHETIC",
        actor,
      }),
    ).rejects.toThrow("signature");
    expect(storage.put).not.toHaveBeenCalled();
  });

  it("rejects access from another institutional scope", async () => {
    const { useCase } = createUseCase();

    await expect(
      useCase.execute({
        donorId: "donor-1",
        uploadedById: "user-2",
        originalFilename: "synthetic.pdf",
        declaredMimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.7 synthetic"),
        documentCategory: "SYNTHETIC",
        actor: { ...actor, institutionalIps: ["IPS-2"] },
      }),
    ).rejects.toThrow(DocumentAccessDeniedError);
  });

  it("keeps and logs an identifiable orphan candidate when database persistence fails", async () => {
    const { useCase, repository, storage } = createUseCase();
    const failure = new Error("database unavailable");
    repository.create.mockRejectedValue(failure);
    const logError = jest.spyOn(Logger.prototype, "error").mockImplementation();

    await expect(
      useCase.execute({
        donorId: "donor-1",
        uploadedById: actor.userId,
        originalFilename: "synthetic.pdf",
        declaredMimeType: "application/pdf",
        buffer: Buffer.from("%PDF-1.7 synthetic"),
        documentCategory: "SYNTHETIC",
        actor,
      }),
    ).rejects.toThrow(failure);

    expect(storage.remove).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith(
      expect.stringContaining('"event":"source_document_persistence_failed"'),
    );
    expect(logError).toHaveBeenCalledWith(expect.stringContaining('"storageKey":"document-1.pdf"'));
    logError.mockRestore();
  });
});
