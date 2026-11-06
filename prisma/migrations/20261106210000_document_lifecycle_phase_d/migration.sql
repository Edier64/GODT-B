-- AlterTable
ALTER TABLE "GENERATED_PDF_DOCUMENT" ADD COLUMN     "process_id" UUID,
ADD COLUMN     "status" VARCHAR(50) NOT NULL DEFAULT 'GENERATED',
ADD COLUMN     "version_number" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "DOCUMENT_PARTICIPANT" (
    "id" UUID NOT NULL,
    "document_instance_id" UUID NOT NULL,
    "process_participant_id" UUID,
    "full_name" VARCHAR(200) NOT NULL,
    "document_type" VARCHAR(20),
    "document_number" VARCHAR(100),
    "signer_role" VARCHAR(100) NOT NULL,
    "is_signer" BOOLEAN NOT NULL DEFAULT false,
    "signature_required" BOOLEAN NOT NULL DEFAULT false,
    "signature_order" INTEGER,
    "status" VARCHAR(50) NOT NULL DEFAULT 'ASIGNADO',
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "DOCUMENT_PARTICIPANT_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DOCUMENT_SIGNATURE" (
    "id" UUID NOT NULL,
    "document_instance_id" UUID NOT NULL,
    "generated_pdf_id" UUID NOT NULL,
    "participant_id" UUID NOT NULL,
    "signature_type" VARCHAR(50) NOT NULL,
    "snapshot_hash" CHAR(64) NOT NULL,
    "signed_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evidence_data" JSONB,
    "authenticated_user_id" UUID,
    "status" VARCHAR(50) NOT NULL DEFAULT 'VALIDA',
    "revoked_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DOCUMENT_SIGNATURE_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CUSTODY_EVENT" (
    "id" UUID NOT NULL,
    "document_instance_id" UUID NOT NULL,
    "process_id" UUID NOT NULL,
    "sequence_number" INTEGER NOT NULL,
    "event_type" VARCHAR(50) NOT NULL,
    "item_description" VARCHAR(255) NOT NULL,
    "container_code" VARCHAR(100),
    "seal_number" VARCHAR(100),
    "temperature_celsius" DECIMAL(5,2),
    "transferor_name" VARCHAR(200) NOT NULL,
    "transferor_id" VARCHAR(100),
    "transferor_institution" VARCHAR(200),
    "receiver_name" VARCHAR(200) NOT NULL,
    "receiver_id" VARCHAR(100),
    "receiver_institution" VARCHAR(200),
    "occurred_at" TIMESTAMPTZ(6) NOT NULL,
    "location" VARCHAR(200) NOT NULL,
    "integrity_verified" BOOLEAN NOT NULL DEFAULT true,
    "observations" TEXT,
    "recorded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CUSTODY_EVENT_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DOCUMENT_PARTICIPANT_document_instance_id_idx" ON "DOCUMENT_PARTICIPANT"("document_instance_id");

-- CreateIndex
CREATE INDEX "DOCUMENT_PARTICIPANT_process_participant_id_idx" ON "DOCUMENT_PARTICIPANT"("process_participant_id");

-- CreateIndex
CREATE INDEX "DOCUMENT_SIGNATURE_document_instance_id_idx" ON "DOCUMENT_SIGNATURE"("document_instance_id");

-- CreateIndex
CREATE INDEX "DOCUMENT_SIGNATURE_generated_pdf_id_idx" ON "DOCUMENT_SIGNATURE"("generated_pdf_id");

-- CreateIndex
CREATE INDEX "DOCUMENT_SIGNATURE_participant_id_idx" ON "DOCUMENT_SIGNATURE"("participant_id");

-- CreateIndex
CREATE INDEX "CUSTODY_EVENT_process_id_sequence_number_idx" ON "CUSTODY_EVENT"("process_id", "sequence_number");

-- CreateIndex
CREATE UNIQUE INDEX "CUSTODY_EVENT_document_instance_id_sequence_number_key" ON "CUSTODY_EVENT"("document_instance_id", "sequence_number");

-- CreateIndex
CREATE INDEX "GENERATED_PDF_DOCUMENT_process_id_idx" ON "GENERATED_PDF_DOCUMENT"("process_id");

-- AddForeignKey
ALTER TABLE "GENERATED_PDF_DOCUMENT" ADD CONSTRAINT "GENERATED_PDF_DOCUMENT_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "DONATION_PROCESS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DOCUMENT_PARTICIPANT" ADD CONSTRAINT "DOCUMENT_PARTICIPANT_document_instance_id_fkey" FOREIGN KEY ("document_instance_id") REFERENCES "DOCUMENT_INSTANCE"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DOCUMENT_PARTICIPANT" ADD CONSTRAINT "DOCUMENT_PARTICIPANT_process_participant_id_fkey" FOREIGN KEY ("process_participant_id") REFERENCES "PROCESS_PARTICIPANT"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DOCUMENT_SIGNATURE" ADD CONSTRAINT "DOCUMENT_SIGNATURE_document_instance_id_fkey" FOREIGN KEY ("document_instance_id") REFERENCES "DOCUMENT_INSTANCE"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DOCUMENT_SIGNATURE" ADD CONSTRAINT "DOCUMENT_SIGNATURE_generated_pdf_id_fkey" FOREIGN KEY ("generated_pdf_id") REFERENCES "GENERATED_PDF_DOCUMENT"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DOCUMENT_SIGNATURE" ADD CONSTRAINT "DOCUMENT_SIGNATURE_participant_id_fkey" FOREIGN KEY ("participant_id") REFERENCES "DOCUMENT_PARTICIPANT"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DOCUMENT_SIGNATURE" ADD CONSTRAINT "DOCUMENT_SIGNATURE_authenticated_user_id_fkey" FOREIGN KEY ("authenticated_user_id") REFERENCES "SYSTEM_USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CUSTODY_EVENT" ADD CONSTRAINT "CUSTODY_EVENT_document_instance_id_fkey" FOREIGN KEY ("document_instance_id") REFERENCES "DOCUMENT_INSTANCE"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CUSTODY_EVENT" ADD CONSTRAINT "CUSTODY_EVENT_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "DONATION_PROCESS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CUSTODY_EVENT" ADD CONSTRAINT "CUSTODY_EVENT_recorded_by_id_fkey" FOREIGN KEY ("recorded_by_id") REFERENCES "SYSTEM_USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
