import "dotenv/config";
import { Logger } from "@nestjs/common";
import {
  resolveBullmqBackend,
  resolveBullmqPgSchema,
  runBullmqPostgresMigrations,
} from "./bullmq-backend";

async function main(): Promise<void> {
  const logger = new Logger("BullmqMigrate");
  const backend = resolveBullmqBackend();

  if (backend !== "postgres") {
    logger.log(
      `BULLMQ_BACKEND=${backend}; no se requieren migraciones de esquema BullMQ en PostgreSQL.`,
    );
    return;
  }

  const schema = resolveBullmqPgSchema();
  const version = await runBullmqPostgresMigrations();
  logger.log(
    `Migraciones de colas BullMQ completadas en schema '${schema}' (versión: ${version}).`,
  );
}

main().catch((error: unknown) => {
  const logger = new Logger("BullmqMigrate");
  logger.error(
    `Error ejecutando migraciones BullMQ en PostgreSQL: ${
      error instanceof Error ? error.stack || error.message : String(error)
    }`,
  );
  process.exit(1);
});

