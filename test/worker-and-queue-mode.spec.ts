import { ConfigService } from "@nestjs/config";
import {
  areQueueWorkersEnabled,
  buildRedisConnectionOptions,
  resolveAppMode,
} from "../src/infrastructure/runtime/app-mode";
import {
  buildPostgresQueueConnectionOptions,
  resolveBullmqBackend,
  resolveBullmqPgSchema,
} from "../src/infrastructure/runtime/bullmq-backend";
import { OcrWorker } from "../src/infrastructure/ocr/ocr-worker";
import { BullmqDossierQueueService } from "../src/infrastructure/dossier/bullmq-dossier-queue.service";

const mockWorkerConstructor = jest.fn().mockImplementation(() => ({
  on: jest.fn(),
  waitUntilReady: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
}));
const mockQueueConstructor = jest.fn().mockImplementation(() => ({
  on: jest.fn(),
  add: jest.fn().mockResolvedValue(undefined),
  waitUntilReady: jest.fn().mockResolvedValue(undefined),
  close: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("bullmq", () => ({
  Queue: function Queue(...args: unknown[]) {
    return mockQueueConstructor(...args);
  },
  Worker: function Worker(...args: unknown[]) {
    return mockWorkerConstructor(...args);
  },
  createPostgresBackend: jest.fn(),
  runMigrations: jest.fn().mockResolvedValue(5),
  withBackend: jest.fn(() => ({
    Queue: function PgQueue(...args: unknown[]) {
      return mockQueueConstructor(...args);
    },
    Worker: function PgWorker(...args: unknown[]) {
      return mockWorkerConstructor(...args);
    },
  })),
}));

jest.mock("ioredis", () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    ping: jest.fn().mockResolvedValue("PONG"),
    disconnect: jest.fn(),
    quit: jest.fn().mockResolvedValue("OK"),
  })),
}));

describe("Runtime AppMode y prevención de consumidores duplicados", () => {
  beforeEach(() => {
    mockWorkerConstructor.mockClear();
    mockQueueConstructor.mockClear();
  });

  it("resuelve correctamente APP_MODE y areQueueWorkersEnabled", () => {
    expect(resolveAppMode(new ConfigService({ APP_MODE: "api" }))).toBe("api");
    expect(resolveAppMode(new ConfigService({ APP_MODE: "worker" }))).toBe("worker");
    expect(resolveAppMode(new ConfigService({ APP_MODE: "migrate" }))).toBe("migrate");
    expect(resolveAppMode(new ConfigService({}))).toBe("all");

    expect(areQueueWorkersEnabled(new ConfigService({ APP_MODE: "api" }))).toBe(false);
    expect(areQueueWorkersEnabled(new ConfigService({ APP_MODE: "migrate" }))).toBe(false);
    expect(areQueueWorkersEnabled(new ConfigService({ APP_MODE: "worker" }))).toBe(true);
    expect(areQueueWorkersEnabled(new ConfigService({}))).toBe(true);
    expect(
      areQueueWorkersEnabled(
        new ConfigService({ APP_MODE: "api", QUEUE_WORKERS_ENABLED: "true" }),
      ),
    ).toBe(true);
  });

  it("construye opciones Redis soportando TLS (rediss://)", () => {
    expect(buildRedisConnectionOptions("redis://:secret@redis:6379")).toEqual({
      host: "redis",
      port: 6379,
      username: undefined,
      password: "secret",
    });

    expect(buildRedisConnectionOptions("rediss://user:pass@mycache.redis.cache.windows.net:6380")).toEqual({
      host: "mycache.redis.cache.windows.net",
      port: 6380,
      username: "user",
      password: "pass",
      tls: {},
    });
  });

  it("resuelve backend PostgreSQL para BullMQ por defecto con skipMigrations: true", () => {
    const pgConfig = new ConfigService({
      DATABASE_URL: "postgresql://godt:secret@postgres:5432/godt?schema=public",
      BULLMQ_PG_SCHEMA: "bullmq",
    });

    expect(resolveBullmqBackend(pgConfig)).toBe("postgres");
    expect(resolveBullmqPgSchema(pgConfig)).toBe("bullmq");
    expect(buildPostgresQueueConnectionOptions(pgConfig)).toMatchObject({
      connectionString: "postgresql://godt:secret@postgres:5432/godt?schema=public",
      schema: "bullmq",
      skipMigrations: true,
    });
  });

  it("en APP_MODE=api NO registra Worker BullMQ en OcrWorker ni en BullmqDossierQueueService", async () => {
    const apiConfig = new ConfigService({
      NODE_ENV: "production",
      APP_MODE: "api",
      BULLMQ_BACKEND: "postgres",
      DATABASE_URL: "postgresql://godt:secret@postgres:5432/godt",
    });
    const fakePrisma = {
      processDossierExport: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const ocrWorker = new OcrWorker(
      apiConfig,
      fakePrisma as never,
      {} as never,
      {} as never,
      { listQueuedJobs: jest.fn().mockResolvedValue([]) } as never,
      { add: jest.fn() } as never,
    );
    ocrWorker.onModuleInit();

    const dossierQueue = new BullmqDossierQueueService(
      apiConfig,
      {} as never,
      fakePrisma as never,
    );
    await dossierQueue.onModuleInit();

    expect(mockQueueConstructor).toHaveBeenCalledTimes(1); // Queue productor activo
    expect(mockWorkerConstructor).not.toHaveBeenCalled();  // Ningún consumidor en API

    await ocrWorker.onModuleDestroy();
    await dossierQueue.onModuleDestroy();
  });

  it("en APP_MODE=worker SÍ registra consumidores BullMQ en OcrWorker y BullmqDossierQueueService", async () => {
    const workerConfig = new ConfigService({
      NODE_ENV: "production",
      APP_MODE: "worker",
      BULLMQ_BACKEND: "postgres",
      DATABASE_URL: "postgresql://godt:secret@postgres:5432/godt",
    });
    const fakePrisma = {
      processDossierExport: { findMany: jest.fn().mockResolvedValue([]) },
    };

    const ocrWorker = new OcrWorker(
      workerConfig,
      fakePrisma as never,
      {} as never,
      {} as never,
      { listQueuedJobs: jest.fn().mockResolvedValue([]) } as never,
      { add: jest.fn() } as never,
    );
    ocrWorker.onModuleInit();

    const dossierQueue = new BullmqDossierQueueService(
      workerConfig,
      {} as never,
      fakePrisma as never,
    );
    await dossierQueue.onModuleInit();

    expect(mockWorkerConstructor).toHaveBeenCalledTimes(2); // OCR + Dossier workers

    await ocrWorker.onModuleDestroy();
    await dossierQueue.onModuleDestroy();
  });
});

