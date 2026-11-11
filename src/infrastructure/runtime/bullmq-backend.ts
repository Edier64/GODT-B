import { ConfigService } from "@nestjs/config";
import {
  Job,
  Processor,
  Queue,
  Worker,
  createPostgresBackend,
  runMigrations,
  withBackend,
} from "bullmq";
import { Pool } from "pg";
import { buildRedisConnectionOptions } from "./app-mode";

export type BullmqBackendType = "postgres" | "redis";

const SAFE_PG_SCHEMA_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

export function resolveBullmqBackend(config?: ConfigService): BullmqBackendType {
  const raw = (
    config?.get<string>("BULLMQ_BACKEND") ??
    process.env.BULLMQ_BACKEND ??
    "postgres"
  )
    .trim()
    .toLowerCase();

  return raw === "redis" ? "redis" : "postgres";
}

export function resolveBullmqPgSchema(config?: ConfigService): string {
  const schema = (
    config?.get<string>("BULLMQ_PG_SCHEMA") ??
    process.env.BULLMQ_PG_SCHEMA ??
    "bullmq"
  ).trim();

  if (!SAFE_PG_SCHEMA_RE.test(schema)) {
    throw new Error(
      `Nombre de schema PostgreSQL inválido para BullMQ: '${schema}'.`,
    );
  }
  return schema;
}

export function resolveBullmqDatabaseUrl(config?: ConfigService): string {
  return (
    config?.get<string>("BULLMQ_DATABASE_URL") ??
    process.env.BULLMQ_DATABASE_URL ??
    config?.get<string>("DATABASE_URL") ??
    process.env.DATABASE_URL ??
    ""
  ).trim();
}

export function buildPostgresQueueConnectionOptions(
  config?: ConfigService,
  options?: {
    connectionTimeoutMillis?: number;
    maxPoolSize?: number;
  },
) {
  const connectionString = resolveBullmqDatabaseUrl(config);
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL (o BULLMQ_DATABASE_URL) es obligatoria para BullMQ con backend PostgreSQL.",
    );
  }

  const schema = resolveBullmqPgSchema(config);
  const explicitSsl = (
    config?.get<string>("BULLMQ_PG_SSL") ??
    process.env.BULLMQ_PG_SSL ??
    ""
  )
    .trim()
    .toLowerCase();
  const rejectUnauthorizedRaw = (
    config?.get<string>("BULLMQ_PG_SSL_REJECT_UNAUTHORIZED") ??
    process.env.BULLMQ_PG_SSL_REJECT_UNAUTHORIZED ??
    "true"
  )
    .trim()
    .toLowerCase();

  const poolConfig: {
    connectionString: string;
    schema: string;
    skipMigrations: boolean;
    max: number;
    connectionTimeoutMillis: number;
    ssl?: { rejectUnauthorized: boolean };
  } = {
    connectionString,
    schema,
    skipMigrations: true,
    max: options?.maxPoolSize ?? 5,
    connectionTimeoutMillis: options?.connectionTimeoutMillis ?? 5000,
  };

  if (explicitSsl === "true") {
    poolConfig.ssl = {
      rejectUnauthorized: rejectUnauthorizedRaw !== "false",
    };
  }

  return poolConfig;
}

export function createBullmqQueue<D = unknown>(
  name: string,
  config?: ConfigService,
  options?: { connectionTimeoutMillis?: number },
): Queue<D> {
  const backend = resolveBullmqBackend(config);
  if (backend === "redis") {
    const redisUrl =
      config?.get<string>("REDIS_URL") ??
      process.env.REDIS_URL ??
      "redis://localhost:6379";
    return new Queue<D>(name, {
      connection: buildRedisConnectionOptions(redisUrl),
    });
  }

  const { Queue: PgQueue } = withBackend(createPostgresBackend);
  return new PgQueue<D>(name, {
    connection: buildPostgresQueueConnectionOptions(config, options),
  }) as unknown as Queue<D>;
}

export function createBullmqWorker<D = unknown, R = unknown>(
  name: string,
  processor: Processor<D, R>,
  config?: ConfigService,
  options?: { concurrency?: number; connectionTimeoutMillis?: number },
): Worker<D, R> {
  const backend = resolveBullmqBackend(config);
  if (backend === "redis") {
    const redisUrl =
      config?.get<string>("REDIS_URL") ??
      process.env.REDIS_URL ??
      "redis://localhost:6379";
    return new Worker<D, R>(name, processor, {
      connection: buildRedisConnectionOptions(redisUrl),
      concurrency: options?.concurrency ?? 1,
    });
  }

  const { Worker: PgWorker } = withBackend(createPostgresBackend);
  return new PgWorker<D, R>(name, processor, {
    connection: buildPostgresQueueConnectionOptions(config, options),
    concurrency: options?.concurrency ?? 1,
  }) as unknown as Worker<D, R>;
}

/**
 * Ejecuta las migraciones DDL de BullMQ en PostgreSQL sobre un cliente dedicado.
 * Debe invocarse exclusivamente en la etapa controlada `APP_MODE=migrate`, nunca en réplicas API/Worker.
 */
export async function runBullmqPostgresMigrations(
  config?: ConfigService,
): Promise<number> {
  const pgConfig = buildPostgresQueueConnectionOptions(config, {
    maxPoolSize: 2,
    connectionTimeoutMillis: 10000,
  });

  const pool = new Pool({
    connectionString: pgConfig.connectionString,
    max: 2,
    connectionTimeoutMillis: pgConfig.connectionTimeoutMillis,
    ...(pgConfig.ssl ? { ssl: pgConfig.ssl } : {}),
  });

  const client = await pool.connect();
  try {
    return await runMigrations(client, pgConfig.schema);
  } finally {
    client.release();
    await pool.end();
  }
}

export type BullmqJob<D = unknown> = Job<D>;

