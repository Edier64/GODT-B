-- Migration 15: Add worker lease and heartbeat to ProcessDossierExport for multi-worker safety
ALTER TABLE "PROCESS_DOSSIER_EXPORT" ADD COLUMN IF NOT EXISTS "processing_worker_id" VARCHAR(100);
ALTER TABLE "PROCESS_DOSSIER_EXPORT" ADD COLUMN IF NOT EXISTS "last_heartbeat_at" TIMESTAMPTZ(6);
