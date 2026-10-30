CREATE UNIQUE INDEX "SOURCE_DOCUMENT_donor_id_sha256_hash_key"
ON "SOURCE_DOCUMENT"("donor_id", "sha256_hash");
