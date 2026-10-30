import { Test } from "@nestjs/testing";
import { HealthService } from "../src/health/health.service";
import { PrismaService } from "../src/infrastructure/prisma/prisma.service";

jest.mock("ioredis", () => ({
  __esModule: true,
  default: class MockRedis {
    async connect() {}
    async ping() {
      return "PONG";
    }
    async quit() {
      return "OK";
    }
  },
}));

describe("HealthService", () => {
  it("reports healthy dependencies", async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ "?column?": 1 }]),
    };
    const module = await Test.createTestingModule({
      providers: [HealthService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    const service = module.get(HealthService);
    const result = await service.check();

    expect(result.status).toBe("ok");
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });
});
