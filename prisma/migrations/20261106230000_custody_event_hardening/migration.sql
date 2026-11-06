-- AlterTable: Custody Event Hardening & Verification Audit
ALTER TABLE "CUSTODY_EVENT" ADD COLUMN "verified_at" TIMESTAMPTZ(6),
ADD COLUMN "verified_by_id" UUID,
ADD COLUMN "verifier_notes" TEXT,
ALTER COLUMN "integrity_verified" SET DEFAULT false;

-- AddForeignKey
ALTER TABLE "CUSTODY_EVENT" ADD CONSTRAINT "CUSTODY_EVENT_verified_by_id_fkey" FOREIGN KEY ("verified_by_id") REFERENCES "SYSTEM_USER"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
