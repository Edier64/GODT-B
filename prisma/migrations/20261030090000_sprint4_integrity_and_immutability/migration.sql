-- Preserve the published definition and enforce same-instance current revisions.
ALTER TABLE "DOCUMENT_RESPONSE_REVISION"
  ADD CONSTRAINT "DOCUMENT_RESPONSE_REVISION_id_instance_key"
  UNIQUE ("id", "document_instance_id");

ALTER TABLE "DOCUMENT_INSTANCE"
  DROP CONSTRAINT "DOCUMENT_INSTANCE_current_revision_id_fkey";

ALTER TABLE "DOCUMENT_INSTANCE"
  ADD CONSTRAINT "DOCUMENT_INSTANCE_current_revision_instance_fkey"
  FOREIGN KEY ("current_revision_id", "id")
  REFERENCES "DOCUMENT_RESPONSE_REVISION" ("id", "document_instance_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "DOCUMENT_INSTANCE_current_revision_id_id_key"
  ON "DOCUMENT_INSTANCE" ("current_revision_id", "id");

ALTER TABLE "DOCUMENT_FIELD_PROVENANCE"
  ADD COLUMN "source_value" JSONB,
  ADD COLUMN "conflict_resolved_by" UUID,
  ADD COLUMN "conflict_resolved_at" TIMESTAMPTZ(6),
  ADD COLUMN "conflict_decision" VARCHAR(100),
  ADD COLUMN "conflict_justification" TEXT;

ALTER TABLE "DOCUMENT_FIELD_PROVENANCE"
  ADD CONSTRAINT "DOCUMENT_FIELD_PROVENANCE_conflict_resolved_by_fkey"
  FOREIGN KEY ("conflict_resolved_by") REFERENCES "SYSTEM_USER"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "prevent_published_template_version_update"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."status" = 'PUBLISHED' THEN
    RAISE EXCEPTION 'Published template versions are immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "template_version_published_immutable"
BEFORE UPDATE ON "TEMPLATE_VERSION"
FOR EACH ROW
EXECUTE FUNCTION "prevent_published_template_version_update"();
