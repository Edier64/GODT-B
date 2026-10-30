/*
  Warnings:

  - Added the required column `category` to the `DOCUMENT_TEMPLATE` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `DOCUMENT_TEMPLATE` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `DOCUMENT_TEMPLATE` table without a default value. This is not possible if the table is not empty.
  - Added the required column `created_by` to the `TEMPLATE_VERSION` table without a default value. This is not possible if the table is not empty.
  - Added the required column `ui_schema` to the `TEMPLATE_VERSION` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "DOCUMENT_TEMPLATE" ADD COLUMN     "category" VARCHAR(100) NOT NULL,
ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "name" VARCHAR(200) NOT NULL,
ADD COLUMN     "status" VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
ADD COLUMN     "updated_at" TIMESTAMPTZ(6) NOT NULL;

-- AlterTable
ALTER TABLE "GENERATED_PDF_DOCUMENT" ADD COLUMN     "document_instance_id" UUID;

-- AlterTable
ALTER TABLE "TEMPLATE_VERSION" ADD COLUMN     "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "created_by" UUID NOT NULL,
ADD COLUMN     "definition_hash" CHAR(64),
ADD COLUMN     "dependency_config" JSONB,
ADD COLUMN     "generation_config" JSONB,
ADD COLUMN     "published_at" TIMESTAMPTZ(6),
ADD COLUMN     "ui_schema" JSONB NOT NULL;

-- CreateTable
CREATE TABLE "DOCUMENT_INSTANCE" (
    "id" UUID NOT NULL,
    "donor_id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "template_version_id" UUID NOT NULL,
    "document_code" VARCHAR(100) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    "current_revision_id" UUID,
    "created_by" UUID NOT NULL,
    "updated_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "completed_at" TIMESTAMPTZ(6),
    "approved_at" TIMESTAMPTZ(6),

    CONSTRAINT "DOCUMENT_INSTANCE_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DOCUMENT_RESPONSE_REVISION" (
    "id" UUID NOT NULL,
    "document_instance_id" UUID NOT NULL,
    "revision_number" INTEGER NOT NULL,
    "response_data" JSONB NOT NULL,
    "validation_summary" JSONB,
    "change_summary" JSONB,
    "created_by" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DOCUMENT_RESPONSE_REVISION_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DOCUMENT_FIELD_PROVENANCE" (
    "id" UUID NOT NULL,
    "response_revision_id" UUID NOT NULL,
    "field_path" VARCHAR(300) NOT NULL,
    "source_kind" VARCHAR(50) NOT NULL,
    "source_entity_id" UUID,
    "source_document_id" UUID,
    "ocr_field_id" UUID,
    "validated_by" UUID,
    "validated_at" TIMESTAMPTZ(6),
    "conflict_status" VARCHAR(50) NOT NULL DEFAULT 'NONE',
    "conflict_details" JSONB,

    CONSTRAINT "DOCUMENT_FIELD_PROVENANCE_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DOCUMENT_INSTANCE_current_revision_id_key" ON "DOCUMENT_INSTANCE"("current_revision_id");

-- CreateIndex
CREATE INDEX "DOCUMENT_INSTANCE_donor_id_status_updated_at_idx" ON "DOCUMENT_INSTANCE"("donor_id", "status", "updated_at");

-- CreateIndex
CREATE INDEX "DOCUMENT_INSTANCE_template_version_id_status_idx" ON "DOCUMENT_INSTANCE"("template_version_id", "status");

-- CreateIndex
CREATE INDEX "DOCUMENT_RESPONSE_REVISION_document_instance_id_created_at_idx" ON "DOCUMENT_RESPONSE_REVISION"("document_instance_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "DOCUMENT_RESPONSE_REVISION_document_instance_id_revision_nu_key" ON "DOCUMENT_RESPONSE_REVISION"("document_instance_id", "revision_number");

-- CreateIndex
CREATE INDEX "DOCUMENT_FIELD_PROVENANCE_response_revision_id_field_path_idx" ON "DOCUMENT_FIELD_PROVENANCE"("response_revision_id", "field_path");

-- CreateIndex
CREATE INDEX "DOCUMENT_FIELD_PROVENANCE_source_document_id_idx" ON "DOCUMENT_FIELD_PROVENANCE"("source_document_id");

-- CreateIndex
CREATE INDEX "DOCUMENT_FIELD_PROVENANCE_ocr_field_id_idx" ON "DOCUMENT_FIELD_PROVENANCE"("ocr_field_id");

-- CreateIndex
CREATE INDEX "GENERATED_PDF_DOCUMENT_document_instance_id_idx" ON "GENERATED_PDF_DOCUMENT"("document_instance_id");

-- AddForeignKey
ALTER TABLE "TEMPLATE_VERSION" ADD CONSTRAINT "TEMPLATE_VERSION_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "SYSTEM_USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GENERATED_PDF_DOCUMENT" ADD CONSTRAINT "GENERATED_PDF_DOCUMENT_document_instance_id_fkey" FOREIGN KEY ("document_instance_id") REFERENCES "DOCUMENT_INSTANCE"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DOCUMENT_INSTANCE" ADD CONSTRAINT "DOCUMENT_INSTANCE_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "DONOR_RECORD"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DOCUMENT_INSTANCE" ADD CONSTRAINT "DOCUMENT_INSTANCE_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "DOCUMENT_TEMPLATE"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DOCUMENT_INSTANCE" ADD CONSTRAINT "DOCUMENT_INSTANCE_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "TEMPLATE_VERSION"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DOCUMENT_INSTANCE" ADD CONSTRAINT "DOCUMENT_INSTANCE_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "SYSTEM_USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DOCUMENT_INSTANCE" ADD CONSTRAINT "DOCUMENT_INSTANCE_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "SYSTEM_USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DOCUMENT_INSTANCE" ADD CONSTRAINT "DOCUMENT_INSTANCE_current_revision_id_fkey" FOREIGN KEY ("current_revision_id") REFERENCES "DOCUMENT_RESPONSE_REVISION"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DOCUMENT_RESPONSE_REVISION" ADD CONSTRAINT "DOCUMENT_RESPONSE_REVISION_document_instance_id_fkey" FOREIGN KEY ("document_instance_id") REFERENCES "DOCUMENT_INSTANCE"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DOCUMENT_RESPONSE_REVISION" ADD CONSTRAINT "DOCUMENT_RESPONSE_REVISION_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "SYSTEM_USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DOCUMENT_FIELD_PROVENANCE" ADD CONSTRAINT "DOCUMENT_FIELD_PROVENANCE_response_revision_id_fkey" FOREIGN KEY ("response_revision_id") REFERENCES "DOCUMENT_RESPONSE_REVISION"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DOCUMENT_FIELD_PROVENANCE" ADD CONSTRAINT "DOCUMENT_FIELD_PROVENANCE_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "SOURCE_DOCUMENT"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DOCUMENT_FIELD_PROVENANCE" ADD CONSTRAINT "DOCUMENT_FIELD_PROVENANCE_ocr_field_id_fkey" FOREIGN KEY ("ocr_field_id") REFERENCES "OCR_EXTRACTED_FIELD"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DOCUMENT_FIELD_PROVENANCE" ADD CONSTRAINT "DOCUMENT_FIELD_PROVENANCE_validated_by_fkey" FOREIGN KEY ("validated_by") REFERENCES "SYSTEM_USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
