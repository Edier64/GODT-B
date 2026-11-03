import { OcrWorkflowUseCase } from "../src/application/ocr/ocr-workflow.use-case";

describe("OCR job status contract", () => {
  it("returns the persisted status and error code with fields", async () => {
    const repository = {
      findJob: jest.fn().mockResolvedValue({
        id: "job-1",
        sourceDocumentId: "document-1",
        status: "COMPLETADO",
        errorCode: null,
      }),
      listFields: jest.fn().mockResolvedValue([{ id: "field-1" }]),
    };
    const prisma = {
      sourceDocument: {
        findUnique: jest.fn().mockResolvedValue({
          donor: { originatingIpsName: "IPS-1" },
        }),
      },
    };
    const useCase = new OcrWorkflowUseCase(
      repository as never,
      prisma as never,
    );

    await expect(
      useCase.getJob("job-1", {
        userId: "user-1",
        role: "TECHNICIAN",
        institutionalIps: ["IPS-1"],
      }),
    ).resolves.toEqual({
      jobId: "job-1",
      sourceDocumentId: "document-1",
      status: "COMPLETADO",
      errorCode: null,
      fields: [{ id: "field-1" }],
    });
  });
});
