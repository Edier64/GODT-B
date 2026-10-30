ALTER TABLE "OCR_PROCESSING_JOB"
  ADD CONSTRAINT "OCR_PROCESSING_JOB_attempt_number_positive"
  CHECK ("attempt_number" > 0);

ALTER TABLE "OCR_EXTRACTED_FIELD"
  ADD CONSTRAINT "OCR_EXTRACTED_FIELD_confidence_score_range"
  CHECK ("confidence_score" >= 0 AND "confidence_score" <= 1);

ALTER TABLE "OCR_EXTRACTED_FIELD"
  ADD CONSTRAINT "OCR_EXTRACTED_FIELD_validation_audit_consistency"
  CHECK (
    ("validation_status" = 'PENDIENTE' AND "validated_by" IS NULL AND "validated_at" IS NULL)
    OR
    ("validation_status" <> 'PENDIENTE' AND "validated_by" IS NOT NULL AND "validated_at" IS NOT NULL)
  );

ALTER TABLE "OCR_EXTRACTED_FIELD"
  ADD CONSTRAINT "OCR_EXTRACTED_FIELD_confirmed_value_consistency"
  CHECK (
    ("validation_status" IN ('CONFIRMADO', 'MODIFICADO') AND "confirmed_value" IS NOT NULL)
    OR
    ("validation_status" IN ('PENDIENTE', 'RECHAZADO'))
  );
