-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('COORDINATOR', 'SURGEON', 'TECHNICIAN', 'ADMIN');

-- CreateEnum
CREATE TYPE "donor_record_status" AS ENUM ('EN_VALORACION', 'ACTIVO', 'CERRADO');

-- CreateEnum
CREATE TYPE "brain_death_certification_status" AS ENUM ('BORRADOR', 'CERTIFICADA');

-- CreateEnum
CREATE TYPE "legalization_mechanism" AS ENUM ('PRESUNCION_LEGAL', 'CONSENTIMIENTO_FAMILIAR');

-- CreateEnum
CREATE TYPE "ocr_job_status" AS ENUM ('EN_COLA', 'COMPLETADO', 'FALLIDO');

-- CreateEnum
CREATE TYPE "ocr_validation_status" AS ENUM ('PENDIENTE', 'CONFIRMADO', 'MODIFICADO', 'RECHAZADO');

-- CreateEnum
CREATE TYPE "tissue_category" AS ENUM ('OCULAR', 'CARDIOVASCULAR', 'OSTEOMUSCULAR', 'PIEL');

-- CreateTable
CREATE TABLE "SYSTEM_USER" (
    "id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "professional_id" VARCHAR(100),
    "role" "user_role" NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SYSTEM_USER_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DONOR_RECORD" (
    "id" UUID NOT NULL,
    "rnd_code" VARCHAR(100) NOT NULL,
    "status" "donor_record_status" NOT NULL,
    "originating_ips_name" VARCHAR(200) NOT NULL,
    "clinical_service" VARCHAR(200) NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "document_number" VARCHAR(100) NOT NULL,
    "anthropometry" JSONB,
    "blood_group" VARCHAR(20),
    "rh_factor" VARCHAR(20),
    "clinical_data" JSONB,
    "created_by" UUID NOT NULL,

    CONSTRAINT "DONOR_RECORD_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BRAIN_DEATH_CERTIFICATION" (
    "id" UUID NOT NULL,
    "donor_id" UUID NOT NULL,
    "certifying_physician_id" UUID NOT NULL,
    "second_physician_id" UUID NOT NULL,
    "evaluation_started_at" TIMESTAMPTZ(6),
    "diagnosis_confirmed_at" TIMESTAMPTZ(6),
    "apnea_test_result" JSONB,
    "confirmatory_test_result" JSONB,
    "status" "brain_death_certification_status" NOT NULL,

    CONSTRAINT "BRAIN_DEATH_CERTIFICATION_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DONATION_LEGALIZATION" (
    "id" UUID NOT NULL,
    "donor_id" UUID NOT NULL,
    "mechanism" "legalization_mechanism" NOT NULL,
    "officer_in_charge_id" UUID NOT NULL,
    "rnd_check_reference" VARCHAR(200),
    "family_notification_at" TIMESTAMPTZ(6),
    "status" VARCHAR(50) NOT NULL,

    CONSTRAINT "DONATION_LEGALIZATION_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DONATION_REPRESENTATIVE" (
    "id" UUID NOT NULL,
    "legalization_id" UUID NOT NULL,
    "full_name" VARCHAR(200) NOT NULL,
    "document_type" VARCHAR(50) NOT NULL,
    "document_number" VARCHAR(100) NOT NULL,
    "relationship_to_donor" VARCHAR(100) NOT NULL,
    "signature_storage_key" VARCHAR(500),
    "signed_at" TIMESTAMPTZ(6),

    CONSTRAINT "DONATION_REPRESENTATIVE_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SOURCE_DOCUMENT" (
    "id" UUID NOT NULL,
    "donor_id" UUID NOT NULL,
    "uploaded_by" UUID NOT NULL,
    "original_filename" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "document_category" VARCHAR(100) NOT NULL,
    "object_storage_key" VARCHAR(500) NOT NULL,
    "sha256_hash" CHAR(64) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SOURCE_DOCUMENT_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OCR_PROCESSING_JOB" (
    "id" UUID NOT NULL,
    "source_document_id" UUID NOT NULL,
    "requested_by" UUID NOT NULL,
    "provider_name" VARCHAR(100) NOT NULL,
    "status" "ocr_job_status" NOT NULL,
    "attempt_number" INTEGER NOT NULL DEFAULT 1,
    "correlation_id" VARCHAR(100) NOT NULL,
    "error_code" VARCHAR(100),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OCR_PROCESSING_JOB_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OCR_EXTRACTED_FIELD" (
    "id" UUID NOT NULL,
    "ocr_job_id" UUID NOT NULL,
    "source_document_id" UUID NOT NULL,
    "donor_id" UUID NOT NULL,
    "canonical_field_key" VARCHAR(150) NOT NULL,
    "candidate_value" TEXT NOT NULL,
    "confidence_score" DECIMAL(4,3) NOT NULL,
    "bounding_box" JSONB,
    "validation_status" "ocr_validation_status" NOT NULL,
    "confirmed_value" TEXT,
    "validated_by" UUID,
    "validated_at" TIMESTAMPTZ(6),

    CONSTRAINT "OCR_EXTRACTED_FIELD_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ORGAN_RECOVERY_SURGERY" (
    "id" UUID NOT NULL,
    "donor_id" UUID NOT NULL,
    "lead_surgeon_id" UUID NOT NULL,
    "procedure_started_at" TIMESTAMPTZ(6),
    "aortic_clamp_at" TIMESTAMPTZ(6),
    "procedure_ended_at" TIMESTAMPTZ(6),
    "organs_recovered" JSONB,
    "preservation_solution" JSONB,
    "surgical_team" JSONB,

    CONSTRAINT "ORGAN_RECOVERY_SURGERY_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TISSUE_RECOVERY_PROCEDURE" (
    "id" UUID NOT NULL,
    "donor_id" UUID NOT NULL,
    "technician_id" UUID NOT NULL,
    "lead_surgeon_id" UUID NOT NULL,
    "tissue_category" "tissue_category" NOT NULL,
    "checklist_data" JSONB,
    "recovered_components" JSONB,
    "forensic_evidence" JSONB,

    CONSTRAINT "TISSUE_RECOVERY_PROCEDURE_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DOCUMENT_TEMPLATE" (
    "id" UUID NOT NULL,
    "template_code" VARCHAR(100) NOT NULL,

    CONSTRAINT "DOCUMENT_TEMPLATE_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TEMPLATE_VERSION" (
    "id" UUID NOT NULL,
    "template_id" UUID NOT NULL,
    "version_number" VARCHAR(50) NOT NULL,
    "effective_from" TIMESTAMPTZ(6) NOT NULL,
    "status" VARCHAR(50) NOT NULL,
    "json_schema" JSONB NOT NULL,
    "mapping_config" JSONB NOT NULL,
    "authorized_by" UUID NOT NULL,

    CONSTRAINT "TEMPLATE_VERSION_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GENERATED_PDF_DOCUMENT" (
    "id" UUID NOT NULL,
    "donor_id" UUID NOT NULL,
    "template_version_id" UUID NOT NULL,
    "document_code" VARCHAR(100) NOT NULL,
    "object_storage_key" VARCHAR(500) NOT NULL,
    "sha256_hash" CHAR(64) NOT NULL,
    "anonymization_applied" BOOLEAN NOT NULL DEFAULT false,
    "data_snapshot" JSONB NOT NULL,
    "generated_by" UUID NOT NULL,
    "approved_by" UUID,

    CONSTRAINT "GENERATED_PDF_DOCUMENT_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AUDIT_EVENT" (
    "id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "entity_type" VARCHAR(100) NOT NULL,
    "entity_id" UUID NOT NULL,
    "occurred_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "correlation_id" VARCHAR(100) NOT NULL,
    "metadata" JSONB,

    CONSTRAINT "AUDIT_EVENT_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SYSTEM_USER_email_key" ON "SYSTEM_USER"("email");

-- CreateIndex
CREATE UNIQUE INDEX "DONOR_RECORD_rnd_code_key" ON "DONOR_RECORD"("rnd_code");

-- CreateIndex
CREATE INDEX "DONOR_RECORD_status_idx" ON "DONOR_RECORD"("status");

-- CreateIndex
CREATE INDEX "DONOR_RECORD_document_number_idx" ON "DONOR_RECORD"("document_number");

-- CreateIndex
CREATE UNIQUE INDEX "BRAIN_DEATH_CERTIFICATION_donor_id_key" ON "BRAIN_DEATH_CERTIFICATION"("donor_id");

-- CreateIndex
CREATE INDEX "BRAIN_DEATH_CERTIFICATION_certifying_physician_id_idx" ON "BRAIN_DEATH_CERTIFICATION"("certifying_physician_id");

-- CreateIndex
CREATE INDEX "BRAIN_DEATH_CERTIFICATION_second_physician_id_idx" ON "BRAIN_DEATH_CERTIFICATION"("second_physician_id");

-- CreateIndex
CREATE UNIQUE INDEX "DONATION_LEGALIZATION_donor_id_key" ON "DONATION_LEGALIZATION"("donor_id");

-- CreateIndex
CREATE INDEX "DONATION_LEGALIZATION_officer_in_charge_id_idx" ON "DONATION_LEGALIZATION"("officer_in_charge_id");

-- CreateIndex
CREATE INDEX "DONATION_REPRESENTATIVE_legalization_id_idx" ON "DONATION_REPRESENTATIVE"("legalization_id");

-- CreateIndex
CREATE INDEX "SOURCE_DOCUMENT_donor_id_uploaded_at_idx" ON "SOURCE_DOCUMENT"("donor_id", "uploaded_at");

-- CreateIndex
CREATE INDEX "SOURCE_DOCUMENT_sha256_hash_idx" ON "SOURCE_DOCUMENT"("sha256_hash");

-- CreateIndex
CREATE INDEX "OCR_PROCESSING_JOB_status_created_at_idx" ON "OCR_PROCESSING_JOB"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "OCR_PROCESSING_JOB_source_document_id_correlation_id_key" ON "OCR_PROCESSING_JOB"("source_document_id", "correlation_id");

-- CreateIndex
CREATE INDEX "OCR_EXTRACTED_FIELD_donor_id_canonical_field_key_idx" ON "OCR_EXTRACTED_FIELD"("donor_id", "canonical_field_key");

-- CreateIndex
CREATE INDEX "OCR_EXTRACTED_FIELD_validation_status_idx" ON "OCR_EXTRACTED_FIELD"("validation_status");

-- CreateIndex
CREATE INDEX "ORGAN_RECOVERY_SURGERY_donor_id_procedure_started_at_idx" ON "ORGAN_RECOVERY_SURGERY"("donor_id", "procedure_started_at");

-- CreateIndex
CREATE INDEX "TISSUE_RECOVERY_PROCEDURE_donor_id_tissue_category_idx" ON "TISSUE_RECOVERY_PROCEDURE"("donor_id", "tissue_category");

-- CreateIndex
CREATE UNIQUE INDEX "DOCUMENT_TEMPLATE_template_code_key" ON "DOCUMENT_TEMPLATE"("template_code");

-- CreateIndex
CREATE INDEX "TEMPLATE_VERSION_status_effective_from_idx" ON "TEMPLATE_VERSION"("status", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "TEMPLATE_VERSION_template_id_version_number_key" ON "TEMPLATE_VERSION"("template_id", "version_number");

-- CreateIndex
CREATE INDEX "GENERATED_PDF_DOCUMENT_donor_id_idx" ON "GENERATED_PDF_DOCUMENT"("donor_id");

-- CreateIndex
CREATE INDEX "GENERATED_PDF_DOCUMENT_template_version_id_idx" ON "GENERATED_PDF_DOCUMENT"("template_version_id");

-- CreateIndex
CREATE INDEX "AUDIT_EVENT_entity_type_entity_id_idx" ON "AUDIT_EVENT"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "AUDIT_EVENT_actor_user_id_occurred_at_idx" ON "AUDIT_EVENT"("actor_user_id", "occurred_at");

-- CreateIndex
CREATE INDEX "AUDIT_EVENT_correlation_id_idx" ON "AUDIT_EVENT"("correlation_id");

-- AddForeignKey
ALTER TABLE "DONOR_RECORD" ADD CONSTRAINT "DONOR_RECORD_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "SYSTEM_USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BRAIN_DEATH_CERTIFICATION" ADD CONSTRAINT "BRAIN_DEATH_CERTIFICATION_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "DONOR_RECORD"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BRAIN_DEATH_CERTIFICATION" ADD CONSTRAINT "BRAIN_DEATH_CERTIFICATION_certifying_physician_id_fkey" FOREIGN KEY ("certifying_physician_id") REFERENCES "SYSTEM_USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BRAIN_DEATH_CERTIFICATION" ADD CONSTRAINT "BRAIN_DEATH_CERTIFICATION_second_physician_id_fkey" FOREIGN KEY ("second_physician_id") REFERENCES "SYSTEM_USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DONATION_LEGALIZATION" ADD CONSTRAINT "DONATION_LEGALIZATION_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "DONOR_RECORD"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DONATION_LEGALIZATION" ADD CONSTRAINT "DONATION_LEGALIZATION_officer_in_charge_id_fkey" FOREIGN KEY ("officer_in_charge_id") REFERENCES "SYSTEM_USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DONATION_REPRESENTATIVE" ADD CONSTRAINT "DONATION_REPRESENTATIVE_legalization_id_fkey" FOREIGN KEY ("legalization_id") REFERENCES "DONATION_LEGALIZATION"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SOURCE_DOCUMENT" ADD CONSTRAINT "SOURCE_DOCUMENT_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "DONOR_RECORD"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SOURCE_DOCUMENT" ADD CONSTRAINT "SOURCE_DOCUMENT_uploaded_by_fkey" FOREIGN KEY ("uploaded_by") REFERENCES "SYSTEM_USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OCR_PROCESSING_JOB" ADD CONSTRAINT "OCR_PROCESSING_JOB_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "SOURCE_DOCUMENT"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OCR_PROCESSING_JOB" ADD CONSTRAINT "OCR_PROCESSING_JOB_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "SYSTEM_USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OCR_EXTRACTED_FIELD" ADD CONSTRAINT "OCR_EXTRACTED_FIELD_ocr_job_id_fkey" FOREIGN KEY ("ocr_job_id") REFERENCES "OCR_PROCESSING_JOB"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OCR_EXTRACTED_FIELD" ADD CONSTRAINT "OCR_EXTRACTED_FIELD_source_document_id_fkey" FOREIGN KEY ("source_document_id") REFERENCES "SOURCE_DOCUMENT"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OCR_EXTRACTED_FIELD" ADD CONSTRAINT "OCR_EXTRACTED_FIELD_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "DONOR_RECORD"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OCR_EXTRACTED_FIELD" ADD CONSTRAINT "OCR_EXTRACTED_FIELD_validated_by_fkey" FOREIGN KEY ("validated_by") REFERENCES "SYSTEM_USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ORGAN_RECOVERY_SURGERY" ADD CONSTRAINT "ORGAN_RECOVERY_SURGERY_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "DONOR_RECORD"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ORGAN_RECOVERY_SURGERY" ADD CONSTRAINT "ORGAN_RECOVERY_SURGERY_lead_surgeon_id_fkey" FOREIGN KEY ("lead_surgeon_id") REFERENCES "SYSTEM_USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TISSUE_RECOVERY_PROCEDURE" ADD CONSTRAINT "TISSUE_RECOVERY_PROCEDURE_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "DONOR_RECORD"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TISSUE_RECOVERY_PROCEDURE" ADD CONSTRAINT "TISSUE_RECOVERY_PROCEDURE_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "SYSTEM_USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TISSUE_RECOVERY_PROCEDURE" ADD CONSTRAINT "TISSUE_RECOVERY_PROCEDURE_lead_surgeon_id_fkey" FOREIGN KEY ("lead_surgeon_id") REFERENCES "SYSTEM_USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TEMPLATE_VERSION" ADD CONSTRAINT "TEMPLATE_VERSION_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "DOCUMENT_TEMPLATE"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TEMPLATE_VERSION" ADD CONSTRAINT "TEMPLATE_VERSION_authorized_by_fkey" FOREIGN KEY ("authorized_by") REFERENCES "SYSTEM_USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GENERATED_PDF_DOCUMENT" ADD CONSTRAINT "GENERATED_PDF_DOCUMENT_donor_id_fkey" FOREIGN KEY ("donor_id") REFERENCES "DONOR_RECORD"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GENERATED_PDF_DOCUMENT" ADD CONSTRAINT "GENERATED_PDF_DOCUMENT_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "TEMPLATE_VERSION"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GENERATED_PDF_DOCUMENT" ADD CONSTRAINT "GENERATED_PDF_DOCUMENT_generated_by_fkey" FOREIGN KEY ("generated_by") REFERENCES "SYSTEM_USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GENERATED_PDF_DOCUMENT" ADD CONSTRAINT "GENERATED_PDF_DOCUMENT_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "SYSTEM_USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AUDIT_EVENT" ADD CONSTRAINT "AUDIT_EVENT_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "SYSTEM_USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
