import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";
import { randomBytes } from "crypto";
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
  readonly workerInstanceId: string;
  private queue: Queue | null = null;
  private worker: Worker | null = null;
  private redisConnection: Redis | null = null;
  private isRedisAvailable = false;

  constructor(
    private readonly config: ConfigService,
    private readonly processor: ProcessDossierExportService,
    private readonly prisma: PrismaService,
  ) {
    this.workerInstanceId =
      this.config.get<string>("INSTANCE_ID") ||
      `worker-${process.pid}-${randomBytes(4).toString("hex")}`;
  }

  async onModuleInit() {
    const nodeEnv = this.config.get<string>("NODE_ENV", "development");
    const isProduction = nodeEnv === "production";
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
          this.logger.log(
            `Procesando trabajo BullMQ: ${job.id} (Export ID: ${job.data.exportId}, Worker: ${this.workerInstanceId})`,
          );
          await this.processor.processExport(
            job.data.exportId,
            job.data.user,
            this.workerInstanceId,
          );
        },
        {
          connection: this.redisConnection,
          concurrency: 2,
        },
      );

      this.worker.on("failed", (job, err) => {
        this.logger.error(`Trabajo BullMQ ${job?.id} falló: ${err?.message}`);
      });

      this.logger.log(
        `BullMQ Dossier Queue & Worker (${this.workerInstanceId}) inicializados exitosamente.`,
      );
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
          `[DEV/TEST ONLY] Redis no disponible para BullMQ (${err?.message}). Modo degradado condicionado por ENABLE_IN_MEMORY_QUEUE_FALLBACK.`,
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
    const nodeEnv = this.config.get<string>("NODE_ENV", "development");
    const isRestrictedEnv = nodeEnv === "production" || nodeEnv === "staging";
    const enableFallbackConfig =
      this.config.get<string>("ENABLE_IN_MEMORY_QUEUE_FALLBACK") === "true";
    const allowFallback = !isRestrictedEnv && enableFallbackConfig;

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
        if (!allowFallback) {
          this.logger.error(
            `Error al encolar en BullMQ (entorno: ${nodeEnv}, fallback permitido: ${allowFallback}) para exportación ${exportId}: ${err?.message}`,
          );
          throw new DossierQueueUnavailableError(
            `Fallo al encolar en BullMQ: ${err?.message}. En entornos ${nodeEnv} no se permite procesamiento volátil sin Redis.`,
          );
        }
        this.logger.warn(
          `Error encolando en BullMQ (${err?.message}), ejecutando fallback directo de desarrollo (ENABLE_IN_MEMORY_QUEUE_FALLBACK=true).`,
        );
      }
    }

    // Comprobación estricta de entorno para fallback
    if (!allowFallback) {
      this.logger.error(
        `[CRITICAL] Intento de encolamiento sin Redis/BullMQ en entorno no autorizado (NODE_ENV=${nodeEnv}, ENABLE_IN_MEMORY_QUEUE_FALLBACK=${enableFallbackConfig}) para exportación ${exportId}.`,
      );
      throw new DossierQueueUnavailableError(
        `El servicio persistente de colas (Redis/BullMQ) no se encuentra disponible. El modo fallback en memoria está estrictamente deshabilitado en este entorno (NODE_ENV=${nodeEnv}).`,
      );
    }

    // Fallback: permitido EXCLUSIVAMENTE si ENABLE_IN_MEMORY_QUEUE_FALLBACK=true y no es prod/staging
    this.logger.warn(
      `[DEV/TEST ONLY] Ejecutando fallback asíncrono en memoria para exportación ${exportId} (workerInstanceId: ${this.workerInstanceId}).`,
    );
    setImmediate(async () => {
      try {
        await this.processor.processExport(exportId, user, this.workerInstanceId);
      } catch (err: any) {
        this.logger.error(
          `Error en fallback directo de desarrollo para exportación ${exportId}: ${err?.message}`,
        );
      }
    });
  }

  /**
   * Recuperación segura e idempotente de exportaciones abandonadas en entornos multi-worker.
   * - Nunca marca como FAILED trabajos activos de otras instancias en BullMQ.
   * - Respeta leases activos y heartbeats recientes dentro del umbral de staleness (15 min).
   * - Solo recupera registros verdaderamente huérfanos o con fallos de proceso no recuperables.
   */
  async recoverOrphanExports(): Promise<void> {
    try {
      const processingExports = await this.prisma.processDossierExport.findMany({
        where: {
          status: "PROCESSING",
        },
      });

      const now = Date.now();
      const STALE_THRESHOLD_MS = 15 * 60 * 1000; // 15 minutos

      for (const exp of processingExports) {
        // 1. Si BullMQ está disponible, consultar estado del job en Redis
        if (this.queue && this.isRedisAvailable) {
          try {
            const job = await this.queue.getJob(`dossier-export-${exp.id}`);
            if (job) {
              const state = await job.getState();
              if (state === "active" || state === "waiting" || state === "delayed") {
                this.logger.log(
                  `Exportación '${exp.id}' activa en BullMQ (estado: ${state}, worker: ${exp.processingWorkerId || "no registrado"}). No se interrumpe.`,
                );
                continue;
              }
            }
          } catch (jobErr: any) {
            this.logger.warn(
              `No se pudo consultar estado de job BullMQ para ${exp.id}: ${jobErr?.message}`,
            );
          }
        }

        // 2. Comprobar actividad reciente (heartbeat de otro worker dentro de los 15 minutos)
        const lastActivityTime = (
          exp.lastHeartbeatAt ||
          exp.updatedAt ||
          exp.createdAt
        ).getTime();
        const elapsedMs = now - lastActivityTime;
        const isStale = elapsedMs > STALE_THRESHOLD_MS;

        // Si fue procesado por otra instancia y el heartbeat es reciente (< 15 min), respetarlo
        if (!isStale && exp.processingWorkerId && exp.processingWorkerId !== this.workerInstanceId) {
          this.logger.log(
            `Exportación '${exp.id}' procesada activamente por instancia '${exp.processingWorkerId}' (último heartbeat hace ${Math.round(elapsedMs / 1000)}s). Preservando ejecución.`,
          );
          continue;
        }

        // 3. Si el job no existe en BullMQ o el tiempo sin actividad supera el umbral, declarar huérfano
        this.logger.warn(
          `Recuperando exportación huérfana '${exp.id}' (worker: ${exp.processingWorkerId || "n/a"}, inactiva por ${Math.round(elapsedMs / 1000)}s). Marcando como FAILED para permitir reintento seguro.`,
        );
        await this.prisma.processDossierExport.update({
          where: { id: exp.id },
          data: {
            status: "FAILED",
            errorMessage:
              "Procesamiento abandonado o interrumpido. El trabajo superó el umbral de inactividad o la instancia procesadora fue terminada. Requiere reintento.",
            lastHeartbeatAt: new Date(),
          },
        });
      }
    } catch (err: any) {
      this.logger.error(`Error en recuperación de exportaciones huérfanas: ${err?.message}`);
    }
  }
}
