import { GetDonorUseCase } from "../src/application/donors/get-donor.use-case";
import { UpdateDonorUseCase } from "../src/application/donors/update-donor.use-case";
import { DonorRecordRepository } from "../src/application/donors/donor-record.repository";
import { DonorRecord } from "../src/domain/donors/donor-record";

const donor: DonorRecord = {
  id: "donor-1",
  rndCode: "RND-1",
  status: "EN_VALORACION",
  originatingIpsName: "IPS-A",
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

function repository(): DonorRecordRepository {
  return {
    create: jest.fn(),
    findById: jest.fn().mockResolvedValue(donor),
    findMany: jest.fn(),
    update: jest.fn(),
    updateWithAudit: jest.fn().mockResolvedValue(donor),
  };
}

describe("Donor security scope", () => {
  it("denies a user from another institutional IPS", async () => {
    await expect(
      new GetDonorUseCase(repository()).execute("donor-1", {
        userId: "owner-1",
        role: "SURGEON",
        institutionalIps: ["IPS-B"],
      }),
    ).rejects.toThrow("cannot access");
  });

  it("requires institutional scope even when the user created the record", async () => {
    await expect(
      new GetDonorUseCase(repository()).execute("donor-1", {
        userId: "owner-1",
        role: "SURGEON",
      }),
    ).rejects.toThrow("cannot access");
  });

  it("uses the transactional repository operation for updates", async () => {
    const repo = repository();
    await new UpdateDonorUseCase(repo).execute(
      "donor-1",
      { clinicalService: "UCI-2" },
      { userId: "owner-1", role: "SURGEON", institutionalIps: ["IPS-A"] },
    );
    expect(repo.updateWithAudit).toHaveBeenCalledWith(
      "donor-1",
      { clinicalService: "UCI-2" },
      expect.objectContaining({ action: "DONOR_UPDATED" }),
    );
    expect(repo.update).not.toHaveBeenCalled();
  });
});
