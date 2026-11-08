import { Test, TestingModule } from "@nestjs/testing";
import { AppModule } from "../src/app.module";
import { IntakeDonorFromClinicalHistoryUseCase } from "../src/application/processes/intake-donor-from-clinical-history.use-case";
import { StartOcrUseCase } from "../src/application/ocr/start-ocr.use-case";
import { OcrWorkflowUseCase } from "../src/application/ocr/ocr-workflow.use-case";
import { CanonicalPropagationEngine } from "../src/application/canonical/canonical-propagation.engine";
import { DonationProcessController } from "../src/presentation/processes/donation-process.controller";
import { OcrController } from "../src/presentation/ocr/ocr.controller";

describe("NestJS DI and Circular Module Resolution Verification", () => {
  let moduleRef: TestingModule;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
  });

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  it("resuelve e inicializa correctamente DonationProcessModule y OcrModule sin UndefinedModuleException", () => {
    expect(moduleRef).toBeDefined();
  });

  it("inyecta correctamente IntakeDonorFromClinicalHistoryUseCase con sus dependencias", () => {
    const intakeUseCase = moduleRef.get(IntakeDonorFromClinicalHistoryUseCase);
    expect(intakeUseCase).toBeDefined();
    expect(typeof intakeUseCase.execute).toBe("function");
  });

  it("inyecta correctamente StartOcrUseCase con sus dependencias de OCR", () => {
    const startOcrUseCase = moduleRef.get(StartOcrUseCase);
    expect(startOcrUseCase).toBeDefined();
    expect(typeof startOcrUseCase.execute).toBe("function");
  });

  it("inyecta correctamente OcrWorkflowUseCase y CanonicalPropagationEngine", () => {
    const ocrWorkflowUseCase = moduleRef.get(OcrWorkflowUseCase);
    expect(ocrWorkflowUseCase).toBeDefined();
    expect(typeof ocrWorkflowUseCase.validate).toBe("function");

    const propagationEngine = moduleRef.get(CanonicalPropagationEngine);
    expect(propagationEngine).toBeDefined();
    expect(typeof propagationEngine.applyAndPropagate).toBe("function");
  });

  it("inyecta correctamente los controladores DonationProcessController y OcrController", () => {
    const processController = moduleRef.get(DonationProcessController);
    expect(processController).toBeDefined();

    const ocrController = moduleRef.get(OcrController);
    expect(ocrController).toBeDefined();
  });
});

