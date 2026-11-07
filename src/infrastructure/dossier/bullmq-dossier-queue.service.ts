import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";
import { ProcessDossierExportService } from "../../application/dossier/process-dossier-export.service";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";
import { DossierQueueUnavailableError } from "../../domain/dossier/dossier.types";
import { PrismaService } from "../prisma/prisma.service";

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
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit() {
    const isProduction = this.config.get<string>("NODE_ENV") === "production";
    const redisUrl = this.config.get<string>("REDIS_URL", "redis://localhost:6379");

    try {
      this.redisConnection = new Redis(redisUrl, {
        maxRetriesPerRequest: isProduction ? 5 : 2,
        lazyConnect: true,
        connectTimeout: 2000,
      });

      await this.redisConnection.connect();
      await this.redisConnection.ping();
      this.isRedisAvailable = true;

      // Crear Queue y Worker de BullMQ con persistencia y concurrencia controlada
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
      this.isRedisAvailable = false;
      if (this.redisConnection) {
        try {
          this.redisConnection.disconnect();
        } catch {}
        this.redisConnection = null;
      }

      if (isProduction) {
        this.logger.error(
          `[CRITICAL] Redis no disponible en PRODUCCIÓN (${err?.message}). BullMQ no pudo iniciar.`,
        );
      } else {
        this.logger.warn(
          `[DEV/TEST ONLY] Redis no disponible para BullMQ (${err?.message}). Se activará procesamiento en segundo plano directo para testing.`,
        );
      }
    }

    // Ejecutar recuperación segura de trabajos huérfanos / interrumpidos
    await this.recoverOrphanExports();
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
    const isProduction = this.config.get<string>("NODE_ENV") === "production";

    if (this.isRedisAvailable && this.queue) {
      try {
        await this.queue.add(
          "generate-dossier",
          { exportId, user },
          {
            jobId: `dossier-export-${exportId}`, // Deduplicación estricta por exportId
            attempts: 3,
            backoff: { type: "exponential", delay: 3000 },
            removeOnComplete: true,
            removeOnFail: false,
          },
        );
        this.logger.log(`Exportación ${exportId} encolada exitosamente en BullMQ.`);
        return;
      } catch (err: any) {
        if (isProduction) {
          this.logger.error(
            `Error al encolar en BullMQ en producción para exportación ${exportId}: ${err?.message}`,
          );
          throw new DossierQueueUnavailableError(
            `Fallo al encolar en BullMQ: ${err?.message}. En producción no se permite procesamiento volátil.`,
          );
        }
        this.logger.warn(
          `Error encolando en BullMQ (${err?.message}), ejecutando fallback directo de desarrollo.`,
        );
      }
    }

    // Comprobación estricta de entorno para fallback
    if (isProduction) {
      this.logger.error(
        `[CRITICAL] Intento de encolamiento sin Redis/BullMQ en producción para exportación ${exportId}.`,
      );
      throw new DossierQueueUnavailableError(
        "El servicio de colas persistentes (Redis/BullMQ) no se encuentra disponible. En producción no se permite procesamiento volátil.",
      );
    }

    // Fallback: permitido EXCLUSIVAMENTE en entorno de desarrollo / testing
    this.logger.warn(
      `[DEV/TEST ONLY] Ejecutando fallback asíncrono directo para exportación ${exportId}.`,
    );
    setImmediate(async () => {
      try {
        await this.processor.processExport(exportId, user);
      } catch (err: any) {
        this.logger.error(
          `Error en fallback directo de desarrollo para exportación ${exportId}: ${err?.message}`,
        );
      }
    });
  }

  /**
   * Recuperación segura e idempotente de exportaciones abandonadas o interrumpidas.
   */
  async recoverOrphanExports(): Promise<void> {
    try {
      // Buscar trabajos en estado PROCESSING que quedaron inconclusos tras un crash o reinicio
      const orphanProcessing = await this.prisma.processDossierExport.findMany({
        where: {
          status: "PROCESSING",
        },
      });

      for (const exp of orphanProcessing) {
        this.logger.warn(
          `Detectada exportación interrumpida '${exp.id}' en estado PROCESSING. Marcando como FAILED para permitir reintento seguro.`,
        );
        await this.prisma.processDossierExport.update({
          where: { id: exp.id },
          data: {
            status: "FAILED",
            errorMessage:
              "Procesamiento interrumpido por reinicio o detención del servicio. Requiere reintento.",
          },
        });
      }
    } catch (err: any) {
      this.logger.error(`Error en recuperación de exportaciones huérfanas: ${err?.message}`);
    }
  }
}
