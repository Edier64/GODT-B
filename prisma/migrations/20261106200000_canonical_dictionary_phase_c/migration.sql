-- AlterTable
ALTER TABLE "DOCUMENT_FIELD_PROVENANCE" ADD COLUMN "canonical_field_key" VARCHAR(150);

-- CreateTable
CREATE TABLE "CANONICAL_FIELD_DEFINITION" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "canonical_field_key" VARCHAR(150) NOT NULL,
    "display_name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "data_type" VARCHAR(50) NOT NULL,
    "unit" VARCHAR(50),
    "scope" VARCHAR(50) NOT NULL,
    "cardinality" VARCHAR(50) NOT NULL DEFAULT 'SINGLE',
    "sharing_policy" VARCHAR(50) NOT NULL DEFAULT 'SHARED',
    "allowed_sources" JSONB NOT NULL,
    "writable" BOOLEAN NOT NULL DEFAULT true,
    "validation_rules" JSONB,
    "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CANONICAL_FIELD_DEFINITION_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PROCESS_CANONICAL_VALUE" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "process_id" UUID NOT NULL,
    "canonical_field_key" VARCHAR(150) NOT NULL,
    "current_value" JSONB NOT NULL,
    "unit" VARCHAR(50),
    "effective_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sample_context" VARCHAR(200),
    "source_kind" VARCHAR(50) NOT NULL,
    "source_instance_id" UUID,
    "source_revision_id" UUID,
    "version_number" INTEGER NOT NULL DEFAULT 1,
    "conflict_status" VARCHAR(50) NOT NULL DEFAULT 'NONE',
    "conflict_details" JSONB,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PROCESS_CANONICAL_VALUE_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PROCESS_CANONICAL_HISTORY" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "process_id" UUID NOT NULL,
    "canonical_field_key" VARCHAR(150) NOT NULL,
    "value" JSONB NOT NULL,
    "unit" VARCHAR(50),
    "effective_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sample_context" VARCHAR(200),
    "source_kind" VARCHAR(50) NOT NULL,
    "source_instance_id" UUID,
    "source_revision_id" UUID,
    "source_document_id" UUID,
    "version_number" INTEGER NOT NULL,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PROCESS_CANONICAL_HISTORY_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CANONICAL_FIELD_DEFINITION_canonical_field_key_key" ON "CANONICAL_FIELD_DEFINITION"("canonical_field_key");

-- CreateIndex
CREATE INDEX "CANONICAL_FIELD_DEFINITION_scope_status_idx" ON "CANONICAL_FIELD_DEFINITION"("scope", "status");

-- CreateIndex
CREATE INDEX "CANONICAL_FIELD_DEFINITION_canonical_field_key_idx" ON "CANONICAL_FIELD_DEFINITION"("canonical_field_key");

-- CreateIndex
CREATE UNIQUE INDEX "PROCESS_CANONICAL_VALUE_process_id_canonical_field_key_key" ON "PROCESS_CANONICAL_VALUE"("process_id", "canonical_field_key");

-- CreateIndex
CREATE INDEX "PROCESS_CANONICAL_VALUE_process_id_conflict_status_idx" ON "PROCESS_CANONICAL_VALUE"("process_id", "conflict_status");

-- CreateIndex
CREATE INDEX "PROCESS_CANONICAL_HISTORY_process_id_canonical_field_key_effective_at_idx" ON "PROCESS_CANONICAL_HISTORY"("process_id", "canonical_field_key", "effective_at");

-- CreateIndex
CREATE INDEX "PROCESS_CANONICAL_HISTORY_process_id_canonical_field_key_version_number_idx" ON "PROCESS_CANONICAL_HISTORY"("process_id", "canonical_field_key", "version_number");

-- CreateIndex
CREATE INDEX "DOCUMENT_FIELD_PROVENANCE_canonical_field_key_idx" ON "DOCUMENT_FIELD_PROVENANCE"("canonical_field_key");

-- AddForeignKey
ALTER TABLE "CANONICAL_FIELD_DEFINITION" ADD CONSTRAINT "CANONICAL_FIELD_DEFINITION_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "SYSTEM_USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PROCESS_CANONICAL_VALUE" ADD CONSTRAINT "PROCESS_CANONICAL_VALUE_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "DONATION_PROCESS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PROCESS_CANONICAL_VALUE" ADD CONSTRAINT "PROCESS_CANONICAL_VALUE_canonical_field_key_fkey" FOREIGN KEY ("canonical_field_key") REFERENCES "CANONICAL_FIELD_DEFINITION"("canonical_field_key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PROCESS_CANONICAL_VALUE" ADD CONSTRAINT "PROCESS_CANONICAL_VALUE_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "SYSTEM_USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PROCESS_CANONICAL_HISTORY" ADD CONSTRAINT "PROCESS_CANONICAL_HISTORY_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "DONATION_PROCESS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PROCESS_CANONICAL_HISTORY" ADD CONSTRAINT "PROCESS_CANONICAL_HISTORY_canonical_field_key_fkey" FOREIGN KEY ("canonical_field_key") REFERENCES "CANONICAL_FIELD_DEFINITION"("canonical_field_key") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PROCESS_CANONICAL_HISTORY" ADD CONSTRAINT "PROCESS_CANONICAL_HISTORY_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "SYSTEM_USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

