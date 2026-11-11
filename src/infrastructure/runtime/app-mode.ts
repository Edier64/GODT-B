import { ConfigService } from "@nestjs/config";

export type GodtAppMode = "api" | "worker" | "migrate" | "all";

export function resolveAppMode(config?: ConfigService): GodtAppMode {
  const raw = (
    config?.get<string>("APP_MODE") ??
    process.env.APP_MODE ??
    "all"
  )
    .trim()
    .toLowerCase();

  if (raw === "api" || raw === "worker" || raw === "migrate" || raw === "all") {
    return raw;
  }

  return "all";
}

/**
 * Determina si esta instancia debe registrar consumidores BullMQ (Worker).
 * - APP_MODE=api o APP_MODE=migrate: deshabilitado (solo productor Queue en API).
 * - APP_MODE=worker o APP_MODE=all (dev/test sin APP_MODE): habilitado.
 * - QUEUE_WORKERS_ENABLED=('true'|'false') permite sobrescritura explícita.
 */
export function areQueueWorkersEnabled(config?: ConfigService): boolean {
  const explicit = (
    config?.get<string>("QUEUE_WORKERS_ENABLED") ??
    process.env.QUEUE_WORKERS_ENABLED ??
    ""
  )
    .trim()
    .toLowerCase();

  if (explicit === "true") {
    return true;
  }
  if (explicit === "false") {
    return false;
  }

  const mode = resolveAppMode(config);
  return mode === "worker" || mode === "all";
}

export function buildRedisConnectionOptions(redisUrl: string): {
  host: string;
  port: number;
  username?: string;
  password?: string;
  tls?: Record<string, unknown>;
} {
  const url = new URL(redisUrl);
  const isTls = url.protocol === "rediss:";
  return {
    host: url.hostname,
    port: Number(url.port || (isTls ? 6380 : 6379)),
    username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined,
    ...(isTls ? { tls: {} } : {}),
  };
}

