import { EvaluateLegalizationUseCase } from "../src/application/legalization/evaluate-legalization.use-case";
import {
  LegalizationPolicy,
  LegalizationRequirementsError,
} from "../src/domain/legalization/legalization";

const representatives = [
  {
    fullName: "Representative 1",
    documentType: "CC",
    documentNumber: "1",
    relationshipToDonor: "Parent",
  },
  {
    fullName: "Representative 2",
    documentType: "CC",
    documentNumber: "2",
    relationshipToDonor: "Parent",
  },
];

describe("LegalizationPolicy", () => {
  it("accepts Anexo 2 only with the documented baseline facts", () => {
    expect(() =>
      new LegalizationPolicy().evaluate({
        mechanism: "PRESUNCION_LEGAL",
        isAdult: true,
        isColombian: true,
        isResident: true,
        oppositionRegistered: false,
        representatives: [],
      }),
    ).not.toThrow();
  });

  it("rejects Anexo 3 with fewer than two representatives", () => {
    expect(() =>
      new LegalizationPolicy().evaluate({
        mechanism: "CONSENTIMIENTO_FAMILIAR",
        isAdult: false,
        isColombian: true,
        isResident: true,
        oppositionRegistered: false,
        representatives: [representatives[0]],
      }),
    ).toThrow("at least two representatives");
  });

  it("rejects incomplete legal facts", () => {
    expect(() =>
      new LegalizationPolicy().evaluate({
        mechanism: "PRESUNCION_LEGAL",
        isAdult: null,
        isColombian: true,
        isResident: true,
        oppositionRegistered: false,
        representatives: [],
      }),
    ).toThrow(LegalizationRequirementsError);
  });

  it("creates an Anexo 3 legalization with two representatives", async () => {
    const repository = {
      createWithRepresentatives: jest.fn().mockResolvedValue({
        id: "legalization-1",
        donorId: "donor-1",
      }),
    };
    const useCase = new EvaluateLegalizationUseCase(repository);

    await expect(
      useCase.execute("donor-1", "officer-1", {
        mechanism: "CONSENTIMIENTO_FAMILIAR",
        isAdult: false,
        isColombian: true,
        isResident: true,
        oppositionRegistered: false,
        representatives,
      }),
    ).resolves.toEqual({ id: "legalization-1", donorId: "donor-1" });
    expect(repository.createWithRepresentatives).toHaveBeenCalledWith(
      "donor-1",
      "officer-1",
      expect.objectContaining({ mechanism: "CONSENTIMIENTO_FAMILIAR" }),
      expect.objectContaining({ action: "DONATION_LEGALIZATION_CREATED" }),
    );
  });
});
