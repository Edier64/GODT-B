import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Queue, Worker, Job } from "bullmq";
import Redis from "ioredis";
import { randomBytes } from "crypto";
import { ProcessDossierExportService } from "../../application/dossier/process-dossier-export.service";
import { AuthenticatedUser } from "../../presentation/auth/auth.types";
import { DossierQueueUnavailableError } from "../../domain/dossier/dossier.types";
import { PrismaService } from "../prisma/prisma.service";
import { areQueueWorkersEnabled, resolveAppMode } from "../runtime/app-mode";
import {
  createBullmqQueue,
  createBullmqWorker,
  resolveBullmqBackend,
} from "../runtime/bullmq-backend";

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
  private isQueueAvailable = false;

  constructor(
    private readonly config: ConfigService,
    private readonly processor: ProcessDossierExportService,
    private readonly prisma: PrismaService,
  ) {
    const configuredInstanceId = this.config.get<string>("INSTANCE_ID");
    const uniqueSuffix = `${process.pid}-${randomBytes(4).toString("hex")}`;
    this.workerInstanceId = configuredInstanceId
      ? `${configuredInstanceId}-${uniqueSuffix}`
      : `worker-${uniqueSuffix}`;
  }

  async onModuleInit() {
    const nodeEnv = this.config.get<string>("NODE_ENV", "development");
    const isProduction = nodeEnv === "production";
    const backend = resolveBullmqBackend(this.config);

    try {
      if (backend === "redis") {
        const redisUrl = this.config.get<string>("REDIS_URL", "redis://localhost:6379");
        this.redisConnection = new Redis(redisUrl, {
          maxRetriesPerRequest: null, // BullMQ exige estrictamente maxRetriesPerRequest: null
          lazyConnect: true,
          connectTimeout: 2000,
        });

        await this.redisConnection.connect();
        await this.redisConnection.ping();

        this.queue = new Queue("dossier-exports", {
          connection: this.redisConnection,
        });
      } else {
        this.queue = createBullmqQueue("dossier-exports", this.config, {
          connectionTimeoutMillis: 2500,
        });
        this.queue.on("error", (err) => {
          this.logger.warn(`Error en conexión BullMQ (${backend}): ${err?.message ?? "error"}`);
        });
        await this.queue.waitUntilReady();
      }

      this.isQueueAvailable = true;

      const workersEnabled = areQueueWorkersEnabled(this.config);
      if (workersEnabled) {
        const processorFn = async (job: Job<DossierJobData>) => {
          this.logger.log(
            `Procesando trabajo BullMQ: ${job.id} (Export ID: ${job.data.exportId}, Worker: ${this.workerInstanceId})`,
          );
          await this.processor.processExport(
            job.data.exportId,
            job.data.user,
            this.workerInstanceId,
          );
        };
        const concurrency = Number(this.config.get("DOSSIER_CONCURRENCY", 2));

        this.worker =
          backend === "redis" && this.redisConnection
            ? new Worker("dossier-exports", processorFn, {
                connection: this.redisConnection,
                concurrency,
              })
            : createBullmqWorker<DossierJobData>(
                "dossier-exports",
                processorFn,
                this.config,
                { concurrency, connectionTimeoutMillis: 2500 },
              );

        this.worker.on("error", (err) => {
          this.logger.error(`Error en worker dossier BullMQ: ${err?.message ?? "error"}`);
        });
        this.worker.on("failed", (job, err) => {
          this.logger.error(`Trabajo BullMQ ${job?.id} falló: ${err?.message}`);
        });

        if (backend === "postgres") {
          await this.worker.waitUntilReady();
        }

        this.logger.log(
          `BullMQ Dossier Queue & Worker (${this.workerInstanceId}, backend: ${backend}) inicializados exitosamente.`,
        );
      } else {
        this.logger.log(
          `BullMQ Dossier Queue (solo productor, backend: ${backend}) inicializada en modo APP_MODE=${resolveAppMode(this.config)}. Consumidor deshabilitado.`,
        );
      }
    } catch (err: any) {
      this.isQueueAvailable = false;
      if (this.worker) {
        await this.worker.close().catch(() => undefined);
        this.worker = null;
      }
      if (this.queue) {
        await this.queue.close().catch(() => undefined);
        this.queue = null;
      }
      if (this.redisConnection) {
        try {
          this.redisConnection.disconnect();
        } catch {}
        this.redisConnection = null;
      }

      if (isProduction) {
        this.logger.error(
          `[CRITICAL] Backend BullMQ (${backend}) no disponible en PRODUCCIÓN (${err?.message}). BullMQ no pudo iniciar.`,
        );
      } else {
        this.logger.warn(
          `[DEV/TEST ONLY] Backend BullMQ (${backend}) no disponible (${err?.message}). Modo degradado condicionado por ENABLE_IN_MEMORY_QUEUE_FALLBACK.`,
        );
      }
    }

    // Ejecutar recuperación segura de trabajos huérfanos solo en instancias con consumidor activo
    if (areQueueWorkersEnabled(this.config)) {
      await this.recoverOrphanExports();
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
    const rawEnv = (this.config.get<string>("NODE_ENV") || "").trim().toLowerCase();
    const isSafeDevOrTest = rawEnv === "development" || rawEnv === "test";
    const enableFallbackConfig =
      this.config.get<string>("ENABLE_IN_MEMORY_QUEUE_FALLBACK") === "true";
    const allowFallback = isSafeDevOrTest && enableFallbackConfig;

    if (this.isQueueAvailable && this.queue) {
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
            `Error al encolar en BullMQ (entorno: ${rawEnv}, fallback permitido: ${allowFallback}) para exportación ${exportId}: ${err?.message}`,
          );
          throw new DossierQueueUnavailableError(
            `Fallo al encolar en BullMQ: ${err?.message}. En entornos ${rawEnv || "no identificados"} no se permite procesamiento volátil sin cola persistente.`,
          );
        }
        this.logger.warn(
          `Error encolando en BullMQ (${err?.message}), ejecutando fallback directo de desarrollo (ENABLE_IN_MEMORY_QUEUE_FALLBACK=true).`,
        );
      }
    }

    // Comprobación estricta de entorno para fallback (seguro por defecto)
    if (!allowFallback) {
      this.logger.error(
        `[CRITICAL] Intento de encolamiento sin BullMQ persistente en entorno no autorizado (NODE_ENV=${rawEnv}, ENABLE_IN_MEMORY_QUEUE_FALLBACK=${enableFallbackConfig}) para exportación ${exportId}.`,
      );
      throw new DossierQueueUnavailableError(
        `El servicio persistente de colas BullMQ no se encuentra disponible. El modo fallback en memoria está estrictamente deshabilitado en este entorno (NODE_ENV=${rawEnv || "indefinido"}).`,
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
        // 1. Si BullMQ está disponible, consultar estado del job en el backend activo
        if (this.queue && this.isQueueAvailable) {
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
        // Actualización condicional y transaccional atómica para evitar colisiones entre múltiples workers
        const updateResult = await this.prisma.processDossierExport.updateMany({
          where: {
            id: exp.id,
            status: "PROCESSING",
            lastHeartbeatAt: exp.lastHeartbeatAt, // Guardia optimista: asegura que otra instancia no haya refrescado en paralelo
          },
          data: {
            status: "FAILED",
            errorMessage:
              "Procesamiento abandonado o interrumpido. El trabajo superó el umbral de inactividad o la instancia procesadora fue terminada. Requiere reintento.",
            lastHeartbeatAt: new Date(),
          },
        });

        if (updateResult.count > 0) {
          this.logger.warn(
            `Recuperada exportación huérfana '${exp.id}' (worker: ${exp.processingWorkerId || "n/a"}, inactiva por ${Math.round(elapsedMs / 1000)}s).`,
          );
        }
      }
    } catch (err: any) {
      this.logger.error(`Error en recuperación de exportaciones huérfanas: ${err?.message}`);
    }
  }
}
