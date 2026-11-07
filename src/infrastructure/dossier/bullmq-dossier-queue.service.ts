import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";
import { ProcessDossierExportService } from "../../application/dossier/process-dossier-export.service";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";

export interface DossierJobData {
  exportId: string;
  user: AuthenticatedUser;
}

@Injectable()
export class BullmqDossierQueueService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BullmqDossierQueueService.name);
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private redisConnection: Redis | null = null;
  private isRedisAvailable = false;

  constructor(
    private readonly config: ConfigService,
    private readonly processor: ProcessDossierExportService,
  ) {}

  async onModuleInit() {
    const redisUrl = this.config.get<string>("REDIS_URL", "redis://localhost:6379");
    try {
      this.redisConnection = new Redis(redisUrl, {
        maxRetriesPerRequest: 2,
        lazyConnect: true,
        connectTimeout: 2000,
      });

      await this.redisConnection.connect();
      await this.redisConnection.ping();
      this.isRedisAvailable = true;

      // Crear Queue y Worker de BullMQ
      this.queue = new Queue("dossier-exports", {
        connection: this.redisConnection,
      });

      this.worker = new Worker(
        "dossier-exports",
        async (job: Job<DossierJobData>) => {
          this.logger.log(`Procesando trabajo BullMQ: ${job.id} (Export ID: ${job.data.exportId})`);
          await this.processor.processExport(job.data.exportId, job.data.user);
        },
        {
          connection: this.redisConnection,
          concurrency: 2,
        },
      );

      this.worker.on("failed", (job, err) => {
        this.logger.error(`Trabajo BullMQ ${job?.id} falló: ${err?.message}`);
      });

      this.logger.log("BullMQ Dossier Queue & Worker inicializados exitosamente.");
    } catch (err: any) {
      this.logger.warn(`Redis no disponible para BullMQ (${err?.message}). Se activará procesamiento en segundo plano directo.`);
      this.isRedisAvailable = false;
      if (this.redisConnection) {
        try {
          this.redisConnection.disconnect();
        } catch {}
        this.redisConnection = null;
      }
    }
  }

  async onModuleDestroy() {
    if (this.worker) {
      await this.worker.close();
    }
    if (this.queue) {
      await this.queue.close();
    }
    if (this.redisConnection) {
      try {
        this.redisConnection.disconnect();
      } catch {}
    }
  }

  async enqueueExport(exportId: string, user: AuthenticatedUser): Promise<void> {
    if (this.isRedisAvailable && this.queue) {
      try {
        await this.queue.add(
          "generate-dossier",
          { exportId, user },
          {
            attempts: 3,
            backoff: { type: "exponential", delay: 2000 },
            removeOnComplete: true,
            removeOnFail: false,
          },
        );
        this.logger.log(`Exportación ${exportId} encolada en BullMQ.`);
        return;
      } catch (err: any) {
        this.logger.warn(`Error encolando en BullMQ (${err?.message}), procesando en segundo plano directo.`);
      }
    }

    // Fallback: procesamiento directo asíncrono en segundo plano
    setImmediate(async () => {
      try {
        await this.processor.processExport(exportId, user);
      } catch (err: any) {
        this.logger.error(`Error en procesamiento directo de exportación ${exportId}: ${err?.message}`);
      }
    });
  }
}
