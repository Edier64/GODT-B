-- AlterTable
ALTER TABLE "PROCESS_DOSSIER_EXPORT" ADD COLUMN IF NOT EXISTS "package_checksum_sha256" CHAR(64);
ALTER TABLE "PROCESS_DOSSIER_EXPORT" ADD COLUMN IF NOT EXISTS "manifest_digest" CHAR(64);

-- Sincronizar datos históricos de zip_sha256 en package_checksum_sha256
UPDATE "PROCESS_DOSSIER_EXPORT"
SET "package_checksum_sha256" = "zip_sha256"
WHERE "package_checksum_sha256" IS NULL AND "zip_sha256" IS NOT NULL;
