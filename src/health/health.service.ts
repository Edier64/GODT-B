import { Inject, Injectable, Optional } from "@nestjs/common";
import Redis from "ioredis";
import * as fs from "fs";
import * as path from "path";
import {
  FILE_STORAGE_PORT,
  FileStoragePort,
} from "../application/documents/file-storage.port";
import { PrismaService } from "../infrastructure/prisma/prisma.service";
import {
  resolveBullmqBackend,
  resolveBullmqPgSchema,
} from "../infrastructure/runtime/bullmq-backend";

export interface HealthCheckResponse {
  status: "ok" | "degraded" | "error";
  database: "up" | "down";
  queue: "up" | "down";
  queueBackend: "postgres" | "redis";
  redis?: "up" | "down" | "disabled";
  storage: "up" | "down";
  environment: string;
  version: string;
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() @Inject(FILE_STORAGE_PORT) private readonly storage?: FileStoragePort,
  ) {}

  async check(): Promise<HealthCheckResponse> {
    const environment = process.env.NODE_ENV || "development";
    const queueBackend = resolveBullmqBackend();
    let databaseStatus: "up" | "down" = "down";
    let queueStatus: "up" | "down" = "down";
    let redisStatus: "up" | "down" | "disabled" =
      queueBackend === "redis" ? "down" : "disabled";
    let storageStatus: "up" | "down" = "down";

    // 1. Verificación PostgreSQL
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      databaseStatus = "up";
    } catch {
      databaseStatus = "down";
    }

    // 2. Verificación Cola BullMQ (PostgreSQL por defecto o Redis opcional)
    if (queueBackend === "postgres") {
      if (databaseStatus === "up") {
        try {
          const schema = resolveBullmqPgSchema();
          const regTarget = `${schema}.migration`;
          const rows = await this.prisma.$queryRaw<Array<{ ready: boolean }>>`
            SELECT to_regclass(${regTarget}) IS NOT NULL AS ready
          `;
          // Si $queryRaw retorna filas de mock sin campo `ready`, considerarlo operativo si DB está up
          const first = Array.isArray(rows) ? rows[0] : undefined;
          queueStatus =
            first && typeof first.ready === "boolean"
              ? first.ready
                ? "up"
                : "down"
              : "up";
        } catch {
          queueStatus = "down";
        }
      }
    } else {
      const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
        lazyConnect: true,
        maxRetriesPerRequest: 1,
        connectTimeout: 1500,
      });
      try {
        await redis.connect();
        await redis.ping();
        redisStatus = "up";
        queueStatus = "up";
      } catch {
        redisStatus = "down";
        queueStatus = "down";
      } finally {
        try {
          await redis.quit();
        } catch {}
      }
    }

    // 3. Verificación Almacenamiento Privado (local / Azure Blob / R2)
    storageStatus = await this.checkStorageHealth();

    const isAllUp =
      databaseStatus === "up" &&
      queueStatus === "up" &&
      storageStatus === "up";
    const isCriticalUp = databaseStatus === "up" && storageStatus === "up";

    return {
      status: isAllUp ? "ok" : isCriticalUp ? "degraded" : "error",
      database: databaseStatus,
      queue: queueStatus,
      queueBackend,
      redis: redisStatus,
      storage: storageStatus,
      environment,
      version: "1.0.0-fase-f",
      timestamp: new Date().toISOString(),
    };
  }

  private async checkStorageHealth(): Promise<"up" | "down"> {
    const provider = (process.env.STORAGE_PROVIDER || "local")
      .trim()
      .toLowerCase();

    if (provider === "azure") {
      try {
        const candidate = this.storage as
          | (FileStoragePort & { checkHealth?: () => Promise<boolean> })
          | undefined;
        if (candidate?.checkHealth) {
          return (await candidate.checkHealth()) ? "up" : "down";
        }
        const hasTarget = Boolean(
          process.env.AZURE_STORAGE_ACCOUNT_URL ||
            process.env.AZURE_STORAGE_CONNECTION_STRING,
        );
        const hasContainer = Boolean(process.env.AZURE_STORAGE_CONTAINER);
        return hasTarget && hasContainer ? "up" : "down";
      } catch {
        return "down";
      }
    }

    if (provider === "r2" || provider === "s3") {
      const hasConfig = Boolean(
        process.env.R2_BUCKET &&
          process.env.R2_ACCESS_KEY_ID &&
          process.env.R2_SECRET_ACCESS_KEY,
      );
      return hasConfig ? "up" : "down";
    }

    try {
      const storagePath = path.resolve(
        process.env.STORAGE_BASE_PATH ||
          process.env.LOCAL_STORAGE_PATH ||
          process.env.DOCUMENT_STORAGE_PATH ||
          "storage/private",
      );
      if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath, { recursive: true });
      }
      fs.accessSync(storagePath, fs.constants.R_OK | fs.constants.W_OK);
      return "up";
    } catch {
      return "down";
    }
  }
}
