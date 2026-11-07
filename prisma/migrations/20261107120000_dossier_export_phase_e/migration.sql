-- CreateTable: Process Dossier Export
CREATE TABLE "PROCESS_DOSSIER_EXPORT" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "process_id" UUID NOT NULL,
    "requested_by_id" UUID NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    "export_type" VARCHAR(50) NOT NULL DEFAULT 'FULL_ZIP',
    "include_source_documents" BOOLEAN NOT NULL DEFAULT false,
    "selected_document_codes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "selected_source_document_ids" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "progress_percent" INTEGER NOT NULL DEFAULT 0,
    "current_step" VARCHAR(100),
    "consolidated_pdf_storage_key" VARCHAR(500),
    "consolidated_pdf_sha256" CHAR(64),
    "zip_storage_key" VARCHAR(500),
    "zip_sha256" CHAR(64),
    "zip_size_bytes" BIGINT,
    "manifest_data" JSONB,
    "error_message" TEXT,
    "expires_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "PROCESS_DOSSIER_EXPORT_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PROCESS_DOSSIER_EXPORT_process_id_created_at_idx" ON "PROCESS_DOSSIER_EXPORT"("process_id", "created_at");

-- CreateIndex
CREATE INDEX "PROCESS_DOSSIER_EXPORT_status_idx" ON "PROCESS_DOSSIER_EXPORT"("status");

-- AddForeignKey
ALTER TABLE "PROCESS_DOSSIER_EXPORT" ADD CONSTRAINT "PROCESS_DOSSIER_EXPORT_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "DONATION_PROCESS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PROCESS_DOSSIER_EXPORT" ADD CONSTRAINT "PROCESS_DOSSIER_EXPORT_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "SYSTEM_USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
