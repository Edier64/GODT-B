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
  it("reports healthy dependencies in PostgreSQL BullMQ mode", async () => {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ "?column?": 1 }])
        .mockResolvedValueOnce([{ ready: true }]),
    };
    const module = await Test.createTestingModule({
      providers: [HealthService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    const service = module.get(HealthService);
    const result = await service.check();

    expect(result.status).toBe("ok");
    expect(result.database).toBe("up");
    expect(result.queue).toBe("up");
    expect(result.queueBackend).toBe("postgres");
    expect(result.redis).toBe("disabled");
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it("reports degraded when BullMQ PostgreSQL schema is not migrated", async () => {
    const prisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ "?column?": 1 }])
        .mockResolvedValueOnce([{ ready: false }]),
    };
    const module = await Test.createTestingModule({
      providers: [HealthService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    const service = module.get(HealthService);
    const result = await service.check();

    expect(result.status).toBe("degraded");
    expect(result.database).toBe("up");
    expect(result.queue).toBe("down");
  });
});
