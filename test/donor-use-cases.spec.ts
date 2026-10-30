import { CreateDonorUseCase } from "../src/application/donors/create-donor.use-case";
import { GetDonorUseCase } from "../src/application/donors/get-donor.use-case";
import { DonorRecordRepository } from "../src/application/donors/donor-record.repository";
import { DonorRecord } from "../src/domain/donors/donor-record";

const donor: DonorRecord = {
  id: "donor-1",
  rndCode: "RND-1",
  status: "EN_VALORACION",
  originatingIpsName: "IPS",
  clinicalService: "UCI",
  fullName: "Synthetic donor",
  documentNumber: "DOC-1",
  anthropometry: null,
  bloodGroup: null,
  rhFactor: null,
  clinicalData: null,
  createdById: "owner-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("Donor use cases", () => {
  it("audits a donor creation", async () => {
    const repository: DonorRecordRepository = {
      create: jest.fn().mockResolvedValue(donor),
      findById: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateWithAudit: jest.fn(),
    };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const useCase = new CreateDonorUseCase(repository, audit);

    await useCase.execute(
      {
        rndCode: " RND-1 ",
        originatingIpsName: " IPS ",
        clinicalService: " UCI ",
        fullName: "Synthetic donor",
        documentNumber: "DOC-1",
      },
      "owner-1",
    );

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: "DONOR_CREATED", entityId: "donor-1" }),
    );
  });

  it("denies a non-owner access", async () => {
    const repository: DonorRecordRepository = {
      create: jest.fn(),
      findById: jest.fn().mockResolvedValue(donor),
      findMany: jest.fn(),
      update: jest.fn(),
      updateWithAudit: jest.fn(),
    };
    const useCase = new GetDonorUseCase(repository);

    await expect(
      useCase.execute("donor-1", { userId: "other", role: "SURGEON" }),
    ).rejects.toThrow("cannot access");
  });
});
