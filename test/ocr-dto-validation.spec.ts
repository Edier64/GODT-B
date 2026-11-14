import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { BatchPropagateOcrFieldsDto } from "../src/presentation/ocr/ocr.dto";

describe("BatchPropagateOcrFieldsDto validation", () => {
  it("rejects a batch that is not an array or is empty", async () => {
    const nonArray = plainToInstance(BatchPropagateOcrFieldsDto, {
      items: "not-an-array",
    });
    const emptyArray = plainToInstance(BatchPropagateOcrFieldsDto, {
      items: [],
    });

    const nonArrayErrors = await validate(nonArray);
    const emptyArrayErrors = await validate(emptyArray);

    expect(nonArrayErrors.some((error) => error.property === "items")).toBe(true);
    expect(emptyArrayErrors.some((error) => error.property === "items")).toBe(true);
  });

  it("validates every item as a nested DTO", async () => {
    const dto = plainToInstance(BatchPropagateOcrFieldsDto, {
      items: [
        {
          fieldId: 42,
          status: "NOT_A_VALID_DECISION",
        },
      ],
    });

    const errors = await validate(dto);
    const itemsError = errors.find((error) => error.property === "items");

    expect(itemsError).toBeDefined();
    expect(itemsError?.children?.length).toBeGreaterThan(0);
  });

  it("accepts a batch with valid OCR fields", async () => {
    const dto = plainToInstance(BatchPropagateOcrFieldsDto, {
      items: [
        {
          fieldId: "field-1",
          status: "CONFIRMADO",
        },
        {
          fieldId: "field-2",
          status: "MODIFICADO",
          confirmedValue: "7.35",
        },
      ],
    });

    await expect(validate(dto)).resolves.toHaveLength(0);
  });
});
