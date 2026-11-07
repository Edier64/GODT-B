import { Injectable } from "@nestjs/common";
import Redis from "ioredis";
import * as fs from "fs";
import * as path from "path";
import { PrismaService } from "../infrastructure/prisma/prisma.service";

export interface HealthCheckResponse {
  status: "ok" | "degraded" | "error";
  database: "up" | "down";
  redis: "up" | "down";
  storage: "up" | "down";
  environment: string;
  version: string;
  timestamp: string;
}

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<HealthCheckResponse> {
    const environment = process.env.NODE_ENV || "development";
    let databaseStatus: "up" | "down" = "down";
    let redisStatus: "up" | "down" = "down";
    let storageStatus: "up" | "down" = "down";

    // 1. Verificación PostgreSQL
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      databaseStatus = "up";
    } catch {
      databaseStatus = "down";
    }

    // 2. Verificación Redis
    const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      connectTimeout: 1500,
    });
    try {
      await redis.connect();
      await redis.ping();
      redisStatus = "up";
    } catch {
      redisStatus = "down";
    } finally {
      try {
        await redis.quit();
      } catch {}
    }

    // 3. Verificación Almacenamiento Privado
    try {
      const storagePath = path.resolve(process.env.LOCAL_STORAGE_PATH || "storage/private");
      if (!fs.existsSync(storagePath)) {
        fs.mkdirSync(storagePath, { recursive: true });
      }
      fs.accessSync(storagePath, fs.constants.R_OK | fs.constants.W_OK);
      storageStatus = "up";
    } catch {
      storageStatus = "down";
    }

    const isAllUp = databaseStatus === "up" && redisStatus === "up" && storageStatus === "up";
    const isCriticalUp = databaseStatus === "up" && storageStatus === "up";

    return {
      status: isAllUp ? "ok" : isCriticalUp ? "degraded" : "error",
      database: databaseStatus,
      redis: redisStatus,
      storage: storageStatus,
      environment,
      version: "1.0.0-fase-f",
      timestamp: new Date().toISOString(),
    };
  }
}
