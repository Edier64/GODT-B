-- AlterTable
ALTER TABLE "DOCUMENT_INSTANCE" ADD COLUMN "process_document_id" UUID;

-- AlterTable
ALTER TABLE "DONATION_PROCESS" ADD COLUMN "package_version_id" UUID;

-- CreateTable
CREATE TABLE "PROCESS_PACKAGE" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "code" VARCHAR(100) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PROCESS_PACKAGE_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PROCESS_PACKAGE_VERSION" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "package_id" UUID NOT NULL,
    "version_number" VARCHAR(50) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
    "effective_from" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effective_to" TIMESTAMPTZ(6),
    "description" TEXT,
    "definition_hash" CHAR(64),
    "positions_config" JSONB NOT NULL,
    "created_by_id" UUID NOT NULL,
    "authorized_by_id" UUID,
    "published_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PROCESS_PACKAGE_VERSION_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PROCESS_DOCUMENT" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "process_id" UUID NOT NULL,
    "position_number" INTEGER NOT NULL,
    "document_code" VARCHAR(100) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "category" VARCHAR(100) NOT NULL,
    "status" VARCHAR(50) NOT NULL DEFAULT 'PENDIENTE',
    "applicability_status" VARCHAR(50) NOT NULL DEFAULT 'APLICABLE',
    "non_applicability_reason" TEXT,
    "is_mandatory" BOOLEAN NOT NULL DEFAULT true,
    "order_index" INTEGER NOT NULL,
    "rules" JSONB,
    "template_id" UUID,
    "template_version_id" UUID,
    "current_instance_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PROCESS_DOCUMENT_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PROCESS_PACKAGE_code_key" ON "PROCESS_PACKAGE"("code");

-- CreateIndex
CREATE INDEX "PROCESS_PACKAGE_VERSION_package_id_status_idx" ON "PROCESS_PACKAGE_VERSION"("package_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PROCESS_PACKAGE_VERSION_package_id_version_number_key" ON "PROCESS_PACKAGE_VERSION"("package_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "PROCESS_DOCUMENT_current_instance_id_key" ON "PROCESS_DOCUMENT"("current_instance_id");

-- CreateIndex
CREATE INDEX "PROCESS_DOCUMENT_process_id_status_idx" ON "PROCESS_DOCUMENT"("process_id", "status");

-- CreateIndex
CREATE INDEX "PROCESS_DOCUMENT_process_id_applicability_status_idx" ON "PROCESS_DOCUMENT"("process_id", "applicability_status");

-- CreateIndex
CREATE UNIQUE INDEX "PROCESS_DOCUMENT_process_id_position_number_key" ON "PROCESS_DOCUMENT"("process_id", "position_number");

-- CreateIndex
CREATE UNIQUE INDEX "PROCESS_DOCUMENT_process_id_document_code_key" ON "PROCESS_DOCUMENT"("process_id", "document_code");

-- CreateIndex
CREATE INDEX "DOCUMENT_INSTANCE_process_document_id_idx" ON "DOCUMENT_INSTANCE"("process_document_id");

-- CreateIndex
CREATE INDEX "DONATION_PROCESS_package_version_id_idx" ON "DONATION_PROCESS"("package_version_id");

-- AddForeignKey
ALTER TABLE "DONATION_PROCESS" ADD CONSTRAINT "DONATION_PROCESS_package_version_id_fkey" FOREIGN KEY ("package_version_id") REFERENCES "PROCESS_PACKAGE_VERSION"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DOCUMENT_INSTANCE" ADD CONSTRAINT "DOCUMENT_INSTANCE_process_document_id_fkey" FOREIGN KEY ("process_document_id") REFERENCES "PROCESS_DOCUMENT"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PROCESS_PACKAGE" ADD CONSTRAINT "PROCESS_PACKAGE_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "SYSTEM_USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PROCESS_PACKAGE_VERSION" ADD CONSTRAINT "PROCESS_PACKAGE_VERSION_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "PROCESS_PACKAGE"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PROCESS_PACKAGE_VERSION" ADD CONSTRAINT "PROCESS_PACKAGE_VERSION_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "SYSTEM_USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PROCESS_PACKAGE_VERSION" ADD CONSTRAINT "PROCESS_PACKAGE_VERSION_authorized_by_id_fkey" FOREIGN KEY ("authorized_by_id") REFERENCES "SYSTEM_USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PROCESS_DOCUMENT" ADD CONSTRAINT "PROCESS_DOCUMENT_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "DONATION_PROCESS"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PROCESS_DOCUMENT" ADD CONSTRAINT "PROCESS_DOCUMENT_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "DOCUMENT_TEMPLATE"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PROCESS_DOCUMENT" ADD CONSTRAINT "PROCESS_DOCUMENT_template_version_id_fkey" FOREIGN KEY ("template_version_id") REFERENCES "TEMPLATE_VERSION"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PROCESS_DOCUMENT" ADD CONSTRAINT "PROCESS_DOCUMENT_current_instance_id_fkey" FOREIGN KEY ("current_instance_id") REFERENCES "DOCUMENT_INSTANCE"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

