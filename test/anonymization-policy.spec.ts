import { AnonymizationPolicy } from "../src/application/privacy/anonymization-policy";

describe("AnonymizationPolicy", () => {
  it("keeps only approved clinical fields", () => {
    const result = new AnonymizationPolicy().apply({
      rndCode: "RND-1",
      status: "ACTIVO",
      clinicalService: "UCI",
      bloodGroup: "O",
      rhFactor: "+",
      anthropometry: { weight: 80, fullName: "Civil no permitido" },
      clinicalData: {
        arterialPh: 7.3,
        document_number: "123",
        nested: { phone: "555" },
      },
    });

    expect(result).toEqual({
      rndCode: "RND-1",
      status: "ACTIVO",
      clinicalService: "UCI",
      bloodGroup: "O",
      rhFactor: "+",
      anthropometry: { weight: 80 },
      clinicalData: { arterialPh: 7.3, nested: {} },
    });
    expect(JSON.stringify(result)).not.toContain("123");
    expect(JSON.stringify(result)).not.toContain("Civil no permitido");
  });
});
