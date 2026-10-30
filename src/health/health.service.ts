import { Injectable } from "@nestjs/common";
import Redis from "ioredis";
import { PrismaService } from "../infrastructure/prisma/prisma.service";

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async check(): Promise<{
    status: "ok";
    database: "up";
    redis: "up";
    timestamp: string;
  }> {
    await this.prisma.$queryRaw`SELECT 1`;
    const redis = new Redis(process.env.REDIS_URL ?? "redis://localhost:6379", {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
    try {
      await redis.connect();
      await redis.ping();
    } finally {
      await redis.quit();
    }

    return {
      status: "ok",
      database: "up",
      redis: "up",
      timestamp: new Date().toISOString(),
    };
  }
}
