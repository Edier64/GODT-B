import { mapTesseractTsv } from "../src/infrastructure/ocr/tesseract-ocr.adapter";

describe("Tesseract candidate mapping", () => {
  it("maps only explicitly configured labels and preserves confidence and page", () => {
    const tsv = [
      "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext",
      "5\t1\t1\t1\t1\t1\t10\t20\t40\t10\t90\tBlood",
      "5\t1\t1\t1\t1\t2\t55\t20\t30\t10\t80\tgroup:",
      "5\t1\t1\t1\t1\t3\t90\t20\t20\t10\t70\tO",
      "5\t1\t1\t1\t2\t1\t10\t40\t20\t10\t95\tOther",
    ].join("\n");

    expect(mapTesseractTsv(tsv, { bloodGroup: ["Blood group"] }, 2)).toEqual([
      expect.objectContaining({
        canonicalFieldKey: "bloodGroup",
        candidateValue: "O",
        pageNumber: 2,
        confidenceScore: 0.8,
      }),
    ]);
  });

  it("does not infer candidates for labels outside the configured dictionary", () => {
    const tsv = [
      "level\tpage_num\tblock_num\tpar_num\tline_num\tword_num\tleft\ttop\twidth\theight\tconf\ttext",
      "5\t1\t1\t1\t1\t1\t10\t20\t40\t10\t90\tClinical",
      "5\t1\t1\t1\t1\t2\t55\t20\t30\t10\t80\tservice:",
      "5\t1\t1\t1\t1\t3\t90\t20\t20\t10\t70\tUCI",
    ].join("\n");

    expect(mapTesseractTsv(tsv, { bloodGroup: ["Blood group"] })).toEqual([]);
  });
});
